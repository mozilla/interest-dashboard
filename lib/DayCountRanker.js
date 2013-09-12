/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
function DayCountRanker(namespace, type) {
  this.namespace = namespace;
  this.type = type;
  this.interests = {};
}

DayCountRanker.prototype = {
  consume: function(bucketData) {
    for (let day in bucketData) {
      let typeObject = bucketData[day][this.type];
      if (typeObject && typeObject[this.namespace]) {
        let namespace = typeObject[this.namespace];
        for (let interest in namespace) {
          if (!this.interests.hasOwnProperty(interest)) {
            this.interests[interest] = 0;
          }
          this.interests[interest] += Object.keys(namespace[interest]).length;
        }
      }
    }
    return bucketData;
  },
}

exports.DayCountRanker = DayCountRanker;
