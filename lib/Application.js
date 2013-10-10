/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {DateUtils} = require("DateUtils");
const {id,data} = require("self");
const {storage} = require("sdk/simple-storage");
const tabs = require("tabs");
const simplePrefs = require("simple-prefs")

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

const kIdleDaily = "idle-daily";
const kConsentUninstallThreshold = 30;
const kAppUrls = {
  "about:upstudy-consent": true,
  "about:upstudy": true,
}

let StudyApp = {
  controller: null,

  makeSurveyUrl: function _makeSurveyUrl() {
    // make a survey gizmo url
    let orderedInterests = StudyApp.controller.getRankedInterestsForSurvey();

    let url = "http://qsurvey.mozilla.com/s3/up-test-2?userID=" + StudyApp.controller.getUserID() +
              "&downloadSource=" + StudyApp.controller.getDownloadSource();
    let scoreList = "";

    let index = 0;
    while(index < orderedInterests.length) {
      url += "&interest" + (index+1) + "=" + orderedInterests[index].interest;
      scoreList += ((index) ? "," : "") + orderedInterests[index].score;
      index++;
    }
    // attach score list to url
    url += "&scoreList=" + scoreList;
    return url;
  },

  openSurveyTab: function _openSurveyTab() {
    tabs.open(StudyApp.makeSurveyUrl());
  },

  closeAppTabs: function _closeAppTabs() {
    let group = Promise.promised(Array);
    let promises = [];
    for each (let tab in tabs) {
      if (kAppUrls.hasOwnProperty(tab.url)) {
        let closePromise = Promise.defer();
        promises.push(closePromise);
        tab.close(_ => {
          closePromise.resolve();
        });
      }
    }
    return group(promises);
  },

  openConsentTab: function _openConsentTab({inBackground}) {
    if (inBackground == undefined) {
      inBackground = false;
    }
    tabs.open({
      url: "about:upstudy-consent",
      inBackground: inBackground,
    });
  },

  addonEventListener: {
    onUninstalling: function(addon) {
      if (addon.id == id) {
        Task.spawn(function() {
          yield StudyApp.closeAppTabs();
          StudyApp.controller.onUninstall();
          StudyApp.stopCountingDays();
        });
      }
    },

    onDisabling: function(addon){
      Task.spawn(function() {
        yield StudyApp.closeAppTabs();
        StudyApp.controller.onDisable();
        StudyApp.stopCountingDays();
      });
    },
  },

  observe: function _observe(aSubject, aTopic, aData) {
    if (aTopic == kIdleDaily) {
      let timeDiff = DateUtils.today() - storage.enableDate;
      if (timeDiff > kConsentUninstallThreshold) {
        if (!simplePrefs.prefs.consented) {
          StudyApp.uninstall();
        }
      }
    }
  },

  stopCountingDays: function _stopCountingDays() {
    /*
     * we count from enable date instead of install date
     * otherwise the add-on will be instantly uninstalled
     * after enabling if install > kConsentUninstallThreshold
     */
    delete storage.enableDate;
    let observers = Services.obs.enumerateObservers(kIdleDaily);
    while(observers.hasMoreElements()) {
        let obs = observers.getNext();
        if (obs === StudyApp) {
          Services.obs.removeObserver(obs, kIdleDaily);
        }
    }
  },

  startCountingDays: function _startCountingDays() {
    if (!storage.enableDate) {
      storage.enableDate = DateUtils.today();
    }
    Services.obs.addObserver(StudyApp, kIdleDaily, false);
  },

  uninstall: function _uninstall() {
    AddonManager.getAddonByID(id, addon => {
      StudyApp.closeAppTabs()
        .then(_ => {
          addon.uninstall();
        });
    });
  },
}

let PrefsManager = {
  dispatcher: null,

  onPrefChange: function(prefName) {
    switch (prefName) {
      case "server_url":
        PrefsManager.dispatcher._serverUrl = simplePrefs.prefs.server_url;
        break;
      case "consented":
        PrefsManager.dispatcher._enabled = simplePrefs.prefs.consented;
        if (simplePrefs.prefs.consented) {
          StudyApp.stopCountingDays();
        }
        else {
          StudyApp.startCountingDays();
        }
        break;
      case "dispatchIdleDelay":
        PrefsManager.dispatcher._dispatchIdleDelay = simplePrefs.prefs.dispatchIdleDelay;
        break;
    }
  },

  setObservers: function _setObservers() {
    simplePrefs.on("server_url", PrefsManager.onPrefChange);
    simplePrefs.on("consented", PrefsManager.onPrefChange);
    simplePrefs.on("dispatchIdleDelay", PrefsManager.onPrefChange);
  },

  unsetObservers: function _unsetObservers() {
    simplePrefs.removeListener("server_url", PrefsManager.onPrefChange);
    simplePrefs.removeListener("consented", PrefsManager.onPrefChange);
    simplePrefs.removeListener("dispatchIdleDelay", PrefsManager.onPrefChange);
  },

}

exports.StudyApp = StudyApp;
exports.PrefsManager = PrefsManager;
