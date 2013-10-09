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
    assert.equal(historyReader.getLastVisitId(), 21);
  }).then(done);
}

exports["test read from give id"] = function test_readFromGiveId(assert, done) {
  Task.spawn(function() {
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits("www.autoblog.com",20);
    dayBuffer.clear();

    // only read starting from id == 10
    let historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,10);
    let datum = yield historyReader.resubmitHistory({startDay: today-20});
    let dates = Object.keys(datum);
    assert.equal(dates.length,11);
    testUtils.isIdentical(assert, datum[today + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
    testUtils.isIdentical(assert, datum[(today-10) + ""].rules.edrules, {"Autos":{"autoblog.com":1}});
    assert.ok(datum[(today-11) + ""] == null);
    assert.equal(historyReader.getLastVisitId(), 21);
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
    assert.equal(historyReader.getLastVisitId(), 21);

    // now set chunksize to 1 and read from same id
    dayBuffer.clear();
    historyReader = new HistoryReader(gWorkerFactory.getCurrentWorkers(),dayBuffer,10);
    let newDatum = yield historyReader.resubmitHistory({startDay: today-20},1);
    testUtils.isIdentical(assert, datum, newDatum);
    assert.equal(historyReader.getLastVisitId(), 21);
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

test.run(exports);
