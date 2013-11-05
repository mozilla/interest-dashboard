/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");
const Promise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

const {DateUtils,MICROS_PER_DAY} = require("DateUtils");
const {testUtils} = require("./helpers");
const {DayCountRanker} = require("DayCountRanker");
const test = require("sdk/test");

let testBucket = {
  "type": {
    "namespace": {
      "Autos": {
        "autos.com": 1,
      },
    },
  },
  "type1": {
    "namespace1": {
      "Autos": {
        "autos.com": 1,
      },
    },
  },
};

exports["test persistency"] = function test_Persistency(assert, done) {
  Task.spawn(function() {
    try {
      let ranker = new DayCountRanker("namespace","type");
      ranker.consume({
        "1": testBucket,
        "2": testBucket,
      });
      assert.equal(ranker.getRanking().Autos, 2);
      // now recreate ranker and add two more days
      ranker = new DayCountRanker("namespace","type");
      ranker.consume({
        "3": testBucket,
        "4": testBucket,
      });
      assert.equal(ranker.getRanking().Autos, 4);
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

exports["test storage keys"] = function test_StorageKeys(assert, done) {
  Task.spawn(function() {
    try {
      let ranker = new DayCountRanker("namespace","type");
      let ranker1 = new DayCountRanker("namespace1","type1");
      ranker.clear();
      ranker1.clear();

      ranker.consume({
        "1": testBucket,
        "2": testBucket,
        "3": testBucket,
      });

      ranker1.consume({
        "1": testBucket,
      });

      assert.equal(ranker.getRanking().Autos, 3);
      assert.equal(ranker1.getRanking().Autos, 1);
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

test.run(exports);
