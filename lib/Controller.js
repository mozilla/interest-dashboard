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

function Controller() {
  this.workerFactory = new WorkerFactory();
  this.dataBucket = new DataBucket();
}

Controller.prototype = {

  init: function() {
    this.dataBucket.init();
  },

  readHistoryFromStart: function() {
    // populate workers
    let historyReader = new HistoryReader( this.workerFactory.getCurrentWorkers() );
    return historyReader.resubmitHistory();
  },

  submitHistory: function() {
    return this.readHistoryFromStart();
  },

}

exports.Controller = Controller;
