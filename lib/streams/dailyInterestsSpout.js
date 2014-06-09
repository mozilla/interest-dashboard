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
        for(let i=0; i < message.length; i++) {
          let {details, dateVisits} = message[i];
          let {host, visitDate, visitCount, namespace, results} = details;
          results.forEach(item => {
            let {type, interests} = item;
            interests.forEach(interest => {
              Object.keys(dateVisits).forEach(date => {
                this._storeInterest(host, date, dateVisits[date], namespace, type, interest);
              });
            });
          });
        }
      },

      emitReady: function _DIS_emitReady() {
        this.dates = Object.keys(this.storage.dayBufferInterests);
        this.dates.sort(function (a,b) {
          return parseInt(b) - parseInt(a);
        });

        // check that we have more than one. having only one may mean that we're
        // still adding interests for visits
        if (this.dates.length < 2) {
          return false;
        }

        // return everything except latest day
        let pushDays = this.dates.slice(1, this.dates.length);
        let pushData = {};
        for (let i=0; i < pushDays.length; i++) {
          let day = pushDays[i];
          pushData[day] = this.storage.dayBufferInterests[day];
          delete this.storage.dayBufferInterests[day];
        }
        this.results = pushData;

        return true;
      },

      flush: function _DIS_flush() {
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
          results = this.storage.dayBufferInterests;
          this.storage.dayBufferInterests = {};
          if (this._emitCallback) {
            this.numFromToday = (DateUtils.today() - this.dates[0]);
          }
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
