/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");

const {storage} = require("sdk/simple-storage");
const {Request} = require("sdk/request");

const NYT_USERINFO_URL = "http://www.nytimes.com/svc/web-products/userinfo.json";

exports.NYTUtils = {

  _nytUserDataUrl: NYT_USERINFO_URL,

  fetchNYTUserData: function() {
    let deferred = Promise.defer();
    Request({
      url: this._nytUserDataUrl,
      contentType: "application/json; charset=utf8",
      onComplete: function(response) {
        if (response.status >= 200 && response.status < 300) {
          // we must persist userInfo to avoid a situation when dispatcher
          // is making a payload but response from NYT has not arrvied yet
          // In which case, we should use data stored previously
          storage.nytUserInfo = response.json;
          deferred.resolve(response.json);
        }
        else {
          deferred.reject("HTTP Error " + response.status + " " + response.statusText);
        }
      },
    }).get();
    return deferred.promise;
  },

  getNYTUserData: function() {
    return storage.nytUserInfo || null;
  },
};

