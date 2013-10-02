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
const {DataBucket} = require("DataBucket");
const {WorkerFactory} = require("WorkerFactory");
const {Pipeline} = require("Pipeline");
const {DayCountRanker} = require("DayCountRanker");
const {Annotator} = require("Annotator");
const {Dispatcher} = require("Dispatcher");
const {DateUtils} = require("DateUtils");
const {Surveyor} = require("Surveyor");
const {storage} = require("sdk/simple-storage");
const simplePrefs = require("simple-prefs")

const kDefaultRankNamespace = "edrules";
const kDefaultRankType = "combined";
const kDefaultServerAddress = simplePrefs.prefs.server_url || "https://postbin.paas.allizom.org/post";
//const kDefaultServerAddress = "http://localhost:8080/post";

XPCOMUtils.defineLazyServiceGetter(this, "uuid",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");
const KIdleDaily = "idle-daily";

function Controller() {
  let workerFactory = new WorkerFactory();

  this._workers = workerFactory.getCurrentWorkers();
  this._ranker = new DayCountRanker(kDefaultRankNamespace, kDefaultRankType);
  this._annotator = new Annotator();
  this._dispatcher = new Dispatcher(kDefaultServerAddress);
  this._pipeline = new Pipeline(this._ranker, this._annotator, this._dispatcher);
  this._taxonomy = workerFactory.getTaxonomyInterests(kDefaultRankNamespace);
  this._processingHistory = false;

  // set up daily-observer
  Services.obs.addObserver(this, KIdleDaily, false);
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
    this._ranker.clear();
    this._dispatcher.clear();
  },

  onUninstall: function() {
    this.clear();
    Services.obs.removeObserver(this,KIdleDaily);
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic == KIdleDaily) {
      // submit history - this will process history upto (but not including) today's date
      this.submitHistory(60);
    }
  },

  submitHistory: function(daysAgo,report) {
    // avoid multiple batch processing
    if (this._processingHistory) return;

    // set processingHistory flag and spawn processing
    this._processingHistory = true;
    return Task.spawn(function() {
      // submit history in daily chunks starting from storage.historyCurrentStartDay
      // the end day is today - which means that todays visits will not be submitted
      let today = DateUtils.today();
      if (storage.historyCurrentStartDay == null) {
        storage.historyCurrentStartDay = today - daysAgo;
      }
      let startDay = storage.historyCurrentStartDay;
      let lastVisitId = storage.lastVisitId || 0;
      while (startDay <= today) {
        if (report) {
          report(today - startDay);
        }
        let historyReader = new HistoryReader(this._workers, lastVisitId);
        yield historyReader.resubmitHistory({startDay: startDay, endDay: startDay+10}).then(datum => {
          if (datum != null) {
            return this._pipeline.push(datum);
          }
        });
        storage.historyCurrentStartDay = (startDay < today) ? startDay : today;
        storage.lastVisitId = historyReader.getLastVisitId();
        startDay+=10;
      }
    }.bind(this)).then(() => {
      Services.obs.notifyObservers(null, "controller-history-submission-complete", null);
      this._processingHistory = false;
    });
  },

  dispatchData: function() {
    return this._dispatcher._sendPing(kDefaultServerAddress).then();
  },

  resubmitFullHistory: function(cb) {
    storage.historyCurrentStartDay = DateUtils.today() - 60;
    storage.lastVisitId = 0;
    this._ranker.clear();
    return this.submitHistory(60,cb);
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

}

exports.Controller = Controller;
