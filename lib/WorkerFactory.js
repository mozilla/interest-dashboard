/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const timers = require("timers");
const {data} = require("self");
const {URL} = require("url");
const {PlacesInterestsUtils} = require("PlacesInterestsUtils");

const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const MS_PER_DAY = 86400000;

function WorkerFactory() {
}

WorkerFactory.prototype = {

  setupEdRulesWorker: function() {
    let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
    scriptLoader.loadSubScript(data.url("models/edrules/domainRules.js"));
    scriptLoader.loadSubScript(data.url("models/edrules/textModel.js"));
    scriptLoader.loadSubScript(data.url("models/edrules/urlStopwords.js"));

    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
    worker.addEventListener("message", this, false);
    worker.addEventListener("error", this, false);

    worker.postMessage({
      message: "bootstrap",
      workerNamespace: "edrules",
      interestsDataType: "dfr",
      interestsData: interestsData,
      interestsClassifierModel: interestsClassifierModel,
      interestsUrlStopwords: interestsUrlStopwords
    });

    return worker;
  },

  setup58CatWorker: function() {
    let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
    scriptLoader.loadSubScript(data.url("models/58-cat/domainRules.js"));
    scriptLoader.loadSubScript(data.url("models/58-cat/textModel.js"));
    scriptLoader.loadSubScript(data.url("models/58-cat/urlStopwords.js"));

    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
    worker.addEventListener("message", this, false);
    worker.addEventListener("error", this, false);

    worker.postMessage({
      message: "bootstrap",
      workerNamespace: "58-cat",
      interestsDataType: "dfr",
      interestsData: interestsData,
      interestsClassifierModel: interestsClassifierModel,
      interestsUrlStopwords: interestsUrlStopwords
    });

    return worker;
  },

  init: function() {
  },

  getWorkerForNamespace: function (namespace) {
    if (namespace == "edrules") {
      return this.setupEdRulesWorker();
    }
    else if (namespace == "58-cat") {
      return this.setup58CatWorker();
    }
  },

  getCurrentWorkers: function () {
    return [ this.setupEdRulesWorker(), this.setup58CatWorker() ];
  },

}

exports.WorkerFactory = WorkerFactory;
