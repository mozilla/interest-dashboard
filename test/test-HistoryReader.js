/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
const oldPromise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

const {DateUtils,MICROS_PER_DAY} = require("DateUtils");
const {testUtils} = require("./helpers");
const {WorkerFactory} = require("WorkerFactory");
const {HistoryReader, getTLDCounts} = require("HistoryReader");
const {promiseTimeout} = require("Utils");
const {Stream} = require("streams/core");
const {DayCountRankerBolt} = require("streams/dayCountRankerBolt");
const {DailyInterestsSpout} = require("streams/dailyInterestsSpout");
const {ChartDataProcessorBolt} = require("streams/chartDataProcessorBolt");
const {getPlacesHostForURI, getBaseDomain} = require("Utils");
const test = require("sdk/test");
const {data} = require("sdk/self");

let gWorkerFactory = new WorkerFactory();
let today = DateUtils.today();

const { pathFor } = require('sdk/system');
const path = require('sdk/fs/path');
const file = require('sdk/io/file');

function initStream(storageBackend) {
  // setup stream workers
  let streamObjects = {
    dailyInterestsSpout: DailyInterestsSpout.create(storageBackend),
    chartDataProcessorBolt: ChartDataProcessorBolt.create(storageBackend),
    rankerBolts: DayCountRankerBolt.batchCreate(gWorkerFactory.getRankersDefinitions(), storageBackend),
    stream: new Stream(),
  }
  let stream = streamObjects.stream;
  stream.addNode(streamObjects.dailyInterestsSpout, true);
  streamObjects.rankerBolts.forEach(ranker => {
    stream.addNode(ranker);
  });
  stream.addNode(streamObjects.chartDataProcessorBolt);

  return streamObjects;
}

function daysPostEpochToDate(dayCount) {
  return parseInt(dayCount) * 24 * 60 * 60 * 1000;
}

exports["test read all"] = function test_readAll(assert, done) {
  Task.spawn(function() {
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits("www.w3schools.com",20);

    let storageBackend = {};
    let streamObjects = initStream(storageBackend);

    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(), streamObjects, 0, storageBackend);
    yield historyReader.resubmitHistory({startDay: today-20});

    let assertDeferred = oldPromise.defer();
    streamObjects.chartDataProcessorBolt.setEmitCallback(bolt => {
      assertDeferred.resolve();
    });
    streamObjects.stream.flush(); // flush out the last day
    yield assertDeferred.promise;

    let datum = storageBackend.chartData.genericChartData.lwca["58-cat"].categories.education.days;
    let dates = Object.keys(datum);
    assert.equal(dates.length, 21, "There are 21 days processed");

    assert.deepEqual(datum[today + ""],
      {"x":daysPostEpochToDate(today),"size":1,"domainList":{"w3schools.com":1}},
      "Test expected data for today");

    assert.deepEqual(datum[(today-19) + ""],
      {"x":daysPostEpochToDate(today-19),"size":1,"domainList":{"w3schools.com":1}},
      "Test expected data for today - 19");
    assert.equal(testUtils.tsToDay(historyReader.getLastTimeStamp()), today);
  }).then(done);
}

exports["test read from given timestamp"] = function test_readFromGivenTimestamp(assert, done) {
  Task.spawn(function() {
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits("www.w3schools.com",20);

    let storageBackend = {};
    let streamObjects = initStream(storageBackend);

    // only read starting from id == 10
    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(), streamObjects, (today-10)*MICROS_PER_DAY, storageBackend);
    yield historyReader.resubmitHistory({startDay: today-20});

    let assertDeferred = oldPromise.defer();
    streamObjects.chartDataProcessorBolt.setEmitCallback(bolt => {
      if (bolt.storage.chartData.genericChartData.lwca["58-cat"].categories.education.days[today]) {
        assertDeferred.resolve();
      }
    });
    streamObjects.stream.flush(); // flush out the last day
    yield assertDeferred.promise;

    let datum = storageBackend.chartData.genericChartData.lwca["58-cat"].categories.education.days;
    let dates = Object.keys(datum);
    assert.equal(dates.length,11);
    assert.deepEqual(datum[today + ""],
      {"x":daysPostEpochToDate(today),"size":1,"domainList":{"w3schools.com":1}},
      "Test expected data for today");

    assert.deepEqual(datum[(today-9) + ""],
      {"x":daysPostEpochToDate(today-9),"size":1,"domainList":{"w3schools.com":1}},
      "Test expected data for today - 9");

    assert.deepEqual(datum[(today-10) + ""], undefined,
      "Test expected data for today - 10");

    assert.equal(testUtils.tsToDay(historyReader.getLastTimeStamp()), today);
  }).then(done);
}

