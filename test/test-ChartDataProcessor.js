/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const test = require("sdk/test");
const {testUtils} = require("./helpers");
const {storage} = require("sdk/simple-storage");
const sampleData = require("./sampleData");
const chartData = require("./chartData");
const {ChartDataProcessor} = require("ChartDataProcessor");
const {TimelineDataProcessor} = require("ChartDataProcessor");
const {WeightIntensityDataProcessor} = require("ChartDataProcessor");
const {IntentInterestDataProcessor} = require("ChartDataProcessor");

exports["test consume"] = function test_consume(assert) {
  let chartDataProcessor = new ChartDataProcessor();
  let timelineDataProcessor = new TimelineDataProcessor();
  let weightIntensityDataProcessor = new WeightIntensityDataProcessor();
  let intentInterestDataProcessor = new IntentInterestDataProcessor();

  chartDataProcessor.clear();
  timelineDataProcessor.clear();
  weightIntensityDataProcessor.clear();
  intentInterestDataProcessor.clear();

  // Testing ChartDataProcessor's consume().
  let chartDataProcessorResults = chartDataProcessor.consume(sampleData.dayAnnotatedThree);
  testUtils.isIdentical(assert, JSON.stringify(storage.chartData.genericChartData),
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

  // Testing TimelineDataProcessor's consume()
  timelineDataProcessor.consume(chartDataProcessorResults);
  testUtils.isIdentical(assert, JSON.stringify(storage.chartData.timelineData),
    JSON.stringify(chartData.dayAnnotatedThreeTimelineConsumeResults), "Unexpected timeline data in storage");

  // Test expected properties are there
  for (let type in chartDataProcessorResults) {
    for (let namespace in chartDataProcessorResults[type]) {
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

  // Testing WeightIntensityDataProcessor's consume()
  weightIntensityDataProcessor.consume(chartDataProcessorResults);
  testUtils.isIdentical(assert, JSON.stringify(storage.chartData.weightIntensityData),
    JSON.stringify(chartData.dayAnnotatedThreeWeightIntensityConsumeResults), "Unexpected weight intensity data in storage");

  // Test expected properties are there
  for (let type in chartDataProcessorResults) {
    for (let namespace in chartDataProcessorResults[type]) {
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

  // Testing IntentInterestDataProcessor's consume()
  intentInterestDataProcessor.consume(chartDataProcessorResults);
  testUtils.isIdentical(assert, JSON.stringify(storage.chartData.intentInterestData),
    JSON.stringify(chartData.dayAnnotatedThreeIntentInterestConsumeResults), "Unexpected intent interest data in storage");

  //Test expected properties are there.
  for (let type in chartDataProcessorResults) {
    for (let namespace in chartDataProcessorResults[type]) {
      let intentInterestData = storage.chartData.intentInterestData;
      assert.equal(Object.keys(intentInterestData[type][namespace]).length, 2);
      assert.ok(intentInterestData[type][namespace].hasOwnProperty("sortedIntents"));
      assert.ok(intentInterestData[type][namespace].hasOwnProperty("sortedInterests"));
    }
  }
}

test.run(exports);
