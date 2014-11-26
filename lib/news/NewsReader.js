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
const {TopDomains} = require("./TopDomains");
const {Downloader} = require("./Downloader");
const {IAB_Collector} = require("./IAB_Collector");
const {NewsDebugPage} = require("./NewsDebugPage");
const {IABPage} = require("./IABPage");
const {UP_Settings} = require("./UP_Settings");

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/NewTabUtils.jsm", this);
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");


let NewsReader = {

  init: function() {
    NewsDebugPage.init();
    IABPage.init();
    TopDomains.init();
    Downloader.init();
    IAB_Collector.init();
    UP_Settings.init();

    // prepopulate Downloader with top domains
    Downloader.addSites(TopDomains.sorted.slice(0,20));
  },

  clearStorage: function() {
    Downloader.clear();
    IAB_Collector.clear();
  },

  refreshSettings: function() {
    UP_Settings.refresh();
  },

};

exports.NewsReader = NewsReader;
