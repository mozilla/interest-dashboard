/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {testUtils} = require("./helpers");
const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
const OldPromise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

let testKeywords = {
  "__ANY": {
    "mozilla": {
        "technology & computing": 0.75,
        "computer programming": 0.5
      },
    "baseball": {"baseball": 0.95},
    "golf": {"golf": 0.9},
    "open source": {"computer programming": 0.7},
    "volkswagen,golf": {"automotive": 1},
    "volkswagen,golf,parts": {"auto parts": 1},
    "red,hat": { //http://www.e4hats.com/ribbon-band-wool-hat-red.html
       "unix": 0.5,
       "clothing": 0.5,
      },
    "red,hat,enterprise": { //http://en.wikipedia.org/wiki/Red_Hat_Enterprise_Linux_derivatives
        "unix": 1,
      },
  }
}

let testDomainRules = {
  "mozilla.org" : {
    "__ANY" : {
      "technology & computing": 0.8
    }
    ],
    "__HOST": [
      "phonebook": {"ignore": null}
    ],
    "__PATH": [
      "developer": {"computer programming": 0.9}
    ]
  },
}

// the test array
let matchTests = [
{
  info: "LICA Test 1: mozilla.org",
  url:  "http://www.mozilla.org/en-US",
  title: "Home of the Mozilla Project Ñ Mozilla",
  expectedDecision: ["technology & computing", "general"],
},
//{
//  info: "LICA Test 2: Red Hat Linux",
//  url:  "http://en.wikipedia.org/wiki/Red_Hat_Enterprise_Linux_derivatives",
//  title: "Red Hat Enterprise Linux derivatives - Wikipedia, the free encyclopedia",
//  expectedDecision: ["technology & computing", "unix"]
//},
//{
//  info: "LICA Test 3: Golf, the sport",
//  url:  "http://www.golfdigest.com/golf-courses/2013-02/100-greatest-public-courses",
//  title: "2013-14 Ranking: America's 100 Greatest Public Golf Courses : Golf Digest",
//  expectedDecision: ["sports", "golf"]
//},
//{
//  info: "LICA Test 4: Volkswagen Golf, the car",
//  url:  "http://www.vw.com/models/golf/",
//  title: "2015 VW Golf - The Versatile Compact Car | Volkswagen",
//  expectedDecision: ["automotive", "general"]
//},
]

exports["test default matcher"] = function test_default_matcher(assert, done) {
  let deferred;
  let expectedInterests;

  let workerTester = {
    handleEvent: function(aEvent) {
      if (aEvent.type == "message") {
        let msgData = aEvent.data;
        if (msgData.message == "InterestsForDocument") {
          // make sure that categorization is correct
          let host = msgData.host;
          console.log("msgData=> " + JSON.stringify(msgData.results))
          console.log("expectedDecision=> " + JSON.stringify(expectedDecision))
          assert.ok(msgData.Results == expectedDecision, "passed test 1");
          deferred.resolve();
        }
        else if (!(msgData.message in testUtils.kValidMessages)) {
          // unexpected message
          throw "ERROR_UNEXPECTED_MSG: " + msgData.message;
        }
      }
      else {
        throw "ERROR_UNEXPECTED_MSG_TYPE" + aEvent.type;
      }
    } // end of handleEvent
  };

  let worker = testUtils.getWorker({
      namespace: "test-Matching",
      listener: workerTester,
      domainRules: testDomainRules,
      textModel: null,
      urlStopWords: ['php', 'html']
  });

  Task.spawn(function() {
    for (let test of matchTests) {
      deferred = OldPromise.defer();

      let uri = NetUtil.newURI(test.url);
      let title = test.title;
      let host = uri.host;
      let path = uri.path;
      let baseDomain = Services.eTLD.getBaseDomainFromHost(host);

      expectedInterests = test.expectedInterests;
      worker.postMessage({
        command: "getInterestsForDocument",
        payload: {
          host: host,
          path: path,
          title: title,
          url: test.url,
          baseDomain: baseDomain
        }
      });
      yield deferred.promise;
    }
  }).then(done);
}

require("sdk/test").run(exports);
