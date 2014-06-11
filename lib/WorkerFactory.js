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
const sLocaleData = {
  "zh-CN": {
    mainTaxonomyModel: "41-cat",
    rankersDef: [
      {type: "rules", namespace: "41-cat"},
      {type: "keywords", namespace: "41-cat"},
      {type: "combined", namespace: "41-cat"},
    ],
    modelNames: ["41-cat"],
    surveyEndPoint: "https://www.surveygizmo.com/s3/1545511/firefox-personalization-cn"
  },
  "en-US": {
    mainTaxonomyModel: "edrules",
    rankersDef: [
      {type: "rules", namespace: "edrules"},
      {type: "keywords", namespace: "edrules"},
      {type: "combined", namespace: "edrules"},
    ],
    modelNames: ["58-cat", "edrules", "edrules_extended"],
    surveyEndPoint: "https://www.surveygizmo.com/s3/1368483/firefox-personalization"
  },
};

function WorkerFactory() {
  this._taxonomies = {};

  // Try to use the appropriate locale and default to en-US
  this._localeCode = getUserAgentLocale();
  if (sLocaleData[this._localeCode] == null) {
    this._localeCode = "en-US";
  }
  this._localeData = sLocaleData[this._localeCode];
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
      let {mainTaxonomyModel} = this._localeData;
      scriptLoader.loadSubScript(data.url("models/" + this._localeCode + "/" + mainTaxonomyModel + "/localizedInterests.json"));
      this._localeData.localizedInterests = localizedInterests;
    }
    catch (e) {
    }
  },

  _setupWorker: function(modelName) {
    let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
    scriptLoader.loadSubScript(data.url("models/" + this._localeCode + "/" + modelName + "/domainRules.json"));
    scriptLoader.loadSubScript(data.url("models/" + this._localeCode + "/" + modelName + "/textModel.json"));
    // use the same url stop words
    scriptLoader.loadSubScript(data.url("models/urlStopwords.json"));

    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
    worker.postMessage({
      message: "bootstrap",
      workerRegionCode: this._localeCode,
      workerNamespace: modelName,
      interestsDataType: "dfr",
      interestsData: interestsData,
      interestsClassifierModel: interestsClassifierModel,
      interestsUrlStopwords: interestsUrlStopwords
    });

    if (modelName == this._localeData.mainTaxonomyModel) {
      this._taxonomies[modelName] = this._extractCategories(interestsData);
      this._mainModelDFR = interestsData;
    }

    return worker;
  },

  getCurrentWorkers: function() {
    let workers = [];
    let {modelNames} = this._localeData;
    modelNames.forEach(modelName => {
      workers.push(this._setupWorker(modelName));
    });
    return workers;
  },

  getRankersDefinitions: function() {
    return this._localeData.rankersDef;
  },

  getTaxonomyInterests: function() {
    return Object.keys(this._taxonomies[this._localeData.mainTaxonomyModel]);
  },

  getLocalizedInterests: function() {
    return this._localeData.localizedInterests;
  },

  getSurveyEndPoint: function() {
    return this._localeData.surveyEndPoint;
  },

  getMainModelDFR: function() {
    return this._mainModelDFR;
  },
}

exports.WorkerFactory = WorkerFactory;
