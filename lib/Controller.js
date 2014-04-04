/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const {HistoryReader} = require("HistoryReader");
const {WorkerFactory} = require("WorkerFactory");
const {Pipeline} = require("Pipeline");
const {DayCountRanker} = require("DayCountRanker");
const {Annotator} = require("Annotator");
const {Dispatcher} = require("Dispatcher");
const {DateUtils} = require("DateUtils");
const {DayBuffer} = require("DayBuffer");
const {Surveyor} = require("Surveyor");
const {Crypto} = require("Crypto");
const {NYTimesHistoryVisitor} = require("NYTimesHistoryVisitor");
const {NYTUtils} = require("NYTUtils");
const {computeInterestsFromHosts} = require("Utils");

const simplePrefs = require("sdk/simple-prefs");
const {storage} = require("sdk/simple-storage");

const kDefaultResubmitHistoryDays = 60;

XPCOMUtils.defineLazyServiceGetter(this, "uuid",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");
const kIdleDaily = "idle-daily";

function Controller(options={}) {
  let historyDaysToResubmit = options.historyDays || kDefaultResubmitHistoryDays;
  this._workerFactory = new WorkerFactory();
  this._historyDaysToResubmit = historyDaysToResubmit;
  this._workers = this._workerFactory.getCurrentWorkers();
  this._rankers = this._makeRankers();
  this._annotator = new Annotator();
  this._dispatcher = new Dispatcher(simplePrefs.prefs.server_url, {
    enabled: simplePrefs.prefs.consented,
    dispatchIdleDelay: simplePrefs.prefs.dispatchIdleDelay,
  });

  this._dayBuffer = new DayBuffer(new Pipeline(this._rankers, this._annotator, this._dispatcher));
  this._processingHistory = false;

  // set up idle-daily observer
  Services.obs.addObserver(this, kIdleDaily, false);

  this._init();
}

Controller.prototype = {

  _init: function __init() {
    if (!simplePrefs.prefs.uuid) {
      // generate and store a UUID for this user agent if it doesn't exist
      simplePrefs.prefs.uuid = uuid.generateUUID().toString().slice(1, -1).replace(/-/g, "");
    }
    this._dispatcher.addExtraParameterToPayload("personalizeOn", this.mayPersonalize());

    if (!storage.hasOwnProperty("downloadSource")) {
      storage.downloadSource = "unknown";
    }
  },

  _makeRankers: function() {
    let rankers = [];
    this._workerFactory.getRankersDefinitions().forEach(def => {
      rankers.push(new DayCountRanker(def.namespace, def.type));
    });
    return rankers;
  },

  stopAndClearStorage: function() {
    // when addon is uninstalled by the Application
    // the addonManager seems to unload the code
    // immediately, thus making this.stop().then()
    // cause an exception. It apears that when
    // _processingHistoryPromise resolves, this.stop()
    // no longer exists. Changing to stop and clearStorage
    // with no waiting on a promise.
    this.stop();
    this.clearStorage();
  },

  stop: function() {
    console.debug("Controller.stop");
    Services.obs.removeObserver(this,kIdleDaily);
    this._stop = true;
    if (this._currentReader != null) {
      this._currentReader.stop();
    }
    return this._processingHistoryPromise;
  },

  clear: function() {
    console.debug("Controller.clear");
    // Storage is cleared, simple.prefs survive uninstalls
    storage.lastTimeStamp = 0;
    storage.downloadSource = null;
    this._dayBuffer.clear();
    this._dispatcher.clear();
    this._rankers.forEach(ranker => {
      ranker.clear();
    });
    NYTimesHistoryVisitor.clear();
  },

  clearStorage: function() {
    console.debug("Controller.clearStorage");
    this.clear();
    delete storage.lastTimeStamp;
    delete storage.downloadSource;
    delete storage.installDate;
    delete storage.updateDate;
    delete storage.version;
    delete storage.tldCounter;
    delete storage.ranking;
    delete storage.nytUserInfo;
    this._dayBuffer.clearStorage();
    this._dispatcher.clearStorage();
  },

  _fetchOnSubmit: function() {
    NYTUtils.fetchNYTUserData();
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic == kIdleDaily) {
      // submit history - this will process history upto (but not including) today's date
      this.submitHistory(this._historyDaysToResubmit).then(_ => {
        this._dispatcher.setObserveIdle();
      });
    }
  },

  submitHistory: function(options={}) {
    // avoid multiple batch processing
    if (this._processingHistory) return;

    // call _fetchOnSubmit() to start async data collection in background
    // controller.submit() is called on startup and idle-daily events
    // fetching data (like NYT user status) should happend along with submit
    this._fetchOnSubmit();

    console.debug("Controller.submitHistory: started");
    let daysAgo = options.daysAgo || this._historyDaysToResubmit;
    let flush = options.flush;
    this._dayBuffer.setReportCallback(options.report);

    // set processingHistory flag and spawn processing
    this._processingHistory = true;
    this._processingHistoryPromise = Task.spawn(function() {
      let startDay = DateUtils.today() - daysAgo;
      let lastTimeStamp = storage.lastTimeStamp || 0;
      this._currentReader = new HistoryReader(this._workers, this._dayBuffer, lastTimeStamp);
      yield this._currentReader.resubmitHistory({startDay: startDay, historyVisitor: NYTimesHistoryVisitor});
      storage.lastTimeStamp = this._currentReader.getLastTimeStamp();
      if (flush) {
        this._dayBuffer.flush();
      }
      // compute interests on progressive partiions of top moz_hosts
      if (!this._stop) {
        this._hostInterestsSlices = yield computeInterestsFromHosts(this._workerFactory.getMainModelDFR());
      }
    }.bind(this)).then(() => {
      Services.obs.notifyObservers(null, "controller-history-submission-complete", null);
      this._processingHistory = false;
      this._currentReader = null;
      this._dayBuffer.setReportCallback(null);
      console.debug("Controller.submitHistory: completed");
    });
    return this._processingHistoryPromise;
  },

  dispatchData: function() {
    return this._dispatcher._sendPing(simplePrefs.prefs.server_url).then();
  },

  resubmitHistory: function(options={}) {
    storage.lastTimeStamp = 0;
    this._rankers.forEach(ranker => {
      ranker.clear();
    });
    this._dayBuffer.clear();
    return this.submitHistory({daysAgo:this._historyDaysToResubmit, flush:options.flush, report:options.report});
  },

  getNextDispatchBatch: function() {
    return this._dispatcher.getPendingBatch();
  },

  getRankedInterests: function() {
    return this._rankers[0].getRanking();
  },

  getRankedInterestsForSurvey: function(len=30) {
    return Surveyor.orderInterestsForSurvey(
             this._rankers.map(ranker => {
              return ranker.getRanking();
             }),
             this._workerFactory.getTaxonomyInterests(),
             len,
             this._workerFactory.getLocalizedInterests());
  },

  getSurveyEndPoint: function() {
    return this._workerFactory.getSurveyEndPoint();
  },

  getUserInterests: function() {
    let interests = Crypto.uuidGetMappedInterests(simplePrefs.prefs.uuid);
    // return encrypted interests if they exist for uuid
    // otherwise fallback to getRankedInterests
    return (interests != null) ? interests : this.getRankedInterests();
  },

  getUserID: function() {
    return simplePrefs.prefs.uuid;
  },

  mayPersonalize: function() {
    return ((simplePrefs.prefs.uuid.charCodeAt(0) % 2) != 0);
  },

  getHostComputedInterests: function() {
    return this._hostInterestsSlices;
  },
}

exports.Controller = Controller;
