/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Class} = require("sdk/core/heritage");
const {id,data} = require("self");
const {Factory, Unknown} = require("api-utils/xpcom");
const {PageMod} = require("page-mod");
const {Controller} = require("Controller");
const {StudyApp} = require("Application");
const workers = require("sdk/content/worker");
const utils = require("sdk/window/utils");
const simplePrefs = require("simple-prefs")

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

let gController = new Controller();

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
        gController.resubmitFullHistory({report: processingDaysLeft, flush: true}).then(() => {
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
        StudyApp.openSurveyTab();
      });

      worker.port.on("dispatch_get_next", function() {
        let data = gController.getNextDispatchBatch();
        worker.port.emit("message", {content: {topic: "dispatch_batch", data: data}});
      });

      worker.port.on("show_consent", function() {
        StudyApp.openConsentTab({inBackground: true});
      });
    }
  },
}

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
        gController.recordConsent();
        StudyApp.stopCountingDays();
        // replace tab with gizmo url
        worker.tab.url = StudyApp.makeSurveyUrl();
      });

      worker.port.on("uninstall", function() {
        // the user wants to remove the addon
        StudyApp.uninstall();
      });

      worker.port.emit("message", {content: {topic: "dispatch_batch", data: gController.getNextDispatchBatch()}});
    }
  },
}

exports.main = function(options, callbacks) {
  gController.init();
  StudyApp.controller = gController;

  // setup development menu
  Factory(DevMenu.factory);
  PageMod(DevMenu.page);

  // consent page
  Factory(ConsentPage.factory);
  PageMod(ConsentPage.page);

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
  else if ((options.loadReason == "enable" || options.loadReason == "startup")
            && !simplePrefs.prefs.consented) {
    StudyApp.openConsentTab({inBackground: false});
  }

  if (!simplePrefs.prefs.consented) {
    // if the user hasn't consented yet, check daily if the user has
    StudyApp.startCountingDays();
  }
};
