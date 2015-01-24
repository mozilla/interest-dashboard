/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {ChartDataProcessorBolt} = require("streams/chartDataProcessorBolt");
const {SpiderDataProcessorBolt} = require("streams/spiderDataProcessorBolt");
const test = require("sdk/test");
const {testUtils} = require("./helpers");
const {Cc, Ci, Cu} = require("chrome");
const sampleData = require("./sampleData");
const chartData = require("./chartData");
Cu.import("resource://gre/modules/Task.jsm");

exports["test spider data processing"] = function test_spiderDataProcessing(assert, done) {
  Task.spawn(function() {
    assert.ok(true);
    let chartDataProcessorBolt = ChartDataProcessorBolt.create({});
    let chartDataProcessorResults = (yield chartDataProcessorBolt.consume({meta: {}, message: sampleData.dayAnnotatedThree})).message;

    let spiderDataProcessorBolt = SpiderDataProcessorBolt.create({});
    let spiderDataProcessorResults = (yield spiderDataProcessorBolt.consume({meta: {}, message: chartDataProcessorResults})).message;//.message["chartData"];

    // Checking for the correct keys in the spider data results
    assert.equal(Object.keys(spiderDataProcessorResults).length, 4, "There are 4 keys in the output of spider data processor");
    assert.ok(spiderDataProcessorResults.hasOwnProperty("nodes"), "The 'nodes' key is in the data processor output");
    assert.ok(spiderDataProcessorResults.hasOwnProperty("links"), "The 'links' key is in the data processor output");
    assert.ok(spiderDataProcessorResults.hasOwnProperty("categoricalNodes"), "The 'categoricalNodes' key is in the data processor output");
    assert.ok(spiderDataProcessorResults.hasOwnProperty("categoricalLinks"), "The 'categoricalLinks' key is in the data processor output");

    assert.equal(Object.keys(spiderDataProcessorResults.nodes).length, 3, "There are 3 keys in 'nodes'");
    assert.equal(Object.keys(spiderDataProcessorResults.links).length, 2, "There are 2 keys in 'links'");
    assert.equal(Object.keys(spiderDataProcessorResults.categoricalNodes).length, 2, "There are 2 keys in 'categoricalNodes'");
    assert.equal(Object.keys(spiderDataProcessorResults.categoricalLinks).length, 2, "There are 2 keys in 'categoricalLinks'");
  }).then(done);
}

test.run(exports);