exports["test chunk size 1"] = function test_ChunkSize1(assert, done) {
  Task.spawn(function() {
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits("www.w3schools.com",20);

    let storageBackend = {};
    let streamObjects = initStream(storageBackend);

    // only read starting from id == 10
    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),streamObjects, 10, storageBackend);
    yield historyReader.resubmitHistory({startDay: today-20});

    let assertDeferred = oldPromise.defer();
    streamObjects.chartDataProcessorBolt.setEmitCallback(bolt => {
      if (bolt.storage.chartData.genericChartData.lwca["58-cat"].categories.education.days[today]) {
        assertDeferred.resolve();
      }
    });
    streamObjects.stream.flush(); // flush out the last day
    yield assertDeferred.promise;
    streamObjects.chartDataProcessorBolt.setEmitCallback(undefined);

    let datum = storageBackend.chartData.genericChartData.lwca["58-cat"].categories.education.days;;
    assert.equal(testUtils.tsToDay(historyReader.getLastTimeStamp()), today);

    // now set chunksize to 1 and read from same id
    storageBackend = {};
    streamObjects = initStream(storageBackend);
    historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),streamObjects, 10, storageBackend);
    yield historyReader.resubmitHistory({startDay: today-20, chunkSize: 1});

    assertDeferred = oldPromise.defer();
    streamObjects.chartDataProcessorBolt.setEmitCallback(bolt => {
      if (bolt.storage.chartData.genericChartData.lwca["58-cat"].categories.education.days[today]) {
        assertDeferred.resolve();
      }
    });
    streamObjects.stream.flush(); // flush out the last day
    yield assertDeferred.promise;
    streamObjects.chartDataProcessorBolt.setEmitCallback(undefined);

    let newDatum = storageBackend.chartData.genericChartData.lwca["58-cat"].categories.education.days;
    assert.deepEqual(datum, newDatum);
    assert.equal(testUtils.tsToDay(historyReader.getLastTimeStamp()), today);
  }).then(done);
}

exports["test accumulation"] = function test_Accumulation(assert, done) {
  Task.spawn(function() {
    let microNow = Date.now() * 1000;
    yield testUtils.promiseClearHistory();
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.w3schools.com/"), visitDate: microNow - 4*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.w3schools.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.w3schools.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.w3schools.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.w3schools.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.w3schools.com/"), visitDate: microNow - 2*MICROS_PER_DAY});

    let storageBackend = {};
    let streamObjects = initStream(storageBackend);

    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(), streamObjects, 0, storageBackend);
    yield historyReader.resubmitHistory({startDay: today-20});

    let assertDeferred = oldPromise.defer();
    streamObjects.chartDataProcessorBolt.setEmitCallback(bolt => {
      if (bolt.storage.chartData.genericChartData.lwca["58-cat"].categories.education.days[today-2]) {
        assertDeferred.resolve();
      }
    });
    streamObjects.stream.flush(); // flush out the last day
    yield assertDeferred.promise;

    let datum = storageBackend.chartData.genericChartData.lwca["58-cat"].categories.education.days;
    let dates = Object.keys(datum);
    assert.equal(dates.length,3);
    assert.deepEqual(datum[(today-3) + ""],
      {"x":daysPostEpochToDate(today-3),"size":1,"domainList":{"w3schools.com":1}});
    assert.deepEqual(datum[(today-2) + ""],
      {"x":daysPostEpochToDate(today-2),"size":2,"domainList":{"w3schools.com":2}});
    assert.deepEqual(datum[(today-1) + ""],
      {"x":daysPostEpochToDate(today-1),"size":3,"domainList":{"w3schools.com":3}});
    done();
  }).then(done);
}

