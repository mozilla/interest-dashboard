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

const {promiseTimeout, getRelevantPrefs} = require("Utils");
const simplePrefs = require("simple-prefs");
const {testUtils} = require("./helpers");
const test = require("sdk/test");

exports["test promiseTimeout"] = function test_promiseTimeout(assert, done) {
  Task.spawn(function() {
    let then = Date.now();
    yield promiseTimeout(3000);
    let passedTime = Date.now() - then;
    assert.ok( passedTime >= (3000 * 0.99), "passed time should be close to delay");
    done();
  });
}

exports["test getRelevantPrefs"] = function test_GetRelevantPrefs(assert, done) {
  let prefs = getRelevantPrefs();
  let expected = {
    "privacy.donottrackheader.value":1,
    "privacy.donottrackheader.enabled":false,
    "browser.privatebrowsing.autostart":false,
    "browser.urlbar.autocomplete.enabled": true,
    "browser.urlbar.default.behavior": 0,
    "network.cookie.cookieBehavior": 0,
    "network.cookie.lifetimePolicy": 0,
    "privacy.sanitize.sanitizeOnShutdown":false,
    "places.history.enabled":true,
    "browser.formfill.enable":true,
    "nytimes_personalization_start": simplePrefs.prefs.nytimes_personalization_start
  };
  testUtils.isIdentical(assert,prefs,expected);
  done();
}


test.run(exports);
