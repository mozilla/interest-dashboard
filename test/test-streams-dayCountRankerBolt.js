"use strict";

const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");
const test = require("sdk/test");
const {DayCountRankerBolt} = require("streams/dayCountRankerBolt");
const {mergeObjects} = require("Utils");

let createMessage = function(namespace, type, options) {
  let numAutos = options.numAutos || 0;
  let numSports = options.numSports || 0;

  let testMessage = {};
  testMessage[type] = {};
  testMessage[type][namespace] = {};

  if (numAutos) {
    testMessage[type][namespace]["Autos"] = {"autos.com": numAutos};
  }

  if (numSports) {
    testMessage[type][namespace]["Sports"] = {"sports.com": numSports};
  }
  return testMessage;
}

exports["test persistence"] = function test_persistence(assert, done) {
  Task.spawn(function() {
    try {
      let ranker;

      let namespace = "namespace";
      let type = "persistence_test";
      let dataStore = {};

      ranker = DayCountRankerBolt.create(namespace, type, dataStore);
      yield ranker.consume({
        "1": createMessage(namespace, type, {numAutos: 1}),
        "2": createMessage(namespace, type, {numAutos: 1}),
      });
      assert.equal(ranker.getInterests().Autos, 2, "ranking should accumulate");
      // now recreate ranker and add two more days
      ranker = DayCountRankerBolt.create(namespace, type, dataStore);
      yield ranker.consume({
        "3": createMessage(namespace, type, {numAutos: 1}),
        "4": createMessage(namespace, type, {numAutos: 1}),
      });
      assert.equal(ranker.getInterests().Autos, 4, "ranking should be preserved across instances");
      ranker.clearStorage();
    } catch (ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test storage keys"] = function test_storageKeys(assert, done) {
  Task.spawn(function() {
    try {
      let dataStore = {};
      let rankerMeta = [{ns: "namespace", t: "storagekey_test"}, {ns: "namespace1", t: "storagekey_test1"}];
      let ranker = DayCountRankerBolt.create(rankerMeta[0].ns, rankerMeta[0].t, dataStore);
      let ranker1 = DayCountRankerBolt.create(rankerMeta[1].ns, rankerMeta[1].t, dataStore);

      let makeMergeMessage = function() {
        let msg1 = createMessage(rankerMeta[0].ns, rankerMeta[0].t, {numAutos: 1});
        let msg2 = createMessage(rankerMeta[1].ns, rankerMeta[1].t, {numAutos: 1});
        mergeObjects(msg1, msg2);
        return msg1;
      }

      yield ranker.consume({
        "1": makeMergeMessage(),
        "2": makeMergeMessage(),
        "3": makeMergeMessage(),
      });

      yield ranker1.consume({
        "1": makeMergeMessage(),
      });

      assert.equal(ranker.getInterests().Autos, 3, "ranking should accumulate");
      assert.equal(ranker1.getInterests().Autos, 1, "ranker1 should have a different ranking count");

      ranker.clearStorage();
      ranker1.clearStorage();
    } catch (ex) {
      console.error(ex);
    }
  }).then(done);
}

exports["test ranking"] = function test_ranking(assert, done) {
  Task.spawn(function() {
    try {
      let namespace = "namespace";
      let type = "ranking_test";

      let ranker = DayCountRankerBolt.create(namespace, type, {});

      yield ranker.consume({
        "1": createMessage(namespace, type, {numAutos: 1, numSports: 2}),
        "2": createMessage(namespace, type, {numAutos: 1}),
      });

      let ranking;

      ranking = ranker.getRanking();
      assert.equal(ranking.length, 2, "ranking should have the correct number of interests");
      assert.equal(ranking[0].interest, "Autos", "ranking should be in descending order");
      assert.equal(ranking[0].score, 2, "score should count occurences over 2 days");
      assert.equal(ranking[1].interest, "Sports", "ranking should be in descending order");
      assert.equal(ranking[1].score, 1, "score should count occurences over only 1 day");

      yield ranker.consume({
        "3": createMessage(namespace, type, {numSports: 1}),
        "4": createMessage(namespace, type, {numSports: 1}),
        "5": createMessage(namespace, type, {numSports: 1}),
      });
      ranking = ranker.getRanking();
      assert.equal(ranking.length, 2, "interests numbers should be the same");
      assert.equal(ranking[0].interest, "Sports", "ranking should be updated");
      assert.equal(ranking[0].score, 4, "score should be updated");

      ranker.clearStorage();
    } catch (ex) {
      console.error(ex);
    }
  }).then(done);
}

test.run(exports);
