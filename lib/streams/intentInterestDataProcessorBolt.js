/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {createNode} = require("streams/core");
const {storage} = require("sdk/simple-storage");
const {TypeNamespace} = require("TypeNamespace");
const {DataProcessorHelper} = require("Utils");
const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

/*
 * Takes chartData messages and manipulates the data
 * to be suitable for intent interest charts
 */
let IntentInterestDataProcessorBolt = {
  _createChartData: function(domainList, storedData, dataType, title) {
    let chartData = [];
    for (let domain in domainList) {
      let obj =  {
        "label": domain,
        "value": domainList[domain]
      };
      chartData.push(obj);
    }
    storedData[dataType].push({
      "chartJSON": chartData,
      "title": title
    });
  },

  create: function _IIDPB_create(storageBackend) {
    let node = createNode({
      identifier: "intentInterestDataProcessorBolt",
      listenType: "chartData", // Can also listen to other chart data processors
      emitType: "intentInterestData",
      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("intentInterestData", this.storage);
        DataProcessorHelper.iterateOverTypeNamespace(message, this.storage.chartData.intentInterestData, (message, storedData) => {
          storedData["sortedInterests"] = [];
          storedData["sortedIntents"] = [];

          for (let intentData of message.sortedIntents.splice(0, 10)) {
            let maxWeightDate = intentData.maxWeightDate;
            let domainList = intentData.days[maxWeightDate]["domainList"];
            let maxIntentDate = (new Date(intentData.days[maxWeightDate]["x"])).toLocaleDateString();
            let title = intentData.name + " (" + maxIntentDate + ")";
            let chartJSON = IntentInterestDataProcessorBolt._createChartData(domainList, storedData, "sortedIntents", title);
          }
          for (let interestData of message["sortedInterests"].splice(0, 10)) {
            let domainList = {};
            for (let dateInfo in interestData.days) {
              for (let domain in interestData.days[dateInfo]["domainList"]) {
                if (!domainList[domain]) {
                  domainList[domain] = 0;
                }
                domainList[domain] += interestData.days[dateInfo]["domainList"][domain];
              }
            }
            let title = interestData.name;
            let chartJSON = IntentInterestDataProcessorBolt._createChartData(domainList, storedData, "sortedInterests", title);
          }
        });
        Services.obs.notifyObservers(null, "chart-update",
          JSON.stringify({"type": "intentInterest", "data": this.storage.chartData.intentInterestData}));
        this.results = message;
      },
    }, {storage: storageBackend || storage});
    return node;
  }
}

exports.IntentInterestDataProcessorBolt = IntentInterestDataProcessorBolt;
