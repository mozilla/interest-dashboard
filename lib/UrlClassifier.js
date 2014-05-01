/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const {getPlacesHostForURI, getBaseDomain} = require("Utils");

const MS_PER_DAY = 86400000;

function UrlClassifier(workers) {
  this._workers = workers;
  this._init();
}

UrlClassifier.prototype = {

  //////////////////////////////////////////////////////////////////////////////
  //// nsIDOMEventListener

  handleEvent: function(aEvent) {
    let eventType = aEvent.type;
    if (eventType == "message") {
      let msgData = aEvent.data;
      if (msgData.message == "InterestsForDocument") {
        this._handleInterestsResults(msgData);
      }
    }
    else if (eventType == "error") {
      //TODO:handle error
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

  _callMatchingWorker: function I__callMatchingWorker(worker,callObject) {
    worker.postMessage(callObject);
  },

  _handleInterestsResults: function I__handleInterestsResults(aData) {
    Task.spawn(function() {
      if (aData.messageId == "classifyUrl") {
        // decrement url count and check if we have seen results from all workers
        this._results[aData.namespace] = aData;
        this._expectedResponses--;
        if (this._expectedResponses == 0) {
          this._resolvePromise();
        }
      }
    }.bind(this));
  },

  _resolvePromise: function I__resolvePromise() {
    if (this._deferred != null) {
      let deferred = this._deferred;
      this._deferred = null;
      deferred.resolve(this._results);
    }
  },

  classifyPage: function I__ClassifyPage(url, title) {
    if (this._deferred) {
      return this._deferred.promise;
    }

    let deferred = this._deferred = Promise.defer();
    this._results = {};
    try {
      // submit url+title to workers
      let theUrl = url || "http://www.no_such_domain_ever.hmm";
      let uri = NetUtil.newURI(theUrl);
      let host = getPlacesHostForURI(uri);
      let message = {};
      message.message = "getInterestsForDocument";
      message.url = theUrl;
      message.title = title || "";
      message.host = host;
      message.path = uri["path"];
      message.tld = getBaseDomain(host);
      message.metaData = {};
      message.language = "en";
      message.messageId = "classifyUrl";
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

exports.UrlClassifier = UrlClassifier;
