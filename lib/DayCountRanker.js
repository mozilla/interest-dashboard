/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {storage} = require("sdk/simple-storage");
const {mergeObjects} = require("Utils");

function DayCountRanker(namespace, type) {
  this.namespace = namespace;
  this.type = type;
  this.storageKey = "daycount_" + namespace + "_" + type;
  if (!storage.ranking) {
    storage.ranking = {};
  }
  if (!storage.ranking[this.storageKey]) {
    storage.ranking[this.storageKey] = {};
  }
  this.interests = storage.ranking[this.storageKey];
}

DayCountRanker.prototype = {
  consume: function _consume(bucketData) {
    for (let day in bucketData) {
      let typeObject = bucketData[day][this.type];
      if (typeObject && typeObject[this.namespace]) {
        let namespace = typeObject[this.namespace];
        for (let interest in namespace) {
          if (!this.interests.hasOwnProperty(interest)) {
            this.interests[interest] = 0;
          }
          this.interests[interest] ++;
        }
      }
    }
    this.saveRanking();
    return bucketData;
  },

  getRanking: function _getRanking() {
    if (Object.keys(storage.ranking[this.storageKey]).length > 0) {
      return JSON.parse(JSON.stringify(storage.ranking[this.storageKey]));
    }
    return null;
  },

  clear: function _clear() {
    this.interests = {};
    storage.ranking[this.storageKey] = {};
  },

  clearStorage: function _clearStorage() {
    delete storage.ranking[this.storageKey];
  },

  saveRanking: function _saveRanking() {
    let storageData = storage.ranking[this.storageKey];
    mergeObjects(storageData, this.interests);
  },
}

exports.DayCountRanker = DayCountRanker;
