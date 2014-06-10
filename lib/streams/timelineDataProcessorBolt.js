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
let TimelineDataProcessorBolt = {
  create: function _TDPB_create() {
    let node = createNode({
      identifier: "timelineDataProcessorBolt",
      listenType: "chartData", // Can also listen to other chart data processors
      emitType: "timelineData",
      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("timelineData");
        DataProcessorHelper.iterateOverTypeNamespace(message, storage.chartData.timelineData, (message, storedData) => {
          let chartJSON = [];
          let interestList = Object.keys(message.categories);
          for (let i = 0; i < interestList.length; i++) {
            let dataPoints = message.categories[interestList[i]].days;
            chartJSON.push({
              key: interestList[i],
              values: Object.keys(dataPoints).map(key => {
                dataPoints[key]["y"] = i;
                return dataPoints[key];
              })
            });
          }

          storedData["interestList"] = interestList;
          storedData["chartJSON"] = chartJSON;
        });
        Services.obs.notifyObservers(null, "chart-update",
          JSON.stringify({"type": "timeline", "data": storage.chartData.timelineData}));
        this.results = message;
      },
    });
    return node;
  }
}

exports.TimelineDataProcessorBolt = TimelineDataProcessorBolt;
