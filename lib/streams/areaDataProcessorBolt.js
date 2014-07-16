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
 * to be suitable for the timeline chart
 */
let AreaDataProcessorBolt = {
  create: function _TDPB_create(storageBackend) {
    let node = createNode({
      identifier: "areaDataProcessorBolt",
      listenType: "chartData", // Can also listen to other chart data processors
      emitType: "areaData",
      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("areaData", this.storage);
        DataProcessorHelper.iterateOverTypeNamespace(message, this.storage.chartData.areaData, (message, storedData) => {
          let chartJSON = [];
          for (let category in message.categories) {
            let dataPoints = message.categories[category].days;
            chartJSON.push({
              key: category,
              values: Object.keys(dataPoints).map(key => {
                return [dataPoints[key].x, dataPoints[key].size];
              })
            });
          }
          storedData["chartJSON"] = chartJSON;
        });
      },
    }, {storage: storageBackend || storage});
    return node;
  }
}

exports.AreaDataProcessorBolt = AreaDataProcessorBolt;
