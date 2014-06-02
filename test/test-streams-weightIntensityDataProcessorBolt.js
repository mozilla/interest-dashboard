/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {WeightIntensityDataProcessorBolt} = require("streams/weightIntensityDataProcessorBolt");
const test = require("sdk/test");
const {testUtils} = require("./helpers");
const {storage} = require("sdk/simple-storage");
const {Cc, Ci, Cu} = require("chrome");
const sampleData = require("./sampleData");
const chartData = require("./chartData");
Cu.import("resource://gre/modules/Task.jsm");

exports["test weight intensity data processing"] = function test_weightIntensityDataProcessing(assert, done) {
  Task.spawn(function() {
    let weightIntensityDataProcessorBolt = WeightIntensityDataProcessorBolt.create();
    yield weightIntensityDataProcessorBolt.consume(chartData.dayAnnotatedThreeChartProcessorConsumeResults);

    testUtils.isIdentical(assert, JSON.stringify(storage.chartData.weightIntensityData),
      JSON.stringify(chartData.dayAnnotatedThreeWeightIntensityConsumeResults), "Unexpected chart data in storage");

    // Test expected properties are there.
    let weightIntensityDataProcessorResults = storage.chartData.weightIntensityData;
    for (let type in weightIntensityDataProcessorResults) {
      for (let namespace in weightIntensityDataProcessorResults[type]) {
        let weightIntensityData = storage.chartData.weightIntensityData;
        assert.equal(Object.keys(weightIntensityData[type][namespace]).length, 6);
        assert.ok(weightIntensityData[type][namespace].hasOwnProperty("xMax"));
        assert.ok(weightIntensityData[type][namespace].hasOwnProperty("xMin"));
        assert.ok(weightIntensityData[type][namespace].hasOwnProperty("yMax"));
        assert.ok(weightIntensityData[type][namespace].hasOwnProperty("yMin"));
        assert.ok(weightIntensityData[type][namespace].hasOwnProperty("chartJSON"));
        assert.ok(weightIntensityData[type][namespace].hasOwnProperty("pointToInterestsMap"));
        for (let point of weightIntensityData[type][namespace]["chartJSON"]) {
          assert.equal(Object.keys(point).length, 2);
          assert.ok(point.hasOwnProperty("key"));
          assert.ok(point.hasOwnProperty("values"));
          for (let value of point["values"]) {
            assert.equal(Object.keys(value).length, 2);
            assert.ok(value.hasOwnProperty("x"));
            assert.ok(value.hasOwnProperty("y"));
          }
        }
      }
    }
  }).then(done);
}

test.run(exports);
