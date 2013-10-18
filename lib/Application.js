/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Factory, Unknown} = require("api-utils/xpcom");
const {Class} = require("sdk/core/heritage");
const {PageMod} = require("page-mod");
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
const kConsentUninstallDays = 30;
const kConsentCounts = {
  foreground: 3,
  uninstall: 4,
};
const kAppUrlSet = {
  "about:upstudy-consent": true,
  "about:upstudy": true,
};

let DevMenu = {
  factory: {
    contract: "@mozilla.org/network/protocol/about;1?what=upstudy",

    Component: Class({
      extends: Unknown,
      interfaces: ["nsIAboutModule"],

      newChannel: function(uri) {
        let chan = Services.io.newChannel(data.url("upstudy.html"), null, null);
        chan.originalURI = uri;
        return chan;
      },

      getURIFlags: function(uri) {
        return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
      }
    })
  },

  page: {
    contentScriptFile: [
      data.url("js/angular.min.js"),
      data.url("upstudy.js"),
    ],

    include: ["about:upstudy"],
    onAttach: function(worker) {
      worker.port.emit("style", data.url("css/bootstrap.min.css"));
      worker.port.emit("style", data.url("css/bootstrap-responsive.min.css"));
      worker.port.emit("style", data.url("css/styles.css"));

      worker.port.emit("message", {content: {topic: "ranking_data", data: StudyApp.controller.getRankedInterests()}});
      worker.port.emit("message", {content: {topic: "dispatch_batch", data: StudyApp.controller.getNextDispatchBatch()}});

      worker.port.on("history_process", function() {
        function processingDaysLeft(daysLeft) {
          worker.port.emit("message", {content: {topic: "days_left", data: daysLeft}});
        }
        StudyApp.controller.resubmitHistory({report: processingDaysLeft, flush: true}).then(() => {
          worker.port.emit("message", {content: {topic: "ranking_data", data: StudyApp.controller.getRankedInterests()}});
          worker.port.emit("message", {content: {topic: "dispatch_batch", data: StudyApp.controller.getNextDispatchBatch()}});
        });
      });

      worker.port.on("dispatch_run", function() {
        StudyApp.controller.dispatchData().then((daysSent) => {
          worker.port.emit("message", {content: {topic: "dispatch_success", data: daysSent}});
        },
        (reason) => {
          worker.port.emit("message", {content: {topic: "dispatch_error", data: reason}});
        });
      });

      worker.port.on("survey_run", function() {
        // make a survey gizmo url and send it to a different tab
        StudyApp.openSurveyTab();
      });

      worker.port.on("dispatch_get_next", function() {
        let data = StudyApp.controller.getNextDispatchBatch();
        worker.port.emit("message", {content: {topic: "dispatch_batch", data: data}});
      });

      worker.port.on("show_consent", function() {
        StudyApp.openConsentTab({inBackground: true});
      });
    }
  },
};

let ConsentPage = {
  factory: {
    contract: "@mozilla.org/network/protocol/about;1?what=upstudy-consent",

    Component: Class({
      extends: Unknown,
      interfaces: ["nsIAboutModule"],

      newChannel: function(uri) {
        let chan = Services.io.newChannel(data.url("consent.html"), null, null);
        chan.originalURI = uri;
        return chan;
      },

      getURIFlags: function(uri) {
        return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
      }
    })
  },

  page: {
    contentScriptFile: [
      data.url("js/angular.min.js"),
      data.url("js/ui-bootstrap-tpls-0.6.0.min.js"),
      data.url("consent.js"),
    ],

    include: ["about:upstudy-consent"],
    onAttach: function(worker) {
      worker.port.emit("style", data.url("css/bootstrap.min.css"));
      worker.port.emit("style", data.url("css/bootstrap-responsive.min.css"));
      worker.port.emit("style", data.url("css/styles.css"));

      worker.port.on("consented", function() {
        StudyApp.controller.recordConsent();
        StudyApp.stopCountdown();
        // replace tab with gizmo url
        worker.tab.url = StudyApp.makeSurveyUrl();
      });

      worker.port.on("uninstall", function() {
        // the user wants to remove the addon
        StudyApp.uninstall();
      });

      worker.port.emit("message", {content: {topic: "dispatch_batch", data: StudyApp.controller.getNextDispatchBatch()}});
    }
  },
};

