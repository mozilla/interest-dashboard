/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Factory, Unknown} = require("api-utils/xpcom");
const {Class} = require("sdk/core/heritage");
const {PageMod} = require("page-mod");
const {DateUtils} = require("DateUtils");
const {HeadlinerPersonalizationAPI} = require("Headliner");
const {id,data} = require("self");
const {storage} = require("sdk/simple-storage");
const request = require("request");
const tabs = require("tabs");
const simplePrefs = require("simple-prefs");
const querystring = require("querystring");

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
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
        StudyApp.openConsentTab();
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
        StudyApp.recordConsent();
        if (StudyApp.controller._processingHistory) {
          StudyApp.controller._dayBuffer.setReportCallback(function(daysLeft){
            worker.port.emit("message", {content: {topic: "days_left", data: daysLeft}});
          });
          worker.tab.on("close", function() {
            if (StudyApp.controller._processingHistory) {
              StudyApp.controller._dayBuffer.setReportCallback(null);
              StudyApp.submitPromise.then(_ => {
                StudyApp.controller._dispatcher.setObserveIdle(10);
                StudyApp.openSurveyTab();
              });
            }
          });

          StudyApp.submitPromise.then(_ => {
            // replace tab with gizmo url
            StudyApp.controller._dispatcher.setObserveIdle(10);
            worker.tab.url = StudyApp.makeSurveyUrl();
          });
        }
        else {
          StudyApp.controller._dispatcher.setObserveIdle(10);
          worker.tab.url = StudyApp.makeSurveyUrl();
        }
      });

      worker.port.on("uninstall", function() {
        // the user wants to remove the addon
        StudyApp.uninstall();
      });

      if (StudyApp.controller._processingHistory) {
        StudyApp.submitPromise.then(_ => {
          worker.port.emit("message", {content: {topic: "dispatch_batch", data: StudyApp.controller.getNextDispatchBatch()}});
        });
      }
      else {
        worker.port.emit("message", {content: {topic: "dispatch_batch", data: StudyApp.controller.getNextDispatchBatch()}});
      }

      worker.port.emit("message", {content: {topic: "download_source", data: storage.downloadSource}});
    }
  },
};

