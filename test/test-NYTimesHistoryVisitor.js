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
const {Stream} = require("streams/core");
const {DailyInterestsSpout} = require("streams/dailyInterestsSpout");
const {HostStripBolt} = require("streams/hostStripBolt");
const {InterestStorageBolt} = require("streams/interestStorageBolt");

const test = require("sdk/test");

function initStream(storageBackend) {
  // setup stream workers
  let streamObjects = {
    dailyInterestsSpout: DailyInterestsSpout.create(storageBackend),
    hostStripBolt: HostStripBolt.create(),
    interestStorageBolt: InterestStorageBolt.create(storageBackend),
    stream: new Stream(),
  }
  let stream = streamObjects.stream;
  stream.addNode(streamObjects.dailyInterestsSpout, true);
  stream.addNode(streamObjects.hostStripBolt);
  stream.addNode(streamObjects.interestStorageBolt);

  return streamObjects;
}

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
    path: "/?hp",
    expected: {
      path: "/",
      "query":["hp"]
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
      path: "/foo/bar/_TITLE",
      "query":[]
    },
  },
  {
    path: "/2014/11/22/us/title.html",
    expected: {
      path: "/_DATE/us/_TITLE",
      "query":[]
    },
  },
  {
    path: "/xyz/2014/11/22/us/title.html",
    expected: {
      path: "/xyz/_DATE/us/_TITLE",
      "query":[]
    },
  },
  {
    path: "/2014/11/22/title.html",
    expected: {
      path: "/_DATE/_TITLE",
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
      path: "/_DATE/us/ca/_TITLE",
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
  {
    path: "/2013/07/10/a-game-that-deals-in-personal-data/?_php=true&_type=blogs&_php=true&_type=blogs&_r=1",
    expected: {
      path: "/_DATE/_TITLE",
      "query":[]
    },
  },
  {
    path: "/2013/07/10/section-with-dash/title-with-dash",
    expected: {
      path: "/_DATE/section-with-dash/_TITLE",
      "query":[]
    },
  },
  {
    path: "/2009/07/10/section-with-dash/title-with-dash",
    expected: {
      path: "/_DATE/section-with-dash/_TITLE",
      "query":[]
    },
  },
  {
    path: "/1998/07/10/section-with-dash/title-with-dash",
    expected: {
      path: "/_DATE/section-with-dash/_TITLE",
      "query":[]
    },
  },
  {
    path: "/video/dining/100000002663579/the-women-in-the-kitchen.html",
    expected: {
      path: "/video/dining/_NUM/_TITLE",
      "query":[]
    },
  },
  {
    path: "/projects/2013/invisible-child/#/?chapt=2",
    expected: {
      path: "/projects/_NUM/_TITLE",
      "query":[]
    },
  },
];

exports["test extractFromPath"] =
function test_ExtractFromPath(assert, done) {
  Task.spawn(function() {
    try {
      let nytHV = new NYTimesHistoryVisitor({});
      EXTRACT_TEST_CASES.forEach(testCase => {
        let obj = nytHV._extractFromUrl("http://www.nytimes.com" + testCase.path);
        assert.deepEqual(obj, testCase.expected);
      });
    } catch (ex) {
      console.error(ex);
    }
  }).then(done);
}

let gWorkerFactory = new WorkerFactory();
let today = DateUtils.today();

exports["test consumeHistoryVisit"] =
function test_ConsumeHistoryVisit(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.promiseAddVisits([
       {uri: NetUtil.newURI("http://www.nytimes.com")},
       {uri: NetUtil.newURI("http://dealbook.nytimes.com/2014/11/11/x_y_z.html?ref=biz&moz_test=1")},
       {uri: NetUtil.newURI("http://autos.nytimes.com/2014/11/11/x_y_z.html?ref=biz&moz_test=1")},
       {uri: NetUtil.newURI("http://world.nytimes.com/2014/11/11/x_y_z.html?ref=biz&moz_test=1")},
       {uri: NetUtil.newURI("http://foo.bar.blogs.nytimes.com/us/ca/index.html?hp")},
       {uri: NetUtil.newURI("http://x.y.z.nytimes.com/2014/11/11/x_y_z.html?ref=biz&moz_test=1")},
       {uri: NetUtil.newURI("http://nytimes.com")},
      ]);


      let storageBackend = {};
      NYTimesHistoryVisitor.storage = storageBackend;
      let nytHV = new NYTimesHistoryVisitor(storageBackend);

      let streamObjects = initStream();
      let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(), streamObjects, 0, storageBackend);
      yield historyReader.resubmitHistory({startDay: today-20, historyVisitor: nytHV});
      let visits =  nytHV.getVisits();

      assert.equal(visits.length, 4);

      assert.equal(visits[0].visitId, 1);
      assert.equal(visits[0].host, "nytimes.com");
      assert.ok(visits[0].timeStamp != null);

      assert.equal(visits[1].visitId, 2);
      assert.equal(visits[1].host, "dealbook.nytimes.com");

      assert.equal(visits[2].visitId, 5);
      assert.equal(visits[2].host, "foo.bar.blogs.nytimes.com");

      assert.equal(visits[3].visitId, 7);
      assert.equal(visits[3].host, "nytimes.com");

      nytHV.clear();
      assert.ok(nytHV.getVisits() == null);

    } catch (ex) {
      console.error(ex);
    }
  }).then(done);
}

test.run(exports);
