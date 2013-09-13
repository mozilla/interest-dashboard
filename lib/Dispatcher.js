/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Cc,Ci} = require("chrome");
const {storage} = require("sdk/simple-storage");
var uuid = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);

/**
 * Merge obj2 into obj1.
 * This assumes both arguments are javascript objects.
 *
 * @returns obj1
 */
function mergeObjects(obj1, obj2) {
  for (var prop in obj2) {
    if ( typeof obj2[prop] == "object" ) {
      if ( !obj1.hasOwnProperty(prop) ) {
        obj1[prop] = obj2[prop];
      }
      else {
        obj1[prop] = mergeObjects(obj1[prop], obj2[prop]);
      }
    } else {
      obj1[prop] = obj2[prop];
    }
  }
  return obj1;
}

function Dispatcher(serverAddress) {
  if (!storage.hasOwnProperty("messageQueue")) {
    storage.messageQueue = {};
  }
  if (!storage.hasOwnProperty("uuid")) {
    // generate and store a UUID for this user agent if it doesn't exist
    storage.uuid = uuid.generateUUID().toString().slice(1, -1).replace(/-/g, "");
  }
  this.serverAddress = serverAddress;
  this._dumpStats();
}

Dispatcher.prototype = {
  consume: function _consume(annotatedData) {
    // may cause disk churning
    mergeObjects(storage.messageQueue, annotatedData);
    this._dumpStats();
    return null;
  },

  dispatch: function _dispatch() {
  },

  _dumpStats: function __dumpStats() {
    dump("days in storage: " + Object.keys(storage.messageQueue).length + "\n");
    dump("uuid: " + storage.uuid + "\n");
  },
}

exports.Dispatcher = Dispatcher;
