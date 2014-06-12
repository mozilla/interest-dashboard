/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const {getPlacesHostForURI, getBaseDomain, getPublicSuffix} = require("Utils");

const MS_PER_DAY = 86400000;

function KeywordExtractor(workers) {
  this._workers = workers;
  this._init();
}

KeywordExtractor.prototype = {

  //////////////////////////////////////////////////////////////////////////////
  //// nsIDOMEventListener

  handleEvent: function(aEvent) {
    let eventType = aEvent.type;
    if (eventType == "message") {
      let msgData = aEvent.data;
      if (msgData.message == "KeywordsForDocument") {
        this._handleKeywordsResults(msgData);
      }
    }
    else if (eventType == "error") {
      Cu.reportError(aEvent.message);
    }
  },

  //////////////////////////////////////////////////////////////////////////////
  //// Helpers

  _init: function() {
    this._workers.forEach(worker => {
      worker.addEventListener("message", this, false);
      worker.addEventListener("error", this, false);
    });
  },

  _callMatchingWorker: function _KE__callMatchingWorker(worker,callObject) {
    worker.postMessage(callObject);
  },

  _handleKeywordsResults: function _KE__handleKeywordsResults(aData) {
    if (aData.messageId == "extractKeywords") {
      // decrement url count and check if we have seen results from all workers
      this._results[aData.namespace] = aData;
      this._expectedResponses--;
      if (this._expectedResponses == 0) {
        this._resolvePromise();
      }
    }
  },

  _resolvePromise: function _KE__resolvePromise() {
    if (this._deferred != null) {
      let deferred = this._deferred;
      this._deferred = null;
      deferred.resolve(this._results);
    }
  },

  extractKeywords: function _KE_extractKeywords(url, title) {
    if (this._deferred) {
      return this._deferred.promise;
    }

    let deferred = this._deferred = Promise.defer();
    this._results = {};
    try {
      // submit url+title to workers
      url = url || "";
      let uri = NetUtil.newURI(url);
      let host = getPlacesHostForURI(uri);
      let message = {};
      message.message = "getKeywordsForDocument";
      message.url = url;
      message.title = title || "";
      message.host = host;
      message.path = uri.path;
      message.baseDomain = getBaseDomain(host);
      message.publicSuffix = getPublicSuffix(host);
      message.metaData = {};
      message.language = "en";
      message.messageId = "extractKeywords";
      this._expectedResponses = this._workers.length;
      this._workers.forEach(worker => {
        this._callMatchingWorker(worker, message);
      });
    }
    catch (e) {
      this._deferred = null;
      deferred.reject(e);
    }
    return deferred.promise;
  },

}

exports.KeywordExtractor = KeywordExtractor;
