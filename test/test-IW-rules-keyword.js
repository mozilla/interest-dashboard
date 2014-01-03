/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {testUtils} = require("./helpers");
const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
const Promise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

let testDomainRules = {
  "*.mozilla.org" : {
    "__PATH": {
      "/firefox": {
        "__ANY" : [
          "computers"
        ],

        "firefox": [
          "web"
        ],
      }
    }
  }
}

// the test array 
let matchTests = [
{
  info: "Match Test 1 (Rules): mozilla.org",
  url:  "http://www.mozilla.org/firefox",
  title: "Hello World Firefox",
  expectedInterests:  [{"type":"rules","interests":["computers","web"]},{"type":"combined","interests":["computers","web"]},{"type":"keywords","interests":[]}],
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
          testUtils.isIdentical(assert, msgData.results, expectedInterests);
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
      deferred = Promise.defer();

      let uri = NetUtil.newURI(test.url);
      let title = test.title;
      let host = uri.host;
      let path = uri.path;
      let tld = Services.eTLD.getBaseDomainFromHost(host);

      //console.log(test.info);

      expectedInterests = test.expectedInterests;
      worker.postMessage({
        message: "getInterestsForDocument",
        host: host,
        path: path,
        title: title,
        url: test.url,
        tld: tld
      });
      yield deferred.promise;
    }
  }).then(done);
}

require("sdk/test").run(exports);
