/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {testUtils} = require("./helpers");
const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
const {data} = require("sdk/self");
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
    "/realestate": [
      "real estate"
    ],
  },
  "__ANY" : {
    "/golf": [
      "golf",
    ],
    "golf.": [
      ["tiger", 0.7],
      ["foo", 0.5],
    ],
    "frontline": [
      "test"
    ],
    "travel_u": [
      "travel"
    ],
    "foo_u": [
       "foo"
    ],
    "bar_t": [
       "bar"
    ],
  },
  "__SCOPES": [
    {
      "__HOSTS": {
        "blast.com": true,
        "heavy.blast2.com": true,
        "super.heavy.blast3.com": true,
      },
      "__ANY": {
          "ebola_t": [ "science"],
      },
    },
    {
      "__HOSTS": {
        "blast4.com": true,
      },
      "__ANY": {
          "bank_t": [ "banking"],
      },
    },
  ],
}

// the test array
let matchTests = [
{
  info: "Match Test 1 (Rules): mozilla.org",
  url:  "http://www.mozilla.org",
  title: "Hello World",
  expectedInterests:  [{"type":"rules","interests":[{"category":"computers","subcat":"general"}]}],
},
{
  info: "Match Test 2 (Rules): weather gov",
  url:  "http://nws.noaa.gov",
  title: "Hello World",
  expectedInterests:  [{"type":"rules","interests":[{"category":"government","subcat":"general"},{"category":"weather","subcat":"general"},{"category":"science","subcat":"general"}]}],
},
{
  info: "Match Test 3 (Rules): mail.google.com example",
  url:  "https://mail.google.com/mail/u/0/?ui=2&shva=1#inbox?compose=13e0005db4a0d0d4",
  title: "",
  expectedInterests: [{"type":"rules","interests":[{"category":"uncategorized","subcat":"dummy"}]}],
},
{
  info: "Match Test 4 (Rules): www.news.com home url",
  url:  "https://www.news.com",
  title: "",
  expectedInterests: [{"type":"rules","interests":[{"category":"news","subcat":"general"},{"category":"news_home","subcat":"general"}]}],
},
{
  info: "Match Test 5 (Rules): www.news.com page url",
  url:  "https://www.news.com/page_url",
  title: "",
  expectedInterests: [{"type":"rules","interests":[{"category":"news","subcat":"general"}]}],
},
{
  info: "Match Test 6 (Rules): www.news.com query url",
  url:  "https://www.news.com?page=1",
  title: "",
  expectedInterests: [{"type":"rules","interests":[{"category":"news","subcat":"general"},{"category":"news_home","subcat":"general"}]}],
},
{
  info: "Match Test 7 (Rules): www.testpathdomain.com query url",
  url:  "https://www.testpathdomain.com/CODE?qw=aa",
  title: "CPlusPlus programming",
  expectedInterests: [{"type":"rules","interests":[{"category":"programming","subcat":"general"},{"category":"oop","subcat":"general"}]}],
},
{
  info: "Match Test 8 (Rules): www.stack.com query url",
  url:  "https://www.stack.com/code/js?qw=aa",
  title: "js programming",
  expectedInterests: [{"type":"rules","interests":[{"category":"js","subcat":"general"}]}],
},
{
  info: "Match Test 9 (Rules): __ANY golf",
  url:  "https://www.stack.com/golf/js?qw=aa",
  title: "js programming",
  expectedInterests: [{"type":"rules","interests":[{"category":"golf","subcat":"general"}]}],
},
{
  info: "Match Test 10 (Rules): .app",
  url:  "https://app.dev.google.com/",
  title: "js programming",
  expectedInterests: [{"type":"rules","interests":[{"category":"app","subcat":"general"}]}],
},
{
  info: "Match Test 11 (Rules): real_estate",
  url:  "https://dev.google.com/real_estate/",
  title: "js programming",
  expectedInterests: [{"type":"rules","interests":[{"category":"real estate","subcat":"general"}]}],
},
{
  info: "Match Test 12 (Rules): golf subdomain",
  url:  "https://golf.google.com/golf",
  title: "tornament",
  expectedInterests: [{"type":"rules","interests":[{"category":"golf","subcat":"general"},{"category":"tiger","subcat":"general"}]}],
},
{
  info: "Match Test 13 (Rules): frontline bigram",
  url:  "https://google.com",
  title: "front line",
  expectedInterests: [{"type":"rules","interests":[{"category":"test","subcat":"general"}]}],
},
{
  info: "Match Test 14 (Rules): travel in subdomain",
  url:  "https://travel.google.com",
  title: "travel",
  expectedInterests: [{"type":"rules","interests":[{"category":"travel","subcat":"general"}]}],
},
{
  info: "Match Test 15 (Rules): travel in path",
  url:  "https://google.com/travel",
  title: "travel",
  expectedInterests: [{"type":"rules","interests":[{"category":"travel","subcat":"general"}]}],
},
{
  info: "Match Test 16 (Rules): travel in query",
  url:  "https://google.com/search?q=travel",
  title: "travel",
  expectedInterests: [{"type":"rules","interests":[{"category":"travel","subcat":"general"}]}],
},
{
  info: "Match Test 17 (Rules): travel in title",
  url:  "https://google.com/search?q=zumbaHoo",
  title: "travel",
  expectedInterests: [{"type":"rules","interests":[{"category":"uncategorized","subcat":"dummy"}]}],
},
{
  info: "Match Test 18 (Rules): foo in URL",
  url:  "http://us.cnn.com/2014/11/16/foo/xyz",
  title: "G20 summit",
  expectedInterests: [{"type":"rules","interests":[{"category":"foo","subcat":"general"}]}],
},
{
  info: "Match Test 19 (Rules): bar in title",
  url:  "http://us.cnn.com/xxx",
  title: "G20 bar summit",
  expectedInterests: [{"type":"rules","interests":[{"category":"bar","subcat":"general"}]}],
},
{
  info: "Match Test 20 (Rules): scoped rule application",
  url:  "http://little.blast.com",
  title: "ebola rules",
  expectedInterests: [{"type":"rules","interests":[{"category":"science","subcat":"general"}]}],
},
{
  info: "Match Test 21 (Rules): scoped rule application",
  url:  "http://little.blast3.com",
  title: "ebola rules",
  expectedInterests: [{"type":"rules","interests":[{"category":"uncategorized","subcat":"dummy"}]}],
},
{
  info: "Match Test 22 (Rules): scoped rule application",
  url:  "http://heavy.blast2.com",
  title: "ebola rules",
  expectedInterests: [{"type":"rules","interests":[{"category":"science","subcat":"general"}]}],
},
{
  info: "Match Test 23 (Rules): scoped rule application",
  url:  "http://super.heavy.blast3.com",
  title: "ebola rules",
  expectedInterests: [{"type":"rules","interests":[{"category":"science","subcat":"general"}]}],
},
{
  info: "Match Test 24 (Rules): scoped rule application",
  url:  "http://super.heavy.blast4.com",
  title: "bank rules",
  expectedInterests: [{"type":"rules","interests":[{"category":"banking","subcat":"general"}]}],
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
          if (!testUtils.compareArrayOrderIrrelevant(msgData.results, expectedInterests)) {
            console.log("msgData=> " + JSON.stringify(msgData.results))
            console.log("expectedInterests=> " + JSON.stringify(expectedInterests))
          }
          assert.ok(testUtils.compareArrayOrderIrrelevant(msgData.results, expectedInterests), msgData.info);
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
          baseDomain: baseDomain,
          info: test.info
        }
      });
      yield deferred.promise;
    }
  }).then(done);
}

require("sdk/test").run(exports);
