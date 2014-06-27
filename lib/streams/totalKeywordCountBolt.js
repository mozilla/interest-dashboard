"use strict";

const {createNode} = require("streams/core");
const {storage} = require("sdk/simple-storage");
const {mergeObjects} = require("Utils");
const {DateUtils} = require("DateUtils");

let TotalKeywordCountBolt = {
  create: function _TKCB_create(storageBackend) {
    let totalKeywordCountBolt = createNode({
      identifier: "totalKeywordCountBolt",
      listenType: "keyword",
      emitType: null,

      init: function _TKCB_init() {
        if (!this.storage.keywords) {
          this.storage.keywordCounts = {};
          this.latestProcessedDate = null;
          this.numFromToday = Number.POSITIVE_INFINITY;
        }
      },

      _init_storage_entry: function _TKCB__init_storage_entry(type, keywords) {
        if (this.storage.keywordCounts[type] == null) {
          this.storage.keywordCounts[type] = {};
        }
        for (let kw of keywords) {
          if (this.storage.keywordCounts[type][kw] == null) {
            this.storage.keywordCounts[type][kw] = 0;
          }
        }
      },

      ingest: function _TKCB_ingest(message) {
        for(let i=0; i < message.length; i++) {
          let {details, dateVisits} = message[i];
          let {host, visitDate, visitCount, namespace, results} = details;
          for (let result of results) {
            this._init_storage_entry(result.type, result.keywords);
            for (let kw of result.keywords) {
              Object.keys(dateVisits).forEach(date => {
                this.storage.keywordCounts[result.type][kw] += 1;
                this.latestProcessedDate = date;
              });
            }
          }
        }
        this.numFromToday = DateUtils.today() - this.latestProcessedDate;
      },

      clearData: function _TKCB_clearData() {
        this.storage.keywordCounts = {};
      },

      clearStorage: function _TKCB_clearStorage() {
        delete this.storage.keywordCounts;
      },
    }, {storage: storageBackend || storage});
    return totalKeywordCountBolt;
  }
};
exports.TotalKeywordCountBolt = TotalKeywordCountBolt;
