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
const {WorkerFactory} = require("WorkerFactory");
const {HistoryReader} = require("HistoryReader");
const {DayBuffer} = require("DayBuffer");
const {Pipeline} = require("Pipeline");
const test = require("sdk/test");

let gWorkerFactory = new WorkerFactory();
let today = DateUtils.today();
let pushedData;
let testConsumer = {
  consume: function _consume(bucketData) {
    pushedData = bucketData;
  },
};
let dayBuffer = new DayBuffer(new Pipeline(testConsumer));
let microNow = Date.now() * 1000;

exports["test past visits"] = function test_PastVisits(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});

      let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),0);
      let bucket = yield historyReader.resubmitHistory({startDay: today-20},1);
      dayBuffer.consume(bucket);
      // check that the we pushed the full bucket
      testUtils.isIdentical(assert, bucket.getInterests(), pushedData);
      assert.ok(dayBuffer.getLastDrop() == null);
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

exports["test today visits"] = function test_TodayVisits(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});
      let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),0);
      let bucket = yield historyReader.resubmitHistory({startDay: today-20},1);
      dayBuffer.consume(bucket);
      // make sure that today's data is not in the pushedData
      assert.ok(pushedData[today+""] == null);
      // make sure the past visits are still in the bucket
      assert.ok(pushedData["" + (today-1)] != null);
      assert.ok(pushedData["" + (today-2)] != null);
      // check the last drop
      assert.ok(dayBuffer.getLastDrop().date, today + "");
      testUtils.isIdentical(assert, bucket.getInterests()[today +""], dayBuffer.getLastDrop().day);

      // keep adding to todays visits
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});

      let lastVisitId = historyReader.getLastVisitId();
      historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),lastVisitId);
      bucket = yield historyReader.resubmitHistory({startDay: today-20},1);

      // we should only see 2 visits in the bucket
      testUtils.isIdentical(assert,bucket.getInterests()[today+""]["rules"]["edrules"], {"Autos":{"autoblog.com":2}});
      // now push
      pushedData = null;
      dayBuffer.consume(bucket);
      // verify that pushedData is still null
      assert.ok(pushedData == null);
      // and make shure that the lastDrop day data is kosher
      assert.ok(dayBuffer.getLastDrop().date, today + "");
      testUtils.isIdentical(assert, dayBuffer.getLastDrop().data["rules"]["edrules"], {"Autos":{"autoblog.com":3}});

      // time to move to the future
      DateUtils.sendIntoFuture(1);
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow + MICROS_PER_DAY});
      lastVisitId = historyReader.getLastVisitId();

      historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),lastVisitId);
      bucket = yield historyReader.resubmitHistory({startDay: today-20},10);
      dayBuffer.consume(bucket);

      // we now should see the the accumulated last day in the pushData
      testUtils.isIdentical(assert,pushedData[today+""]["rules"]["edrules"], {"Autos":{"autoblog.com":4}});
      assert.ok(dayBuffer.getLastDrop().date, (today+1) + "");
      testUtils.isIdentical(assert, dayBuffer.getLastDrop().data["rules"]["edrules"], {"Autos":{"autoblog.com":1}});

      // now flush
      dayBuffer.flush();
      testUtils.isIdentical(assert, pushedData[(today+1)]["rules"]["edrules"], {"Autos":{"autoblog.com":1}});

    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

test.run(exports);
