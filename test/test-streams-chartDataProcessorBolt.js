/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {ChartDataProcessorBolt} = require("streams/chartDataProcessorBolt");
const test = require("sdk/test");
const {testUtils} = require("./helpers");
const {storage} = require("sdk/simple-storage");
const {Cc, Ci, Cu} = require("chrome");
const sampleData = require("./sampleData");
const chartData = require("./chartData");
Cu.import("resource://gre/modules/Task.jsm");

exports["test chart data processing"] = function test_chartDataProcessing(assert, done) {
  Task.spawn(function() {
    let chartDataProcessorBolt = ChartDataProcessorBolt.create();
    let chartDataProcessorResults = yield chartDataProcessorBolt.consume(sampleData.dayAnnotatedThree);

    testUtils.isIdentical(assert, JSON.stringify(chartDataProcessorResults),
      JSON.stringify(chartData.dayAnnotatedThreeChartProcessorConsumeResults), "Unexpected chart data in storage");

    // Test expected properties are there.
    for (let type in chartDataProcessorResults) {
      for (let namespace in chartDataProcessorResults[type]) {
        assert.equal(Object.keys(chartDataProcessorResults[type][namespace]).length, 9);
        assert.ok(chartDataProcessorResults[type][namespace].hasOwnProperty("_type"));
        assert.ok(chartDataProcessorResults[type][namespace].hasOwnProperty("_namespace"));
        assert.ok(chartDataProcessorResults[type][namespace].hasOwnProperty("categories"));
        assert.ok(chartDataProcessorResults[type][namespace].hasOwnProperty("sortedInterests"));
        assert.ok(chartDataProcessorResults[type][namespace].hasOwnProperty("sortedIntents"));
        assert.ok(chartDataProcessorResults[type][namespace].hasOwnProperty("xMax"));
        assert.ok(chartDataProcessorResults[type][namespace].hasOwnProperty("xMin"));
        assert.ok(chartDataProcessorResults[type][namespace].hasOwnProperty("yMax"));
        assert.ok(chartDataProcessorResults[type][namespace].hasOwnProperty("yMin"));
      }
    }
  }).then(done);
}

test.run(exports);
