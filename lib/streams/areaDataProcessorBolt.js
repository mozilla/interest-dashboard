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
 * to be suitable for the area chart
 */
let AreaDataProcessorBolt = {
  create: function _TDPB_create(storageBackend) {
    let node = createNode({
      identifier: "areaDataProcessorBolt",
      listenType: "chartData", // Can also listen to other chart data processors
      emitType: "areaData",

      _daysPostEpochToDate: function(dayCount) {
        return parseInt(dayCount) * 24 * 60 * 60 * 1000;
      },

      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("areaData", this.storage);
        let areaTypeNamespace = message["keywords"]["58-cat"];
        let chartJSON = [];

        let top8 = areaTypeNamespace.sortedInterests.slice(0, 9);
        let topInterests = top8.map(interest => {
          return interest.name;
        });

        let daySet = {};
        for (let category of topInterests) {
          let dataPoints = areaTypeNamespace.categories[category].days;
          Object.keys(dataPoints).map(key => {
            daySet[key] =  true;
          });
        }
        let sortedDays = Object.keys(daySet).sort();

        for (let category of topInterests) {
          let values = [];
          let dataPoints = areaTypeNamespace.categories[category].days;
          for (let day of sortedDays) {
            let value = [this._daysPostEpochToDate(day), dataPoints[day] ? dataPoints[day].size : 0];
            values.push(value);
          }
          chartJSON.push({
            key: category,
            values: values
          });
        }
        this.storage.chartData.areaData["chartJSON"] = chartJSON;
        Services.obs.notifyObservers(null, "chart-update",
          JSON.stringify({"type": "area", "data": this.storage.chartData.areaData}));
        this.results = message;
      },
    }, {storage: storageBackend || storage});
    return node;
  }
}

exports.AreaDataProcessorBolt = AreaDataProcessorBolt;
