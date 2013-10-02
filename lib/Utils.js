/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu} = require("chrome");

Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const timers = require("timers");

/**
 * Merge obj2 into obj1.
 * @params obj1, obj2 Javascript Objects. obj2's properties will be added to obj1
 *
 * @returns obj1
 */
exports.mergeObjects = function mergeObjects(obj1, obj2) {
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

/**
 * Gives the size of a string in bytes
 * @params s a string
 *
 * @returns size in bytes
 */
exports.byteCount = function byteCount(s) {
  return encodeURI(s).split(/%..|./).length - 1;
}


/**
 * Resolves a promise after specified delay
 * @params milisecondsDelay
 *         a delay in ms
 * @returns promise to be resolved after delay passes
 */
exports.promiseTimeout = function promiseTimeout(milisecondsDelay) {
  let deferred = Promise.defer();
  timers.setTimeout(() => {deferred.resolve();},milisecondsDelay);
  return deferred.promise;
}
