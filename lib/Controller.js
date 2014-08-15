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
const {Dispatcher} = require("Dispatcher");
const {Stream} = require("streams/core");
const {DailyInterestsSpout} = require("streams/dailyInterestsSpout");
const {TotalKeywordCountBolt} = require("streams/totalKeywordCountBolt");
const {DayCountRankerBolt} = require("streams/dayCountRankerBolt");
const {HostStripBolt} = require("streams/hostStripBolt");
const {ChartDataProcessorBolt} = require("streams/chartDataProcessorBolt");
const {InterestDashboardDataProcessorBolt} = require("streams/interestDashboardDataProcessorBolt");
const {InterestStorageBolt} = require("streams/interestStorageBolt");
const {DateUtils} = require("DateUtils");
const {Surveyor} = require("Surveyor");
const {Crypto} = require("Crypto");
const {NYTimesHistoryVisitor} = require("NYTimesHistoryVisitor");
const {NYTUtils} = require("NYTUtils");
const {UrlClassifier} = require("UrlClassifier");
const {computeInterestsFromHosts} = require("Utils");

const simplePrefs = require("sdk/simple-prefs");
const {storage} = require("sdk/simple-storage");

const kDefaultResubmitHistoryDays = 30;

XPCOMUtils.defineLazyServiceGetter(this, "uuid",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");
const kIdleDaily = "idle-daily";

function Controller(options={}) {
  let historyDaysToResubmit = options.historyDays || kDefaultResubmitHistoryDays;
  this._workerFactory = new WorkerFactory();
  this._historyDaysToResubmit = historyDaysToResubmit;
  this._workers = this._workerFactory.getCurrentWorkers();
  this.storage = options.storage || storage;
  this._dispatcher = new Dispatcher(simplePrefs.prefs.server_url, {
    enabled: simplePrefs.prefs.consented,
    dispatchIdleDelay: simplePrefs.prefs.dispatchIdleDelay,
    storageBackend: this.storage,
  });
  this._urlClassifier = new UrlClassifier(this._workers.interests);

  this._processingHistory = false;

  this._streamObjects = this._initStream(options.storage);
  this._nytHistoryVisitor = new NYTimesHistoryVisitor(options.storage);
  this._nytUtils = new NYTUtils(options.storage);
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

    if (!this.storage.hasOwnProperty("downloadSource")) {
      this.storage.downloadSource = "unknown";
    }
  },

  _initStream: function _C__setupStream(storageBackend) {
    // setup stream workers
    let streamObjects = {
      dailyInterestsSpout: DailyInterestsSpout.create(storageBackend),
      totalKeywordCountBolt: TotalKeywordCountBolt.create(storageBackend),
      rankerBolts: DayCountRankerBolt.batchCreate(this._workerFactory.getRankersDefinitions(), storageBackend),
      hostStripBolt: HostStripBolt.create(),
      chartDataProcessorBolt: ChartDataProcessorBolt.create(),
      interestDashboardDataProcessorBolt: InterestDashboardDataProcessorBolt.create(),
      interestStorageBolt: InterestStorageBolt.create(storageBackend),
      stream: new Stream(),
    }
    let stream = streamObjects.stream;
    stream.addNode(streamObjects.dailyInterestsSpout, true);
    stream.addNode(streamObjects.totalKeywordCountBolt, true);
    streamObjects.rankerBolts.forEach(ranker => {
      stream.addNode(ranker);
    });
    stream.addNode(streamObjects.chartDataProcessorBolt);
    stream.addNode(streamObjects.interestDashboardDataProcessorBolt);
    stream.addNode(streamObjects.hostStripBolt);
    stream.addNode(streamObjects.interestStorageBolt);

    return streamObjects;
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
    this.storage.lastTimeStamp = 0;
    this.storage.downloadSource = null;
    this._streamObjects.dailyInterestsSpout.clear();
    this._streamObjects.interestStorageBolt.clearData();
    this._dispatcher.clear(); // TODO: remove?
    this._streamObjects.rankerBolts.forEach(ranker => {
      ranker.clearData();
    });
    this._nytHistoryVisitor.clear();
  },

  clearStorage: function() {
    console.debug("Controller.clearStorage");
    this.clear();
    delete this.storage.lastTimeStamp;
    delete this.storage.downloadSource;
    delete this.storage.installDate;
    delete this.storage.updateDate;
    delete this.storage.version;
    delete this.storage.tldCounter;
    delete this.storage.ranking;
    delete this.storage.nytUserInfo;
    delete this.storage.chartData;
    delete this.storage.domains;
    this._streamObjects.dailyInterestsSpout.clearStorage();
    this._dispatcher.clearStorage();
  },

  _fetchOnSubmit: function() {
    this._nytUtils.fetchNYTUserData();
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
    this._streamObjects.dailyInterestsSpout.setEmitCallback(options.report);

    // set processingHistory flag and spawn processing
    this._processingHistory = true;
    this._processingHistoryPromise = Task.spawn(function() {
      let startDay = DateUtils.today() - daysAgo;
      let lastTimeStamp = this.storage.lastTimeStamp || 0;
      this._currentReader = new HistoryReader(this._workers, this._streamObjects, lastTimeStamp);
      yield this._currentReader.resubmitHistory({startDay: startDay, historyVisitor: this._nytHistoryVisitor});
      this.storage.lastTimeStamp = this._currentReader.getLastTimeStamp();
      if (flush) {
        this._streamObjects.stream.flush();
      }
      // compute interests on progressive partiions of top moz_hosts
      if (!this._stop) {
        this._hostInterestsSlices = yield computeInterestsFromHosts(this._workerFactory.getMainModelDFR());
        this._dispatcher.addExtraParameterToPayload("mozhostsInterests", this._hostInterestsSlices);
      }
    }.bind(this)).then(() => {
      Services.obs.notifyObservers(null, "controller-history-submission-complete", null);
      this._processingHistory = false;
      this._currentReader = null;
      this._streamObjects.dailyInterestsSpout.setEmitCallback(null);
      console.debug("Controller.submitHistory: completed");
    });
    return this._processingHistoryPromise;
  },

  dispatchData: function() {
    return this._dispatcher._sendPing(simplePrefs.prefs.server_url).then();
  },

  resubmitHistory: function(options={}) {
    this.storage.lastTimeStamp = 0;
    this._streamObjects.rankerBolts.forEach(ranker => {
      ranker.clearData();
    });
    this._streamObjects.totalKeywordCountBolt.clearData();
    this._streamObjects.dailyInterestsSpout.clear();
    return this.submitHistory({daysAgo:this._historyDaysToResubmit, flush:options.flush, report:options.report});
  },

  getNextDispatchBatch: function() {
    return this._dispatcher.getPendingBatch();
  },

  getRankedInterests: function() {
    //return this._rankers[0].getRanking();
    // TODO is that what we want?
    return this._streamObjects.rankerBolts[0].getInterests();
  },

  /**
   * Return the top <code>limit</code> keywords for a user.
   * @returns an object with the text as key and the count as value
   */
  getTopKeywords: function(limit) {
    limit = limit || 250;
    let tokenCounts = {};
    for (let type in storage.keywordCounts) {
      tokenCounts[type] = [];
      for (let token in storage.keywordCounts[type]) {
        tokenCounts[type].push({key: token, value: storage.keywordCounts[type][token]});
      }
      tokenCounts[type].sort((a, b) => {
        return b.value - a.value;
      });
      tokenCounts[type] = tokenCounts[type].slice(0, limit);
    }
    return tokenCounts;
  },

  getRankedInterestsForSurvey: function(len=30) {
    return Surveyor.orderInterestsForSurvey(
             this._streamObjects.rankerBolts.map(ranker => {
              return ranker.getInterests();
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

  classifyPage: function(url, title) {
    return this._urlClassifier.classifyPage(url, title);
  },

  getHostComputedInterests: function() {
    return this._hostInterestsSlices;
  },

}

exports.Controller = Controller;
