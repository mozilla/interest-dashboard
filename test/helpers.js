/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
const {data} = require("self");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");
let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);

function MockWorkerListener() {};

MockWorkerListener.prototype = {
  handleEvent: function(aEvent) {
    let eventType = aEvent.type;
    if (eventType == "message") {
      let msgData = aEvent.data;
      if (msgData.message == "InterestsForDocument") {
        this._handleInterestsResults(msgData);
      }
    }
    else if (eventType == "error") {
      //TODO:handle error
      Cu.reportError(aEvent.message);
    }
  },
}

exports.testUtils = {
  do_check_eq : function do_check_eq(expected, actual) {
    assert.deepEqual(expected, actual);
  },

  itemsHave : function itemsHave(items, data) {
    for (let i in items) {
      if(items[i] == data) return true;
    }
    return false;
  },

  isIdentical : function isIdentical(expected, actual) {
    if (expected == null) {
      this.do_check_eq(expected, actual);
    }
    else if (typeof expected == "object") {
      // Make sure all the keys match up
      this.do_check_eq(Object.keys(expected).sort() + "", Object.keys(actual).sort());

      // Recursively check each value individually
      Object.keys(expected).forEach(key => {
        this.isIdentical(actual[key], expected[key]);
      });
    }
    else {
      this.do_check_eq(expected, actual);
    }
  },

  getWorkerListener : function getWorkerListener() {
    return MockWorkerListener();
  },

  getWorker : function getWorker({namespace, domainRules, textModel, urlStopWords, listener}) {
    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
    worker.addEventListener("message", listener, false);
    worker.addEventListener("error", listener, false);
    worker.postMessage({
      message: "bootstrap",
      workerNamespace: namespace,
      interestsDataType: "dfr",
      interestsData: domainRules,
      interestsClassifierModel: textModel,
      interestsUrlStopwords: urlStopWords
    });
    return worker;
  },

  kValidMessages : {
    "bootstrapComplete": true,
    "InterestsForDocumentRules": true,
    "InterestsForDocumentText": true,
    "InterestsForDocument": true
  },
};
