/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {data} = require("sdk/self");
const {URL} = require("sdk/url");

const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const MS_PER_DAY = 86400000;

function WorkerFactory() {
  this._taxonomies = {};
}

WorkerFactory.prototype = {

  _extractCategories: function(ruleData) {
    let allCats = {};
    if (ruleData != null) {
      Object.keys(ruleData).forEach(domain => {
        Object.keys(ruleData[domain]).forEach(key => {
          let val = ruleData[domain][key];
          if (Array.isArray(val)) {
            val.forEach(cat => {
              allCats[cat] = 1;
            });
          }
          else {
            allCats[val] = 1;
          }
        });
      });
    }
    return allCats;
  },

  _setupEdRulesWorker: function() {
    let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
    scriptLoader.loadSubScript(data.url("models/edrules/domainRules.json"));
    scriptLoader.loadSubScript(data.url("models/edrules/textModel.json"));
    scriptLoader.loadSubScript(data.url("models/edrules/urlStopwords.json"));

    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
    worker.postMessage({
      message: "bootstrap",
      workerNamespace: "edrules",
      interestsDataType: "dfr",
      interestsData: interestsData,
      interestsClassifierModel: interestsClassifierModel,
      interestsUrlStopwords: interestsUrlStopwords
    });

    this._taxonomies["edrules"] = this._extractCategories(interestsData);
    return worker;
  },

  _setupEdRulesExtendedWorker: function() {
    let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
    scriptLoader.loadSubScript(data.url("models/edrules_extended/domainRules.json"));
    scriptLoader.loadSubScript(data.url("models/edrules_extended/textModel.json"));
    scriptLoader.loadSubScript(data.url("models/edrules/urlStopwords.json"));

    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
    worker.postMessage({
      message: "bootstrap",
      workerNamespace: "edrules_extended",
      interestsDataType: "dfr",
      interestsData: interestsData,
      interestsClassifierModel: interestsClassifierModel,
      interestsUrlStopwords: interestsUrlStopwords
    });

    return worker;
  },

  _setupEdRulesExtendedKeywordsWorker: function() {
    let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
    scriptLoader.loadSubScript(data.url("models/edrules_extended/domainRules.json"));
    scriptLoader.loadSubScript(data.url("models/edrules_extended/textModel.kw.json"));
    scriptLoader.loadSubScript(data.url("models/edrules/urlStopwords.json"));

    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
    worker.postMessage({
      message: "bootstrap",
      workerNamespace: "edrules_extended_kw",
      interestsDataType: "dfr",
      interestsData: interestsData,
      interestsClassifierModel: interestsClassifierModel,
      interestsUrlStopwords: interestsUrlStopwords
    });

    return worker;
  },

  _setup58CatWorker: function() {
    let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
    scriptLoader.loadSubScript(data.url("models/58-cat/domainRules.json"));
    scriptLoader.loadSubScript(data.url("models/58-cat/textModel.json"));
    scriptLoader.loadSubScript(data.url("models/58-cat/urlStopwords.json"));

    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
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

  getCurrentWorkers: function () {
    return [ this._setupEdRulesWorker(), this._setup58CatWorker(), this._setupEdRulesExtendedWorker(), this._setupEdRulesExtendedKeywordsWorker() ];
  },

  getTaxonomyInterests: function (namespace) {
    return Object.keys(this._taxonomies[namespace]);
  },

}

exports.WorkerFactory = WorkerFactory;
