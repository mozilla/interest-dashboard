/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");
const Promise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

const {DateUtils,MICROS_PER_DAY} = require("DateUtils");
const {testUtils} = require("./helpers");
const {NYTimesHistoryVisitor} = require("NYTimesHistoryVisitor");
const {WorkerFactory} = require("WorkerFactory");
const {HistoryReader, getTLDCounts} = require("HistoryReader");
const {DayBuffer} = require("DayBuffer");

const test = require("sdk/test");

const EXTRACT_TEST_CASES = [
  {
    path: "/foo/bar/index.html",
    expected: {
      path: "/foo/bar/index.html",
      "query":[]
    },
  },
  {
    path: "/foo",
    expected: {
      path: "/foo",
      "query":[]
    },
  },
  {
    path: "/",
    expected: {
      path: "/",
      "query":[]
    },
  },
  {
    path: "index.html",
    expected: {
      path: "index.html",
      "query":[]
    },
  },
  {
    path: "/index.html",
    expected: {
      path: "/index.html",
      "query":[]
    },
  },
  {
    path: "/foo/bar/title.html",
    expected: {
      path: "/foo/bar",
      "query":[]
    },
  },
  {
    path: "/2014/11/22/us/title.html",
    expected: {
      path: "/_DATE/us",
      "query":[]
    },
  },
  {
    path: "/2014/11/22/title.html",
    expected: {
      path: "/_DATE",
      "query":[]
    },
  },
  {
    path: "/2014/11/22/index.html",
    expected: {
      path: "/_DATE/index.html",
      "query":[]
    },
  },
  {
    path: "/2014/11/22/us/ca/title.html",
    expected: {
      path: "/_DATE/us/ca",
      "query":[]
    },
  },
  {
    path: "/us/index.html?hpw&hp&src=foo&moz_test=20&xyz=20&ref=us",
    expected: {
      path: "/us/index.html",
      "query":["hpw", "hp", "src=foo", "moz_test=20", "ref=us"]
    },
  },
  {
    path: "/us/index.html?hp&action=1&module=1&contentCollection=1",
    expected: {
      path: "/us/index.html",
      "query":["hp", "action=1", "module=1", "contentCollection=1"]
    },
  },
];

exports["test extractFromPath"] =
function test_ExtractFromPath(assert, done) {
  Task.spawn(function() {
    try {
      EXTRACT_TEST_CASES.forEach(testCase => {
        let obj = NYTimesHistoryVisitor._extractFromPath(testCase.path);
        testUtils.isIdentical(assert, obj, testCase.expected);
      });
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

let gWorkerFactory = new WorkerFactory();
let today = DateUtils.today();
let dayBuffer = new DayBuffer();

exports["test consumeHistoryVisit"] =
function test_ConsumeHistoryVisit(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.promiseAddVisits([
       {uri: NetUtil.newURI("http://www.nytimes.com")},
       {uri: NetUtil.newURI("http://world.nytimes.com/2014/11/11/x_y_z.html?ref=biz&moz_test=1")},
       {uri: NetUtil.newURI("http://www.nytimes.com/us/ca/index.html?hp")},
      ]);

      NYTimesHistoryVisitor.clear();

      let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(), dayBuffer, 0);
      yield historyReader.resubmitHistory({startDay: today-20, historyVisitor: NYTimesHistoryVisitor});
      let visits =  NYTimesHistoryVisitor.getVisits();

      assert.equal(visits[0].visitId, 1);
      assert.equal(visits[0].host, "nytimes.com");
      assert.ok(visits[0].timeStamp != null);

      assert.equal(visits[1].visitId, 2);
      assert.equal(visits[1].host, "world.nytimes.com");

      assert.equal(visits[2].visitId, 3);
      assert.equal(visits[2].host, "nytimes.com");

      NYTimesHistoryVisitor.clear();
      assert.ok(NYTimesHistoryVisitor.getVisits() == null);
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

test.run(exports);