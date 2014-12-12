/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");
const oldPromise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

const {WorkerFactory} = require("WorkerFactory");
const {UrlClassifier} = require("UrlClassifier");
const test = require("sdk/test");

exports["test interest classifier"] = function test_UrlClassifier(assert, done) {
  Task.spawn(function() {
    let workerFactory = new WorkerFactory();
    let workers = workerFactory.getInterestsWorkers();
    let urlClassifier = new UrlClassifier(workers);
    let results = yield urlClassifier.classifyPage("http://www.autoblog.com/","Drive honda");
    assert.equal(Object.keys(results).length, workers.length);
    assert.deepEqual(results["58-cat"].results,
          [{"type": "lwca", interests: ["uncategorized"], subcat: "dummy"},
           {"type":"rules","interests":["cars"]},
           {"type":"keywords","interests":[]},
           {"type":"combined","interests":["cars"]}
          ]);
    assert.deepEqual(results["edrules"].results,
          [{"type":"rules","interests":["Autos"]},
           {"type":"keywords","interests":[]},
           {"type":"combined","interests":["Autos"]},
          ]);
    // test for an error
    yield urlClassifier.classifyPage("not a url").then(result => {
      assert.ok(false);
    },
    error => {
      assert.ok(true);
    });

    // classify only the text
    results = yield urlClassifier.classifyPage(null, "iphone, ipad, apple, product, phone");
    assert.deepEqual(results["edrules"].results,
        [{"type":"rules","interests":[]},
         {"type":"keywords","interests":["Apple"]},
         {"type":"combined","interests":["Apple"]}
        ]);

  }).then(done);
}

test.run(exports);
