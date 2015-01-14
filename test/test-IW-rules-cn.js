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
  "sina.com.cn" : {
    "__ANY": [
      "News"
    ],

    "bar. /video": [
      "Video"
    ],

    // 电视剧
    "bar. /video \u7535\u89C6\u5267": [
      "TV Series"
    ]
  }
};

// the test array
let matchTests = [
{
  info: "Match Test 1 (Rules): sina.com.cn",
  url:  "http://foo.bar.sina.com.cn/video?kw=aa",
  title: "电视剧影视频道",
  expectedInterests:  [{"type":"rules","interests":["News","Video","TV Series"]}],
}];

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
          assert.ok(testUtils.compareArrayOrderIrrelevant(msgData.results, expectedInterests), "interests match");
          deferred.resolve();
        }
        else if (!(msgData.message in testUtils.kValidMessages)) {
          // unexpected message
          throw "ERROR_UNEXPECTED_MSG: " + msgData.message;
        }
      }
      else {
        throw "ERROR_UNEXPECTED_MSG_TYPE: " + aEvent.type;
      }
    } // end of handleEvent
  };


  let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
  scriptLoader.loadSubScript(data.url("words.js"));
  scriptLoader.loadSubScript(data.url("rules.js"));

  let worker = testUtils.getWorker({
      namespace: "test-Matching",
      regionCode: 'zh-CN',
      listener: workerTester,
      domainRules: testDomainRules,
      urlStopWords: ['php', 'html'],
      domain_rules: domain_rules,
      host_rules: host_rules,
      path_rules: path_rules,
      words_tree: words_tree,
      ignore_words: ignore_words,
      ignore_domains: ignore_domains,
      ignore_exts: ignore_exts,
      bad_domain_specific: bad_domain_specific
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