let StudyApp = {
  controller: null,

  /** tabs and pages **/

  makeSurveyUrl: function _makeSurveyUrl() {
    // make a survey gizmo url
    let orderedInterests = StudyApp.controller.getRankedInterestsForSurvey();

    let url = "http://qsurvey.mozilla.com/s3/up-test-2?userID=" + StudyApp.controller.getUserID() +
              "&downloadSource=" + StudyApp.getDownloadSource();
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

  openConsentTab: function _openConsentTab({inBackground}) {
    storage.openConsentCount += 1;

    if (inBackground == undefined) {
      inBackground = true;
    }
    tabs.open({
      url: "about:upstudy-consent",
      inBackground: inBackground,
    });
  },

  closeAppTabs: function _closeAppTabs() {
    let group = Promise.promised(Array);
    let promises = [];
    for each (let tab in tabs) {
      if (kAppUrlSet.hasOwnProperty(tab.url)) {
        let closePromise = Promise.defer();
        promises.push(closePromise);
        tab.close(_ => {
          closePromise.resolve();
        });
      }
    }
    return group(promises);
  },

  /** event listeners and observers **/
  observe: function _observe(aSubject, aTopic, aData) {
    if (aTopic == kIdleDaily) {
      let timeDiff = DateUtils.today() - storage.enableDate;
      if (timeDiff > kConsentUninstallDays) {
        if (!simplePrefs.prefs.consented) {
          StudyApp.uninstall();
        }
      }
    }
  },

  /*
   * The uninstall countdowns are reset upon uninstalling or disabling of the application.
   */
  stopCountdown: function _stopCountdown() {
    delete storage.openConsentCount;
    delete storage.enableDate;
    let observers = Services.obs.enumerateObservers(kIdleDaily);
    while(observers.hasMoreElements()) {
        let obs = observers.getNext();
        if (obs === StudyApp) {
          Services.obs.removeObserver(obs, kIdleDaily);
        }
    }
  },

  /*
   * The application starts a countdown from the moment of enabling
   * the Addon. If either the conditions of:
   *    1. a consent display count
   *    2. a number of days has past
   * is met, the addon will be uninstalled.
   */
  startCountdown: function _startCountdown() {
    if (storage.openConsentCount == undefined) {
      storage.openConsentCount = 0;
    }

    if (!storage.enableDate) {
      storage.enableDate = DateUtils.today();
    }
    Services.obs.addObserver(StudyApp, kIdleDaily, false);
  },

  /** addon functionality **/

  init: function _init(controller) {
    StudyApp.controller = controller;

    // setup development menu
    Factory(DevMenu.factory);
    PageMod(DevMenu.page);

    // consent page
    Factory(ConsentPage.factory);
    PageMod(ConsentPage.page);

    // get addon source URL
    AddonManager.getAddonByID(id, addon => {
      if (addon && addon.sourceURI) {
        StudyApp.setSourceUri(addon.sourceURI);
      }
    });
  },

  uninstall: function _uninstall() {
    AddonManager.getAddonByID(id, addon => {
      StudyApp.closeAppTabs()
        .then(_ => {
          addon.uninstall();
        });
    });
  },

  unload: function(reason) {
    console.debug("Appication.unload: on " + reason);
    if (reason == "uninstall" || reason == "disable") {
      Task.spawn(function() {
        yield StudyApp.closeAppTabs();
        StudyApp.controller.onUninstalling();
        StudyApp.stopCountdown();
        PrefsManager.unsetObservers();
      });
    }
    else if(reason == "shutdown") {
      StudyApp.controller.stop();
    }
  },

  start: function _start({loadReason}) {
    console.debug("Appication.start: on " + loadReason);
    if (loadReason == "install") {
      /* upon addon install,
       * process history in the background and load a consent tab on completion */
      StudyApp.controller.submitHistory().then(() => {
        StudyApp.openConsentTab({inBackground: true});
      });
    }

    if (!simplePrefs.prefs.consented) {
      // if the user hasn't consented yet, check daily if the user has
      StudyApp.startCountdown();

      if (storage.openConsentCount+1 >= kConsentCounts.uninstall) {
        StudyApp.uninstall();
      }

      else {
        let inBackground = (storage.openConsentCount+1 < kConsentCounts.foreground);
        if (loadReason == "enable" || loadReason == "startup") {
          // and also open a consent tab if the user just enabled the app or started the browser
          StudyApp.controller.submitHistory().then(() => {
            StudyApp.openConsentTab({inBackground: inBackground});
          });
        }
      }
    }
    PrefsManager.setObservers();
  },

  setSourceUri: function(uri) {
    if (uri && uri.spec) {
      let spec = uri.spec;
      let source = "unknown";
      if (spec.contains("test-pilot")) {
        source = "test-pilot";
      }
      else if (spec.contains("partner")) {
        source = "partner";
      }
      else if (spec.contains("mechanical-turk")) {
        source = "mechanical-turk";
      }
      storage.downloadSource = source;
    }
  },

  getDownloadSource: function() {
    return storage.downloadSource;
  },


};

let PrefsManager = {
  onPrefChange: function(prefName) {
    switch (prefName) {
      case "server_url":
        StudyApp.controller._dispatcher._serverUrl = simplePrefs.prefs.server_url;
        break;
      case "consented":
        StudyApp.controller._dispatcher._enabled = simplePrefs.prefs.consented;
        if (simplePrefs.prefs.consented) {
          StudyApp.stopCountdown();
        }
        else {
          StudyApp.startCountdown();
        }
        break;
      case "dispatchIdleDelay":
        StudyApp.controller._dispatcher._dispatchIdleDelay = simplePrefs.prefs.dispatchIdleDelay;
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

};

exports.DevMenu = DevMenu;
exports.ConsentPage = ConsentPage;
exports.StudyApp = StudyApp;
exports.PrefsManager = PrefsManager;
