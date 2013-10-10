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
const {PrefsManager} = require("Application");
const simplePrefs = require("simple-prefs")

const kDefaultRankNamespace = "edrules";
const kDefaultRankType = "combined";

XPCOMUtils.defineLazyServiceGetter(this, "uuid",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");
const kIdleDaily = "idle-daily";

function Controller() {
  let workerFactory = new WorkerFactory();

  this._workers = workerFactory.getCurrentWorkers();
  this._ranker = new DayCountRanker(kDefaultRankNamespace, kDefaultRankType);
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
  
  // set up pref observers
  PrefsManager.dispatcher = this._dispatcher;
  PrefsManager.setObservers();
}

Controller.prototype = {

  init: function() {
    if (!storage.hasOwnProperty("uuid")) {
      // generate and store a UUID for this user agent if it doesn't exist
      storage.uuid = uuid.generateUUID().toString().slice(1, -1).replace(/-/g, "");
    }

    if (!storage.hasOwnProperty("downloadSource")) {
      storage.downloadSource = "unknown";
    }
  },

  clear: function() {
    storage.historyCurrentStartDay = null;
    storage.lastVisitId = 0;
    simplePrefs.prefs.consented = false;
    this._ranker.clear();
    this._dispatcher.clear();
  },

  onEnable: function() {
    PrefsManager.setObservers();
  },

  onDisable: function() {
    PrefsManager.unsetObservers();
  },

  onUninstall: function() {
    this.clear();
    Services.obs.removeObserver(this, kIdleDaily);
    PrefsManager.unsetObservers();
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic == kIdleDaily) {
      // submit history - this will process history upto (but not including) today's date
      this.submitHistory(60);
    }
  },

  submitHistory: function(daysAgo, doFlush) {
    // avoid multiple batch processing
    if (this._processingHistory) return;

    // set processingHistory flag and spawn processing
    this._processingHistory = true;
    return Task.spawn(function() {
      let startDay = DateUtils.today() - daysAgo;
      let lastVisitId = storage.lastVisitId || 0;
      let historyReader = new HistoryReader(this._workers, this._dayBuffer, lastVisitId);
      yield historyReader.resubmitHistory({startDay: startDay});
      storage.lastVisitId = historyReader.getLastVisitId();
      if (doFlush) {
        this._dayBuffer.flush();
      }
    }.bind(this)).then(() => {
      Services.obs.notifyObservers(null, "controller-history-submission-complete", null);
      this._processingHistory = false;
    });
  },

  dispatchData: function() {
    return this._dispatcher._sendPing(simplePrefs.prefs.server_url).then();
  },

  resubmitFullHistory: function(options={}) {
    storage.lastVisitId = 0;
    this._ranker.clear();
    this._dayBuffer.clear();
    this._dayBuffer.setReportCallback(options.report);
    return this.submitHistory(60, options.flush).then(() => {
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
    return storage.uuid;
  },

  setSourceUri: function(uri) {
    if (uri && uri.spec) {
      let spec = uri.spec;
      let source = "unknown";
      if (spec.contains("test-pilot")) {
        source = "test-pilot";
      }
      else if (spec.contains("partner")) {
        source = "partner";
      }
      else if (spec.contains("mechanical-turk")) {
        source = "mechanical-turk";
      }
      storage.downloadSource = source;
    }
  },

  getDownloadSource: function() {
    return storage.downloadSource;
  },

  recordConsent : function() {
    simplePrefs.prefs.consented = true;
  },

}

exports.Controller = Controller;
