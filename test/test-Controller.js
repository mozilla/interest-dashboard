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

const {Controller} = require("Controller");
const {DateUtils,MICROS_PER_DAY} = require("DateUtils");
const {testUtils} = require("./helpers");
const {storage} = require("sdk/simple-storage");
const {promiseTimeout} = require("Utils");
const test = require("sdk/test");

exports["test controller"] = function test_Controller(assert, done) {
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
      let testController = new Controller();
      testController.clear();
      yield testController.submitHistory({flush: true});

      // we should only see 3 urls being processed, hten Autos should nly contain 3 days
      testUtils.isIdentical(assert, testController.getRankedInterests(), {"Autos":4}, "4 Autos");

      let payload = testController.getNextDispatchBatch();
      let days = Object.keys(payload.interests);
      // make sure that the history data is keyed on 4,5, and 6 th day
      testUtils.isIdentical(assert, days ,  ["" + (today-4), "" + (today-3), "" + (today-2), "" + today], "4 days upto today");

      // add one more visits for today and make sure we pick them up
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.thehill.com/"), visitDate: microNow + 1});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.rivals.com/"), visitDate: microNow + 2});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.rivals.com/"), visitDate: microNow + MICROS_PER_DAY});

      let observer = {
        observe: function(aSubject, aTopic, aData) {
          try {
            if  (aTopic != "controller-history-submission-complete") {
              throw "UNEXPECTED_OBSERVER_TOPIC " + aTopic;
            }
            // we should see the 3 intersts now
            testUtils.isIdentical(assert, testController.getRankedInterests(), {"Autos":4,"Politics":1,"Sports":1}, "should see 3 intresests");
            // and we must see 4 day in the keys
            payload = testController.getNextDispatchBatch();
            days = Object.keys(payload.interests);
            testUtils.isIdentical(assert, days ,  ["" + (today-4), "" + (today-3), "" + (today-2), "" + today],"still 4 days");
            Services.obs.removeObserver(observer, "controller-history-submission-complete");
            done();
          } catch (ex) {
            dump( ex + " ERROR\n");
          }
        },
      };

      Services.obs.addObserver(observer, "controller-history-submission-complete" , false);
      Services.obs.notifyObservers(null, "idle-daily", null);
    } catch(ex) {
      dump( ex + " ERROR\n");
    }
  });
}

exports["test enable and disable"] = function test_EnableAndDisable(assert, done) {
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

      let testController = new Controller();
      testController.clear();

      let testScores = function() {
        let interests = testController.getRankedInterests();
        assert.equal(interests.Autos, 60);
        assert.equal(interests.Politics, 60);
        assert.equal(interests.Sports, 60);
        assert.equal(interests.Programming, 60);
        assert.equal(interests.Humor, 60);
        assert.equal(interests.Android, 60);
      };

      yield testController.submitHistory({flush: true});
      let theVeryLastTimeStamp = storage.lastTimeStamp;
      // verify reanks
      testScores();

      // a toture test to make sure we can disable and re-enable
      // controller without loss of data
      testController.clear();
      let promise = testController.resubmitHistory({flush: true});
      let cycles = 0;
      while (true) {
        yield promiseTimeout(1);
        testController.onDisabling();
        yield promise;
        let lastTimeStamp = storage.lastTimeStamp;
        if (lastTimeStamp == theVeryLastTimeStamp) {
          break;
        }
        promise = testController.restart({flush: true});
        cycles++;
      }
      testScores();
      assert.ok(cycles > 1);
    } catch(ex) {
      dump(ex + " ERROR\n");
    }
  }).then(done);
}

exports["test uninstall"] = function test_Uninstall(assert, done) {
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

      let testController = new Controller();
      testController.clear();

      testController.submitHistory({flush: true});
      yield testController.onUninstalling();

      // make sure we are all clean
      assert.equal(storage.lastTimeStamp, undefined);
      assert.equal(storage.downloadSource, undefined);
      assert.equal(storage.dayBufferInterests, undefined);
      assert.equal(storage.interests, undefined);
      assert.equal(storage.ranking, undefined);
      assert.equal(storage.hasOwnProperty("interests"), false);

      // avoid intermittent unit-test failures caused by storage cleanup
      // simply re-create a controller, and clean it.  This will remake
      // all objects and repopulate storage.
      testController = new Controller();
      testController.clear();
    } catch(ex) {
      dump(ex + " ERROR\n");
    }
  }).then(done);
}

test.run(exports);
