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

const {Controller} = require("Controller");
const {DateUtils,MICROS_PER_DAY} = require("DateUtils");
const {testUtils} = require("./helpers");
const test = require("sdk/test");

exports["test matching workers"] = function test_MatchingWorkers(assert, done) {
  Task.spawn(function() {
    yield testUtils.promiseClearHistory();

    let microNow = Date.now() * 1000;
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 4*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});


    let testController = testUtils.setupTestController();
    let processDeferred;
    let today = DateUtils.today();

    processDeferred = Promise.defer();
    testController._streamObjects.interestStorageBolt.setEmitCallback(bolt => {
      if (bolt.storage.interests.hasOwnProperty(today)) {
        processDeferred.resolve();
      }
    });
    yield testController.submitHistory({flush: true});
    yield processDeferred.promise;
    testController._streamObjects.interestStorageBolt.setEmitCallback(undefined);

    let payload = testController.getNextDispatchBatch();

    assert.deepEqual(payload["interests"]["" + today]["rules"]["edrules"], {"Autos":[1]}, "edrules model test");
    assert.deepEqual(payload["interests"]["" + today]["rules"]["edrules_extended"], {"Autos":[1]}, "edrules_extended model test");
    assert.deepEqual(payload["interests"]["" + today]["rules"]["58-cat"], {"cars":[1]}, "58-cat model test");
    assert.deepEqual(payload["interests"]["" + (today-4)]["rules"]["edrules"], {"Autos":[1]}, "edrules model test");
    assert.deepEqual(payload["interests"]["" + (today-4)]["rules"]["edrules_extended"], {"Autos":[1]}, "edrules_extended model test");
    assert.deepEqual(payload["interests"]["" + (today-4)]["rules"]["58-cat"], {"cars":[1]}, "58-cat model test");
    assert.deepEqual(payload["interests"]["" + (today-4)]["keywords"]["edrules_extended"], {"Autos":[1]}, "edrules_extended model test");

    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.nytimes.com/"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.nytimes.com/thepage"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.foxnews.com/"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.foxnews.com/thepage"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.cnn.com/"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.cnn.com/thepage"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.washingtonpost.com/"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.washingtonpost.com/thepage"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.mitbbs.com/"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.mitbbs.com/thepage"), visitDate: microNow});
    yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.mitbbs.com/thepage1"), visitDate: microNow});
    testController.clear();

    processDeferred = Promise.defer();
    testController._streamObjects.interestStorageBolt.setEmitCallback(bolt => {
      if (bolt.storage.interests.hasOwnProperty(today)) {
        processDeferred.resolve();
      }
    });
    yield testController.submitHistory({flush: true});
    yield processDeferred.promise;
    testController._streamObjects.interestStorageBolt.setEmitCallback(undefined);

    payload = testController.getNextDispatchBatch();

    assert.deepEqual(payload["interests"]["" + today]["rules"]["58-cat"],
      {"cars":[1],"news":[2,2,2,2,3],"__news_counter":[2,2,2,2],"__news_home_counter":[1,1,1,1],"politics":[2],"tv":[2]});

  }).then(done);
}

test.run(exports);
