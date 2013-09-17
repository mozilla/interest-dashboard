/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {testUtils} = require("./helpers");
const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
const Promise = require("sdk/core/promise");
const {data} = require("self");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
scriptLoader.loadSubScript(data.url("models/edrules/urlStopwords.js"));
scriptLoader.loadSubScript(data.url("models/edrules/textModel.js"));

let defaultMatchTests = [
  {
    info: "DefaultTextClassifier Test 1: polygon",
    url:  "http://www.polygon.com/2013/3/5/4066808/thief-screenshots-leak-next-gen",
    title: "Rumored images for new Thief game leak, reportedly in the works on next-gen platforms",
    expectedInterests:  [{"type":"rules","interests":[]},{"type":"keywords","interests":["Video-Games"]},{"type":"combined","interests":["Video-Games"]}],
  }
];

exports["test edrules text"] = function test_edrules_text(assert, done) {
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
        throw "ERROR_UNEXPECTED_MSG_TYPE " + aEvent.type;
      }
    } // end of handleEvent
  };

  let worker = testUtils.getWorker({
      namespace: "test-edrules-text",
      listener: workerTester,
      domainRules: null,
      textModel: interestsClassifierModel,
      urlStopWords: interestsUrlStopwords,
  });

  Task.spawn(function() {
    for (let test of defaultMatchTests) {
      deferred = Promise.defer();

      let uri = NetUtil.newURI(test.url);
      let title = test.title;
      let host = uri.host;
      let path = uri.path;
      let tld = Services.eTLD.getBaseDomainFromHost(host);

      console.log(test.info);

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

let riggedMatchTests = {
  interestsClassifierModel: {
    logPriors: [0.5, 0.5].map(Math.log),
    logLikelihoods: {

      foo: [0.8, 0.2].map(Math.log),
      qux: [0.8, 0.2].map(Math.log),
      quux: [0.8, 0.2].map(Math.log),

      bar: [0.2, 0.8].map(Math.log),
      baz: [0.2, 0.8].map(Math.log),
      xyzzy: [0.2, 0.8].map(Math.log),
    },
    classes: {
      0: "foo",
      1: "bar",
    }
  },
  tests: [
  {
    info: "RiggedTextClassifier Test 1: foo",
    url:  "http://example.com/testing/foo/qux",
    title: "biz baz quux",
    expectedInterests:  [{"type":"rules","interests":[]},{"type":"keywords","interests":["foo"]},{"type":"combined","interests":["foo"]}]
  },
  {
    info: "RiggedTextClassifier Test 2: bar",
    url:  "http://example.com/testing/bar/baz",
    title: "qux biz xyzzy",
    expectedInterests:  [{"type":"rules","interests":[]},{"type":"keywords","interests":["bar"]},{"type":"combined","interests":["bar"]}]
  },
  {
    info: "RiggedTextClassifier Test 3: both equally likely",
    url:  "http://example.com/testing/foo/qux",
    title: "bar baz",
    expectedInterests:  [{"type":"rules","interests":[]},{"type":"keywords","interests":["bar","foo"]},{"type":"combined","interests":["bar","foo"]}]
  },
  {
    info: "RiggedTextClassifier Test 4: no tokens",
    url:  "http://example.com/testing/",
    title: "no significant keyword",
    expectedInterests: [{"type":"rules","interests":[]},{"type":"keywords","interests":[]},{"type":"combined","interests":[]}]
  },
  {
    info: "RiggedTextClassifier Test 5: not enough tokens",
    url:  "http://example.com/testing/foo/bar",
    title: "not enough tokens",
    expectedInterests:  [{"type":"rules","interests":[]},{"type":"keywords","interests":[]},{"type":"combined","interests":[]}]
  }
  ]
}

exports["test text classifier"] = function test_text_classification(assert, done) {
  let deferred;
  let expectedInterests;

  let workerTester = {
    handleEvent: function(aEvent) {
      if (aEvent.type == "message") {
        let msgData = aEvent.data;
        if (msgData.message == "InterestsForDocument") {
          // make sure that categorization is correct 
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
      namespace: "test-text-classifier",
      listener: workerTester,
      domainRules: null,
      textModel: riggedMatchTests.interestsClassifierModel,
      urlStopWords: interestsUrlStopwords,
  });

  Task.spawn(function() {
    for (let test of riggedMatchTests.tests) {
      deferred = Promise.defer();

      let uri = NetUtil.newURI(test.url);
      let title = test.title;
      let host = uri.host;
      let path = uri.path;
      let tld = Services.eTLD.getBaseDomainFromHost(host)

      console.log(test.info);

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
