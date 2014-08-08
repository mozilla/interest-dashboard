/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Cu} = require("chrome");
const {createNode} = require("streams/core");
const {storage} = require("sdk/simple-storage");
const {TypeNamespace} = require("TypeNamespace");
const {DataProcessorHelper} = require("Utils");

/*
 * Takes dailyInterests messages and manipulates the data
 * to be suitable for charts
 */
let ChartDataProcessorBolt = {
  create: function _CDPB_create(storageBackend) {
    let node = createNode({
      identifier: "chartDataProcessorBolt",
      listenType: "dailyInterests",
      emitType: "chartData",
      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("genericChartData", this.storage);
        let storageData = this.storage.chartData.genericChartData;
        for (let day in message) {
          for (let type in message[day]) {
            for (let namespace in message[day][type]) {
              if (!storageData[type]) {
                storageData[type] = {};
              }
              if (!storageData[type][namespace]) {
                storageData[type][namespace] = new TypeNamespace(type, namespace);
              }
              if (!(storageData[type][namespace] instanceof TypeNamespace)) {
                storageData[type][namespace] = TypeNamespace.deserialize(storageData[type][namespace]);
              }
              for (let category in message[day][type][namespace]) {
                let domainsToCountMap = message[day][type][namespace][category];
                storageData[type][namespace].addDayToCategory(category, day, domainsToCountMap);
              }
            }
          }
        }

        for (let type in storageData) {
          for (let namespace in storageData[type]) {
            if (!storageData[type][namespace]) {
              storageData[type][namespace] = new TypeNamespace(type, namespace);
            }
            if (!(storageData[type][namespace] instanceof TypeNamespace)) {
              storageData[type][namespace] = TypeNamespace.deserialize(storageData[type][namespace]);
            }
            storageData[type][namespace].sortCategories("dayCount", "x");
            storageData[type][namespace].sortCategories("maxWeight", "y");
            storageData[type][namespace].setXYMaxMin();
            storageData[type][namespace].setIntentAndInterestDistForCategories();
          }
        }

        this.results = this.storage.chartData.genericChartData;
      },
    }, {storage: storageBackend || storage});
    return node;
  }
}

exports.ChartDataProcessorBolt = ChartDataProcessorBolt;
