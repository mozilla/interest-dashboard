/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {PrefsManager, StudyApp, NYTimesRecommendations} = require("Application");
const {testUtils} = require("./helpers");
const test = require("sdk/test");
const simplePrefs = require("simple-prefs");
const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");

exports["test NYTimesRecommendation pref changes"] = function test_NYT_init(assert, done) {
  // the pagemod is applied on init and when pref changes happen
  Task.spawn(function() {
    simplePrefs.prefs.consented = false;
    let deferred = Promise.defer();
    StudyApp.submitPromise = deferred.promise;
    deferred.resolve();

    simplePrefs.prefs.consented = true;
    PrefsManager.setObservers();

    let controller = {_dispatcher: {_enabled: false}};
    StudyApp.controller = controller;
    yield NYTimesRecommendations.init();

    simplePrefs.prefs.consented = false;
    assert.ok(NYTimesRecommendations.mod == null, "unsetting consent removes pagemod");
    assert.ok(NYTimesRecommendations.contentClient == null, "unsetting consent removes headliner client");

    simplePrefs.prefs.consented = true;
    assert.ok(NYTimesRecommendations.mod != null, "setting consent re-adds pagemod");
    assert.ok(NYTimesRecommendations.contentClient != null, "setting consent re-adds headliner client");
  }).then(_ => {
    PrefsManager.unsetObservers();
  }).then(done);
}

require("sdk/test").run(exports);
