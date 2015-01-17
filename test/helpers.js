/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc, Ci, Cu, ChromeWorker,components} = require("chrome");
const {data} = require("sdk/self");
const oldPromise = require("sdk/core/promise");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/PlacesUtils.jsm");
Cu.import("resource://gre/modules/Task.jsm");

const {MICROS_PER_DAY} = require("DateUtils");
const {Controller} = require("Controller");

exports.testUtils = {
  do_check_eq : function do_check_eq(assert, actual, expected, text) {
    assert.equal(actual, expected, text);
  },

  compareArrayOrderIrrelevant : function checkEqualityOfTwoArrays() {
    //---why? Basically in the tests we have to compare an array of nested objects for equality. However, deepEqual takes
    //into account the order, which we don't care about here
    //---accepts: any number of arrays
    //---returns: true or false

    first_array = JSON.stringify(arguments[0].map(JSON.stringify).sort()) //take the first item from the array
    for(let i=1;i<arguments.length;i++){ //iterate through the rest of them
      if(JSON.stringify(arguments[i].map(JSON.stringify).sort()) != first_array){
        return false //if not equal, immediately break out of the loop and return
      }
    }
    return true //all must be equal, return true

  },

  itemsHave : function itemsHave(items, data) {
    for (let i in items) {
      if(items[i] == data) return true;
    }
    return false;
  },

  getWorker : function getWorker({namespace, domainRules, urlStopWords,
                                  listener, regionCode, domain_rules, host_rules, path_rules,
                                  words_tree, ignore_words, ignore_domains, ignore_exts, bad_domain_specific}) {
    let worker = new ChromeWorker(data.url("interests/interestsWorker.js"));
    worker.addEventListener("message", listener, false);
    worker.addEventListener("error", listener, false);
    worker.postMessage({
      command: "bootstrap",
      payload: {
        workerNamespace: namespace,
        workerRegionCode: regionCode || 'en-US',
        interestsDataType: "dfr",
        interestsData: domainRules,
        interestsUrlStopwords: urlStopWords,
        domain_rules: domain_rules,
        host_rules: host_rules,
        path_rules: path_rules,
        words_tree: words_tree,
        ignore_words: ignore_words,
        ignore_domains: ignore_domains,
        ignore_exts: ignore_exts,
        bad_domain_specific: bad_domain_specific
      }
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
    let deferred = oldPromise.defer();
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
  },

  addVisits: function(hosts, daysBack, skipToday) {
    let microNow = Date.now() * 1000;
    let microToday = Math.floor(microNow / MICROS_PER_DAY) * MICROS_PER_DAY;
    let promises = [];
    let last = (skipToday) ? 1 : 0;
    let hostArray = [];
    if (Array.isArray(hosts)) {
      hostArray = hosts;
    } else {
      hostArray.push(hosts);
    }
    for( let i = daysBack; i >= last; i--) {
      hostArray.forEach(host => {
        let rand = Math.floor(Math.random()*(MICROS_PER_DAY-10)) + 1;
        promises.push(this.promiseAddVisits({uri: NetUtil.newURI("http://"+host), visitDate: microToday - i*MICROS_PER_DAY + rand}));
      });
    }
    return oldPromise.promised(Array)(promises).then();
  },

  promiseTopicObserved: function(aTopic) {
    let deferred = oldPromise.defer();
    Services.obs.addObserver(
      function PTO_observe(aSubject, aTopic, aData) {
        Services.obs.removeObserver(PTO_observe, aTopic);
        deferred.resolve([aSubject, aData]);
      }, aTopic, false);

    return deferred.promise;
  },

  promiseClearHistory: function() {
    let promise = this.promiseTopicObserved(PlacesUtils.TOPIC_EXPIRATION_FINISHED);
    Task.spawn(function () {PlacesUtils.bhistory.removeAllPages();});
    return promise;
  },

  tsToDay: function(ts) {
    return Math.floor(ts / MICROS_PER_DAY);
  },

  setupTestController: function(options={}) {
    options.storage = options.storage || {};
    let testController = new Controller(options);
    return testController;
  },
};
