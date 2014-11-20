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

const kAppUrlSet = {
  "about:you": true,
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
      data.url("charts/SpiderGraph.js"),
      data.url("js/html4-defs.js"),
      data.url("js/html-sanitizer.js"),
    ],

    include: ["about:you"],
    onAttach: function(worker) {
      Services.obs.addObserver(AboutYou, "chart-update", false);

      StudyApp.controller._streamObjects.dailyInterestsSpout.setEmitCallback(dailyInterestsSpout => {
        worker.port.emit("message", {content: {topic: "days_left", data: dailyInterestsSpout.numFromToday}});
      });

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
        StudyApp.controller.resubmitHistory({flush: true});
      });
    }
  },
};

let StudyApp = {
  controller: null,
  submitPromise: null,

  /** tabs and pages **/

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

  /** addon functionality **/

  init: function _init(controller) {
    StudyApp.controller = controller;

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
  },

  start: function _start({loadReason}) {
    console.debug("StudyApp.start: on " + loadReason);
    tabs.on('activate', function () {
      if (tabs.activeTab.url == "about:you") {
        StudyApp.submitPromise = StudyApp.controller.submitHistory();
      }
    });
    StudyApp.saveAddonInfo();

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
};

exports.StudyApp = StudyApp;