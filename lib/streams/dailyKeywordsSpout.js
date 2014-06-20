"use strict";

const {storage} = require("sdk/simple-storage");
const {createNode} = require("streams/core");
const {DateUtils} = require("DateUtils");

let DailyKeywordsSpout = {
  create: function _DIS_create(storageBackend) {
    let node = createNode({
      identifier: "dailyKeywordsSpout",
      listenType: "keyword",
      emitType: "dailyKeywords",

      init: function _DIS_init() {
        if (!this.storage.dayBufferKeywords) {
          this.storage.dayBufferKeywords = {};
        }
      },

      getKeywords: function _DIS__getKeywords() {
        return this.storage.dayBufferKeywords;
      },

      _storeKeyword: function _DIS__storeKeyword(host, visitDate, visitCount, namespace, type, keyword) {
        if (!this.storage.dayBufferKeywords[visitDate]) {
          this.storage.dayBufferKeywords[visitDate] = {};
        }
        if (!this.storage.dayBufferKeywords[visitDate][type]) {
          this.storage.dayBufferKeywords[visitDate][type] = {};
        }
        if (!this.storage.dayBufferKeywords[visitDate][type][namespace]) {
          this.storage.dayBufferKeywords[visitDate][type][namespace] = {};
        }
        if (!this.storage.dayBufferKeywords[visitDate][type][namespace][keyword]) {
          this.storage.dayBufferKeywords[visitDate][type][namespace][keyword] = {};
        }
        if (!this.storage.dayBufferKeywords[visitDate][type][namespace][keyword][host]) {
          this.storage.dayBufferKeywords[visitDate][type][namespace][keyword][host] = 0;
        }
        this.storage.dayBufferKeywords[visitDate][type][namespace][keyword][host] += visitCount;
      },

      ingest: function _DIS_ingest(message) {
        for(let i=0; i < message.length; i++) {
          let {details, dateVisits} = message[i];
          let {host, visitDate, visitCount, namespace, results} = details;
          /*
          results.forEach(item => {
            let {type, keywords} = item;
            keywords.forEach(keyword => {
              Object.keys(dateVisits).forEach(date => {
                this._storeKeyword(host, date, dateVisits[date], namespace, type, keyword);
              });
            });
          });
          */
        }
      },

      emitReady: function _DIS_emitReady() {
        /*
        this.dates = Object.keys(this.storage.dayBufferKeywords);
        this.dates.sort(function (a,b) {
          return parseInt(b) - parseInt(a);
        });

        // check that we have more than one. having only one may mean that we're
        // still adding keywords for visits
        if (this.dates.length < 2) {
          return false;
        }

        // return everything except latest day
        let pushDays = this.dates.slice(1, this.dates.length);
        let pushData = {};
        for (let i=0; i < pushDays.length; i++) {
          let day = pushDays[i];
          pushData[day] = this.storage.dayBufferKeywords[day];
          delete this.storage.dayBufferKeywords[day];
        }
        this.results = pushData;
        */
        this.results = null;

        return true;
      },

      flush: function _DIS_flush() {
        /*
        let results;
        if (this.results) {
          // invoked when emitReady
          results = this.results;
          if (this._emitCallback) {
            this.numFromToday = (DateUtils.today() - this.dates[1]);
          }
        }
        else {
          // invoked directly
          results = this.storage.dayBufferKeywords;
          this.storage.dayBufferKeywords = {};
          if (this._emitCallback) {
            this.numFromToday = (DateUtils.today() - this.dates[0]);
          }
        }
        return results;
        */
        return null;
      },

      clearStorage: function _DIS_clearStorage() {
        delete this.storage.dayBufferKeywords;
      },

    }, {storage: storageBackend || storage});

    return node;
  }
};

exports.DailyKeywordsSpout = DailyKeywordsSpout;
