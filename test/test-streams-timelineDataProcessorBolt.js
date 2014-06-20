/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {TimelineDataProcessorBolt} = require("streams/timelineDataProcessorBolt");
const test = require("sdk/test");
const {testUtils} = require("./helpers");
const {Cc, Ci, Cu} = require("chrome");
const sampleData = require("./sampleData");
const chartData = require("./chartData");
Cu.import("resource://gre/modules/Task.jsm");

exports["test timeline data processing"] = function test_timelineDataProcessing(assert, done) {
  Task.spawn(function() {
    let storage = {};
    let timelineDataProcessorBolt = TimelineDataProcessorBolt.create(storage);
    yield timelineDataProcessorBolt.consume({meta: {}, message: chartData.dayAnnotatedThreeChartProcessorConsumeResults});

    assert.deepEqual(JSON.stringify(storage.chartData.timelineData),
      JSON.stringify(chartData.dayAnnotatedThreeTimelineConsumeResults), "Unexpected chart data in storage");

    // Test expected properties are there.
    let timelineDataProcessorResults = storage.chartData.timelineData
    for (let type in timelineDataProcessorResults) {
      for (let namespace in timelineDataProcessorResults[type]) {
        let timelineData = storage.chartData.timelineData;
        assert.equal(Object.keys(timelineData[type][namespace]).length, 2);
        assert.ok(timelineData[type][namespace].hasOwnProperty("interestList"));
        assert.ok(timelineData[type][namespace].hasOwnProperty("chartJSON"));
        for (let point of timelineData[type][namespace]["chartJSON"]) {
          assert.equal(Object.keys(point).length, 2);
          assert.ok(point.hasOwnProperty("key"));
          assert.ok(point.hasOwnProperty("values"));
          for (let value of point["values"]) {
            assert.equal(Object.keys(value).length, 4);
            assert.ok(value.hasOwnProperty("x"));
            assert.ok(value.hasOwnProperty("y"));
            assert.ok(value.hasOwnProperty("size"));
            assert.ok(value.hasOwnProperty("domainList"));
          }
        }
      }
    }
  }).then(done);
}

test.run(exports);
