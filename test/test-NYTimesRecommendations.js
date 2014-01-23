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

    let controller = {_dispatcher: {_enabled: false}, getRankedInterests: function() {return {};}};
    StudyApp.controller = controller;
    yield NYTimesRecommendations.init();

    simplePrefs.prefs.consented = false;
    assert.ok(NYTimesRecommendations.mod == null, "unsetting consent removes pagemod");
    assert.ok(NYTimesRecommendations.contentClient == null, "unsetting consent removes headliner client");
    assert.ok(NYTimesRecommendations.refreshTaskId == null, "there should be no active refresh task");

    simplePrefs.prefs.consented = true;
    assert.ok(NYTimesRecommendations.mod != null, "setting consent re-adds pagemod");
    assert.ok(NYTimesRecommendations.contentClient != null, "setting consent re-adds headliner client");
    assert.ok(NYTimesRecommendations.refreshTaskId != null, "there should be an active refresh task");

    let oldRefreshTaskId = NYTimesRecommendations.refreshTaskId;
    simplePrefs.prefs.headliner_refresh_interval = 3600;
    assert.notEqual(NYTimesRecommendations.refreshTaskId, oldRefreshTaskId, "refresh task id should have changed");

  }).then(_ => {
    PrefsManager.unsetObservers();
  }).then(done);
}

exports["test NYTimesRecommendation getInterests"] = function test_NYT_getInterests(assert) {
  let userInterestSample = null;
  let orderedInterests = null;

  NYTimesRecommendations.allowedInterestSet = {
    "Arts": true,
    "Basketball": true,
    "Tennis": true,
    "Fashion-Men": true,
    "Video-Games": true,
    "Do-It-Yourself": true
  }

  StudyApp.controller = {
    getRankedInterests: function() {
      return userInterestSample;
    }
  }

  userInterestSample = {'Video-Games': 42, 'Arts': 3, 'Basketball': 18, 'Humor': 41, 'Do-It-Yourself': 55, 'Tennis': 13, 'Fashion-Men': 14};
  orderedInterests = NYTimesRecommendations.getTop5Interests();
  assert.equal(Object.keys(orderedInterests).length, 5, "At most 5 are returned");

  userInterestSample = {'Gossip': 51, 'Arts': 3};
  orderedInterests = NYTimesRecommendations.getTop5Interests();
  assert.equal(Object.keys(orderedInterests).length, 1, "Only allowed interests are let through");
}

exports["test NYTimesRecommendation transformData"] = function test_NYT_transformData(assert) {
  let rawData = {
    "d": [
      {
        "media": [
          {
            "caption": "The 2014 Mazda 3 flaunts Euro-style curves and intriguing shapes.", 
            "copyright": "Mazda North America", 
            "media-metadata": [
              {
                "format": "Standard Thumbnail", 
                "height": 75, 
                "url": "http://graphics8.nytimes.com/images/2013/12/01/automobiles/SUB-WHEEL1/SUB-WHEEL1-thumbStandard.jpg", 
                "width": 75
              }, 
              {
                "format": "thumbLarge", 
                "height": 150, 
                "url": "http://graphics8.nytimes.com/images/2013/12/01/automobiles/SUB-WHEEL1/SUB-WHEEL1-thumbLarge.jpg", 
                "width": 150
              }, 
              {
                "format": "mediumThreeByTwo210", 
                "height": 140, 
                "url": "http://graphics8.nytimes.com/images/2013/12/01/automobiles/SUB-WHEEL1/SUB-WHEEL1-mediumThreeByTwo210.jpg", 
                "width": 210
              }
            ], 
            "subtype": "photo", 
            "type": "image"
          }
        ], 
        "title": "Performer Available for Private Parties", 
        "url": "http://www.nytimes.com/2013/12/01/automobiles/autoreviews/performer-available-for-private-parties.html?src=moz-up"
      }
    ], 
    "num_articles": 1
  };
  let data = NYTimesRecommendations.transformData(rawData);
  assert.equal(data.length, 1, "one object in results expected");
  assert.equal(Object.keys(data[0]).length, 4, "four attributes in object expected");
}

exports["test NYTimesRecommendation periodic refresh task"] = function test_NYT_periodicRefreshTask(assert, done) {
  Task.spawn(function() {
    NYTimesRecommendations.debug = true;
    simplePrefs.prefs.consented = true;

    let deferred = Promise.defer();
    StudyApp.submitPromise = deferred.promise;
    deferred.resolve();
    yield NYTimesRecommendations.init();

    assert.ok(NYTimesRecommendations.refreshTaskId != null, "there should be an active refresh task");

    let clientConsumeDeferred = Promise.defer();
    let numConsumed = 0;
    NYTimesRecommendations.contentClient.consume = function() {
      numConsumed += 1;
      assert.ok(true, "refresh task has run");
      if (numConsumed > 1) {
        assert.ok(true, "refresh task has run recurrently");
        clientConsumeDeferred.resolve();
      }
    }

    simplePrefs.prefs.headliner_refresh_interval = 1;
    NYTimesRecommendations.unsetContentRefresh();
    assert.ok(NYTimesRecommendations.refreshTaskId == null, "there should be no active refresh task");
    NYTimesRecommendations.setContentRefresh();
    assert.ok(NYTimesRecommendations.refreshTaskId != null, "there should be an active refresh task");

    yield clientConsumeDeferred.promise;
  }).then(done);
}

exports["test personalization timestamp"] = function test_PersonalizationTimestamp(assert, done) {
  Task.spawn(function() {
    let now = Date.now();
    yield NYTimesRecommendations.init();
    let personalizationStart = simplePrefs.prefs.nytimes_personalization_start;
    // since other tests may already set nytimes_personalization_start, let's at least make sure
    // that nytimes_personalization_start is witnin 10 minutes of now
    assert.ok(Math.abs(parseInt(personalizationStart) - now) < 10*60*1000)

    // also test that repeated calling to NYTimesRecommendations.init, does not reset it
    yield NYTimesRecommendations.destroy();
    yield NYTimesRecommendations.init();
    assert.equal(personalizationStart, simplePrefs.prefs.nytimes_personalization_start);
  }).then(done);
}

require("sdk/test").run(exports);
