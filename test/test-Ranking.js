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
const test = require("sdk/test");

let today = DateUtils.today();
let setupTestController = testUtils.setupTestController;

function flushTestController(testController, resolveTest) {
  let processDeferred = Promise.defer();
  testController._streamObjects.interestStorageBolt.setEmitCallback(bolt => {
    if (resolveTest(bolt)) {
      processDeferred.resolve();
    }
  });
  return testController.resubmitHistory({flush: true}).then(() => {
    return processDeferred.promise.then(() => {
      testController._streamObjects.interestStorageBolt.setEmitCallback(undefined);
    });
  });
}

exports["test empty profile ranking"] = function test_EmptyProfileRanking(assert, done) {
  Task.spawn(function() {
    try {
      let storageBackend = {};
      yield testUtils.promiseClearHistory();
      let testController = setupTestController({storage: storageBackend});

      assert.ok(testController.getRankedInterests() == null);
      let sranked = testController.getRankedInterestsForSurvey();
      assert.equal(sranked.length, 30);
      sranked.forEach(pair => {
        assert.equal(pair.score,0);
      });

      sranked = testController.getRankedInterestsForSurvey(50);
      sranked.forEach(pair => {
        assert.equal(pair.score,0);
      });
    } catch(ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test ranking"] = function test_Ranking(assert, done) {
  Task.spawn(function() {
    try {
    yield testUtils.promiseClearHistory();
    let microNow = Date.now() * 1000;

    let storageBackend = {};
    let testController = setupTestController({rankType: "combined", storage: storageBackend});
    storageBackend.ranking = {
      "daycount_edrules_rules": {"Autos":4},
      "daycount_edrules_keywords": {"Autos":4},
      "daycount_edrules_combined": {"Autos":4},
      "daycount_edrules_extended_rules": {"Autos":4},
      "daycount_edrules_extended_keywords": {"Autos":4},
      "daycount_edrules_extended_combined": {"Autos":4}
    }

    assert.deepEqual(testController.getRankedInterests(), {"Autos":4}, "Only Autos");

    // now test how we generate random zero-score interests
    let sranked = testController.getRankedInterestsForSurvey(10);
    assert.deepEqual(sranked[0] , {"interest":"Autos","score":4}, "first is Autos");

    // make sure the rest of scores is zero
    let duplicateCatcher = {};
    for( let i = 1; i < 10; i++) {
      assert.ok(sranked[i].score == 0,"Score is 0");
      assert.ok(duplicateCatcher[sranked[i].interest] == null, "no dups");
      duplicateCatcher[sranked[i].interest] = 1;
    }

    let newranks = testController.getRankedInterestsForSurvey(10);
    assert.deepEqual(newranks[0] , {"interest":"Autos","score":4}, "still Autos is first");

    // make sure that interetsts are different
    let diffCount = 0;
    duplicateCatcher = {};
    for( let i = 1; i < 10; i++) {
      assert.ok(duplicateCatcher[newranks[i].interest] == null, "no dups");
      duplicateCatcher[newranks[i].interest] = 1;
      if (sranked[i].interest != newranks[i].interest) {
        diffCount ++;
      }
    }

    // we should see at least 3 diffs
    assert.ok(diffCount >= 3, "Differences exists and = " + diffCount);

    storageBackend.ranking = {
      "daycount_edrules_rules": {"Travel":1, "Tennis": 2, "Politics": 3, "Autos": 4, "Humor": 5, "Programming": 6, "Television": 7, "Science": 8, "Music": 9, "Android": 10},
      "daycount_edrules_keywords": {},
      "daycount_edrules_combined": {},
      "daycount_edrules_extended_rules": {},
      "daycount_edrules_extended_keywords": {},
      "daycount_edrules_extended_combined": {}
    }

    let cats = [
     {
      host: "traveler.xyz",
      interest: "Travel",
      score: 1
     },
     {
      host: "tennis.gr",
      interest: "Tennis",
      score: 2
     },
     {
      host: "salon.com",
      interest: "Politics",
      score: 3
     },
     {
      host: "cars.ru",
      interest: "Autos",
      score: 4
     },
     {
      host: "funnyjunk.com",
      interest: "Humor",
      score: 5
     },
     {
      host: "mysql.com",
      interest: "Programming",
      score: 6
     },
     {
      host: "sidereel.com",
      interest: "Television",
      score: 7
     },
     {
      host: "sciencenews.org",
      interest: "Science",
      score: 8
     },
     {
      host: "rollingstone.com",
      interest: "Music",
      score: 9
     },
     {
      host: "androidpolice.com",
      interest: "Android",
      score: 10
     }
    ];

    sranked = testController.getRankedInterestsForSurvey(10).sort((a,b) => {
      return b.score - a.score;
    });
    for (let i = 0; i < cats.length; i++) {
      assert.equal(cats[9-i].interest, sranked[i].interest, "Interest match");
      assert.equal(cats[9-i].score, sranked[i].score, "Score match");
    }

    // now add a few extra interests and see if top/medium/low works
    // add Gossip
    storageBackend.ranking.daycount_edrules_rules.Gossip = 11;

    // Gossip should be first and then shifteed by 1 cats
    sranked = testController.getRankedInterestsForSurvey();
    assert.equal("Gossip", sranked[0].interest);
    assert.equal(11, sranked[0].score);

    storageBackend.ranking.daycount_edrules_rules.Baseball = 12;
    storageBackend.ranking.daycount_edrules_rules["Home-Design"] = 13;
    storageBackend.ranking.daycount_edrules_rules.Apple = 14;

    sranked = testController.getRankedInterestsForSurvey();
    assert.deepEqual(sranked[0], {"interest":"Apple","score":14});
    assert.deepEqual(sranked[1], {"interest":"Home-Design","score":13});
    assert.deepEqual(sranked[2], {"interest":"Baseball","score":12});
    assert.ok(sranked[29] != null);
    assert.equal(sranked[29].score, 0);

   } catch(ex) {
     console.error(ex);
   }
  }).then(done);
}

exports["test day counting"] = function test_DayCounting(assert, done) {
  Task.spawn(function() {
   try {
    yield testUtils.promiseClearHistory();
    let microNow = Date.now() * 1000;

    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY + 10});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY + 20});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY + 30});

    let storageBackend = {};
    let testController = setupTestController({rankType: "combined", storage: storageBackend});
    testController.clear()

    yield flushTestController(testController, bolt => {
      return bolt.storage.interests.hasOwnProperty(today-3);
    });
    assert.deepEqual(testController.getRankedInterests(), {"Autos":1}, "we should only see score 1 for 1 day");

    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY + 10});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY + 20});
    testController.clear()
    yield flushTestController(testController, bolt => {
      return bolt.storage.interests.hasOwnProperty(today-2);
    });
    assert.deepEqual(testController.getRankedInterests(), {"Autos":2}, "we should see score 2 for 2 days");
   } catch(ex) {
     console.error(ex);
   }
  }).then(done);
}

test.run(exports);
