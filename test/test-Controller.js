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
const Promise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

const {Controller} = require("Controller");
const {NYTimesHistoryVisitor} = require("NYTimesHistoryVisitor");
const {DateUtils,MICROS_PER_DAY} = require("DateUtils");
const {testUtils} = require("./helpers");
const {promiseTimeout} = require("Utils");
const {Stream} = require("streams/core");
const {DailyInterestsSpout} = require("streams/dailyInterestsSpout");
const {DayCountRankerBolt} = require("streams/dayCountRankerBolt");
const {HostStripBolt} = require("streams/hostStripBolt");
const {InterestStorageBolt} = require("streams/interestStorageBolt");

let setupTestController = testUtils.setupTestController;

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
      let testController = setupTestController();
      testController.clear();

      let processDeferred;;

      processDeferred = Promise.defer();
      testController._streamObjects.rankerBolts[0].setEmitCallback(bolt => {
        if (bolt.storage.ranking[bolt.storageKey].Autos == 4) {
          processDeferred.resolve();
        }
      });
      yield testController.submitHistory({flush: true});
      yield processDeferred.promise;
      testController._streamObjects.dailyInterestsSpout.setEmitCallback(undefined);

      // we should see 4 urls being processed, hten Autos should contain 4 days
      assert.deepEqual(testController.getRankedInterests(), {"Autos":4}, "4 Autos");

      // wait till storage bolt has captured the interests
      processDeferred = Promise.defer();
      testController._streamObjects.interestStorageBolt.setEmitCallback(bolt => {
        if (Object.keys(bolt.storage.interests).length == 4) {
          processDeferred.resolve();
        }
      });
      yield processDeferred.promise;
      testController._streamObjects.interestStorageBolt.setEmitCallback(undefined);

      let payload = testController.getNextDispatchBatch();
      let days = Object.keys(payload.interests);
      // make sure that the history data is keyed on 4,5, and 6 th day
      assert.deepEqual(days ,  ["" + (today-4), "" + (today-3), "" + (today-2), "" + today], "4 days upto today");

      // add one more visits for today and make sure we pick them up
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.thehill.com/"), visitDate: microNow + 1});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.rivals.com/"), visitDate: microNow + 2});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.rivals.com/"), visitDate: microNow + MICROS_PER_DAY});


      processDeferred = Promise.defer();
      let observer = {
        observe: function(aSubject, aTopic, aData) {
          try {
            if  (aTopic != "controller-history-submission-complete") {
              throw "UNEXPECTED_OBSERVER_TOPIC " + aTopic;
            }
            processDeferred.promise.then(() => {
              testController._streamObjects.dailyInterestsSpout.setEmitCallback(undefined);

              // we should see the 3 intersts now
              assert.deepEqual(testController.getRankedInterests(), {"Autos":4,"Politics":1,"Sports":1}, "should see 3 intresests");
              // and we must see 4 day in the keys
              payload = testController.getNextDispatchBatch();
              days = Object.keys(payload.interests);
              assert.deepEqual(days ,  ["" + (today-4), "" + (today-3), "" + (today-2), "" + today],"still 4 days");
              Services.obs.removeObserver(observer, "controller-history-submission-complete");
              done();
            });
          } catch (ex) {
            console.error(ex);
          }
        },
      };

      testController._streamObjects.rankerBolts[0].setEmitCallback(bolt => {
        if (Object.keys(bolt.storage.ranking[bolt.storageKey]).length == 3) {
          processDeferred.resolve();
        }
      });

      Services.obs.addObserver(observer, "controller-history-submission-complete" , false);
      Services.obs.notifyObservers(null, "idle-daily", null);
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
      let testController = setupTestController({storage: storageBackend});
      testController.clear();

      let testScores = function(theController) {
        let interests = theController.getRankedInterests();
        assert.equal(interests.Autos, 60);
        assert.equal(interests.Politics, 60);
        assert.equal(interests.Sports, 60);
        assert.equal(interests.Programming, 60);
        assert.equal(interests.Humor, 60);
        assert.equal(interests.Android, 60);
      };

      let processDeferred;

      processDeferred = Promise.defer();
      testController._streamObjects.interestStorageBolt.setEmitCallback(bolt => {
        if (Object.keys(bolt.storage.interests).length == 60) {
          processDeferred.resolve();
        }
      });

      yield testController.submitHistory({flush: true});
      yield processDeferred.promise;
      testController._streamObjects.interestStorageBolt.setEmitCallback(undefined);

      let today = DateUtils.today();
      let theVeryLastTimeStamp = storageBackend.lastTimeStamp;
      // verify ranks
      testScores(testController);

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
      assert.equal(storageBackend.nytimesVisits, undefined);
      assert.equal(storageBackend.hasOwnProperty("interests"), false);
    } catch(ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test get uuid"] = function test_GetUUID(assert, done) {
  Task.spawn(function() {
    try {
      let testController = setupTestController();
      assert.ok(testController.getUserID() != null);
      assert.ok(testController.getUserID() != "");
    } catch(ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test nytCollect"] = function test_NYTCollect(assert, done) {
  Task.spawn(function() {
    try {
      let hostArray = ["www.nytimes.com"];
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits(hostArray,1);

      let storageBackend = {};
      let testController = setupTestController({storage: storageBackend});

      let nytHistoryVisitor = new NYTimesHistoryVisitor(storageBackend);
      assert.ok(nytHistoryVisitor.getVisits() == null);

      yield testController.submitHistory({flush: true});
      assert.equal(nytHistoryVisitor.getVisits().length, 2);
      assert.ok(true);
    } catch(ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test getUserInterests"] = function test_GetUserInterests(assert, done) {
  Task.spawn(function() {
    try {
      let hostArray = ["www.autoblog.com"];
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits(hostArray,2);

      let testController = setupTestController();
      testController.clear();
      yield testController.submitHistory({flush: true})


      let processDeferred = Promise.defer();
      testController._streamObjects.rankerBolts[0].setEmitCallback(bolt => {
        if (bolt.storage.ranking[bolt.storageKey].Autos == 3) {
          processDeferred.resolve();
        }
      });
      yield processDeferred.promise;
      testController._streamObjects.rankerBolts[0].setEmitCallback(undefined);

      simplePrefs.prefs.uuid = "this_uuid_cannot_exist";
      let interests = testController.getUserInterests();
      assert.deepEqual(interests, {"Autos":3});

      simplePrefs.prefs.uuid = "NO_SUCH_UUID";
      interests = testController.getUserInterests();
      assert.deepEqual(interests, {"NO_SUCH_INTREST":1});
    } catch(ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test mayPersonalize"] = function test_MayPersonalize(assert, done) {
  Task.spawn(function() {
    try {
      // set uuid andt make a controller
      simplePrefs.prefs.uuid = "1";
      let storage = {};
      let testController = setupTestController({storage: storage});
      let pObject = testController._dispatcher._makePayloadObject();
      assert.ok(testController.mayPersonalize() == true);
      assert.ok(pObject.personalizeOn == true);

      // remake controller for a different uuid
      simplePrefs.prefs.uuid = "2";
      testController = setupTestController({storage: storage});
      assert.ok(testController.mayPersonalize() == false);
      pObject = testController._dispatcher._makePayloadObject();
      assert.ok(pObject.personalizeOn == false);
    } catch(ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test hostComputedInterests"] = function test_HostComputedInterests(assert, done) {
  Task.spawn(function() {
    try {
      let hostArray = ["www.autoblog.com",
                       "www.thehill.com",
                       "www.mysql.com",
                      ];
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits(hostArray,2);

      let testController = setupTestController();
      testController.clear();
      yield testController.submitHistory({flush: true});
      let results = testController.getHostComputedInterests();
      assert.deepEqual(results, {
        "1":{"interests":{"Autos":300},"frecency":300},
        "2":{"interests":{"Autos":300,"Politics":300},"frecency":300},
        "3":{"interests":{"Autos":300,"Politics":300,"Programming":300},"frecency":300}
      });
    } catch(ex) {
      console.error(ex);
    }
  }).then(done);
}

test.run(exports);