let NYTimesRecommendations = {
  debug: false,
  workers: [],
  refreshTaskId: null,
  mod: null,
  contentClient: null,
  allowedInterestSet: {"Arts": true, "Basketball": true, "Travel": true, "Boxing": true, "Soccer": true, "Ideas": true, "Sports": true, "Music": true, "Hockey": true, "Android": true, "Home-Design": true, "Health-Women": true, "Business": true, "Parenting": true, "Football": true, "Autos": true, "Baseball": true, "Tennis": true, "Video-Games": true, "Television": true, "Cooking": true, "Do-It-Yourself": true, "Fashion-Men": true, "Science": true, "Programming": true, "Movies": true, "Golf": true, "Apple": true, "Fashion-Women": true, "Weddings": true, "Entrepreneur": true, "Design": true, "Health-Men": true, "Politics": true, "Technology": true},

  getTop5Interests: function NYTR_getInterests() {
    let interests = {};

    // get ranked interests
    let orderedInterests = [];
    let scoreTotal = 0;
    let ranking = StudyApp.controller.getUserInterests() || {};
    Object.keys(ranking).sort(function (a,b) {
      return ranking[b] - ranking[a];
    }).forEach(function (interest) {
      orderedInterests.push({name: interest, score: ranking[interest]});
      scoreTotal += ranking[interest];
    });

    // obtain top 5 allowed interests
    for (let interest of orderedInterests) {
      if (Object.keys(interests).length >= 5) {
        break;
      }
      if (NYTimesRecommendations.allowedInterestSet.hasOwnProperty(interest.name)) {
        interests[interest.name] = interest.score/scoreTotal;
      }
    }

    return interests;
  },

  transformData: function NYTR_transformData(rawData) {
    let transformed = [];
    if (rawData.hasOwnProperty("d")) {
      let articles = rawData.d;
      for (let a of articles) {
        let item = {};
        if (a.hasOwnProperty("media") && a.media.length > 0) {
          for (let media of a.media) {
            for (let metadata of media["media-metadata"]) {
              if (metadata.format == "Standard Thumbnail") {
                item.thumbUrl = metadata.url;
              }
            }
          }
        }
        item.url = a.url;
        item.title = a.title;
        item.topic = a.column;
        transformed.push(item);
      }
    }
    return transformed;
  },

  pagemod: {
    contentScriptFile: [data.url("nytimes-personalize.js")],
    contentStyleFile: [data.url("css/nytimes/newstyles.css")],
    include: ["*.nytimes.com"],
    onAttach: function(worker) {
      console.debug("Application.NYTimesRecommendations: attached");
      NYTimesRecommendations.workers.push(worker);
      NYTimesRecommendations.contentClient.getContent(NYTimesRecommendations.getTop5Interests()).then(function recommend(rawData) {
        let transformed = NYTimesRecommendations.transformData(rawData);
        let ribbonScriptUrl = data.url("js/nytimes/headliner-ribbon.js");
        worker.port.emit("recommend_on_page", [transformed, ribbonScriptUrl]);
      });

      worker.on("detach", function() {
        NYTimesRecommendations.detachWorker(this);
      });
    }
  },

  detachWorker: function NYTR_detachWorker(worker) {
    let index = NYTimesRecommendations.workers.indexOf(worker);
    if (index != -1) {
      NYTimesRecommendations.workers.splice(index, 1);
    }
    console.debug("Application.NYTimesRecommendations: detached");
  },

  destroy: function NYTR_destroy() {
    if (NYTimesRecommendations.mod) {
      NYTimesRecommendations.mod.destroy();
      NYTimesRecommendations.mod = null;
      NYTimesRecommendations.contentClient = null;
      console.debug("Application.NYTimesRecommendations: pagemod destroyed");
    }
    NYTimesRecommendations.unsetContentRefresh()
  },

  init: function NYTR_init() {
    // Needs to happen after rankings have been calculated
    return StudyApp.submitPromise.then(_ => {
      NYTimesRecommendations.contentClient = new HeadlinerPersonalizationAPI(simplePrefs.prefs.nytimes_headliner_url);
      NYTimesRecommendations.mod = PageMod(NYTimesRecommendations.pagemod);
      NYTimesRecommendations.setContentRefresh();
      // timestamp personalization start if it has not being set
      if (simplePrefs.prefs.nytimes_personalization_start == "") {
        // prefs do not handle large ints, so timestamp has to be string
        simplePrefs.prefs.nytimes_personalization_start = "" + Date.now();
      }
    });
  },

  setContentRefresh: function NYTR_setContentRefresh() {
    let refreshDelayMS = simplePrefs.prefs.headliner_refresh_interval * 1000;
    if (!NYTimesRecommendations.debug && refreshDelayMS < 3600000) {
      // minimum refresh time : 1 hour, unless in debug mode
      refreshDelayMS = 3600000;
    }
    NYTimesRecommendations.refreshTaskId = setTimeout(function() {
      NYTimesRecommendations.contentClient.refreshContent(NYTimesRecommendations.getTop5Interests());
      NYTimesRecommendations.setContentRefresh();
    }, refreshDelayMS);
    console.debug("Application.NYTimesRecommendations: content refresh set");
  },

  unsetContentRefresh: function NYTR_unsetContentRefresh() {
    if (NYTimesRecommendations.refreshTaskId) {
      clearTimeout(NYTimesRecommendations.refreshTaskId);
      NYTimesRecommendations.refreshTaskId = null;
      console.debug("Application.NYTimesRecommendations: content refresh unset");
    }
  },
};

