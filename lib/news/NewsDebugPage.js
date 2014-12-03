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
const {Downloader} = require("./Downloader");

Cu.import("resource://gre/modules/Services.jsm", this);

const kNewsFeedUpdate = "news-feed-update";

let NewsDebugPage = {
  init: function() {
    Factory(this.factory);
    PageMod(this.page);
  },

  factory: {
    contract: "@mozilla.org/network/protocol/about;1?what=news-debug",

    Component: Class({
      extends: Unknown,
      interfaces: ["nsIAboutModule"],

      newChannel: function(uri) {
        let chan = Services.io.newChannel(data.url("news/news-debug.html"), null, null);
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
      data.url("js/angular.min.js"),
      data.url("js/news/news-debug.js"),
    ],

    contentScriptWhen: "end",

    include: ["about:news-debug"],

    onAttach: function(worker) {
      // inject styles
      worker.port.emit("style", data.url("css/news/bootstrap.min.css"));
      worker.port.emit("style", data.url("css/news/bootstrap-theme.min.css"));
      worker.port.emit("style", data.url("css/news/styles.css"));
      worker.port.emit("bootstrap");

      worker.port.on("refreshSiteInfo", function(site) {
        Downloader.refreshSitesInfo().then(() => {
          worker.port.emit("updateSites", Downloader.getSitesArray());
        });
      });

      worker.port.on("addSite", function(site) {
        Downloader.addSite(site);
        worker.port.emit("updateSites", Downloader.getSitesArray());
      });

      worker.port.on("removeSite", function(site) {
        Downloader.removeSite(site);
        worker.port.emit("updateSites", Downloader.getSitesArray());
      });

      worker.port.on("clearSite", function(site) {
        Downloader.clearSite(site);
        worker.port.emit("updateSites", Downloader.getSitesArray());
      });

      worker.port.on("clearSites", function(site) {
        Downloader.clearSites();
        worker.port.emit("updateSites", Downloader.getSitesArray());
      });

      worker.port.on("recentDocs", function(site) {
        Downloader.updateSite(site);
        worker.port.emit("updateSites", Downloader.getSitesArray());
      });

      // update sites
      worker.port.emit("updateSites", Downloader.getSitesArray());

      // setup feedupdate observer
      let observer = {
        observe: function(aSubject, aTopic, aData) {
          worker.port.emit("updateSites", Downloader.getSitesArray());
        }
      };
      Services.obs.addObserver(observer, kNewsFeedUpdate, false);
      worker.on('detach', function() {
        Services.obs.removeObserver(observer, kNewsFeedUpdate);
      });
    },
  }
};

exports.NewsDebugPage = NewsDebugPage;
