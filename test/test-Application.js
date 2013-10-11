/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {PrefsManager, StudyApp} = require("Application");
const {Controller} = require("Controller");
const {testUtils} = require("./helpers");
const test = require("sdk/test");
const simplePrefs = require("simple-prefs");

exports["test PrefsManager prefs"] = function test_PrefsManagerPrefs(assert) {
  let testController = new Controller();
  StudyApp.controller = testController;
  PrefsManager.setObservers();

  let dispatcher = testController._dispatcher;

  let dispatcherProperties = [
                              {pref: "consented", obj: "_enabled", value: true},
                              {pref: "server_url", obj: "_serverUrl", value: "http://example.com/userprofile"},
                              {pref: "dispatchIdleDelay", obj: "_dispatchIdleDelay", value: 5}
  ];

  dispatcherProperties.forEach(prop => {
    testUtils.isIdentical(assert, simplePrefs.prefs[prop.pref], dispatcher[prop.obj]);
    simplePrefs.prefs[prop.pref] = prop.value;
    testUtils.isIdentical(assert, simplePrefs.prefs[prop.pref], dispatcher[prop.obj]);
  });
}

test.run(exports);
