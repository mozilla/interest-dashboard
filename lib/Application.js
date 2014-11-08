/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Class} = require("sdk/core/heritage");
const {data, id} = require("sdk/self");
const {Factory, Unknown} = require("sdk/platform/xpcom");
const {PageMod} = require("sdk/page-mod");
const clipboard = require("sdk/clipboard");
const querystring = require("sdk/querystring");
const simplePrefs = require("sdk/simple-prefs");
const {storage} = require("sdk/simple-storage");
const tabs = require("sdk/tabs");
const {ActionButton} = require("sdk/ui/button/action");
const { Bookmark, save } = require("sdk/places/bookmarks");

const {DateUtils} = require("DateUtils");
const {HeadlinerPersonalizationAPI} = require("Headliner");

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
const bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
const ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Timer.jsm");

const kIdleDaily = "idle-daily";
const kUninstallDays = 30*6;
const kConsentUninstallDays = 30;
const kConsentCounts = {
  foreground: 3,
  uninstall: 4,
};
const kAppUrlSet = {
  "about:upstudy-consent": true,
  "about:upstudy-dev": true,
  "about:you": true,
};

let DevMenu = {
  factory: {
    contract: "@mozilla.org/network/protocol/about;1?what=upstudy-dev",

    Component: Class({
      extends: Unknown,
      interfaces: ["nsIAboutModule"],

      newChannel: function(uri) {
        let chan = Services.io.newChannel(data.url("devmenu.html"), null, null);
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
      data.url("devmenu.js"),
    ],

    include: ["about:upstudy-dev"],
    onAttach: function(worker) {
      worker.port.emit("style", data.url("css/devmenu/bootstrap.min.css"));
      worker.port.emit("style", data.url("css/devmenu/bootstrap-responsive.min.css"));
      worker.port.emit("style", data.url("css/devmenu/styles.css"));

      worker.port.emit("message", {content: {topic: "ranking_data", data: StudyApp.controller.getRankedInterests()}});
      worker.port.emit("message", {content: {topic: "dispatch_batch", data: StudyApp.controller.getNextDispatchBatch()}});
      worker.port.emit("message", {content: {topic: "host_interests_data", data: StudyApp.controller.getHostComputedInterests()}});

      worker.port.on("history_process", function() {
        function processingDaysLeft(dailyInterestsSpout) {
          worker.port.emit("message", {content: {topic: "days_left", data: dailyInterestsSpout.numFromToday}});
        }
        StudyApp.controller.resubmitHistory({report: processingDaysLeft, flush: true}).then(() => {
          worker.port.emit("message", {content: {topic: "ranking_data", data: StudyApp.controller.getRankedInterests()}});
          worker.port.emit("message", {content: {topic: "dispatch_batch", data: StudyApp.controller.getNextDispatchBatch()}});
          worker.port.emit("message", {content: {topic: "host_interests_data", data: StudyApp.controller.getHostComputedInterests()}});
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
      });

      worker.port.on("url_classify", function(data) {
        StudyApp.controller.classifyPage(data.url, data.title).then(results => {
          // simplify results
          let simpleData = {};
          Object.keys(results).forEach(ns => {
            let nsData;
            results[ns].results.forEach(type => {
              if (type.interests.length > 0) {
                if (nsData == null) nsData = {};
                nsData[type.type] = type.interests.map(category => { return category + " ";});
              }
            });
            if (nsData) {
              simpleData[ns] = nsData;
            }
          });
          worker.port.emit("message", {content: {topic: "url_classify_batch", data: simpleData}});
        },
        error => {
          worker.port.emit("message", {content: {topic: "url_classify_batch", data: "ERROR: " + error}});
        });
      });
    }
  },
};

let AboutYou = {
  _workers: [],
  _latestBookmark: "",
  factory: {
    contract: "@mozilla.org/network/protocol/about;1?what=you",

    Component: Class({
      extends: Unknown,
      interfaces: ["nsIAboutModule"],

      newChannel: function(uri) {
        let chan = Services.io.newChannel(data.url("about-you.html"), null, null);
        chan.originalURI = uri;
        return chan;
      },

      getURIFlags: function(uri) {
        return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
      }
    })
  },

  historySubmitComplete: function() {
    for (let worker of AboutYou._workers) {
      worker.port.emit("message", {content: {topic: "ranking_data",
        data: { rankings: StudyApp.controller.getRankedInterests(), submitComplete: true}}});
    }
  },

  observe : function(aSubject, aTopic, aData) {
    let dataObj = JSON.parse(aData);
    switch (aTopic) {
      case "chart-update":
        for (let worker of AboutYou._workers) {
          worker.port.emit("message", {content: {topic: "json_update", data: dataObj}});
        }
    }
  },

  page: {
    contentScriptWhen: "start",
    contentScriptFile: [
      data.url("js/angular.min.js"),
      data.url("vendor/d3/d3.v3.min.js"),
      data.url("vendor/nvd3/nv.d3.min.js"),
      data.url("js/jquery.min.js"),
      data.url("js/bootstrap.min.js"),
      data.url("js/jquery.dataTables.min.js"),
      data.url("about-you.js"),
      data.url("charts/ChartManager.js"),
      data.url("charts/InterestDashboard.js"),
      data.url("js/html4-defs.js"),
      data.url("js/html-sanitizer.js"),
    ],

    include: ["about:you"],
    onAttach: function(worker) {
      Services.obs.addObserver(AboutYou, "chart-update", false);

      StudyApp.controller._streamObjects.dailyInterestsSpout.setEmitCallback(dailyInterestsSpout => {
        worker.port.emit("message", {content: {topic: "days_left", data: dailyInterestsSpout.numFromToday}});
      });

      let callback = function(progressType, progress, total) {
        worker.port.emit("message", {content: {topic: "progress", data: {
          "progressType": progressType,
          "progress": progress,
          "total": total
        }}});
      }
      StudyApp.controller._lwcaClassifier.setHistoryProgressCallback(callback);
      StudyApp.controller._lwcaClassifier.setTitleProgressCallback(callback);

      AboutYou._workers.push(worker); // Set worker so that callback functions can access it after a page refresh.

      worker.port.emit("style", data.url("css/devmenu/bootstrap.min.css"));
      worker.port.emit("style", data.url("css/devmenu/bootstrap-responsive.min.css"));
      worker.port.emit("style", data.url("css/tutorial.css"));
      worker.port.emit("style", data.url("css/jquery.dataTables.css"));
      worker.port.emit("style", data.url("css/devmenu/styles.css"));
      worker.port.emit("style", data.url("vendor/nvd3/nv.d3.min.css"));
      worker.port.emit("style", data.url("http://code.cdn.mozilla.net/fonts/fira.css"));

      worker.port.emit("init");

      worker.port.on("category_visit_request", (data) => {
        if (storage.chartData.interestDashboardData.historyVisits[data.categoryName] &&
              storage.chartData.interestDashboardData.historyVisits[data.categoryName].complete) {
          worker.port.emit("message", {content: {topic: "cancel_append_visits"}});
          return; // There are no more visits to load.
        }
        StudyApp.controller._streamObjects.interestDashboardDataProcessorBolt
          .getNextHistoryVisitPage(data.categoryName).then(() => {
            worker.port.emit("message", {content: {topic: "append_visit_data",
                            data: {"category": data.categoryName,
                                   "historyVisits": storage.chartData.interestDashboardData.historyVisits[data.categoryName].visitData,
                                   "pageResponseSize": storage.chartData.interestDashboardData.historyVisits[data.categoryName].pageResponseSize,
                                   "complete": storage.chartData.interestDashboardData.historyVisits[data.categoryName].complete}}});
          });
      });

      worker.port.on("category_reset_request", (data) => {
        storage.chartData.interestDashboardData.historyVisits[data.categoryName] = undefined;
      });

      worker.port.on("category_topsites_request", (data) => {
        StudyApp.controller._streamObjects.interestDashboardDataProcessorBolt.getFaviconsForTopSites(data.categoryName).then(() => {
          worker.port.emit("message", {content: {topic: "populate_topsites",
            data: {"topsites": storage.chartData.interestDashboardData.sortedDomains,
                   "category": data.categoryName}}
          });
        });
      });

      worker.port.on("copy_to_clipboard", message => {
        clipboard.set(message);
      });

      worker.port.on("bookmark_change_request", (data) => {
        let uri = ios.newURI(data.url, null, null);
        let ids = bmsvc.getBookmarkIdsForURI(uri);
        let bookmarkRemoved = false;
        for (let id of ids) {
          if (bmsvc.getItemTitle(id) == data.title) {
            bmsvc.removeItem(id);
            bookmarkRemoved = true;
          }
        }

        if (!bookmarkRemoved) {
          let bookmark = Bookmark({ title: data.title, url: data.url });
          save(bookmark);
        }
      });

      worker.port.on("debug_report_request", (data) => {
        let debugLogs = StudyApp.controller._streamObjects.interestDashboardDataProcessorBolt.getDebugLogs();
        worker.port.emit("message", {content: {topic: "debug_report", data: debugLogs}});
      });

      worker.port.on("chart_data_request", () => {
        if (storage.chartData) {
          storage.chartData.interestDashboardData.historyVisits = {};
          StudyApp.controller._streamObjects.interestDashboardDataProcessorBolt.getFaviconsForTopSites().then(() => {
            worker.port.emit("message", {content: {topic: "chart_init", data: storage.chartData}});
          });
        }
      });
      worker.port.on("history_process", () => {
        storage.chartData = undefined;
        storage.dayBufferInterests = {};
        storage.domains = undefined;
        StudyApp.controller.resubmitHistory({flush: true}).then(AboutYou.historySubmitComplete);
      });
    }
  },
};

let StudyApp = {
  controller: null,
  submitPromise: null,

  /** tabs and pages **/

  makeSurveyUrl: function _makeSurveyUrl() {
    // make a survey gizmo url
    let surveyEndPoint = StudyApp.controller.getSurveyEndPoint();
    let orderedInterests = StudyApp.controller.getRankedInterestsForSurvey();

    let url = surveyEndPoint + "?userID=" + StudyApp.controller.getUserID() +
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

  /*
   * The consent-based uninstall countdowns are reset upon:
   * 1. init
   * 2. all app unloads except for shutdown (uninstall/disable/upgrade/downgrade)
   * 3. consent pref changes
   */
  resetConsentCountdown: function _resetConsentCountdown() {
    storage.openConsentCount = 0;
    storage.enableDay = DateUtils.today();
  },

  /** addon functionality **/

  init: function _init(controller) {
    StudyApp.controller = controller;

    // setup development menu
    Factory(DevMenu.factory);
    PageMod(DevMenu.page);

    // about interests
    Factory(AboutYou.factory);
    PageMod(AboutYou.page);

    // get addon source URL
    AddonManager.getAddonByID(id, addon => {
      StudyApp.setSourceUri(addon.sourceURI);
    });

    let button = ActionButton({
      id: "interest-dashboard",
      label: "Interest Dashboard",
      icon: data.url("css/devmenu/resources/ID_Icon_Static.png"),
      onClick: function() {
        tabs.open({
          url: "about:you",
        });
      }
    });
  },

  saveAddonInfo: function _saveAddonInfo() {
    let savedPromise = Promise.defer();
    AddonManager.getAddonByID(id, addon => {
      storage.installDay = DateUtils.convertDateToDays(addon.installDate);
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
      StudyApp.resetConsentCountdown();

      // then stop the rest of the application
      Task.spawn(function() {
        yield StudyApp.closeAppTabs();
      });

      // Specially clear the Test Pilot current study mutex if necessary
      const TP_CURRENTSTUDY = "extensions.testpilot.currentstudy";
      const TP_TESTID = "up-research";
      try {
        let study = Services.prefs.getCharPref(TP_CURRENTSTUDY);
        if (study == TP_TESTID) {
          Services.prefs.clearUserPref(TP_CURRENTSTUDY);
        }
      }
      catch(ex) {}
    }
    PrefsManager.unsetObservers();
  },

  start: function _start({loadReason}) {
    console.debug("StudyApp.start: on " + loadReason);
    tabs.on('activate', function () {
      if (tabs.activeTab.url == "about:you") {
        StudyApp.submitPromise = StudyApp.controller.submitHistory();
      }
    });

    StudyApp.saveAddonInfo();

    PrefsManager.setObservers();
    let consentCount = storage.openConsentCount || 0;

    if (!simplePrefs.prefs.consented) {
      // check how many times the user has open the browser unconsented
      if (consentCount+1 >= kConsentCounts.uninstall) {
        StudyApp.uninstall();
        return;
      }
    }

    if (loadReason == "startup") {
      // only store previous computed data upon startup
      //StudyApp.controller.stopAndClearStorage();
      StudyApp.submitPromise = StudyApp.controller.submitHistory();
    }
    else {
      // on enable, upgrade and install, save addon vital signs to
      // the storage and recompute interests from scratch
      StudyApp.submitPromise = StudyApp.controller.resubmitHistory();
    }
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

  recordConsent: function() {
    simplePrefs.prefs.consented = true;
  },
};

let PrefsManager = {
  onPrefChange: function(prefName) {
    switch (prefName) {
      case "server_url":
        StudyApp.controller._dispatcher._serverUrl = simplePrefs.prefs.server_url;
        break;
    }
  },

  setObservers: function _setObservers() {
    simplePrefs.on("server_url", PrefsManager.onPrefChange);
    simplePrefs.on("consented", PrefsManager.onPrefChange);
    simplePrefs.on("nytimes_headliner_url", PrefsManager.onPrefChange);
    simplePrefs.on("headliner_refresh_interval", PrefsManager.onPrefChange);
  },

  unsetObservers: function _unsetObservers() {
    simplePrefs.removeListener("server_url", PrefsManager.onPrefChange);
    simplePrefs.removeListener("consented", PrefsManager.onPrefChange);
    simplePrefs.removeListener("nytimes_headliner_url", PrefsManager.onPrefChange);
    simplePrefs.removeListener("headliner_refresh_interval", PrefsManager.onPrefChange);
  },

};

exports.DevMenu = DevMenu;
exports.StudyApp = StudyApp;
exports.PrefsManager = PrefsManager;
