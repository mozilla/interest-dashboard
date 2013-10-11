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


    let testController = new Controller();
    testController.clear();
    yield testController.resubmitHistory({flush: true});

    let today = DateUtils.today();
    let payload = testController.getNextDispatchBatch();

    testUtils.isIdentical(assert, payload["interests"]["" + today]["rules"]["edrules"], {"Autos":[1]}, "edrules model test");
    testUtils.isIdentical(assert, payload["interests"]["" + today]["rules"]["edrules_extended"], {"Autos":[1]}, "edrules_extended model test");
    testUtils.isIdentical(assert, payload["interests"]["" + today]["rules"]["58-cat"], {"cars":[1]}, "58-cat model test");
    testUtils.isIdentical(assert, payload["interests"]["" + (today-4)]["rules"]["edrules"], {"Autos":[1]}, "edrules model test");
    testUtils.isIdentical(assert, payload["interests"]["" + (today-4)]["rules"]["edrules_extended"], {"Autos":[1]}, "edrules_extended model test");
    testUtils.isIdentical(assert, payload["interests"]["" + (today-4)]["rules"]["58-cat"], {"cars":[1]}, "58-cat model test");
    done();
  });
}

test.run(exports);
