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
XPCOMUtils.defineLazyServiceGetter(this, "uuid",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");

const {storage} = require("sdk/simple-storage");
const {nsHttpServer, startServerAsync} = require("sdk/test/httpd");
const test = require("sdk/test");
const simplePrefs = require("simple-prefs")

const {Controller} = require("Controller");
const {Dispatcher} = require("Dispatcher");
const {testUtils} = require("./helpers");
const {getRelevantPrefs} = require("Utils");
const {StudyApp} = require("Application");
const {getTLDCounts} = require("HistoryReader");
const {Crypto} = require("Crypto");
const {NYTimesHistoryVisitor} = require("NYTimesHistoryVisitor");
const {NYTUtils} = require("NYTUtils");
const sampleData = require("./sampleData");

StudyApp.setSourceUri(NetUtil.newURI("http://localhost"));

// create uuid, which is assumed to be created in the Controller
simplePrefs.prefs.uuid = uuid.generateUUID().toString().slice(1, -1).replace(/-/g, "");

function makeTestPayload(referencePayload, interests) {
  return {
    payloadDate: referencePayload.payloadDate,
    uuid: simplePrefs.prefs.uuid,
    prefs: getRelevantPrefs(),
    source: storage.downloadSource,
    installDate: storage.installDate,
    updateDate: storage.updateDate,
    version: storage.version,
    locale: Services.prefs.getCharPref("general.useragent.locale"),
    tldCounter: getTLDCounts(),
    hasSurveyInterests: Crypto.hasMappedInterests(simplePrefs.prefs.uuid),
    nytVisits: NYTimesHistoryVisitor.getVisits() || [],
    nytUserData: NYTUtils.getNYTUserData(),
    interests: interests || storage.interests
  };
}

const notifTopics = ["dispatcher-payload-transmission-complete", "idle-daily", "idle"];
function removeObservers() {
  try {
    for (let topic of notifTopics) {
      let observers = Services.obs.enumerateObservers(topic);
      while(observers.hasMoreElements()) {
        let obs = observers.getNext();
        Services.obs.removeObserver(obs, topic);
      }
    }
  } catch(e) {
    dump("error: " + e + "\n");
  }
}

exports["test init"] = function test_init(assert) {
  let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1});

  testUtils.isIdentical(assert, storage.interests, {}, "interests storage isn't initialized");
}

exports["test consume"] = function test_consume(assert) {
  let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1});

  dispatcher.consume(sampleData.dayAnnotatedOne);
  testUtils.isIdentical(assert, storage.interests, sampleData.dayAnnotatedOne, "unexpected interest data in storage");
  dispatcher.consume(sampleData.dayAnnotatedTwo);
  testUtils.isIdentical(assert, Object.keys(storage.interests).length, 2, "new data isn't consumed");

  dispatcher.clear();
  testUtils.isIdentical(assert, storage.interests, {}, "interests storage isn't cleared");
}

exports["test _makePayload"] = function test__makePayload(assert) {
  let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1});

  dispatcher.consume(sampleData.dayAnnotatedOne);
  dispatcher.consume(sampleData.dayAnnotatedTwo);

  let payload = null;

  // size limit is big enough to include both days
  payload = dispatcher._makePayload(1024*256);
  testUtils.isIdentical(assert, payload, makeTestPayload(payload), "unexpected payload data");

  // size limit is big enough to only include one day. earlier day will be picked due to sorting
  payload = dispatcher._makePayload(0);
  testUtils.isIdentical(assert, payload, makeTestPayload(payload, sampleData.dayAnnotatedOne), "unexpected payload data");

  dispatcher.clear();
  testUtils.isIdentical(assert, storage.interests, {}, "interests storage isn't cleared");
}

exports["test _deletedays"] = function test__DeleteDays(assert) {
  let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1});

  dispatcher.consume(sampleData.dayAnnotatedOne);
  dispatcher.consume(sampleData.dayAnnotatedTwo);

  let days = Object.keys(storage.interests);

  testUtils.isIdentical(assert, Object.keys(storage.interests).length, 2);
  dispatcher._deleteDays([days[0]]);
  testUtils.isIdentical(assert, Object.keys(storage.interests).length, 1);
  dispatcher._deleteDays([days[0]]);
  testUtils.isIdentical(assert, Object.keys(storage.interests).length, 1);
  dispatcher._deleteDays([days[1]]);
  testUtils.isIdentical(assert, Object.keys(storage.interests).length, 0);
}

