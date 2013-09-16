/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const timers = require("timers");
const {data} = require("self");
const {URL} = require("url");

const {Cc,Ci,Cm,Cr,Cu} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const {HistoryReader} = require("HistoryReader");
const {DataBucket} = require("DataBucket");
const {WorkerFactory} = require("WorkerFactory");
const {Pipeline} = require("Pipeline");
const {DayCountRanker} = require("DayCountRanker");
const {Annotator} = require("Annotator");
const {Dispatcher} = require("Dispatcher");
const {DateUtils} = require("DateUtils");
const {storage} = require("sdk/simple-storage");

const kDefaultRankNamespace = "edrules";
const kDefaultRankType = "combined";
const kDefaultServerAddress = "https://postbin.paas.allizom.org/post";

const KIdleDaily = "idle-daily";

function Controller() {
  this.workerFactory = new WorkerFactory();
  this.dataBucket = new DataBucket();

  this._ranker = new DayCountRanker(kDefaultRankNamespace, kDefaultRankType);
  this._annotator = new Annotator();
  this._dispatcher = new Dispatcher(kDefaultServerAddress);
  this.pipeline = new Pipeline(this._ranker, this._annotator, this._dispatcher);

  Services.obs.addObserver(this, KIdleDaily, false);
}

Controller.prototype = {

  init: function() {
  },

  observe: function(aSubject, aTopic, aData)
  {
    if (aTopic == KIdleDaily) {
      // submit history - this will process history upto (but not including) today's date
      this.submitHistory();
    }
  },

  submitHistory: function() {
    return Task.spawn(function() {
      let historyReader = new HistoryReader( this.workerFactory.getCurrentWorkers() );
      // submit history in daily chunks starting from storage.historyCurrentStartDay
      // the end day is today - which means that todays visits will not be submitted
      let today = DateUtils.today();
      if (storage.historyCurrentStartDay == null) {
        storage.historyCurrentStartDay = today - 120;
      }
      let startDay = storage.historyCurrentStartDay;
      while (startDay < today) {
        yield historyReader.resubmitHistory({startDay: startDay, endDay: startDay+1}).then(datum => {
          if (datum != null) {
            return this.pipeline.push(datum);
          }
        });
        startDay++;
        storage.historyCurrentStartDay = startDay;
      }
    }.bind(this));
  },

  resubmitFullHistory: function() {
    storage.historyCurrentStartDay = DateUtils.today() - 120;
    this._ranker.clear();
    return this.submitHistory();
  },

  getHistoryData: function() {
    return this._dispatcher.getHistoryData();
  },

}

exports.Controller = Controller;
