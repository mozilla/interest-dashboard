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

exports["test empty profile ranking"] = function test_EmptyProfileRanking(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      let testController = new Controller({rankType: "combined"});
      testController.clear()
      yield testController.submitHistory({flush: true});
      // we should only see 3 urls being processed, hten Autos should nly contain 3 days
      assert.ok(testController.getRankedInterests() == null);
      // now test how we generate random zero-score interests
      let sranked = testController.getRankedInterestsForSurvey();
      assert.equal(sranked.length, 10);
      sranked.forEach(pair => {
        assert.equal(pair.score,0);
      });
    } catch(ex) {
      dump(ex + " ERROROR \n");
      assert.ok(false);
    }
  }).then(done);
}


exports["test ranking"] = function test_Ranking(assert, done) {
  Task.spawn(function() {
   try {
    yield testUtils.promiseClearHistory();
    let microNow = Date.now() * 1000;

    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});

    let testController = new Controller({rankType: "combined"});
    testController.clear()
    yield testController.submitHistory({flush: true});

    // we should only see 3 urls being processed, hten Autos should nly contain 3 days
    testUtils.isIdentical(assert, testController.getRankedInterests(), {"Autos":4}, "Only Autos");

    // now test how we generate random zero-score interests
    let sranked = testController.getRankedInterestsForSurvey();
    testUtils.isIdentical(assert, sranked[0] , {"interest":"Autos","score":4}, "first is Autos");
    // make sure the rest of scores is zero
    let duplicateCatcher = {};
    for( let i = 1; i < 10; i++) {
      assert.ok(sranked[i].score == 0,"Score is 0");
      assert.ok(duplicateCatcher[sranked[i].interest] == null, "no dups");
      duplicateCatcher[sranked[i].interest] = 1;
    }

    let newranks = testController.getRankedInterestsForSurvey();
    testUtils.isIdentical(assert, newranks[0] , {"interest":"Autos","score":4}, "still Autos is first");

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

    yield testUtils.promiseClearHistory();
    let cats = [
     {
      host: "roughguides.com",
      interest: "Travel",
      score: 1
     },
     {
      host: "tennisnews.com",
      interest: "Tennis",
      score: 2
     },
     {
      host: "salon.com",
      interest: "Politics",
      score: 3
     },
     {
      host: "autoblog.com",
      interest: "Autos",
      score: 4
     },
     {
      host: "cracked.com",
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
      host: "sciencenews.com",
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

    for (let i = 0; i < cats.length; i++) {
      let item = cats[i];
      yield testUtils.addVisits(item.host,item.score,true);
    }

    // make sure that counts stay the same
    yield testController.resubmitHistory({flush: true});
    sranked = testController.getRankedInterestsForSurvey();
    for (let i = 0; i < cats.length; i++) {
      assert.equal(cats[9-i].interest, sranked[i].interest, "Interest match");
      assert.equal(cats[9-i].score, sranked[i].score, "Score match");
    }

    // now add a few extra interests and see if top/medium/low works
    // add Gossip
    yield testUtils.addVisits("tmz.com",11,true);
    yield testController.resubmitHistory({flush: true});

    // Gossip should be first and then shifteed by 1 cats
    sranked = testController.getRankedInterestsForSurvey();
    assert.equal("Gossip", sranked[0].interest);
    assert.equal(11, sranked[0].score);

    for (let i = 1; i < 6; i++) {
      assert.equal(cats[10-i].interest, sranked[i].interest, "Interest match");
      assert.equal(cats[10-i].score, sranked[i].score, "Score match");
    }

    // now add baseball
    yield testUtils.addVisits("hardballtimes.com",12,true);
    yield testUtils.addVisits("dezeen.com",13,true);
    yield testUtils.addVisits("ilounge.com",14,true);
    yield testController.resubmitHistory({flush: true});
    sranked = testController.getRankedInterestsForSurvey();
    testUtils.isIdentical(assert, sranked,
      [{"interest":"Apple","score":14},{"interest":"Home-Design","score":13},
       {"interest":"Baseball","score":12},{"interest":"Gossip","score":11},
       {"interest":"Music","score":9},{"interest":"Science","score":8},{"interest":"Television","score":7},
       {"interest":"Autos","score":4},{"interest":"Politics","score":3},{"interest":"Tennis","score":2}],
     "Top/Med/Low");

   } catch(ex) {
     dump(ex + " ERROROR \n");
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
    let testController = new Controller({rankType: "combined"});
    testController.clear()
    yield testController.resubmitHistory({flush: true});
    testUtils.isIdentical(assert, testController.getRankedInterests(), {"Autos":1}, "we should only see score 1 for 1 day");

    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY + 10});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY + 20});
    testController.clear()
    yield testController.resubmitHistory({flush: true});
    testUtils.isIdentical(assert, testController.getRankedInterests(), {"Autos":2}, "we should see score 2 for 2 days");
   } catch(ex) {
     dump(ex + " ERROROR \n");
   }
  }).then(done);
}

test.run(exports);
