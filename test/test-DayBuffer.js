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
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - MICROS_PER_DAY});

      let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(), dayBuffer, 0);
      let datum = yield historyReader.resubmitHistory({startDay: today-20},1);
      // we should have yesterday in the datum
      assert.ok(datum[(today-1)+""] != null);
      // and we should have the day before yesterday pushed
      assert.ok(pushedData[(today-2)+""] != null);
      dayBuffer.flush();
      // check that the we pushed yesterday data
      assert.ok(pushedData[(today-1)+""] != null);
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
      dayBuffer.clear();

      let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,0);
      let datum = yield historyReader.resubmitHistory({startDay: today-20},1);
      // make sure that today's data is in the dayBuffer
      assert.ok(datum[today+""] != null);
      // make sure that today's data is not in the pushedData
      assert.ok(pushedData[today+""] == null);
      // make sure the past visits are still in the bucket
      assert.ok(pushedData["" + (today-1)] != null);
      assert.ok(pushedData["" + (today-2)] != null);
      // keep adding to todays visits
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});
      pushedData = null;

      let lastVisitId = historyReader.getLastVisitId();
      historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,lastVisitId);
      datum = yield historyReader.resubmitHistory({startDay: today-20},1);

      // push data should be NULL as we did not see the future yet
      assert.ok(pushedData == null);
      // we should see 3 visits accumulate for today
      testUtils.isIdentical(assert,datum[today+""]["rules"]["edrules"], {"Autos":{"autoblog.com":3}});

      // time to move to the future
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow + MICROS_PER_DAY});
      lastVisitId = historyReader.getLastVisitId();

      historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,lastVisitId);
      datum = yield historyReader.resubmitHistory({startDay: today-20},10);

      // we now should see the the accumulated last day in the pushData
      testUtils.isIdentical(assert,pushedData[today+""]["rules"]["edrules"], {"Autos":{"autoblog.com":4}});
      testUtils.isIdentical(assert, datum[(today+1)+""]["rules"]["edrules"], {"Autos":{"autoblog.com":1}});

      // now flush
      dayBuffer.flush();
      testUtils.isIdentical(assert, pushedData[(today+1)+""]["rules"]["edrules"], {"Autos":{"autoblog.com":1}});

    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

test.run(exports);
