/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const simplePrefs = require("sdk/simple-prefs");
const {storage} = require("sdk/simple-storage");
const test = require("sdk/test");

const {Cc, Ci, Cu} = require("chrome");
const oldPromise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

const {Controller} = require("Controller");
const {DateUtils,MICROS_PER_DAY} = require("DateUtils");
const {testUtils} = require("./helpers");
const {promiseTimeout} = require("Utils");
const {Stream} = require("streams/core");
const {DayCountRankerBolt} = require("streams/dayCountRankerBolt");

let setupTestController = testUtils.setupTestController;

exports["test controller history submission completes"] = function test_Controller(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      let today = DateUtils.today();

      let microNow = Date.now() * 1000;
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 4*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});

      // step one day into future to flush the DayBuffer
      let testController = setupTestController();
      testController.clear();

      let processDeferred;
      processDeferred = oldPromise.defer();
      testController._streamObjects.chartDataProcessorBolt.setEmitCallback(bolt => {
        assert.equal(Object.keys(bolt.storage.domains.all).length, 1, "Test we have the autoblog domain");
        processDeferred.resolve();
      });

      let observer = {
        observe: function(aSubject, aTopic, aData) {
          try {
            if  (aTopic != "controller-history-submission-complete") {
              throw "UNEXPECTED_OBSERVER_TOPIC " + aTopic;
            }
            testController._streamObjects.dailyInterestsSpout.setEmitCallback(undefined);
            Services.obs.removeObserver(observer, "controller-history-submission-complete");
            assert.ok(true);
            done();
          } catch (ex) {
            console.error(ex);
          }
        },
      };

      Services.obs.addObserver(observer, "controller-history-submission-complete" , false);

      yield testController.submitHistory({flush: true});
    } catch(ex) {
      console.error(ex);
    }
  });
}

exports["test stop and start"] = function test_StopAndStart(assert, done) {
  Task.spawn(function() {
    try {
      let hostArray = ["www.autoblog.com",
                       "www.thehill.com",
                       "www.rivals.com",
                       "www.mysql.com",
                       "www.cracked.com",
                       "www.androidpolice.com"];
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits(hostArray,59);

      let storageBackend = {};
      let testController = setupTestController({
        storage: storageBackend,
        historyDays: 90,
      });
      testController.clear();

      let processDeferred;
      processDeferred = oldPromise.defer();
      testController._streamObjects.chartDataProcessorBolt.setEmitCallback(bolt => {
        let minDay = bolt.storage.chartData.genericChartData.lwca["58-cat"].minDay;
        let maxDay = bolt.storage.chartData.genericChartData.lwca["58-cat"].maxDay;
        let numDays = maxDay - minDay + 1;
        if (numDays == 60) {
          processDeferred.resolve();
        }
      });

      yield testController.submitHistory({flush: true});
      yield processDeferred.promise;

      let today = DateUtils.today();
      let theVeryLastTimeStamp = storageBackend.lastTimeStamp;
      // a toture test to make sure we can disable and re-enable
      // controller without loss of data
      testController.clear();
      let promise = testController.resubmitHistory();
      let cycles = 0;
      while (true) {
        yield promiseTimeout(100);
        testController.stop();
        yield promise;
        let lastTimeStamp = storageBackend.lastTimeStamp;
        if (lastTimeStamp == theVeryLastTimeStamp) {
          break;
        }
        testController = setupTestController({storage: storageBackend});
        promise = testController.submitHistory();
        cycles++;
      }
      yield testController.submitHistory({flush: true});
      assert.ok(cycles > 1);
    } catch(ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test clear storage"] = function test_ClearStorage(assert, done) {
  Task.spawn(function() {
    try {
      let hostArray = ["www.autoblog.com",
                       "www.thehill.com",
                       "www.rivals.com",
                       "www.mysql.com",
                       "www.cracked.com",
                       "www.nytimes.com",
                       "www.androidpolice.com"];
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits(hostArray,59);

      let storageBackend = {};
      let testController = setupTestController({storage: storageBackend});
      testController.clear();

      testController.submitHistory({flush: true});
      yield testController.stopAndClearStorage();

      // make sure we are all clean
      assert.equal(storageBackend.lastTimeStamp, undefined);
      assert.equal(storageBackend.downloadSource, undefined);
      assert.equal(storageBackend.dayBufferInterests, undefined);
      assert.equal(storageBackend.interests, undefined);
      assert.equal(storageBackend.ranking, undefined);
      assert.equal(storageBackend.hasOwnProperty("interests"), false);
    } catch(ex) {
      console.error(ex);
    }
  }).then(done);
}

test.run(exports);
