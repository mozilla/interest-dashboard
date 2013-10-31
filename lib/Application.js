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
const simplePrefs = require("simple-prefs");
const querystring = require("querystring");

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
      worker.port.emit("style", data.url("css/devmenu/bootstrap.min.css"));
      worker.port.emit("style", data.url("css/devmenu/bootstrap-responsive.min.css"));
      worker.port.emit("style", data.url("css/devmenu/styles.css"));

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
      worker.port.emit("style", data.url("css/consent/responsive-min.css"));
      worker.port.emit("style", data.url("css/consent/styleguide-min.css"));
      worker.port.emit("style", data.url("css/consent/styles.css"));

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

    let url = "https://www.surveygizmo.com/s3/1368483/firefox-personalization?userID=" + StudyApp.controller.getUserID() +
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
    console.debug("StudyApp.openConsentTab open_count:"+storage.openConsentCount);

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
      StudyApp.setSourceUri(addon.sourceURI);
    });
  },

  saveAddonInfo: function _saveAddonInfo() {
    let savedPromise = Promise.defer();
    AddonManager.getAddonByID(id, addon => {
      storage.installDate = "" + addon.installDate;
      storage.updateDate = "" + addon.updateDate;
      storage.version = "" + addon.version;
      savedPromise.resolve();
    });
    return savedPromise.promise;
  },

  uninstall: function _uninstall() {
    console.debug("StudyApp.uninstall");
    AddonManager.getAddonByID(id, addon => {
      StudyApp.closeAppTabs()
        .then(_ => {
          addon.uninstall();
        });
    });
  },

  unload: function(reason) {
    console.debug("StudyApp.unload: on " + reason);
    if(reason == "shutdown") {
      // on shutdown, stop the controller and do NOT clean storage
      StudyApp.controller.stop();
    }
    else {
      // for all other reasons: uninstall/disable/upgrade/downgrade
      // stop controller and clean the storage
      StudyApp.controller.stopAndClearStorage();
      // then stop the rest of the application
      Task.spawn(function() {
        yield StudyApp.closeAppTabs();
        StudyApp.stopCountdown();
        PrefsManager.unsetObservers();
      });
    }
  },

  start: function _start({loadReason}) {
    console.debug("StudyApp.start: on " + loadReason);

    PrefsManager.setObservers();
    let consentCount = storage.openConsentCount || 0;
    let inBackground = (consentCount+1 < kConsentCounts.foreground);

    if (!simplePrefs.prefs.consented) {
      // check how many times the user has open the browser unconsented
      if (consentCount+1 >= kConsentCounts.uninstall) {
        StudyApp.uninstall();
        return;
      }
      // check daily if the user has consented
      StudyApp.startCountdown();
    }

    let submitPromise;

    if (loadReason == "startup") {
      // only store previous computed data upon startup
      submitPromise = StudyApp.controller.submitHistory();
    }
    else {
      // on enable, upgrade and install, save addon vital signs to
      // the storage and recompute interests from scratch
      StudyApp.saveAddonInfo();
      submitPromise = StudyApp.controller.resubmitHistory();
    }

    submitPromise.then(() => {
      if (!simplePrefs.prefs.consented) {
        StudyApp.openConsentTab({inBackground: inBackground});
      }
    });
  },

  setSourceUri: function(uri) {
    let source = "unknown";
    if (uri) {
      let url = uri.QueryInterface(Ci.nsIURL);
      let qs = querystring.parse(url.query);
      if (qs.src) {
        source = qs.src;
      }
    }
    storage.downloadSource = source;
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
