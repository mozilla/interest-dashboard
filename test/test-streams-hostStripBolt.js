/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");
const Promise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Task.jsm");

const {DateUtils} = require("DateUtils");
const {testUtils} = require("./helpers");
const {HostStripBolt} = require("streams/hostStripBolt");
const {Stream, createNode} = require("streams/core");
const test = require("sdk/test");

let today = DateUtils.today();
let dailyInterestMessage = {};
dailyInterestMessage[today] = {
  rules: {
    edrules: {
      Autos: {
        "autoblog.com": 3,
      },
      Sports: {
        "sportsblog.com": 2,
        "nba.com": 4,
      },
    }
  }
};

exports["test host strip"] = function test_hostStrip(assert, done) {
  Task.spawn(function() {
    let hostStripBolt = HostStripBolt.create();
    let stripped = yield hostStripBolt.consume(dailyInterestMessage);
    assert.equal(Object.keys(stripped[today]["rules"]["edrules"]).length, 2, "stripped data contains the same number of categories");
    assert.deepEqual(stripped[today]["rules"]["edrules"]["Autos"], [3], "stripped data contains enumerated data");
    assert.deepEqual(stripped[today]["rules"]["edrules"]["Sports"], [2,4], "stripped data contains multiple data points");
  }).then(done);
}

test.run(exports);
