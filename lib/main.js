/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Class} = require("sdk/core/heritage");
const {data} = require("self");
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
      data.url("js/jquery-1.7.2.js"),
      data.url("upstudy.js"),
    ],

    include: ["about:upstudy"],
    onAttach: function(worker) {
      worker.port.on("history_run", function() {
        gController.submitHistory().then(interests => {
          worker.port.emit("history_done", interests);
        });
      });
    }
  });

  gController.init();
  // Automatically open a tab unless it's a regular firefox restart
  tabs.open("about:upstudy");

};

