/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {data} = require("sdk/self");
const test = require("sdk/test");

const {testUtils} = require("./helpers");
const {Cc, Ci} = require("chrome");
const tabs = require("sdk/tabs");

exports["test bleach"] = function test_Bleach(assert,done) {
 // this script tests bleach cleansing for pairs of input and expected strings
 let testScript = "self.port.on('test', function(inStr, expectStr, isURL) { " +
                  " let res;" +
                  " if (isURL) res = Bleach.sanitizeURL(inStr);" +
                  " else res = Bleach.clean(inStr, {strip: true, tags: []});" +
                  " self.port.emit('test', {test: inStr, expect: expectStr, result: res}); " +
                  "});";
 let testCases = [
  ["hello", "hello"],
  ["&amp; this is awesome", "&amp; this is awesome"],
  ["a <a href=\"javascript:evilness()\">i'll be good i promise</a>", "a i'll be good i promise"],
  ["some thing pretending to be a url", "#", true],
  ["http://test.com", "http&#58;&#47;&#47;test&#46;com", true]
 ];

 let testedCases = testCases.length;
 tabs.open({
  url: "data:text/html,Hello Window",
  onOpen: function onOpen(tab) {
    let worker = tab.attach({
      contentScriptFile: [data.url("js/bleach.js")],
      contentScript: testScript,
    });
    worker.port.on('test', function(tested) {
      //dump(JSON.stringify(tested) + "<<<\n");
      assert.equal(tested.expect, tested.result);
      testedCases--;
      if(testedCases==0) {
        done();
      }
    });
    testCases.forEach(tCase => {
      worker.port.emit("test", tCase[0], tCase[1], tCase[2]);
    });
  }});
};

test.run(exports);
