/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu,ChromeWorker} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const {HistoryReader} = require("HistoryReader");
const {WorkerFactory} = require("WorkerFactory");
const {StudyApp} = require("Application");
const {Stream} = require("streams/core");
const {DailyInterestsSpout} = require("streams/dailyInterestsSpout");
const {DayCountRankerBolt} = require("streams/dayCountRankerBolt");
const {ChartDataProcessorBolt} = require("streams/chartDataProcessorBolt");
const {SpiderDataProcessorBolt} = require("streams/spiderDataProcessorBolt");
const {InterestDashboardDataProcessorBolt} = require("streams/interestDashboardDataProcessorBolt");
const {DateUtils} = require("DateUtils");
const {UrlClassifier} = require("UrlClassifier");
const {computeInterestsFromHosts} = require("Utils");

const simplePrefs = require("sdk/simple-prefs");
const {storage} = require("sdk/simple-storage");
const {data} = require("sdk/self");

const kDefaultResubmitHistoryDays = 30;

function Controller(options={}) {
  let historyDaysToResubmit = options.historyDays || kDefaultResubmitHistoryDays;
  this._workerFactory = new WorkerFactory();
  this._historyDaysToResubmit = historyDaysToResubmit;
  this._workers = this._workerFactory.getCurrentWorkers();
  this.storage = options.storage || storage;
  this._urlClassifier = new UrlClassifier(this._workers.interests);

  this._processingHistory = false;
  this._streamObjects = this._initStream(options.storage);
  this._init();
}

Controller.prototype = {

  _init: function __init() {
    if (!this.storage.hasOwnProperty("downloadSource")) {
      this.storage.downloadSource = "unknown";
    }
  },

  _initStream: function _C__setupStream(storageBackend) {
    // setup stream workers
    let streamObjects = {
      dailyInterestsSpout: DailyInterestsSpout.create(storageBackend),
      rankerBolts: DayCountRankerBolt.batchCreate(this._workerFactory.getRankersDefinitions(), storageBackend),
      chartDataProcessorBolt: ChartDataProcessorBolt.create(),
      spiderDataProcessorBolt: SpiderDataProcessorBolt.create(),
      interestDashboardDataProcessorBolt: InterestDashboardDataProcessorBolt.create(),
      stream: new Stream(),
    }
    let stream = streamObjects.stream;
    stream.addNode(streamObjects.dailyInterestsSpout, true);
    streamObjects.rankerBolts.forEach(ranker => {
      stream.addNode(ranker);
    });
    stream.addNode(streamObjects.chartDataProcessorBolt);
    stream.addNode(streamObjects.spiderDataProcessorBolt);
    stream.addNode(streamObjects.interestDashboardDataProcessorBolt);

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
    this._streamObjects.rankerBolts.forEach(ranker => {
      ranker.clearData();
    });
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
    delete this.storage.interests;
    delete this.storage.chartData;
    delete this.storage.domains;
    this._streamObjects.dailyInterestsSpout.clearStorage();
  },

  submitHistory: function(options={}) {
    // avoid multiple batch processing
    if (this._processingHistory) return;

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
      yield this._currentReader.resubmitHistory({startDay: startDay});
      this.storage.lastTimeStamp = this._currentReader.getLastTimeStamp();
      if (flush) {
        this._streamObjects.stream.flush();
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

  resubmitHistory: function(options={}) {
    this.storage.lastTimeStamp = 0;
    this._streamObjects.rankerBolts.forEach(ranker => {
      ranker.clearData();
    });
    this._streamObjects.dailyInterestsSpout.clear();
    return this.submitHistory({daysAgo:this._historyDaysToResubmit, flush:options.flush, report:options.report});
  },

  getSurveyEndPoint: function() {
    return this._workerFactory.getSurveyEndPoint();
  },

  classifyPage: function(url, title) {
    return this._urlClassifier.classifyPage(url, title);
  },

}

exports.Controller = Controller;