let StudyApp = {
  controller: null,
  submitPromise: null,

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

  openConsentTab: function _openConsentTab() {
    if (!simplePrefs.prefs.consented) {
      storage.openConsentCount += 1;
    }
    console.debug("StudyApp.openConsentTab open_count:"+storage.openConsentCount);

    tabs.open({
      url: "about:upstudy-consent",
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
      // if unconsented, check for enable date
      if (!simplePrefs.prefs.consented) {
        let enableDiff = DateUtils.today() - storage.enableDay;
        if (enableDiff > kConsentUninstallDays) {
            StudyApp.uninstall();
        }
      }

      // uninstall if maximum lifetime (kUninstallDays) is hit
      let installDiff = DateUtils.today() - storage.installDay;
      if (installDiff > kUninstallDays) {
        StudyApp.uninstall();
      }
    }
  },

  /*
   * Safely unset kIdleDaily observer.
   * This is important, because this may be called when the daily observer hasn't been set yet.
   */
  safeUnsetCountdownObserver: function _safeUnsetCountdownObserver() {
    try {
      Services.obs.removeObserver(StudyApp, kIdleDaily);
    }
    catch (err) {
      console.debug("Could not remove idle-daily observer for StudyApp");
    }
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

  /*
   * The application starts a countdown from the moment of enabling
   * the Addon. If either the conditions of:
   *    1. a consent display count
   *    2. a number of days has past
   * is met, the addon will be uninstalled.
   */
  startCountdown: function _startCountdown() {
    if (storage.openConsentCount == undefined || !storage.enableDay) {
      StudyApp.resetConsentCountdown();
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

    NewTab.init(controller);
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
    StudyApp.safeUnsetCountdownObserver();
  },

  start: function _start({loadReason}) {
    console.debug("StudyApp.start: on " + loadReason);
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
    // check daily if the add-on needs to be uninstalled
    StudyApp.startCountdown();

    if (loadReason == "startup") {
      // only store previous computed data upon startup
      StudyApp.submitPromise = StudyApp.controller.submitHistory();
    }
    else {
      // on enable, upgrade and install, save addon vital signs to
      // the storage and recompute interests from scratch
      StudyApp.submitPromise = StudyApp.controller.resubmitHistory();
    }

    if (!simplePrefs.prefs.consented) {
      StudyApp.openConsentTab();
    }
    else {
      // Start NYTimes pagemod
      NYTimesRecommendations.init();
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
      case "consented":
        StudyApp.controller._dispatcher._enabled = simplePrefs.prefs.consented;
        StudyApp.resetConsentCountdown();
        if (simplePrefs.prefs.consented) {
          NYTimesRecommendations.init();
        }
        else {
          NYTimesRecommendations.destroy();
        }
        break;
      case "nytimes_headliner_url":
        if (NYTimesRecommendations.contentClient) {
          NYTimesRecommendations.contentClient._personalizationUrl = simplePrefs.prefs.nytimes_headliner_url;
        }
        break;
      case "headliner_refresh_interval":
        if (NYTimesRecommendations.contentClient) {
          NYTimesRecommendations.unsetContentRefresh();
          NYTimesRecommendations.setContentRefresh();
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
    simplePrefs.on("nytimes_headliner_url", PrefsManager.onPrefChange);
    simplePrefs.on("headliner_refresh_interval", PrefsManager.onPrefChange);
    simplePrefs.on("dispatchIdleDelay", PrefsManager.onPrefChange);
  },

  unsetObservers: function _unsetObservers() {
    simplePrefs.removeListener("server_url", PrefsManager.onPrefChange);
    simplePrefs.removeListener("consented", PrefsManager.onPrefChange);
    simplePrefs.removeListener("nytimes_headliner_url", PrefsManager.onPrefChange);
    simplePrefs.removeListener("headliner_refresh_interval", PrefsManager.onPrefChange);
    simplePrefs.removeListener("dispatchIdleDelay", PrefsManager.onPrefChange);
  },

};

let NewTab = {

  recommendLinks: function _recommendLinks(callback) {
    let req = request.Request({
      url: simplePrefs.prefs.newtabLinkServer,
      onComplete: function(response) {
        if (response.status == 200) {
          //dump(JSON.stringify(response.json, null , 2));
          callback(response.json);
        }
        else {
          dump("failed to load\n");
        }
      }
    });
    req.get();
  },

  init: function _init(controller) {
    if (simplePrefs.prefs.enableNewTabShow) {
      const TP_NEWTAB_PRELOAD = "browser.newtab.preload";
      Services.prefs.setBoolPref(TP_NEWTAB_PRELOAD,false);
      tabs.on('ready', function(tab) {
        if (tab.url == "about:newtab") {
          let worker = tab.attach({
              contentScriptFile: [
                                  data.url("js/jquery-1.10.2.min.js"),
                                  data.url("newtab/newtab.js")
                                 ]
          });
          worker.port.emit("style", data.url("newtab/newtab.css"));
          worker.port.on("recommend", function() {
            NewTab.recommendLinks(json => {
              worker.port.emit("show",json);
            });
          });
        }
      });
    }
  },

};

exports.DevMenu = DevMenu;
exports.ConsentPage = ConsentPage;
exports.StudyApp = StudyApp;
exports.PrefsManager = PrefsManager;
exports.NYTimesRecommendations = NYTimesRecommendations;
