/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Cu} = require("chrome");
const {storage} = require("sdk/simple-storage");
const {Request} = require("sdk/request");
const {mergeObjects, byteCount, getRelevantPrefs} = require("Utils");
const simplePrefs = require("simple-prefs")
	
const kIdleDaily = "idle-daily";
const kIdle = "idle";
const kDispatchComplete = "dispatcher-payload-transmission-complete";
const kMaxPayloadSize = 1024*256;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");

XPCOMUtils.defineLazyServiceGetter(this, "idleService",
                                   "@mozilla.org/widget/idleservice;1",
                                   "nsIIdleService");

function Dispatcher(serverUrl, {enabled, dispatchIdleDelay}) {
  if (!storage.hasOwnProperty("interests")) {
    storage.interests = {};
  }
  this._serverUrl = serverUrl;
  this._isIdleObserver = false;
  this._enabled = enabled || false;
  this._dispatchIdleDelay = dispatchIdleDelay || 300;
  Services.obs.addObserver(this, kIdleDaily, false);
}

Dispatcher.prototype = {
  clear: function() {
    storage.interests = {};
  },

  clearStorage: function() {
    delete storage.interests;
  },

  consume: function _consume(annotatedData) {
    // may cause disk churning
    mergeObjects(storage.interests, annotatedData);
    return null;
  },

  getPendingBatch: function _getPendingBatch() {
    if (Object.keys(storage.interests).length > 0) {
      return JSON.parse(JSON.stringify(this._makePayload(kMaxPayloadSize)));
    }
    return null;
  },

  observe: function _observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case kIdleDaily:
        this._setObserveIdle();
        break;
      case kIdle:
        // ping data to server
        this._unsetObserveIdle();
        if (this._enabled) {
          this._sendPing(this._serverUrl);
        }
        break;
    }
  },

  _sendPing: function __sendPing(serverUrl) {
    var payload = this._makePayload(kMaxPayloadSize);
    return this._dispatch(serverUrl, payload).then(days => {
      this._deleteDays(days);
      Services.obs.notifyObservers(null, kDispatchComplete, days);
      return days.length;
    },
    reason => {
      return reason;
    });
  },

  _makePayload: function __makePayload(maxSize) {
    let payload = {
      uuid: simplePrefs.prefs.uuid,
      prefs: getRelevantPrefs(),
      source: storage.downloadSource,
      interests: {}
    };
    let payloadSize = byteCount(JSON.stringify(payload));
    let sortedMsgIds = Object.keys(storage.interests)
      .map((k) => {return parseInt(k);})
      .sort();

    for(var i=0; i < sortedMsgIds.length; i++) {
      let data = {}
      let day = sortedMsgIds[i];
      data[day] = storage.interests[day];
      mergeObjects(payload.interests, data);
      payloadSize += byteCount(JSON.stringify(data));
      if (payloadSize >= maxSize) {
        break;
      }
    }
    return payload;
  },

  _deleteDays: function __deleteDays(days) {
    let storageData = storage.interests;
    days.forEach( (day) => {
      delete storageData[day];
    });
    storage.interests = storageData;
  },

  _dispatch: function __dispatch(serverUrl, payload) {
    deferred = Promise.defer();

    if (Object.keys(payload.interests).length == 0) {
      deferred.reject("won't send. payload empty");
    }
    else {
      let serverPing = Request({
        url: serverUrl,
        contentType: "application/json; charset=utf8",
        content: JSON.stringify(payload),
        onComplete: (response) => {
          if (response.status == 200) {
            let days = Object.keys(payload.interests);
            deferred.resolve(days);
          }
          else {
            deferred.reject("HTTP Error " + response.status + " " + response.statusText)
          }
        },
      });
      serverPing.post();
    }
    return deferred.promise;
  },

  _setObserveIdle: function __setObserveIdle() {
    idleService.addIdleObserver(this, this._dispatchIdleDelay);
    this._isIdleObserver = true;
  },

  _unsetObserveIdle: function __unsetObserveIdle() {
    if (this._isIdleObserver) {
      idleService.removeIdleObserver(this, this._dispatchIdleDelay);
      this._isIdleObserver = false;
    }
  },
}

exports.Dispatcher = Dispatcher;
