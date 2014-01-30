/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");

const {storage} = require("sdk/simple-storage");
const {nsHttpServer, startServerAsync} = require("sdk/test/httpd");
const test = require("sdk/test");
const {NYTUtils} = require("NYTUtils");
const {testUtils} = require("./helpers");

// setup nyt-m cookie
Services.cookies.add(".nytimes.com", "/", "nyt-m", "t=i.10&v=i.20&l=l.25", false, false, false, Date.now() / 1000 + 100000);

exports["test fetchNYTUserData"] = function test_fetchNYTUserData(assert, done) {
  Task.spawn(function() {
    let server = new nsHttpServer();
    server.start(-1);
    let serverPort = server.identity.primaryPort
    let serverUrl = "http://localhost:" + serverPort + "/post";
    let responseJSON = {
        "meta": {},
        "data": {
          "id": "0",
          "name": "",
          "subscription": {
            "web": "0",
            "mobile": "0",
            "crosswords": "0",
            "hd": "0"
          }
        }
    };

    NYTUtils._nytUserDataUrl = serverUrl;

    // test registration
    server.registerPathHandler("/post", (request, response) => {
      assert.equal(request.method, "GET");
      response.setHeader("Content-Type", "application/json; charset=utf8", false);
      response.setStatusLine(request.httpVersion, 200, "OK");
      response.write(JSON.stringify(responseJSON));
    });

    yield NYTUtils.fetchNYTUserData();
    let userInfo = NYTUtils.getNYTUserData();
    server.stop(function(){});
    // add visit count to expected jason user info
    responseJSON.visitCount = 20;
    // ensure userInfo is timestamped
    assert.ok(userInfo.timeStamp);
    // add it to the expected response
    responseJSON.timeStamp = userInfo.timeStamp;
    testUtils.isIdentical(assert, userInfo, responseJSON);
  }).then(done);
}

test.run(exports);
