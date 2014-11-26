/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
const {Ci,Cu,Cc} = require("chrome");
const tabs = require("sdk/tabs");
const url = require("sdk/url");
const {data} = require("sdk/self");
const {storage} = require("sdk/simple-storage");
const {Class} = require("sdk/core/heritage");
const {Factory, Unknown} = require("sdk/platform/xpcom");
const {PageMod} = require("sdk/page-mod");
const {IAB_Collector} = require("./IAB_Collector");
const {UP_Settings} = require("./UP_Settings");

Cu.import("resource://gre/modules/Services.jsm", this);

const kIABUpdate = "iab-update";

let IABPage = {
  init: function() {
    Factory(this.factory);
    PageMod(this.page);
  },

  factory: {
    contract: "@mozilla.org/network/protocol/about;1?what=news",

    Component: Class({
      extends: Unknown,
      interfaces: ["nsIAboutModule"],

      newChannel: function(uri) {
        let chan = Services.io.newChannel(data.url("news/iab.html"), null, null);
        chan.originalURI = uri;
        return chan;
      },

      getURIFlags: function(uri) {
        return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
      }
    })
  },
  page: {
    // load scripts
    contentScriptFile: [
      data.url("js/jquery.min.js"),
      data.url("js/news/angular.js"),
      data.url("js/news/iabApp.js"),
      data.url("js/news/newsAppControllers.js"),
    ],

    contentScriptWhen: "end",

    contentScriptOptions: {
      dataUrl:  data.url(""),
    },

    include: ["about:news"],

    onAttach: function(worker) {

      function updateData() {
        let obj = IAB_Collector.getData();
        obj.settings = UP_Settings.getSettings();
        return obj;
      };

      // inject styles
      worker.port.emit("style", data.url("css/news/bootstrap.min.css"));
      worker.port.emit("style", data.url("css/news/bootstrap-theme.min.css"));
      worker.port.emit("style", data.url("css/news/styles.css"));

      worker.port.emit("import", data.load("news/docPagingView.html"));
      worker.port.emit("bootstrap");
      worker.port.emit("full-data", updateData());

      worker.port.on("clearAll", function() {
        IAB_Collector.clearAll();
      });

      worker.port.on("reset", function() {
        UP_Settings.reset();
        worker.port.emit("update", updateData());
      });

      worker.port.on("check-change", function(cat, value) {
        UP_Settings.setChecked(cat, value);
      });

      // setup aib update observer
      let observer = {
        observe: function(aSubject, aTopic, aData) {
          worker.port.emit("update", updateData());
        }
      };
      Services.obs.addObserver(observer, kIABUpdate, false);
      worker.on('detach', function() {
        Services.obs.removeObserver(observer, kIABUpdate);
      });
    },
  }
};

exports.IABPage = IABPage;
