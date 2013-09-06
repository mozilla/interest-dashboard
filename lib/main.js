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
  // Handle about:profile-domains requests
  Factory({
    contract: "@mozilla.org/network/protocol/about;1?what=profile-domains",

    Component: Class({
      extends: Unknown,
      interfaces: ["nsIAboutModule"],

      newChannel: function(uri) {
        let chan = Services.io.newChannel(data.url("index.html"), null, null);
        chan.originalURI = uri;
        return chan;
      },

      getURIFlags: function(uri) {
        return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
      }
    })
  });

  // Add functionality into about:profile-domains page loads
  PageMod({
    contentScriptFile: [
      data.url("profile.js"),
    ],

    include: ["about:profile-upstudy"],

    onAttach: function(worker) {
      worker.port.emit("style", data.url("profile.css"));
      worker.port.emit("daysVisited", daysVisited);
    }
  });

  let historyReader = new HistoryReader();
  historyReader.init();
  historyReader.resubmitHistory();
};