exports["test _dispatch"] = function test__Dispatch(assert, done) {
  Task.spawn(function() {
    let server = new nsHttpServer();
    server.start(-1);
    let serverPort = server.identity.primaryPort
    let serverUrl = "http://localhost:" + serverPort + "/post";

    yield StudyApp.saveAddonInfo();
    let dispatcher = new Dispatcher(serverUrl, {enabled: true, dispatchIdleDelay: 1});
    dispatcher.consume(sampleData.dayAnnotatedOne);
    dispatcher.consume(sampleData.dayAnnotatedTwo);
    let payload = dispatcher._makePayload(1024*256);

    let responseDeferred = Promise.defer();

    let testPayload = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      let body = NetUtil.readInputStreamToString(request._bodyInputStream, bodySize, {charset: "UTF-8"});
      assert.ok(body);

      let deserialized = JSON.parse(body);
      testUtils.isIdentical(assert, deserialized, makeTestPayload(deserialized), "unexpected payload data");

      response.setHeader("Content-Type", "text/plain", false);
      response.setStatusLine(request.httpVersion, 201, "OK");
      responseDeferred.resolve();
    }

    // test registration
    server.registerPathHandler("/post", (request, response) => {
      testPayload(request, response);
    });

    yield dispatcher._dispatch(serverUrl, payload);
    yield responseDeferred.promise;

    server.stop(function(){});
    dispatcher.clear();
    testUtils.isIdentical(assert, storage.interests, {}, "interests storage isn't cleared");
  }).then(_ => {
    removeObservers();
  }).then(done);
}

exports["test _sendPing"] = function test__sendPing(assert, done) {
  Task.spawn(function() {
    let server = new nsHttpServer();
    server.start(-1);
    let serverPort = server.identity.primaryPort;
    let serverUrl = "http://localhost:" + serverPort + "/post";

    yield StudyApp.saveAddonInfo();
    let dispatcher = new Dispatcher(serverUrl, {enabled: true, dispatchIdleDelay: 1});
    dispatcher.consume(sampleData.dayAnnotatedOne);
    dispatcher.consume(sampleData.dayAnnotatedTwo);
    let payload = dispatcher._makePayload(1024*256);

    let responseDeferred = Promise.defer();

    let testPayload = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      let body = NetUtil.readInputStreamToString(request._bodyInputStream, bodySize, {charset: "UTF-8"});
      assert.ok(body);

      let deserialized = JSON.parse(body);
      testUtils.isIdentical(assert, deserialized, makeTestPayload(deserialized), "unexpected payload data");

      response.setHeader("Content-Type", "text/plain", false);
      response.setStatusLine(request.httpVersion, 201, "OK");
      responseDeferred.resolve();
    }

    // test registration
    server.registerPathHandler("/post", (request, response) => {
      testPayload(request, response);
    });
    let daysInStorage = Object.keys(storage.interests);

    // observe notification
    let transmitNotifDeferred = Promise.defer();
    let observeTransmission =  {
      observe: (aSubject, aTopic, aData) => {
        if  (aTopic != "dispatcher-payload-transmission-complete") {
          throw "UNEXPECTED_OBSERVER_TOPIC " + aTopic;
        }
        testUtils.isIdentical(assert, aData, daysInStorage.join(","), "transmission contains unexpected items");
        transmitNotifDeferred.resolve();
      },
    }
    Services.obs.addObserver(observeTransmission, "dispatcher-payload-transmission-complete", false);

    // launch work
    dispatcher.setObserveIdle();
    Services.obs.notifyObservers(null, "idle", null);

    // server should have responded
    yield responseDeferred.promise;

    // notification should be sent
    yield transmitNotifDeferred.promise;

    testUtils.isIdentical(assert, {}, storage.interests, "storage should have been cleared");
    server.stop(function(){});
  }).then(_ => {
    removeObservers();
  }).then(done);
}

