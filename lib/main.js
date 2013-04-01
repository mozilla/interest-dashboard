/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Class} = require("sdk/core/heritage");
const {data} = require("self");
const {Factory, Unknown} = require("api-utils/xpcom");
const {PageMod} = require("page-mod");
const tabs = require("tabs");

const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/PlacesInterestsStorage.jsm");
Cu.import("resource://gre/modules/Services.jsm");

const INTEREST_ENABLED_PREF = "interests.enabled";

exports.main = function(options, callbacks) {
  let iService = Cc["@mozilla.org/places/interests;1"].
    getService(Ci.nsISupports).wrappedJSObject;

  // Handle about:profile requests
  Factory({
    contract: "@mozilla.org/network/protocol/about;1?what=profile",

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

  // Add functionality into about:profile page loads
  PageMod({
    contentScriptFile: [
      data.url("profile.js"),
    ],

    include: ["about:profile"],

    onAttach: function(worker) {
      worker.port.emit("style", data.url("profile.css"));

      worker.port.on("call_service", function(method, args) {
        iService[method].apply(iService, args).then(function(result) {
          worker.port.emit("called_service", method, args, result);
        });
      });
    }
  });

  // Initialize interests metadata, so Firefox knows to look for these
  const interests = ["arts", "banking", "blogging", "business", "career",
    "cars", "clothes", "computers", "consumer-electronics", "cuisine", "dance",
    "discounts", "drinks", "education", "email", "entertainment", "family",
    "fashion", "finance", "food", "games", "government", "health", "history",
    "hobby", "home", "image-sharing", "law", "maps", "marketing", "men",
    "motorcycles", "movies", "music", "news", "outdoors", "pets", "photography",
    "politics", "radio", "reading", "real-estate", "reference", "relationship",
    "religion", "reviews", "science", "shoes", "shopping", "society", "sports",
    "technology", "travel", "tv", "video-games", "weather", "women", "writing"];
  interests.forEach(item => PlacesInterestsStorage.setMetaForInterest(item));

  // Automatically open a tab unless it's a regular firefox restart
  if (options.loadReason != "startup") {
    tabs.open("about:profile");
  }

  // Turn on the interest service when activating the add-on
  Services.prefs.getDefaultBranch("").setBoolPref(INTEREST_ENABLED_PREF, true);
};

exports.onUnload = function(reason) {
  // Turn off the interest service when deactivating the add-on
  Services.prefs.getDefaultBranch("").setBoolPref(INTEREST_ENABLED_PREF, false);
};
