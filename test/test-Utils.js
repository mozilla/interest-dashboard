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

const simplePrefs = require("sdk/simple-prefs");
const test = require("sdk/test");

const {promiseTimeout, getRelevantPrefs, computeInterestsFromHosts} = require("Utils");
const {testUtils} = require("./helpers");

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
    "privacy.donottrackheader.value": Services.prefs.getIntPref("privacy.donottrackheader.value"),
    "privacy.donottrackheader.enabled":Services.prefs.getBoolPref("privacy.donottrackheader.enabled"),
    "browser.privatebrowsing.autostart": Services.prefs.getBoolPref("browser.privatebrowsing.autostart"),
    "browser.urlbar.autocomplete.enabled": Services.prefs.getBoolPref("browser.urlbar.autocomplete.enabled"),
    "browser.urlbar.default.behavior": Services.prefs.getIntPref("browser.urlbar.default.behavior"),
    "network.cookie.cookieBehavior": Services.prefs.getIntPref("network.cookie.cookieBehavior"),
    "network.cookie.lifetimePolicy": Services.prefs.getIntPref("network.cookie.lifetimePolicy"),
    "privacy.sanitize.sanitizeOnShutdown": Services.prefs.getBoolPref("privacy.sanitize.sanitizeOnShutdown"),
    "places.history.enabled": Services.prefs.getBoolPref("places.history.enabled"),
    "browser.formfill.enable":Services.prefs.getBoolPref("browser.formfill.enable"),
    "nytimes_personalization_start": simplePrefs.prefs.nytimes_personalization_start
  };
  testUtils.isIdentical(assert,prefs,expected);
  done();
}

exports["test computeInterestsFromHosts"] = function test_ComputeInterestsFromHosts(assert, done) {
  let interestsData = {
    "salon.com" : {
       "__ANY" : [
          "Politics"
       ]
    },
    "autoblog.com" : {
       "__ANY" : [
          "Auto"
       ]
    },
    "mozilla.org" : {
       "__ANY" : [
          "Computers"
       ]
    },
    "foo.com" : {
       "__ANY" : [
          "FOO"
       ]
    },
  };

  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      yield testUtils.addVisits("www.autoblog.com", 4);
      yield testUtils.addVisits("mozilla.org", 3);
      yield testUtils.addVisits("salon.com", 2);

      let results = yield computeInterestsFromHosts(interestsData);
      testUtils.isIdentical(assert, results, {
        "1":{"interests":{"Auto":500},"frecency":500},
        "2":{"interests":{"Auto":500,"Computers":400},"frecency":400},
        "3":{"interests":{"Auto":500,"Computers":400,"Politics":300},"frecency":300}
      });
      for (let i = 0; i < 20; i++) {
        yield testUtils.addVisits(i + "dummy.com", 1);
      }
      yield testUtils.addVisits("foo.com", 1);
      results = yield computeInterestsFromHosts(interestsData);
      assert.equal(Object.keys(results).length,4);
      testUtils.isIdentical(assert, results["24"], {"interests":{"Auto":500,"Computers":400,"Politics":300,"FOO":200},"frecency":200});
    } catch (ex) {
      dump( ex + " ERROR\n");
    }
  }).then(done);
}

test.run(exports);
