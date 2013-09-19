/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

exports.mergeObjects = mergeObjects;
