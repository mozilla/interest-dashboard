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
      testUtils.isIdentical(
        assert,
        results[0],
        {"id":11,"title":"test visit for http://www.autoblog.com/","url":"http://www.autoblog.com/","visitDate":today-10}
      );
      testUtils.isIdentical(
        assert,
        results[10],
        {"id":21,"title":"test visit for http://www.autoblog.com/","url":"http://www.autoblog.com/","visitDate":today}
      );
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

exports["test ID and ChunkSize"] = function test_IdAndChunkSize(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits("www.autoblog.com",20);

      // test limiting by visitId & chunk
      let results = yield PlacesInterestsUtils.getRecentHistory(today - 20, null, {lastVisitId: 0,chunkSize: 10});
      assert.ok(results.length == 10);
      testUtils.isIdentical(
        assert,
        results[0],
        {"id":1,"title":"test visit for http://www.autoblog.com/","url":"http://www.autoblog.com/","visitDate":today-20}
      );
      testUtils.isIdentical(
        assert,
        results[9],
        {"id":10,"title":"test visit for http://www.autoblog.com/","url":"http://www.autoblog.com/","visitDate":today-11}
      );

      results = yield PlacesInterestsUtils.getRecentHistory(today - 20, null, {lastVisitId: 7,chunkSize: 10});
      assert.ok(results.length == 10);
      testUtils.isIdentical(
        assert,
        results[0],
        {"id":8,"title":"test visit for http://www.autoblog.com/","url":"http://www.autoblog.com/","visitDate":today-13}
      );
      testUtils.isIdentical(
        assert,
        results[9],
        {"id":17,"title":"test visit for http://www.autoblog.com/","url":"http://www.autoblog.com/","visitDate":today-4}
      );
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

      let results = yield PlacesInterestsUtils.getRecentHistory(today - 20, null, {lastVisitId: 7,chunkSize: 10});
      // test onRow function
      let newResults = [];
      yield PlacesInterestsUtils.getRecentHistory(today - 20,
        function(result) {
          newResults.push(result);
        },
        {
          lastVisitId: 7,
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
          lastVisitId: 0,
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
      testUtils.isIdentical(
        assert,
        results[0],
        {"id":11,"title":"test visit for http://www.autoblog.com/","url":"http://www.autoblog.com/","visitDate":today-10}
      );
      testUtils.isIdentical(
        assert,
        results[10],
        {"id":21,"title":"test visit for http://www.autoblog.com/","url":"http://www.autoblog.com/","visitDate":today}
      );
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

test.run(exports);
