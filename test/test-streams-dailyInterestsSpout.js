/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");
const Promise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Task.jsm");

const {DateUtils} = require("DateUtils");
const {DailyInterestsSpout} = require("streams/dailyInterestsSpout");
const {Stream, createNode} = require("streams/core");
const test = require("sdk/test");

let today = DateUtils.today();
let microNow = Date.now() * 1000;
let interestMessage = {
  "message": "InterestsForDocument",
  "url": "http://www.autoblog.com/",
  "title": "test visit for http://www.autoblog.com/",
  "host": "autoblog.com",
  "path": "/",
  "tld": "autoblog.com",
  "metaData": {},
  "language": "en",
  "messageId": "resubmit",
  "namespace": "edrules",
  "results": [
    {"type":"rules","interests":["Autos"]},
  ]
};

exports["test visit processing"] = function test_PastVisits(assert, done) {
  Task.spawn(function() {
    try {
      let dateVisits = {}
      dateVisits[today-2] = 1
      dateVisits[today-1] = 1

      let doAssert;
      let assertionBolt = createNode({
        identifier: "assertionBolt",
        listenType: "dailyInterests",
        emitType: null,
        ingest: function(message) {
          doAssert(message);
        }
      });

      let dailyInterestsSpout = DailyInterestsSpout.create({});
      let stream = new Stream();
      stream.addNode(dailyInterestsSpout, true);
      stream.addNode(assertionBolt);

      let pushPromise = stream.push("interest", {details: interestMessage, dateVisits: dateVisits});
      doAssert = function(message) {
        assert.ok(message.hasOwnProperty(today-2), "result should have the day before yesterday's data");
      }
      yield pushPromise;

      let assertDeferred = Promise.defer();
      doAssert = function(message) {
        assertDeferred.resolve();
        assert.ok(message.hasOwnProperty(today-1), "result should have yesterday's data");
      }
      let flushPromise = stream.flush();
      yield flushPromise;
      yield assertDeferred.promise;
      dailyInterestsSpout.clearStorage();
    }
    catch (ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test ignore latest day visit unless flush"] = function test_TodayVisits(assert, done) {
  Task.spawn(function() {
    try {
      let dateVisits = {}
      dateVisits[today-2] = 1
      dateVisits[today-1] = 1
      dateVisits[today] = 1

      let doAssert;
      let assertionBolt = createNode({
        identifier: "assertionBolt",
        listenType: "dailyInterests",
        emitType: null,
        ingest: function(message) {
          doAssert(message);
        }
      });

      let dailyInterestsSpout = DailyInterestsSpout.create({});
      let stream = new Stream();
      stream.addNode(dailyInterestsSpout, true);
      stream.addNode(assertionBolt);

      let pushPromise;

      // test that the latest day is not pushed through the network
      pushPromise = stream.push("interest", {details: interestMessage, dateVisits: dateVisits});
      doAssert = function(message) {
        assert.ok(message.hasOwnProperty(today-2), "result should have the day before yesterday's data");
        assert.ok(message.hasOwnProperty(today-1), "result should have yesterday's data");
        assert.equal(message.hasOwnProperty(today), false, "result should not have today's data");
      }
      yield pushPromise;

      // test that the latest day is accumulated and returns when flushed

      let flushedDeferred = Promise.defer();
      doAssert = function(message) {
        flushedDeferred.resolve();
        assert.ok(message.hasOwnProperty(today), "today's count should be present");
        assert.equal(message[today]["rules"]["edrules"]["Autos"]["autoblog.com"], 3, "today's visit count should have accumulated");
      }
      dateVisits = {};
      dateVisits[today] = 2; // assertion checks if 2 is added to the 1 count set before
      pushPromise = stream.push("interest", {details: interestMessage, dateVisits: dateVisits});
      yield stream.flush();
      yield pushPromise;
      dailyInterestsSpout.clearStorage();
    }
    catch (ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test emit callback"] = function test_TodayVisits(assert, done) {
  Task.spawn(function() {
    try {
      let dateVisits;

      dateVisits = {}
      dateVisits[today-2] = 1

      let dailyInterestsSpout = DailyInterestsSpout.create({});
      let stream = new Stream();
      stream.addNode(dailyInterestsSpout, true);

      let pushPromise;

      // setup spout to keep waiting
      pushPromise = stream.push("interest", {details: interestMessage, dateVisits: dateVisits});

      let whenEmitDeferred = Promise.defer();
      let reportWhenEmitting = function() {
        assert.ok(true, "report should have fired");
        whenEmitDeferred.resolve(true);
      }
      dailyInterestsSpout.setEmitCallback(reportWhenEmitting);

      // set one more day to trigger emit
      dateVisits = {}
      dateVisits[today-1] = 1
      stream.push("interest", {details: interestMessage, dateVisits: dateVisits});

      yield whenEmitDeferred.promise;
      yield pushPromise;
      assert.ok(true, "original push promise resolves");
    }
    catch (ex) {
      console.error(ex);
    }
  }).then(done);
}

test.run(exports);