exports["test stop and restart"] = function test_StopAndRestart(assert, done) {
  Task.spawn(function() {
    try {
      let hostArray = ["www.w3schools.com",
                       "www.amazon.com",
                       "www.doordash.com",
                       "www.api.jquery.com",
                       "www.nbcnews.com",
                       "www.evo.com"];
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits(hostArray,60);

      let storageBackend = {};
      let streamObjects = initStream(storageBackend);

      let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),streamObjects, 0, storageBackend);

      let processDeferred;

      // block until the data has been processed
      processDeferred = oldPromise.defer();
      streamObjects.dailyInterestsSpout.setEmitCallback(spout => {
        if (spout.numFromToday == 0) {
          processDeferred.resolve();
        }
      });
      yield historyReader.resubmitHistory({startDay: today-61});
      yield processDeferred.promise;
      streamObjects.dailyInterestsSpout.setEmitCallback(undefined);

      // block until today's data has been flushed
      processDeferred = oldPromise.defer();
      streamObjects.chartDataProcessorBolt.setEmitCallback(bolt => {
        let minDay = bolt.storage.chartData.genericChartData.lwca["58-cat"].minDay;
        let maxDay = bolt.storage.chartData.genericChartData.lwca["58-cat"].maxDay;
        let numDays = maxDay - minDay + 1;
        if (numDays == 61) {
          processDeferred.resolve();
        }
      });
      streamObjects.stream.flush();
      yield processDeferred.promise;
      streamObjects.chartDataProcessorBolt.setEmitCallback(undefined);

      let allTheData = storageBackend;
      let categories = storageBackend.chartData.genericChartData.lwca["58-cat"].categories;
      assert.deepEqual(Object.keys(categories).length, 2);

      for (let category in categories) {
        assert.deepEqual(Object.keys(categories[category].days).length, 61);
      }

      let theVeryLastTimeStamp = historyReader.getLastTimeStamp();

      // now start the torture test
      storageBackend = {};
      streamObjects = initStream(storageBackend);

      processDeferred = oldPromise.defer();
      streamObjects.dailyInterestsSpout.setEmitCallback(spout => {
        if (spout.numFromToday == 0) {
          processDeferred.resolve();
        }
      });

      historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),streamObjects, 0, storageBackend);
      let promise = historyReader.resubmitHistory({startDay: today-61});
      let cycles = 0;
      while (true) {
        yield promiseTimeout(100);
        historyReader.stop();
        yield promise;
        let lastTimeStamp = historyReader.getLastTimeStamp();
        if (lastTimeStamp == theVeryLastTimeStamp) {
          break;
        }
        historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),streamObjects,lastTimeStamp, storageBackend);
        promise = historyReader.resubmitHistory({startDay: today-61});
        cycles ++;
      }
      assert.ok(cycles > 1);

      yield processDeferred.promise;
      streamObjects.dailyInterestsSpout.setEmitCallback(undefined);

      // torture run is complete
      // wait until data is flushed
      processDeferred = oldPromise.defer();
      streamObjects.chartDataProcessorBolt.setEmitCallback(bolt => {
        let minDay = bolt.storage.chartData.genericChartData.lwca["58-cat"].minDay;
        let maxDay = bolt.storage.chartData.genericChartData.lwca["58-cat"].maxDay;
        let numDays = maxDay - minDay + 1;
        if (numDays == 61) {
          processDeferred.resolve();
        }
      });

      streamObjects.stream.flush();
      yield processDeferred.promise;
      streamObjects.chartDataProcessorBolt.setEmitCallback(undefined);

      // the content from the torture test and the single run is the same
      assert.deepEqual(storageBackend.chartData.genericChartData.lwca["58-cat"].categories,
        allTheData.chartData.genericChartData.lwca["58-cat"].categories);
    } catch(ex) {
      console.error(ex);
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

    let storageBackend = {};
    let streamObjects = initStream(storageBackend);

    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),streamObjects,0, storageBackend);
    yield historyReader.resubmitHistory({startDay: today-20},1);
    assert.deepEqual(storageBackend.tldCounter,
      {"au":{"mysql.au":1,"facebook.au":1},
       "com":{"thehill.com":1,"foo.com":1},
       "net":{"rivals.net":1},
       "ru":{"autoblog.ru":1},
       "no-suffix":{"oneword":1,"localhost":1},
       "is-ip":{"1.1.1.1":1,"1.2.3.4":1},
       "org":{"androidpolice.org":1}});

    let pureCounts = getTLDCounts(storageBackend);
    assert.deepEqual(pureCounts, {"au":2,"com":2,"ru":1,"net":1,"org":1,"is-ip":2,"no-suffix":2});
  }).then(done);
}

test.run(exports);
