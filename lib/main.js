/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Class} = require("sdk/core/heritage");
const {id,data} = require("self");
const {Factory, Unknown} = require("api-utils/xpcom");
const {PageMod} = require("page-mod");
const {Controller} = require("Controller");
const tabs = require("tabs");
const workers = require("sdk/content/worker");
const utils = require("sdk/window/utils");

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

let gController = new Controller();

let StudyApp = {
  makeSurveyUrl: function _makeSurveyUrl() {
    // make a survey gizmo url
    let orderedInterests = gController.getRankedInterestsForSurvey();

    let url = "http://qsurvey.mozilla.com/s3/up-test-2?userID=" + gController.getUserID() +
              "&downloadSource=" + gController.getDownloadSource();
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

  openConsentTab: function _openConsentTab() {
    tabs.open({
      url: data.url( "consent.html"),
      onReady: function(tab) {
        let worker = tab.attach({
          contentScriptFile: [
            data.url("js/angular.min.js"),
            data.url("js/ui-bootstrap-tpls-0.6.0.min.js"),
            data.url("consent.js")
          ]
        });
        worker.port.emit("style", data.url("css/bootstrap.min.css"));
        worker.port.emit("style", data.url("css/bootstrap-responsive.min.css"));
        worker.port.emit("style", data.url("css/styles.css"));

        worker.port.on("consented", function() {
          gController.recordConsent();
          // replace tab with gizmo url
          tab.url = StudyApp.makeSurveyUrl();
        });

        worker.port.on("uninstall", function() {
          // the user wants to remove the addon
          AddonManager.getAddonByID(id, addon => {
            tab.close();
            addon.uninstall();
          });
        });

        worker.port.emit("message", {content: {topic: "dispatch_batch", data: gController.getNextDispatchBatch()}});
      },
      inBackground: true,
    });
  },

  addonEventListener: {
    onUninstalling: function(addon) {
      if (addon.id == id) {
        gController.onUninstall();
      }
    },
    onDisabling: function(addon){
      gController.onDisable();
    },
  },
}

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

      worker.port.emit("message", {content: {topic: "ranking_data", data: gController.getRankedInterests()}});
      worker.port.emit("message", {content: {topic: "dispatch_batch", data: gController.getNextDispatchBatch()}});

      worker.port.on("history_process", function() {
        function processingDaysLeft(daysLeft) {
          worker.port.emit("message", {content: {topic: "days_left", data: daysLeft}});
        }
        gController.resubmitFullHistory(processingDaysLeft).then(() => {
          worker.port.emit("message", {content: {topic: "ranking_data", data: gController.getRankedInterests()}});
          worker.port.emit("message", {content: {topic: "dispatch_batch", data: gController.getNextDispatchBatch()}});
        });
      });

      worker.port.on("dispatch_run", function() {
        gController.dispatchData().then((daysSent) => {
          worker.port.emit("message", {content: {topic: "dispatch_success", data: daysSent}});
        },
        (reason) => {
          worker.port.emit("message", {content: {topic: "dispatch_error", data: reason}});
        });
      });

      worker.port.on("survey_run", function() {
        // make a survey gizmo url and send it to a different tab
        tabs.open(StudyApp.makeSurveyUrl());
      });

      worker.port.on("dispatch_get_next", function() {
        let data = gController.getNextDispatchBatch();
        worker.port.emit("message", {content: {topic: "dispatch_batch", data: data}});
      });

      worker.port.on("show_consent", function() {
        StudyApp.openConsentTab();
      });
    }
  },
}

exports.main = function(options, callbacks) {
  gController.init();

  // setup development menu
  Factory(DevMenu.factory);
  PageMod(DevMenu.page);

  // listen for addon events
  AddonManager.addAddonListener(StudyApp.addonEventListener);

  // get addon source URL
  AddonManager.getAddonByID(id, addon => {
    if (addon && addon.sourceURI) {
      gController.setSourceUri(addon.sourceURI);
    }
  });

  if (options.loadReason == "install") {
    // process history in the background and load a consent tab on completion
    gController.resubmitFullHistory().then(() => {
      StudyApp.openConsentTab();
    });
  }
};
