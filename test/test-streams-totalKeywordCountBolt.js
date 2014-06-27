"use strict";

const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");

const {DateUtils} = require("DateUtils");
const {TotalKeywordCountBolt} = require("streams/totalKeywordCountBolt");
const test = require("sdk/test");

let today = DateUtils.today();
let keywordWorkerOutput = {
  results: [
    {
      type: "groovy",
      keywords: ["toejam", "earl", "aliens", "earth"]
    },
    {
      type: "awesome",
      keywords: ["earthworm", "jim", "psycrow", "flying", "cow", "aliens"]
    },
    {
      type: "fantastic",
      keywords: ["cool", "spot", "sunglasses"]
    },
  ]
};

function setExpectedResults(count) {
  let keywordCounts = {};
  for (let typeData of keywordWorkerOutput.results) {
    if (keywordCounts[typeData.type] == null) {
      keywordCounts[typeData.type] = {};
    }
    for (let kw of typeData.keywords) {
      keywordCounts[typeData.type][kw] = count;
    }
  }
  return keywordCounts;
}

exports["test totalKeywordCountBolt"] = function test_totalKeywordCountBolt(assert, done) {
  Task.spawn(function() {
      let dateVisits = {};
      dateVisits[today-2] = 1;

      let storage = {};
      let totalKeywordCountBolt = TotalKeywordCountBolt.create(storage);

      yield totalKeywordCountBolt.consume({meta: {}, message: [{details: keywordWorkerOutput, dateVisits: dateVisits}]});

      let keywordCounts;

      keywordCounts = setExpectedResults(1);
      assert.deepEqual(storage.keywordCounts, keywordCounts, "storage backend contains keyword counts");
      assert.equal(totalKeywordCountBolt.numFromToday, 2, "numFromToday counter is set correctly");

      dateVisits = {};
      dateVisits[today-1] = 1;

      yield totalKeywordCountBolt.consume({meta: {}, message: [{details: keywordWorkerOutput, dateVisits: dateVisits}]});
      keywordCounts = setExpectedResults(2);
      assert.deepEqual(storage.keywordCounts, keywordCounts, "keyword counts are incremental");
      assert.equal(totalKeywordCountBolt.numFromToday, 1, "numFromToday updates correctly");

  }).then(done);
};

test.run(exports);
