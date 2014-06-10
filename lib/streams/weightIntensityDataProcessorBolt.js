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
 * to be suitable for weight intensity charts
 */
let WeightIntensityDataProcessorBolt = {
  create: function _WIDPB_create() {
    let node = createNode({
      identifier: "weightIntensityDataProcessorBolt",
      listenType: "chartData", // Can also listen to other chart data processors
      emitType: "weightIntensityData",
      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("weightIntensityData");
        DataProcessorHelper.iterateOverTypeNamespace(message, storage.chartData.weightIntensityData, (message, storedData) => {
          // pointToInterestsMap is used to make up for a bug in nvd3 where multiple points can't
          // appear in the same location.
          let pointToInterestsMap = {};
          let values = [];

          storedData["xMin"] = message.xMin;
          storedData["yMin"] = message.yMin;
          storedData["xMax"] = message.xMax;
          storedData["yMax"] = message.yMax;

          for (let categoryName in message.categories) {
            let x = message.categories[categoryName].x;
            let y = message.categories[categoryName].y;
            let hash = x.toString() + y.toString();

            if (!pointToInterestsMap[hash]) {
              pointToInterestsMap[hash] = [];
              values.push({"x": x, "y": y});
            }
            pointToInterestsMap[hash].push(categoryName);
          }

          storedData["chartJSON"] = [{
            key: "key",
            values: values
          }];
          storedData["pointToInterestsMap"] = pointToInterestsMap;
        });

        Services.obs.notifyObservers(null, "chart-update",
          JSON.stringify({"type": "weightIntensity", "data": storage.chartData.weightIntensityData}));
        this.results = message;
      },
    });
    return node;
  }
}

exports.WeightIntensityDataProcessorBolt = WeightIntensityDataProcessorBolt;