exports["test _sendPing fail"] = function test__sendPingFail(assert, done) {
  Task.spawn(function() {
    let server = new nsHttpServer();
    server.start(-1);
    let serverPort = server.identity.primaryPort
    let serverUrl = "http://localhost:" + serverPort + "/post";

    yield StudyApp.saveAddonInfo();
    let dispatcher = new Dispatcher(serverUrl, {enabled: true, dispatchIdleDelay: 1});
    dispatcher.consume(sampleData.dayAnnotatedOne);
    dispatcher.consume(sampleData.dayAnnotatedTwo);
    let payload = dispatcher._makePayload(1024*256);

    let responseDeferred = Promise.defer();

    let testPayload = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      let body = NetUtil.readInputStreamToString(request._bodyInputStream, bodySize, {charset: "UTF-8"});
      assert.ok(body);

      let deserialized = JSON.parse(body);
      testUtils.isIdentical(assert, deserialized, makeTestPayload(deserialized), "unexpected payload data");

      response.setHeader("Content-Type", "text/plain", false);
      response.setStatusLine(request.httpVersion, 500, "Server Error");
      responseDeferred.resolve();
    }

    // test registration
    server.registerPathHandler("/post", (request, response) => {
      testPayload(request, response);
    });
    let daysInStorage = Object.keys(storage.interests);

    // observe notification
    let transmitNotifDeferred = Promise.defer();
    let observeTransmission =  {
      observe: (aSubject, aTopic, aData) => {
        if  (aTopic != "dispatcher-payload-transmission-failure") {
          throw "UNEXPECTED_OBSERVER_TOPIC " + aTopic;
        }
        assert.equal(aData, "HTTP Error 500 Server Error", "transmission contains unexpected items");
        transmitNotifDeferred.resolve();
      },
    }
    Services.obs.addObserver(observeTransmission, "dispatcher-payload-transmission-failure", false);

    // launch work
    dispatcher.setObserveIdle();
    Services.obs.notifyObservers(null, "idle", null);

    // server should have responded
    yield responseDeferred.promise;

    // notification should be sent
    yield transmitNotifDeferred.promise;

    testUtils.isIdentical(assert, true, Object.keys(storage.interests).length > 0, "storage should not have been cleared");

    server.stop(function(){});
    // clean up
    storage.interests = {};
  }).then(_ => {
    removeObservers();
  }).then(done);
}

exports["test consent verification"] = function test__consent_verification(assert, done) {
  Task.spawn(function() {
    let dispatcher = new Dispatcher("http://example.com", {enabled: false, dispatchIdleDelay: 1});

    dispatcher._sendPing = function(aUrl) {
      assert.fail("_sendPing should not run without consent");
    }
    dispatcher.setObserveIdle();
    Services.obs.notifyObservers(null, "idle", null);

    let sendPingDeferred = Promise.defer();
    dispatcher._enabled = true;
    dispatcher._sendPing = function(aUrl) {
      assert.ok(true, "_sendPing should run with consent");
      sendPingDeferred.resolve();
    }
    dispatcher.setObserveIdle();
    Services.obs.notifyObservers(null, "idle", null);
    yield sendPingDeferred.promise;
  }).then(_ => {
    removeObservers();
  }).then(done);
}

exports["test locale"] = function test_locale(assert) {
  let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1});
  let payloadObject = dispatcher._makePayloadObject();
  assert.equal(payloadObject.locale, "en-US");
}

exports["test idle-daily dispatch"] = function test_IdleDailyDispatch(assert, done) {
  Task.spawn(function() {
    let testController = new Controller();
    testController.clear();

    let dispatcher = new Dispatcher("http://example.com", {enabled: false, dispatchIdleDelay: 1});
    testController._dispatcher = dispatcher;

    let sendPingDeferred = Promise.defer();
    dispatcher._enabled = true;
    dispatcher._sendPing = function(aUrl) {
      assert.ok(true, "_sendPing should run at idle-daily");
      sendPingDeferred.resolve();
    }
    Services.obs.notifyObservers(null, "idle-daily", null);
    yield sendPingDeferred.promise;
    testController.clear();
  }).then(_ => {
    removeObservers();
  }).then(done);
}

exports["test addExtraParameterToPayload"] = function test_addExtraParameterToPayload(assert) {
  let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1});
  dispatcher.addExtraParameterToPayload("p1","v1");
  let payloadObject = dispatcher._makePayloadObject();
  assert.equal(payloadObject.p1, "v1");
}

test.run(exports);
