/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {testUtils} = require("./helpers");
const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
const oldPromise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

let testDomainRules = {
  "mozilla.org" : {
    "__ANY" : [
      "computers"
    ]
  },
  "noaa.gov" : {
    "nws." : [
      "government",
      "weather",
      "science",
    ]
  },
  "news.com" : {
    "__HOME" : [
      "news_home"
    ],
    "__ANY" : [
      "news"
    ]
  },
  "testpathdomain.com" : {
    "/code": [
      "programming"
    ],

    "/code cplusplus": [
      "oop"
    ],
  },
  "stack.com": {
    "/code /js": [
      "js"
    ]
  },
  "google.com" : {
    "app.": [
      "app"
    ],
    "/real_estate": [
      "real estate"
    ],
  },
  "__ANY" : {
    "/golf": [
      "golf"
    ],
    "golf.": [
      "golf"
    ]
  },
}

// the test array
let matchTests = [
{
  info: "Match Test 1 (Rules): mozilla.org",
  url:  "http://www.mozilla.org",
  title: "Hello World",
  expectedInterests:  [{"type":"rules","interests":["computers"]},{"type":"combined","interests":["computers"]},{"type":"keywords","interests":[]},],
},
{
  info: "Match Test 2 (Rules): weather gov",
  url:  "http://nws.noaa.gov",
  title: "Hello World",
  expectedInterests:  [{"type":"rules","interests":["government","weather","science"]},{"type":"combined","interests":["government","weather","science"]},{"type":"keywords","interests":[]}],
},
{
  info: "Match Test 3 (Rules): mail.google.com example",
  url:  "https://mail.google.com/mail/u/0/?ui=2&shva=1#inbox?compose=13e0005db4a0d0d4",
  title: "",
  expectedInterests: [{"type":"rules","interests":[]},{"type":"keywords","interests":[]},{"type":"combined","interests":[]}],
},
{
  info: "Match Test 4 (Rules): www.news.com home url",
  url:  "https://www.news.com",
  title: "",
  expectedInterests: [{"type":"rules","interests":["news","news_home"]},{"type":"combined","interests":["news","news_home"]},{"type":"keywords","interests":[]}],
},
{
  info: "Match Test 5 (Rules): www.news.com page url",
  url:  "https://www.news.com/page_url",
  title: "",
  expectedInterests: [{"type":"rules","interests":["news"]},{"type":"combined","interests":["news"]},{"type":"keywords","interests":[]}],
},
{
  info: "Match Test 6 (Rules): www.news.com query url",
  url:  "https://www.news.com?page=1",
  title: "",
  expectedInterests: [{"type":"rules","interests":["news","news_home"]},{"type":"combined","interests":["news","news_home"]},{"type":"keywords","interests":[]}],
},
{
  info: "Match Test 7 (Rules): www.testpathdomain.com query url",
  url:  "https://www.testpathdomain.com/code?qw=aa",
  title: "CPlusPlus programming",
  expectedInterests: [{"type":"rules","interests":["programming","oop"]},{"type":"combined","interests":["programming","oop"]},{"type":"keywords","interests":[]}],
},
{
  info: "Match Test 8 (Rules): www.stack.com query url",
  url:  "https://www.stack.com/code/js?qw=aa",
  title: "js programming",
  expectedInterests: [{"type":"rules","interests":["js"]},{"type":"combined","interests":["js"]},{"type":"keywords","interests":[]}],
},
{
  info: "Match Test 9 (Rules): __ANY golf",
  url:  "https://www.stack.com/golf/js?qw=aa",
  title: "js programming",
  expectedInterests: [{"type":"rules","interests":["golf"]},{"type":"combined","interests":["golf"]},{"type":"keywords","interests":[]}],
},
{
  info: "Match Test 10 (Rules): .app",
  url:  "https://app.dev.google.com/",
  title: "js programming",
  expectedInterests: [{"type":"rules","interests":["app"]},{"type":"combined","interests":["app"]},{"type":"keywords","interests":[]}],
},
{
  info: "Match Test 11 (Rules): real_estate",
  url:  "https://dev.google.com/real_estate/",
  title: "js programming",
  expectedInterests: [{"type":"rules","interests":["real estate"]},{"type":"combined","interests":["real estate"]},{"type":"keywords","interests":[]}],
},
{
  info: "Match Test 12 (Rules): golf subdomain",
  url:  "https://golf.google.com/",
  title: "tornament",
  expectedInterests: [{"type":"rules","interests":["golf"]},{"type":"combined","interests":["golf"]},{"type":"keywords","interests":[]}],
},
];

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
          console.log("expectedInterests=> " + JSON.stringify(expectedInterests))
          assert.ok(testUtils.compareArrayOrderIrrelevant(msgData.results, expectedInterests), "interests match");
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
      deferred = oldPromise.defer();

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
