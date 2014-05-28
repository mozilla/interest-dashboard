"use strict";

const {createNode} = require("streams/core");
const {storage} = require("sdk/simple-storage");
const {mergeObjects} = require("Utils");

/*
 * Takes dailyInterests messages and ranks the interests by occurences over daily
 * occurrences. It does not take into account the visit counts.
 */
let makeRanker = function makeRanker(namespace, type) {
  let capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
  let dailyInterestRanker = createNode({
    identifier: namespace+capitalizedType+"Ranker",
    listenType: "dailyInterests",
    namespace: namespace,
    type: type,
    storageKey: "daycount_" + namespace + "_" + type,
    emitType: null,

    init: function _DIR_init() {
      if (!storage.ranking) {
        storage.ranking = {};
      }
      if (!storage.ranking[this.storageKey]) {
        storage.ranking[this.storageKey] = {};
      }
      this.interests = storage.ranking[this.storageKey];
    },

    ingest: function _DIR_ingest(message) {
      for (let day in message) {
        let typeObject = message[day][this.type];
        if (typeObject && typeObject[this.namespace]) {
          let namespace = typeObject[this.namespace];
          for (let interest in namespace) {
            if (!this.interests.hasOwnProperty(interest)) {
              this.interests[interest] = 0;
            }
            this.interests[interest] += 1;
          }
        }
      }
      this.saveRanking();
    },

    getInterests: function _DIR_getInterests() {
      if (Object.keys(storage.ranking[this.storageKey]).length > 0) {
        return JSON.parse(JSON.stringify(storage.ranking[this.storageKey]));
      }
      return null;
    },

    getRanking: function _DIR_getRanking() {
      let ranking = [];
      let interests = this.getInterests() || {};
      Object.keys(interests).sort(function (a,b) {
        return interests[b] - interests[a];
      }).forEach(interest => {
        ranking.push({interest: interest, score: interests[interest]});
      });
      return ranking;
    },

    saveRanking: function _DIR_saveRanking() {
      let storageData = storage.ranking[this.storageKey];
      mergeObjects(storageData, this.interests);
    },

    clearData: function _DIR_clear() {
      this.interests = {};
      storage.ranking[this.storageKey] = {};
    },

    clearStorage: function _DIR_clearStorage() {
      delete storage.ranking[this.storageKey];
    }
  });
  return dailyInterestRanker;
};

exports.makeRanker = makeRanker;
