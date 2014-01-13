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

const {Cc, Ci, Cu} = require("chrome");
const {storage} = require("sdk/simple-storage");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");

exports["test PrefsManager prefs"] = function test_PrefsManagerPrefs(assert) {
  let testController = new Controller();
  StudyApp.controller = testController;
  StudyApp.submitPromise = Promise.defer().promise;
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

exports["test AMO source attribution"] = function test_AMOSourceAttribution(assert) {
  let urls = [
    {url: "https://example.com/foo/bar.xpi", src: "unknown"},
    {url: "https://example.com/foo/bar.xpi?", src: "unknown"},
    {url: "https://example.com/foo/bar.xpi?foo=bar", src: "unknown"},
    {url: "https://example.com/foo/bar.xpi?src=bar", src: "bar"},
    {url: "https://example.com/foo/bar.xpi?src=test-pilot", src: "test-pilot"},
    {url: "https://example.com/foo/bar.xpi?src=partner-2", src: "partner-2"},
    {url: "https://example.com/foo/bar.xpi?src=0", src: "0"},
    {url: "https://example.com/foo/bar.xpi?src=0#abc", src: "0"},
    {url: "https://example.com/foo/bar.xpi?foo=bar&src=0", src: "0"},
  ];

  for (let data of urls) {
    let uri = NetUtil.newURI(data.url);
    StudyApp.setSourceUri(uri);
    testUtils.isIdentical(assert, storage.downloadSource, data.src);
  }
}

test.run(exports);
