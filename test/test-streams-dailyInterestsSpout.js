/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");
const oldPromise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Task.jsm");

const {DateUtils} = require("DateUtils");
const {DailyInterestsSpout} = require("streams/dailyInterestsSpout");
const {Stream, createNode} = require("streams/core");
const test = require("sdk/test");

let today = DateUtils.today();
let microNow = Date.now() * 1000;
let interestMessage = {
  "message": "InterestsForDocument",
  "url": "http://www.w3schools.com/",
  "title": "test visit for http://www.w3schools.com/",
  "host": "w3schools.com",
  "path": "/",
  "tld": "w3schools.com",
  "metaData": {},
  "language": "en",
  "messageId": "resubmit",
  "namespace": "58-cat",
  "results": [
    {"type":"lwca","interests":["Education"]},
  ],
  "visitIDs": {},
};
interestMessage.visitIDs[today-2] = [1415986861953943];
interestMessage.visitIDs[today-1] = [1415990218988805];
interestMessage.visitIDs[today] = [1415990218988805];

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

      let storageBackend = {};
      let dailyInterestsSpout = DailyInterestsSpout.create(storageBackend);
      let stream = new Stream();
      stream.addNode(dailyInterestsSpout, true);
      stream.addNode(assertionBolt);

      let assertDeferred = oldPromise.defer();
      stream.push("interest", [{details: interestMessage, dateVisits: dateVisits}]);
      doAssert = function(message) {
        assertDeferred.resolve();
        assert.deepEqual(Object.keys(message), [today-2 + ""], "result should have the day before yesterday's data only");
      }
      yield assertDeferred.promise;

      assertDeferred = oldPromise.defer();
      doAssert = function(message) {
        assertDeferred.resolve();
        assert.ok(message.hasOwnProperty(today-1), "result should have yesterday's data");
      }
      stream.flush();
      yield assertDeferred.promise;
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

      let assertDeferred = oldPromise.defer();

      // test that the latest day is not pushed through the network
      stream.push("interest", [{details: interestMessage, dateVisits: dateVisits}]);
      doAssert = function(message) {
        assertDeferred.resolve();
        assert.ok(message.hasOwnProperty(today-2), "result should have the day before yesterday's data");
        assert.ok(message.hasOwnProperty(today-1), "result should have yesterday's data");
        assert.equal(message.hasOwnProperty(today), false, "result should not have today's data");
      }
      yield assertDeferred.promise;

      // test that the latest day is accumulated and returns when flushed

      assertDeferred = oldPromise.defer();
      doAssert = function(message) {
        assertDeferred.resolve();
        assert.ok(message.hasOwnProperty(today), "today's count should be present");
        assert.equal(message[today]["lwca"]["58-cat"]["Education"]["hosts"]["w3schools.com"], 3, "today's visit count should have accumulated");
      }
      dateVisits = {};
      dateVisits[today] = 2; // assertion checks if 2 is added to the 1 count set before
      stream.push("interest", [{details: interestMessage, dateVisits: dateVisits}]);
      stream.flush();
      yield assertDeferred.promise;
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

      let pusholdPromise;

      // setup spout to keep waiting
      pusholdPromise = stream.push("interest", [{details: interestMessage, dateVisits: dateVisits}]);

      let whenEmitDeferred = oldPromise.defer();
      let reportWhenEmitting = function() {
        assert.ok(true, "report should have fired");
        whenEmitDeferred.resolve(true);
      }
      dailyInterestsSpout.setEmitCallback(reportWhenEmitting);

      // set one more day to trigger emit
      dateVisits = {}
      dateVisits[today-1] = 1
      stream.push("interest", [{details: interestMessage, dateVisits: dateVisits}]);

      yield whenEmitDeferred.promise;
      yield pusholdPromise;
      assert.ok(true, "original push promise resolves");
    }
    catch (ex) {
      console.error(ex);
    }
  }).then(done);
}

test.run(exports);
