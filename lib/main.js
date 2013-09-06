/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Class} = require("sdk/core/heritage");
const {data} = require("self");
const {Factory, Unknown} = require("api-utils/xpcom");
const {PageMod} = require("page-mod");
const {HistoryReader} = require("HistoryReader");
const tabs = require("tabs");
const workers = require("sdk/content/worker");
const utils = require("sdk/window/utils");

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

exports.main = function(options, callbacks) {
  let historyReader = new HistoryReader();
  historyReader.init();
  historyReader.resubmitHistory();
};

