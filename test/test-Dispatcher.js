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

const {nsHttpServer, startServerAsync} = require("sdk/test/httpd");
const simplePrefs = require("sdk/simple-prefs")
const test = require("sdk/test");

const {Controller} = require("Controller");
const {Dispatcher} = require("Dispatcher");
const {InterestStorageBolt} = require("streams/interestStorageBolt");
const {testUtils} = require("./helpers");
const {getRelevantPrefs, getUserAgentLocale} = require("Utils");
const {StudyApp} = require("Application");
const {getTLDCounts} = require("HistoryReader");
const {Crypto} = require("Crypto");
const {NYTimesHistoryVisitor} = require("NYTimesHistoryVisitor");
const {NYTUtils} = require("NYTUtils");
const sampleData = require("./sampleData");

StudyApp.setSourceUri(NetUtil.newURI("http://localhost"));

// create uuid, which is assumed to be created in the Controller
simplePrefs.prefs.uuid = uuid.generateUUID().toString().slice(1, -1).replace(/-/g, "");

function makeTestPayload(referencePayload, interests, storage) {
  let nytUtils = new NYTUtils(storage);
  let nytHistoryVisitor = new NYTimesHistoryVisitor(storage);
  return {
    payloadDate: referencePayload.payloadDate,
    uuid: simplePrefs.prefs.uuid,
    prefs: getRelevantPrefs(),
    source: storage.downloadSource || null,
    installDate: storage.installDate || null,
    updateDate: storage.updateDate || null,
    version: storage.version || null,
    locale: getUserAgentLocale(),
    tldCounter: getTLDCounts(storage),
    hasSurveyInterests: Crypto.hasMappedInterests(simplePrefs.prefs.uuid),
    nytVisits: nytHistoryVisitor.getVisits() || [],
    nytUserData: nytUtils.getNYTUserData(),
    interests: interests || storage.interests || null
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
  let storageBackend = {};
  let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1, storageBackend: storageBackend});

  assert.deepEqual(storageBackend.interests, {}, "interests storage isn't initialized");
}

exports["test _makePayload"] = function test__makePayload(assert, done) {
  Task.spawn(function() {
    let storageBackend = {};
    let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1, storageBackend: storageBackend});

    let interestStorageBolt = InterestStorageBolt.create(storageBackend);
    interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedOne});
    interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedTwo});

    let payload = null;

    // size limit is big enough to include both days
    payload = dispatcher._makePayload(1024*256);
    assert.deepEqual(payload, makeTestPayload(payload, null, storageBackend), "unexpected payload data");

    // size limit is big enough to only include one day. earlier day will be picked due to sorting
    payload = dispatcher._makePayload(0);
    assert.deepEqual(payload, makeTestPayload(payload, sampleData.dayAnnotatedOne, storageBackend), "unexpected payload data");

    dispatcher.clear();
    assert.deepEqual(storageBackend.interests, {}, "interests storage isn't cleared");
  }).then(done);
}

exports["test _deletedays"] = function test__DeleteDays(assert, done) {
  Task.spawn(function() {
    let storageBackend = {};
    let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1, storageBackend: storageBackend});
    storageBackend.interests = {};

    let interestStorageBolt = InterestStorageBolt.create(storageBackend);
    interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedOne});
    interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedTwo});

    let days = Object.keys(storageBackend.interests);

    assert.equal(Object.keys(storageBackend.interests).length, 2);
    dispatcher._deleteDays([days[0]]);
    assert.equal(Object.keys(storageBackend.interests).length, 1);
    dispatcher._deleteDays([days[0]]);
    assert.equal(Object.keys(storageBackend.interests).length, 1);
    dispatcher._deleteDays([days[1]]);
    assert.equal(Object.keys(storageBackend.interests).length, 0);
  }).then(done);
}

