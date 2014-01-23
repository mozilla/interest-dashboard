/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {HeadlinerPersonalizationAPI} = require("Headliner");
const {testUtils} = require("./helpers");
const {nsHttpServer} = require("sdk/test/httpd");
const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

exports["test Headliner client request"] = function test_HeadlinerRequest(assert, done) {
  Task.spawn(function() {
    let interests = {Arts:0.9, Autos:0.5, Design:0.3};
    let responseJSON = '{"d": [{"url": "http://www.nytimes.com/2013/12/01/automobiles/autoreviews/performer-available-for-private-parties.html?src=moz-up", "media": [{"caption": "The 2014 Mazda 3 flaunts Euro-style curves and intriguing shapes.", "type": "image", "media-metadata": [{"url": "http://graphics8.nytimes.com/images/2013/12/01/automobiles/SUB-WHEEL1/SUB-WHEEL1-thumbStandard.jpg", "width": 75, "height": 75, "format": "Standard Thumbnail"}, {"url": "http://graphics8.nytimes.com/images/2013/12/01/automobiles/SUB-WHEEL1/SUB-WHEEL1-thumbLarge.jpg", "width": 150, "height": 150, "format": "thumbLarge"}, {"url": "http://graphics8.nytimes.com/images/2013/12/01/automobiles/SUB-WHEEL1/SUB-WHEEL1-mediumThreeByTwo210.jpg", "width": 210, "height": 140, "format": "mediumThreeByTwo210"}], "copyright": "Mazda North America", "subtype": "photo"}], "title": "Performer Available for Private Parties"}], "num_articles": 1}';

    let server = new nsHttpServer();
    server.start(-1);
    let serverPort = server.identity.primaryPort;
    let serverUrl = "http://localhost:" + serverPort + "/post";

    let responseDeferred = Promise.defer();
    let testRequest = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      let body = NetUtil.readInputStreamToString(request._bodyInputStream, bodySize, {charset: "UTF-8"});
      let deserialized = JSON.parse(body);

      testUtils.isIdentical(assert, deserialized, interests, "unexpected interest data");
      response.setHeader("Content-Type", "application/json", false);
      response.setStatusLine(request.httpVersion, 200, "OK");
      response.write(responseJSON);
      responseDeferred.resolve();
    }

    server.registerPathHandler("/post", (request, response) => {
      testRequest(request, response);
    });

    let headliner = new HeadlinerPersonalizationAPI(serverUrl);
    let data = yield headliner.consume(interests);
    yield responseDeferred.promise;
    testUtils.isIdentical(assert, data, JSON.parse(responseJSON), "unexpected response data");
    server.stop(function(){});
  }).then(done);
}

exports["test Headliner client request error"] = function test_HeadlinerRequestError(assert, done) {
  Task.spawn(function() {
    let interests = {Arts:0.9, Autos:0.5, Design:0.3};

    let server = new nsHttpServer();
    server.start(-1);
    let serverPort = server.identity.primaryPort;
    let serverUrl = "http://localhost:" + serverPort + "/post";

    let responseDeferred = Promise.defer();
    let testRequest = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      response.setHeader("Content-Type", "text/plain", false);
      response.setStatusLine(request.httpVersion, 500, "Server Error");
      response.write("Internal Server error");
      responseDeferred.resolve();
    }

    server.registerPathHandler("/post", (request, response) => {
      testRequest(request, response);
    });

    let headliner = new HeadlinerPersonalizationAPI(serverUrl);
    let data = yield headliner.consume(interests);
    yield responseDeferred.promise;
    assert.equal(data, null, "consume returns null after an error");
    server.stop(function(){});
  }).then(done);
}

exports["test Headliner client refresh"] = function test_HeadlinerClientRefresh(assert, done) {
  Task.spawn(function() {
    let interests = {Arts:0.9, Autos:0.5, Design:0.3};

    let server = new nsHttpServer();
    server.start(-1);
    let serverPort = server.identity.primaryPort;
    let articleCount = 0;
    let articles = [];

    let failRequest = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      response.setHeader("Content-Type", "text/plain", false);
      response.setStatusLine(request.httpVersion, 500, "Server Error");
      response.write("Internal Server error");
    }
    let successRequest = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      articleCount += 1;
      response.setHeader("Content-Type", "application/json", false);
      response.setStatusLine(request.httpVersion, 200, "OK");
      articles.push({article: articleCount});
      response.write(JSON.stringify(articles));
    }

    server.registerPathHandler("/fail", (request, response) => {
      failRequest(request, response);
    });

    server.registerPathHandler("/success", (request, response) => {
      successRequest(request, response);
    });

    let failUrl = "http://localhost:" + serverPort + "/fail";
    let successUrl = "http://localhost:" + serverPort + "/success";

    let headliner = new HeadlinerPersonalizationAPI(successUrl);
    let oldData;
    let refreshed;
    let cachedData;

    cachedData = yield headliner.getContent(interests);
    refreshed = yield headliner.refreshContent(interests);
    assert.notEqual(refreshed.length, cachedData.length, "content should have been refreshed after a successful consume");

    oldData = refreshed;
    headliner._personalizationUrl = failUrl;
    refreshed = yield headliner.refreshContent(interests);
    assert.equal(refreshed, null, "result of a failed refresh should be null");
    cachedData = yield headliner.getContent(interests);
    testUtils.isIdentical(assert, cachedData, oldData, "content cache should still show old results");

    headliner._personalizationUrl = successUrl;
    refreshed = yield headliner.refreshContent(interests);
    cachedData = yield headliner.getContent(interests);
    testUtils.isIdentical(assert, cachedData, refreshed, "content cache should show new results");

    server.stop(function(){});
  }).then(done);
}

require("sdk/test").run(exports);
