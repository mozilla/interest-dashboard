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

const {getUserAgentLocale} = require("Utils");

const MS_PER_DAY = 86400000;
const INTEREST_LOCALES = {
  "zh-CN": {
    mainTaxonomyModel: "41-cat",
    rankersDef: [
      {type: "rules", namespace: "41-cat"}
    ],
    modelNames: ["41-cat"],
  },
  "en-US": {
    mainTaxonomyModel: "dfr_rules",
    rankersDef: [
      {type: "rules", namespace: "edrules"}
    ],
    modelNames: ["58-cat", "edrules", "edrules_extended", "dfr_rules"],
  },
};

function WorkerFactory() {
  this._taxonomies = {};

  // Try to use the appropriate locale and default to en-US
  this._localeCode = getUserAgentLocale();
  if (INTEREST_LOCALES[this._localeCode] == null) {
    this._localeCode = "en-US";
  }
  this._interestLocaleData = INTEREST_LOCALES[this._localeCode];
  this._readLocalizedInterests();
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

  _readLocalizedInterests: function() {
    try {
      let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
      let {mainTaxonomyModel} = this._interestLocaleData;
      scriptLoader.loadSubScript(data.url("models/" + this._localeCode + "/" + mainTaxonomyModel + "/localizedInterests.js"));
      this._interestLocaleData.localizedInterests = localizedInterests;
    }
    catch (e) {
    }
  },

  _setupInterestsWorker: function(modelName) {
    let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
    scriptLoader.loadSubScript(data.url("models/" + this._localeCode + "/" + modelName + "/domainRules.js"));
    // use the same url stop words
    scriptLoader.loadSubScript(data.url("models/urlStopwords.js"));

    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
    worker.postMessage({
      command: "bootstrap",
      payload: {
        workerRegionCode: this._localeCode,
        workerNamespace: modelName,
        interestsDataType: "dfr",
        interestsData: interestsData,
        interestsUrlStopwords: interestsUrlStopwords,
      }
    });

    if (modelName == this._interestLocaleData.mainTaxonomyModel) {
      this._taxonomies[modelName] = this._extractCategories(interestsData);
      this._mainModelDFR = interestsData;
    }

    return worker;
  },

  getInterestsWorkers: function() {
    let workers = [];
    let {modelNames} = this._interestLocaleData;
    modelNames.forEach(modelName => {
      workers.push(this._setupInterestsWorker(modelName));
    });
    return workers;
  },

  getCurrentWorkers: function() {
    return {
      interests: this.getInterestsWorkers(),
    }
  },

  getRankersDefinitions: function() {
    return this._interestLocaleData.rankersDef;
  },

  getTaxonomyInterests: function() {
    return Object.keys(this._taxonomies[this._interestLocaleData.mainTaxonomyModel]);
  },

  getLocalizedInterests: function() {
    return this._interestLocaleData.localizedInterests;
  },

  getMainModelDFR: function() {
    return this._mainModelDFR;
  },
}

exports.WorkerFactory = WorkerFactory;
