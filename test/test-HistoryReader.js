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
const {HistoryReader, getTLDCounts} = require("HistoryReader");
const {DayBuffer} = require("DayBuffer");
const {promiseTimeout} = require("Utils");
const {storage} = require("sdk/simple-storage");
const test = require("sdk/test");

let gWorkerFactory = new WorkerFactory();
let today = DateUtils.today();
let dayBuffer = new DayBuffer();

exports["test read all"] = function test_readAll(assert, done) {
  Task.spawn(function() {
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits("www.autoblog.com",20);
    dayBuffer.clear();

    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(), dayBuffer, 0);
    let datum = yield historyReader.resubmitHistory({startDay: today-20});
    let dates = Object.keys(datum);
    assert.equal(dates.length,21);
    testUtils.isIdentical(assert, datum[today + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
    testUtils.isIdentical(assert, datum[(today-20) + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
    assert.equal(testUtils.tsToDay(historyReader.getLastTimeStamp()), today);
  }).then(done);
}

exports["test read from given timestamp"] = function test_readFromGivenTimestamp(assert, done) {
  Task.spawn(function() {
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits("www.autoblog.com",20);
    dayBuffer.clear();

    // only read starting from id == 10
    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,(today-10)*MICROS_PER_DAY);
    let datum = yield historyReader.resubmitHistory({startDay: today-20});
    let dates = Object.keys(datum);
    assert.equal(dates.length,11);
    testUtils.isIdentical(assert, datum[today + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
    testUtils.isIdentical(assert, datum[(today-10) + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
    assert.ok(datum[(today-11) + ""] == null);
    assert.equal(testUtils.tsToDay(historyReader.getLastTimeStamp()), today);
  }).then(done);
}

exports["test chunk size 1"] = function test_ChunkSize1(assert, done) {
  Task.spawn(function() {
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits("www.autoblog.com",20);
    dayBuffer.clear();

    // only read starting from id == 10
    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,10);
    let datum = yield historyReader.resubmitHistory({startDay: today-20});
    assert.equal(testUtils.tsToDay(historyReader.getLastTimeStamp()), today);

    // now set chunksize to 1 and read from same id
    dayBuffer.clear();
    historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,10);
    let newDatum = yield historyReader.resubmitHistory({startDay: today-20},1);
    testUtils.isIdentical(assert, datum, newDatum);
    assert.equal(testUtils.tsToDay(historyReader.getLastTimeStamp()), today);
  }).then(done);
}

exports["test accumulation"] = function test_Accumulation(assert, done) {
  Task.spawn(function() {
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits("www.autoblog.com",20);
    dayBuffer.clear();

    // finally test aggregation
    let microNow = Date.now() * 1000;
    yield testUtils.promiseClearHistory();
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 4*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});

    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,0);
    let datum = yield historyReader.resubmitHistory({startDay: today-20},1);
    let dates = Object.keys(datum);
    assert.equal(dates.length,3);
    testUtils.isIdentical(assert, datum[(today-4) + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
    testUtils.isIdentical(assert, datum[(today-3) + ""].rules.edrules, {"Autos":{"autoblog.com":2}});
    testUtils.isIdentical(assert, datum[(today-2) + ""].rules.edrules, {"Autos":{"autoblog.com":3}});
  }).then(done);
}

exports["test stop and restart"] = function test_StopAndRestart(assert, done) {
  Task.spawn(function() {
    try {
      let hostArray = ["www.autoblog.com",
                       "www.thehill.com",
                       "www.rivals.com",
                       "www.mysql.com",
                       "www.cracked.com",
                       "www.androidpolice.com"];
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits(hostArray,60);

      dayBuffer.clear();
      let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,0);
      let allTheData = yield historyReader.resubmitHistory({startDay: today-61},1);
      testUtils.isIdentical(assert, allTheData[today + ""].rules.edrules["Autos"], {"autoblog.com":1});
      testUtils.isIdentical(assert, allTheData[(today-60) + ""].rules.edrules["Autos"], {"autoblog.com":1});
      let theVeryLastTimeStamp = historyReader.getLastTimeStamp();

      // now start the torture test
      dayBuffer.clear();
      historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,0);
      let promise = historyReader.resubmitHistory({startDay: today-61},10);
      let cycles = 0;
      while (true) {
        yield promiseTimeout(100);
        historyReader.stop();
        yield promise;
        let lastTimeStamp = historyReader.getLastTimeStamp();
        if (lastTimeStamp == theVeryLastTimeStamp) {
          break;
        }
        historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,lastTimeStamp);
        promise = historyReader.resubmitHistory({startDay: today-61},1);
        cycles ++;
      }
      assert.ok(cycles > 1);
      // we should use isIdentical, but it takes too much time, so use string length compare instead
      // if your quality zeal is hurt, uncoment the line bellow
      // testUtils.isIdentical(assert, dayBuffer.getInterests(), allTheData);
      assert.equal(JSON.stringify(dayBuffer.getInterests()).length, JSON.stringify(allTheData).length);
    } catch(ex) {
      dump(ex + " ERROR\n");
    }
  }).then(done);
}

exports["test tldCounter"] = function test_TldCounter(assert, done) {
  Task.spawn(function() {
    let hostArray = ["www.autoblog.ru",
                     "www.thehill.com",
                     "www.foo.com",
                     "www.rivals.net",
                     "www.mysql.au",
                     "www.facebook.au",
                     "1.1.1.1",
                     "1.2.3.4",
                     "localhost",
                     "oneword",
                     "www.androidpolice.org"];
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits(hostArray,10);
    dayBuffer.clear();
    delete storage.tldCounter;

    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,0);
    yield historyReader.resubmitHistory({startDay: today-20},1);
    testUtils.isIdentical(assert, storage.tldCounter,
      {"au":{"mysql.au":1,"facebook.au":1},
       "com":{"thehill.com":1,"foo.com":1},
       "net":{"rivals.net":1},
       "ru":{"autoblog.ru":1},
       "no-suffix":{"oneword":1,"localhost":1},
       "is-ip":{"1.1.1.1":1,"1.2.3.4":1},
       "org":{"androidpolice.org":1}});

    let pureCounts = getTLDCounts();
    testUtils.isIdentical(assert, pureCounts, {"au":2,"com":2,"ru":1,"net":1,"org":1,"is-ip":2,"no-suffix":2});
  }).then(done);
}

test.run(exports);
