/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc, Ci, Cu, ChromeWorker,components} = require("chrome");
const {data} = require("self");
const assert = require("test/assert");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/PlacesUtils.jsm");
let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);

exports.testUtils = {
  do_check_eq : function do_check_eq(assert, expected, actual) {
    assert.equal(expected, actual);
  },

  itemsHave : function itemsHave(items, data) {
    for (let i in items) {
      if(items[i] == data) return true;
    }
    return false;
  },

  isIdentical : function isIdentical(assert, expected, actual) {
    if (expected == null) {
      this.do_check_eq(assert, expected, actual);
    }
    else if (Array.isArray(expected)) {
      if (expected.length == actual.length) {
        for (let i = 0; i < expected.length; i++) {
          if (!this.isIdentical(assert,expected[i],actual[i])) {
            return false;
          }
        }
        return true;
      }
      else {
        return false;
      }
    }
    else if (typeof expected == "object") {
      // Make sure all the keys match up
      this.do_check_eq(assert, Object.keys(expected).sort() + "", Object.keys(actual).sort());

      // Recursively check each value individually
      Object.keys(expected).forEach(key => {
        this.isIdentical(assert, actual[key], expected[key]);
      });
    }
    else {
      this.do_check_eq(assert, expected, actual);
    }
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

  promiseAddVisits: function (aPlaceInfo)
  {
    let deferred = Promise.defer();
    let places = [];
    if (aPlaceInfo instanceof Ci.nsIURI) {
      places.push({ uri: aPlaceInfo });
    }
    else if (Array.isArray(aPlaceInfo)) {
      places = places.concat(aPlaceInfo);
    } else {
      places.push(aPlaceInfo)
    }

    // Create mozIVisitInfo for each entry.
    let now = Date.now();
    for (let i = 0; i < places.length; i++) {
      if (!places[i].title) {
        places[i].title = "test visit for " + places[i].uri.spec;
      }
      places[i].visits = [{
        transitionType: Ci.nsINavHistoryService.TRANSITION_LINK,
        visitDate: places[i].visitDate || (now++) * 1000,
        referrerURI: places[i].referrer
      }];
    }

    PlacesUtils.asyncHistory.updatePlaces(
      places,
      {
        handleError: function AAV_handleError(aResultCode, aPlaceInfo) {
          deferred.reject("Unexpected error in adding visits.");
        },
        handleResult: function () {},
        handleCompletion: function UP_handleCompletion() {
          deferred.resolve();
        }
      }
    );

    return deferred.promise;
  }
};
