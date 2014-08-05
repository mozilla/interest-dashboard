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
 * Takes dailyInterests messages and manipulates the data
 * to be suitable for charts
 */
let InterestDashboardDataProcessorBolt = {
  create: function _CDPB_create(storageBackend) {
    let node = createNode({
      identifier: "interestDashboardDataProcessorBolt",
      listenType: "chartData",
      emitType: "interestDashboardData",
      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("interestDashboardData", this.storage);
        let storageData = this.storage.chartData.interestDashboardData;
        let interestDashboardTypeNamespace = message["keywords"]["58-cat"];

        let chartData = [];
        for (let interestData of interestDashboardTypeNamespace.sortedInterests) {
          let obj =  {
            "label": interestData.name,
            "value": interestData.visitCount
          };
          chartData.push(obj);
        }
        this.storage.chartData.interestDashboardData = chartData;

        Services.obs.notifyObservers(null, "chart-update",
          JSON.stringify({"type": "interestDashboard", "data": this.storage.chartData.interestDashboardData}));
        this.results = this.storage.chartData.interestDashboardData;
      },
    }, {storage: storageBackend || storage});
    return node;
  }
}

exports.InterestDashboardDataProcessorBolt = InterestDashboardDataProcessorBolt;
