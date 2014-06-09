/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/Services.jsm");

const {storage} = require("sdk/simple-storage");
const {Request} = require("sdk/request");

const NYT_USERINFO_URL = "http://www.nytimes.com/svc/web-products/userinfo.json";

function NYTUtils(storageBackend) {
  this.storage = storageBackend || storage;
}

NYTUtils.prototype = {

  _nytUserDataUrl: NYT_USERINFO_URL,

  _extractVisitCount: function() {
    let cookies = Services.cookies.getCookiesFromHost("nytimes.com");
    while (cookies.hasMoreElements()) {
      let nytCookie = cookies.getNext().QueryInterface(Ci.nsICookie2);
      if (nytCookie.name == "nyt-m") {
        // nyt-m is found: look for v=1.[0-9]+ - which tracks article visits
        let matches = nytCookie.value.match(/v=i.([0-9]+)/);
        if (matches) {
          // if match is found, return the [0-9]+ portion
          return Number(matches[1]);
        }
        break;
      }
    }
    return null;
  },

  fetchNYTUserData: function() {
    let deferred = Promise.defer();
    Request({
      url: this._nytUserDataUrl,
      contentType: "application/json; charset=utf8",
      onComplete: function(response) {
        if (response.status >= 200 && response.status < 300) {
          let {data} = response.json;
          let userInfo = {
            hasId: data && data.id != "0",
            subscription: data && data.subscription,
            visitCount: this._extractVisitCount(),
            timeStamp: Date.now()
          };
          // we must persist userInfo to avoid a situation when dispatcher
          // is making a payload but response from NYT has not arrvied yet
          // In which case, we should use data stored previously
          this.storage.nytUserInfo = userInfo;
          deferred.resolve(userInfo);
        }
        else {
          deferred.reject("HTTP Error " + response.status + " " + response.statusText);
        }
      }.bind(this),
    }).get();
    return deferred.promise;
  },

  getNYTUserData: function() {
    return this.storage.nytUserInfo || null;
  },
};

exports.NYTUtils = NYTUtils;
