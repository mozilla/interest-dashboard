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

const {WorkerFactory} = require("WorkerFactory");
const {KeywordExtractor} = require("KeywordExtractor");
const {testUtils} = require("./helpers");
const test = require("sdk/test");

exports["test keyword extractor"] = function test_keyword_extractor(assert, done) {
  Task.spawn(function() {
    let workerFactory = new WorkerFactory();
    let workers = workerFactory.getKeywordsWorkers();
    let keywordExtractor = new KeywordExtractor(workers);
    let results = yield keywordExtractor.extractKeywords("http://www.autoblog.com/","Drive honda");
    assert.equal(Object.keys(results).length, workers.length);
  }).then(done);
}

test.run(exports);
