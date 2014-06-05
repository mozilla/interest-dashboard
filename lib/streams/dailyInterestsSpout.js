"use strict";

const {storage} = require("sdk/simple-storage");
const {createNode} = require("streams/core");
const {DateUtils} = require("DateUtils");

let DailyInterestsSpout = {
  create: function _DIS_create(storageBackend) {
    let node = createNode({
      identifier: "dailyInterestsSpout",
      listenType: "interest",
      emitType: "dailyInterests",

      init: function _DIS_init() {
        if (!this.storage.dayBufferInterests) {
          this.storage.dayBufferInterests = {};
        }
      },

      getInterests: function _DIS__getInterests() {
        return this.storage.dayBufferInterests;
      },

      _storeInterest: function _DIS__storeInterest(host, visitDate, visitCount, namespace, type, interest) {
        if (!this.storage.dayBufferInterests[visitDate]) {
          this.storage.dayBufferInterests[visitDate] = {};
        }
        if (!this.storage.dayBufferInterests[visitDate][type]) {
          this.storage.dayBufferInterests[visitDate][type] = {};
        }
        if (!this.storage.dayBufferInterests[visitDate][type][namespace]) {
          this.storage.dayBufferInterests[visitDate][type][namespace] = {};
        }
        if (!this.storage.dayBufferInterests[visitDate][type][namespace][interest]) {
          this.storage.dayBufferInterests[visitDate][type][namespace][interest] = {};
        }
        if (!this.storage.dayBufferInterests[visitDate][type][namespace][interest][host]) {
          this.storage.dayBufferInterests[visitDate][type][namespace][interest][host] = 0;
        }
        this.storage.dayBufferInterests[visitDate][type][namespace][interest][host] += visitCount;
      },

      ingest: function _DIS_ingest(message) {
        let {details, dateVisits} = message;
        let {host, visitDate, visitCount, namespace, results} = details;
        results.forEach(item => {
          let {type, interests} = item;
          interests.forEach(interest => {
            Object.keys(dateVisits).forEach(date => {
              this._storeInterest(host, date, dateVisits[date], namespace, type, interest);
            });
          });
        });
      },

      emitReady: function _DIS_emitReady() {
        let dates = Object.keys(this.storage.dayBufferInterests);

        // check that we have more than one. having only one may mean that we're
        // still adding interests for visits
        if (dates.length < 2) {
          return false;
        }

        // sort by dates, latest-first
        // return everything except latest day
        dates = dates.sort(function (a,b) {
          return parseInt(b) - parseInt(a);
        });
        let pushDays = dates.slice(1, dates.length);
        let pushData = {};
        for (let i=0; i < pushDays.length; i++) {
          let day = pushDays[i];
          pushData[day] = this.storage.dayBufferInterests[day];
          delete this.storage.dayBufferInterests[day];
        }
        this.results = pushData;

        if (this._emitCallback) {
          this._emitCallbackArg = (DateUtils.today() - dates[0]);
        }
        return true;
      },

      flush: function _DIS_flush() {
        let results;
        if (this.results) {
          // invoked when emitReady
          results = this.results;
        }
        else {
          // invoked directly
          results = this.storage.dayBufferInterests;
          this.storage.dayBufferInterests = {};
        }
        return results;
      },

      clearStorage: function _DIS_clearStorage() {
        delete this.storage.dayBufferInterests;
      },

    }, {storage: storageBackend || storage});

    return node;
  }
};

exports.DailyInterestsSpout = DailyInterestsSpout;
