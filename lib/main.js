/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Class} = require("sdk/core/heritage");
const {id,data} = require("self");
const {Factory, Unknown} = require("api-utils/xpcom");
const {PageMod} = require("page-mod");
const {Controller} = require("Controller");
const {ItemJar} = require("ItemJar");
const tabs = require("tabs");
const workers = require("sdk/content/worker");
const utils = require("sdk/window/utils");

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

let gController = new Controller();

exports.main = function(options, callbacks) {

  Factory({
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
  });

  PageMod({
    contentScriptFile: [
      data.url("js/angular.min.js"),
      data.url("upstudy.js"),
    ],

    include: ["about:upstudy"],
    onAttach: function(worker) {
      worker.port.emit("style", data.url("css/bootstrap.min.css"));
      worker.port.emit("style", data.url("css/bootstrap-responsive.min.css"));
      worker.port.emit("style", data.url("css/styles.css"));

      worker.port.on("history_process", function() {
        gController.resubmitFullHistory().then(() => {
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
        // make a survey gizma url and send it to a different tab
        let interests = gController.getRankedInterests();

        // choose 10 best
        let itemJar = new ItemJar(10);
        Object.keys(interests).forEach(interest => {
          itemJar.addItem(interest, interests[interest]);
        });

        // items is an array of the form [ { item: interest, weight: score} ,....]
        let items = itemJar.getItems();
        let url = "http://qsurvey.mozilla.com/s3/up-test-2?userID=" + gController.getUserID() + 
                  "&downloadSource=" + gController.getDownloadSource();

        let urlsToAdd = 10;
        let index = 0;
        while(index < urlsToAdd && index < items.length) {
          url = url + "&interest" + (index+1) + "=" + items[index].item;
          index++;
        }
        // now open the tab
        tabs.open(url);
      });

      worker.port.on("dispatch_get_next", function() {
        let data = gController.getNextDispatchBatch();
        worker.port.emit("message", {content: {topic: "dispatch_batch", data: data}});
      });
    }
  });

  gController.init();
  tabs.open("about:upstudy");

  // get addon URL
  AddonManager.getAddonByID(id, addon => {
    if (addon && addon.sourceURI) {
      gController.setSourceUri(addon.sourceURI);
    }
  });

};

