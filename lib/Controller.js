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
const {storage} = require("sdk/simple-storage");
const simplePrefs = require("simple-prefs")

const kDefaultRankNamespace = "edrules";
const kDefaultRankType = "rules";
const kDefaultResubmitHistoryDays = 60;

XPCOMUtils.defineLazyServiceGetter(this, "uuid",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");
const kIdleDaily = "idle-daily";

function Controller(options={}) {
  let rankNamespace = options.rankNamespace || kDefaultRankNamespace;
  let rankType = options.rankType || kDefaultRankType;
  let historyDaysToResubmit = options.historyDays || kDefaultResubmitHistoryDays;
  let workerFactory = new WorkerFactory();

  this._historyDaysToResubmit = historyDaysToResubmit;
  this._workers = workerFactory.getCurrentWorkers();
  this._ranker = new DayCountRanker(rankNamespace, rankType);
  this._annotator = new Annotator();
  this._dispatcher = new Dispatcher(simplePrefs.prefs.server_url, {
    enabled: simplePrefs.prefs.consented,
    dispatchIdleDelay: simplePrefs.prefs.dispatchIdleDelay,
  });
  this._dayBuffer = new DayBuffer(new Pipeline(this._ranker, this._annotator, this._dispatcher));
  this._taxonomy = workerFactory.getTaxonomyInterests(kDefaultRankNamespace);
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

    if (!storage.hasOwnProperty("downloadSource")) {
      storage.downloadSource = "unknown";
    }
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
    this._ranker.clear();
    this._dispatcher.clear();
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
    this._dayBuffer.clearStorage();
    this._dispatcher.clearStorage();
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic == kIdleDaily) {
      // submit history - this will process history upto (but not including) today's date
      this.submitHistory(this._historyDaysToResubmit);
    }
  },

  submitHistory: function(options={}) {
    console.debug("Controller.submitHistory: started");
    let daysAgo = options.daysAgo || this._historyDaysToResubmit;
    let flush = options.flush;

    // avoid multiple batch processing
    if (this._processingHistory) return;

    // set processingHistory flag and spawn processing
    this._processingHistory = true;
    this._processingHistoryPromise = Task.spawn(function() {
      let startDay = DateUtils.today() - daysAgo;
      let lastTimeStamp = storage.lastTimeStamp || 0;
      this._currentReader = new HistoryReader(this._workers, this._dayBuffer, lastTimeStamp);
      yield this._currentReader.resubmitHistory({startDay: startDay});
      storage.lastTimeStamp = this._currentReader.getLastTimeStamp();
      if (flush) {
        this._dayBuffer.flush();
      }
    }.bind(this)).then(() => {
      Services.obs.notifyObservers(null, "controller-history-submission-complete", null);
      this._processingHistory = false;
      this._currentReader = null;
      console.debug("Controller.submitHistory: completed");
    });
    return this._processingHistoryPromise;
  },

  dispatchData: function() {
    return this._dispatcher._sendPing(simplePrefs.prefs.server_url).then();
  },

  resubmitHistory: function(options={}) {
    storage.lastTimeStamp = 0;
    this._ranker.clear();
    this._dayBuffer.clear();
    this._dayBuffer.setReportCallback(options.report);
    return this.submitHistory({daysAgo:this._historyDaysToResubmit, flush:options.flush}).then(() => {
      this._dayBuffer.setReportCallback(null);
    });
  },

  getNextDispatchBatch: function() {
    return this._dispatcher.getPendingBatch();
  },

  getRankedInterests: function() {
    return this._ranker.getRanking();
  },

  getRankedInterestsForSurvey: function() {
    return Surveyor.orderInterestsForSurvey(this.getRankedInterests(), this._taxonomy);
  },

  getUserID: function() {
    return simplePrefs.prefs.uuid;
  },

  recordConsent : function() {
    simplePrefs.prefs.consented = true;
  },

}

exports.Controller = Controller;