exports["test _dispatch"] = function test__Dispatch(assert, done) {
  Task.spawn(function() {
    let server = new nsHttpServer();
    server.start(-1);
    let serverPort = server.identity.primaryPort
    let serverUrl = "http://localhost:" + serverPort + "/post";

    yield StudyApp.saveAddonInfo();
    let storageBackend = {};
    let dispatcher = new Dispatcher(serverUrl, {enabled: true, dispatchIdleDelay: 1, storageBackend: storageBackend});
    let interestStorageBolt = InterestStorageBolt.create(storageBackend);
    yield interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedOne});
    yield interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedTwo});
    let payload = dispatcher._makePayload(1024*256);

    let responseDeferred = Promise.defer();

    let testPayload = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      let body = NetUtil.readInputStreamToString(request._bodyInputStream, bodySize, {charset: "UTF-8"});
      assert.ok(body);

      let deserialized = JSON.parse(body);

      assert.deepEqual(deserialized, makeTestPayload(deserialized, null, storageBackend), "unexpected payload data");

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
    assert.deepEqual(storageBackend.interests, {}, "interests storage isn't cleared");
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
    let storageBackend = {};
    let dispatcher = new Dispatcher(serverUrl, {enabled: true, dispatchIdleDelay: 1, storageBackend: storageBackend});
    let interestStorageBolt = InterestStorageBolt.create(storageBackend);
    yield interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedOne});
    yield interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedTwo});
    let payload = dispatcher._makePayload(1024*256);

    let responseDeferred = Promise.defer();

    let testPayload = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      let body = NetUtil.readInputStreamToString(request._bodyInputStream, bodySize, {charset: "UTF-8"});
      assert.ok(body);

      let deserialized = JSON.parse(body);
      assert.deepEqual(deserialized, makeTestPayload(deserialized, null, storageBackend), "unexpected payload data");

      response.setHeader("Content-Type", "text/plain", false);
      response.setStatusLine(request.httpVersion, 201, "OK");
      responseDeferred.resolve();
    }

    // test registration
    server.registerPathHandler("/post", (request, response) => {
      testPayload(request, response);
    });
    let daysInStorage = Object.keys(storageBackend.interests);

    // observe notification
    let transmitNotifDeferred = Promise.defer();
    let observeTransmission =  {
      observe: (aSubject, aTopic, aData) => {
        if  (aTopic != "dispatcher-payload-transmission-complete") {
          throw "UNEXPECTED_OBSERVER_TOPIC " + aTopic;
        }
        assert.deepEqual(aData, daysInStorage.join(","), "transmission contains unexpected items");
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

    assert.deepEqual({}, storageBackend.interests, "storage should have been cleared");
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
    let storageBackend = {};
    let dispatcher = new Dispatcher(serverUrl, {enabled: true, dispatchIdleDelay: 1, storageBackend: storageBackend});
    let interestStorageBolt = InterestStorageBolt.create(storageBackend);
    yield interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedOne});
    yield interestStorageBolt.consume({meta: {}, message: sampleData.dayAnnotatedTwo});
    let payload = dispatcher._makePayload(1024*256);

    let responseDeferred = Promise.defer();

    let testPayload = (request, response) => {
      let bodySize = request._bodyInputStream.available();
      let body = NetUtil.readInputStreamToString(request._bodyInputStream, bodySize, {charset: "UTF-8"});
      assert.ok(body);

      let deserialized = JSON.parse(body);
      assert.deepEqual(deserialized, makeTestPayload(deserialized, null, storageBackend), "unexpected payload data");

      response.setHeader("Content-Type", "text/plain", false);
      response.setStatusLine(request.httpVersion, 500, "Server Error");
      responseDeferred.resolve();
    }

    // test registration
    server.registerPathHandler("/post", (request, response) => {
      testPayload(request, response);
    });
    let daysInStorage = Object.keys(storageBackend.interests);

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

    assert.equal(true, Object.keys(storageBackend.interests).length > 0, "storage should not have been cleared");

    server.stop(function(){});
    // clean up
    storageBackend.interests = {};
  }).then(_ => {
    removeObservers();
  }).then(done);
}

exports["test consent verification"] = function test__consent_verification(assert, done) {
  Task.spawn(function() {
    let storageBackend = {};
    let dispatcher = new Dispatcher("http://example.com", {enabled: false, dispatchIdleDelay: 1, storageBackend: storageBackend});

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
  let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1, storageBackend: {}});
  let payloadObject = dispatcher._makePayloadObject();
  assert.equal(payloadObject.locale, "en-US");
}

exports["test idle-daily dispatch"] = function test_IdleDailyDispatch(assert, done) {
  Task.spawn(function() {
    let testController = new Controller();
    testController.clear();

    let dispatcher = new Dispatcher("http://example.com", {enabled: false, dispatchIdleDelay: 1, storageBackend: {}});
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
  let dispatcher = new Dispatcher("http://example.com", {enabled: true, dispatchIdleDelay: 1, storageBackend: {}});
  dispatcher.addExtraParameterToPayload("p1","v1");
  let payloadObject = dispatcher._makePayloadObject();
  assert.equal(payloadObject.p1, "v1");
}

exports["test mozhosts interests dispatch"] = function test_MozhostsInterestsDispatch(assert, done) {
  Task.spawn(function() {

    let hostArray = ["www.autoblog.com"];
    yield testUtils.promiseClearHistory();
    yield testUtils.addVisits(hostArray,2);
    let testController = new Controller({storage: {}});
    testController.clear();
    yield testController.submitHistory({flush: true});
    let batch = testController.getNextDispatchBatch();
    assert.deepEqual(
      batch.mozhostsInterests,
      {"1":{"interests":{"Autos":300},"frecency":300}},
      "mozhostsInterests are present and valid");
  }).then(_ => {
    removeObservers();
  }).then(done);
}

test.run(exports);
