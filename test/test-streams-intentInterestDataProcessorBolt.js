/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {IntentInterestDataProcessorBolt} = require("streams/intentInterestDataProcessorBolt");
const test = require("sdk/test");
const {testUtils} = require("./helpers");
const {storage} = require("sdk/simple-storage");
const {Cc, Ci, Cu} = require("chrome");
const sampleData = require("./sampleData");
const chartData = require("./chartData");
Cu.import("resource://gre/modules/Task.jsm");

exports["test intent interest data processing"] = function test_intentInterestDataProcessing(assert, done) {
  Task.spawn(function() {
    let intentInterestDataProcessorBolt = IntentInterestDataProcessorBolt.create();
    yield intentInterestDataProcessorBolt.consume({meta: {}, message: chartData.dayAnnotatedThreeChartProcessorConsumeResults});

    testUtils.isIdentical(assert, JSON.stringify(storage.chartData.intentInterestData),
      JSON.stringify(chartData.dayAnnotatedThreeIntentInterestConsumeResults), "Unexpected chart data in storage");

    // Test expected properties are there.
    let intentInterestDataProcessorResults = storage.chartData.intentInterestData;
    for (let type in intentInterestDataProcessorResults) {
      for (let namespace in intentInterestDataProcessorResults[type]) {
        let intentInterestData = storage.chartData.intentInterestData;
        assert.equal(Object.keys(intentInterestData[type][namespace]).length, 2);
        assert.ok(intentInterestData[type][namespace].hasOwnProperty("sortedIntents"));
        assert.ok(intentInterestData[type][namespace].hasOwnProperty("sortedInterests"));
      }
    }
  }).then(done);
}

test.run(exports);
