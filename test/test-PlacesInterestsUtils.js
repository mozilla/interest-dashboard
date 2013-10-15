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
const {PlacesInterestsUtils} = require("PlacesInterestsUtils");
const test = require("sdk/test");

let today = DateUtils.today();
exports["test 10 last days"] = function test_Getting10LastDays(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits("www.autoblog.com",20);

      // test going 10 days back
      let results = yield PlacesInterestsUtils.getRecentHistory(today - 10);
      assert.ok(results.length == 11);

      // check the first and the last items
      assert.equal(results[0].visitDate, today-10);
      assert.equal(results[10].visitDate, today);
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

exports["test TimeStamp and ChunkSize"] = function test_TimeStampAndChunkSize(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits("www.autoblog.com",20);

      // test limiting by timestamp & chunk
      let results = yield PlacesInterestsUtils.getRecentHistory(today - 20, null, {lastTimeStamp: 0,chunkSize: 10});
      assert.ok(results.length == 10);
      assert.equal(results[0].visitDate, today-20);
      assert.equal(results[9].visitDate, today-11);

      let lastTimeStamp = results[9].timeStamp;

      results = yield PlacesInterestsUtils.getRecentHistory(today - 20, null, {lastTimeStamp: lastTimeStamp,chunkSize: 20});
      assert.ok(results.length == 11);
      assert.equal(results[0].visitDate, today-10);
      assert.equal(results[10].visitDate, today);

    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

exports["test onRow"] = function test_OnRow(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits("www.autoblog.com",20);

      let results = yield PlacesInterestsUtils.getRecentHistory(today - 20, null, {lastTimeStamp: 0,chunkSize: 10});
      // test onRow function
      let newResults = [];
      yield PlacesInterestsUtils.getRecentHistory(today - 20,
        function(result) {
          newResults.push(result);
        },
        {
          lastTimeStamp: 0,
          chunkSize: 10,
        }
      );
      testUtils.isIdentical(assert, newResults, results);
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

exports["test stop and restart"] = function test_StopAndRestart(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits("www.autoblog.com",20);
      assert.ok(PlacesInterestsUtils.isStopped() == false);

      let newResults = [];
      let deadPromise = PlacesInterestsUtils.getRecentHistory(today - 20,
        function(result) {
          newResults.push(result);
        },
        {
          lastTimeStamp: 0,
          chunkSize: 100,
        }
      );
      PlacesInterestsUtils.stop();
      let deadPromiseResult = yield deadPromise;
      assert.ok(deadPromiseResult == null);
      assert.ok(PlacesInterestsUtils.isStopped() == true);

      // attempt to run a query again
      let nullResult = PlacesInterestsUtils.getRecentHistory(today - 10);
      assert.ok(nullResult == null);

      // restart
      PlacesInterestsUtils.restart();
      assert.ok(PlacesInterestsUtils.isStopped() == false);
      let results = yield PlacesInterestsUtils.getRecentHistory(today - 10);
      // check the first and the last items
      assert.equal(results[0].visitDate, today-10);
      assert.equal(results[10].visitDate, today);
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

test.run(exports);
