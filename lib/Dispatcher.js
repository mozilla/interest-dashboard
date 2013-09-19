/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Cu} = require("chrome");
const {storage} = require("sdk/simple-storage");
const {Request} = require("sdk/request");
const {mergeObjects} = require("Utils");
	
//const kIdleTimeoutSeconds = 5 * 60;
const kIdleTimeoutSeconds = 5;
const KIdleDaily = "idle-daily";
const kIdle = "idle";
const kMaxPayloadSize = 1024*256;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");

XPCOMUtils.defineLazyServiceGetter(this, "idleService",
                                   "@mozilla.org/widget/idleservice;1",
                                   "nsIIdleService");
XPCOMUtils.defineLazyServiceGetter(this, "uuid",
                                   "@mozilla.org/uuid-generator;1",
                                   "nsIUUIDGenerator");

/**
 * Gives the size of a string in bytes
 */
function byteCount(s) {
  return encodeURI(s).split(/%..|./).length - 1;
}

function Dispatcher(serverUrl) {
  if (!storage.hasOwnProperty("interests")) {
    storage.interests = {};
  }
  if (!storage.hasOwnProperty("uuid")) {
    // generate and store a UUID for this user agent if it doesn't exist
    storage.uuid = uuid.generateUUID().toString().slice(1, -1).replace(/-/g, "");
  }
  this._serverUrl = serverUrl;
  this._isIdleObserver = false;
  Services.obs.addObserver(this, KIdleDaily, false);
}

Dispatcher.prototype = {
  consume: function _consume(annotatedData) {
    // may cause disk churning
    mergeObjects(storage.interests, annotatedData);
    return null;
  },

  getPendingBatch: function _getPendingBatch() {
    return JSON.stringify(this._makePayload(kMaxPayloadSize));
  },

  observe: function _observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case kIdleDaily:
        this._setObserveIdle();
        break;
      case kIdle:
        // ping data to server
        this._sendPing(false, this._serverUrl);
        break;
    }
  },

  _sendPing: function __sendPing(serverUrl) {
    if (this._isIdleObserver) {
      idleService.removeIdleObserver(this, kIdleTimeoutSeconds);
      this._isIdleObserver = false;
    }
    var payload = this._makePayload(kMaxPayloadSize);
    return this._dispatch(serverUrl, payload).then((days) => {
      this._deleteDays(days);
      return days.length;
    },
    (reason) => {
      return reason;
    });
  },

  _makePayload: function __makePayload(maxSize) {
    let payload = {uuid: storage.uuid, interests: {}};
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

    if (Object.keys(payload.interests).length == 0 ) {
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
    idleService.addIdleObserver(this, kIdleTimeoutSeconds);
    this._isIdleObserver = true;
  },
}

exports.Dispatcher = Dispatcher;
