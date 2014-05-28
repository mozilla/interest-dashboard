"use strict";

const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");

const {DateUtils} = require("DateUtils");
const {InterestStorageBolt} = require("streams/interestStorageBolt");
const test = require("sdk/test");

let today = DateUtils.today();
let hostlessInterestMessage = {};
hostlessInterestMessage[today] = {
  rules: {
    edrules: {
      Autos: [3],
      Sports: [2, 4],
    }
  }
};

exports["test interestStorageBolt"] = function test_interestStoragebolt(assert, done) {
  Task.spawn(function() {
    let storage = {};
    let interestStorageBolt = InterestStorageBolt.create(storage);

    yield interestStorageBolt.consume(hostlessInterestMessage);

    assert.deepEqual(storage.interests[today].rules.edrules, {Autos: [3], Sports: [2, 4]}, "storage backend contains interests");
  }).then(done);
};

test.run(exports);
