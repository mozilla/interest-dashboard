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

const {Controller} = require("Controller");
const {DateUtils,MICROS_PER_DAY} = require("DateUtils");
const {testUtils} = require("./helpers");
const {storage} = require("sdk/simple-storage");
const test = require("sdk/test");
const simplePrefs = require("simple-prefs");

exports["test controller"] = function test_Controller(assert, done) {
  Task.spawn(function() {
    try {
      yield testUtils.promiseClearHistory();
      let today = DateUtils.today();

      let microNow = Date.now() * 1000;
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 4*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 3*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.autoblog.com/"), visitDate: microNow});

      // step one day into future to flush the DayBuffer
      DateUtils.sendIntoFuture(1);

      let testController = new Controller();
      testController.clear();
      yield testController.resubmitFullHistory();

      // we should only see 3 urls being processed, hten Autos should nly contain 3 days
      testUtils.isIdentical(assert, testController.getRankedInterests(), {"Autos":4}, "4 Autos");

      let payload = testController.getNextDispatchBatch();
      let days = Object.keys(payload.interests);
      // make sure that the history data is keyed on 4,5, and 6 th day
      testUtils.isIdentical(assert, days ,  ["" + (today-4), "" + (today-3), "" + (today-2), "" + today], "4 days upto today");

      // add one more visits for today and make sure we pick them up
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.thehill.com/"), visitDate: microNow });
      yield testUtils.promiseAddVisits({uri: NetUtil.newURI("http://www.rivals.com/"), visitDate: microNow });

      let observer = {
        observe: function(aSubject, aTopic, aData) {
          try {
            if  (aTopic != "controller-history-submission-complete") {
              throw "UNEXPECTED_OBSERVER_TOPIC " + aTopic;
            }
            // we should see the 3 intersts now
            testUtils.isIdentical(assert, testController.getRankedInterests(), {"Autos":4,"Politics":1,"Sports":1}, "should see 3 intresests");
            // and we must see 4 day in the keys
            payload = testController.getNextDispatchBatch();
            days = Object.keys(payload.interests);
            testUtils.isIdentical(assert, days ,  ["" + (today-4), "" + (today-3), "" + (today-2), "" + today],"still 4 days");
            Services.obs.removeObserver(observer, "controller-history-submission-complete");
            done();
          } catch (ex) {
            dump( ex + " ERROR\n");
          }
        },
      };

      Services.obs.addObserver(observer, "controller-history-submission-complete" , false);
      Services.obs.notifyObservers(null, "idle-daily", null);
    } catch(ex) {
      dump( ex + " ERROR\n");
    }
  });
}

exports["test controller prefs"] = function test_ControllerPrefs(assert) {
  let testController = new Controller();
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
