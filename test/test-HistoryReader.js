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
const test = require("sdk/test");

let gWorkerFactory = new WorkerFactory();

exports["test HistoryReader sanity"] = function test_HistoryReaderSanity(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits("www.autoblog.com",20);
      let today = DateUtils.today();

      let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(), 0);
      let bucket = yield historyReader.resubmitHistory({startDay: today-20});
      let datum = bucket.getInterests();
      let dates = Object.keys(datum);
      assert.equal(dates.length,21);
      testUtils.isIdentical(assert, datum[today + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
      testUtils.isIdentical(assert, datum[(today-20) + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
      assert.equal(historyReader.getLastVisitId(), 21);

      // only read starting from id == 10
      historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),10);
      bucket = yield historyReader.resubmitHistory({startDay: today-20});
      datum = bucket.getInterests();
      dates = Object.keys(datum);
      assert.equal(dates.length,11);
      testUtils.isIdentical(assert, datum[today + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
      testUtils.isIdentical(assert, datum[(today-10) + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
      assert.ok(datum[(today-11) + ""] == null);
      assert.equal(historyReader.getLastVisitId(), 21);

      // now set chunksize to 1
      historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),10);
      bucket = yield historyReader.resubmitHistory({startDay: today-20},1);
      let newDatum = bucket.getInterests();
      testUtils.isIdentical(assert, datum, newDatum);
      assert.equal(historyReader.getLastVisitId(), 21);

      // finally test aggregation
      let microNow = Date.now() * 1000;
      yield testUtils.promiseClearHistory();
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 4*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});

      historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),0);
      bucket = yield historyReader.resubmitHistory({startDay: today-20},1);
      datum = bucket.getInterests();
      dates = Object.keys(datum);
      assert.equal(dates.length,3);
      testUtils.isIdentical(assert, datum[(today-4) + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
      testUtils.isIdentical(assert, datum[(today-3) + ""].rules.edrules, {"Autos":{"autoblog.com":2}});
      testUtils.isIdentical(assert, datum[(today-2) + ""].rules.edrules, {"Autos":{"autoblog.com":3}});

    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

test.run(exports);
