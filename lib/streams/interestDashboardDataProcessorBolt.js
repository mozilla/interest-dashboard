/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {createNode} = require("streams/core");
const {storage} = require("sdk/simple-storage");
const {TypeNamespace} = require("TypeNamespace");
const {DataProcessorHelper} = require("Utils");
const {Cu} = require("chrome");
const {getHistoryDetails} = require("Utils");
Cu.import("resource://gre/modules/Task.jsm");
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

      _daysPostEpochToDate: function(dayCount) {
        return parseInt(dayCount) * 24 * 60 * 60 * 1000;
      },

      populateHistoryVisitDetails: function() {
        let categoryList = storage.chartData.interestDashboardData.tableData;
        return Task.spawn(function() {
          let kMaxVisits = 50;
          for (let category of categoryList) {
            let visitQueryList = category.visitIDs.length > kMaxVisits ?
                                 category.visitIDs.slice(0, kMaxVisits) :
                                 category.visitIDs;
            yield getHistoryDetails(category.name, visitQueryList);
          }
        });
      },

      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("interestDashboardData", this.storage);

        /* Processing data for pie chart. */
        let interestDashboardTypeNamespace = message["keywords"]["58-cat"];

        let chartData = [];
        for (let interestData of interestDashboardTypeNamespace.sortedInterests) {
          let obj =  {
            "label": interestData.name,
            "value": interestData.visitCount
          };
          chartData.push(obj);
        }
        this.storage.chartData.interestDashboardData.pieData = chartData;

        /* Processing data for area graph. */
        let chartJSON = [];
        let sortedCategories = interestDashboardTypeNamespace.sortedInterests;
        let interests = sortedCategories.map(interest => {
          return interest.name;
        });

        // Create a set of all dates and sort it into sortedDays.
        let daySet = {};
        for (let category of interests) {
          let dataPoints = interestDashboardTypeNamespace.categories[category].days;
          Object.keys(dataPoints).map(key => {
            daySet[key] =  true;
          });
        }
        let sortedDays = Object.keys(daySet).sort();

        // Generate chart data.
        for (let category of interests) {
          let values = [];
          let dataPoints = interestDashboardTypeNamespace.categories[category].days;
          for (let day of sortedDays) {
            let value = [this._daysPostEpochToDate(day), dataPoints[day] ? dataPoints[day].size : 0];
            values.push(value);
          }
          chartJSON.push({
            key: category,
            values: values
          });
        }
        this.storage.chartData.interestDashboardData.areaData = chartJSON;
        this.storage.chartData.interestDashboardData.tableData = interestDashboardTypeNamespace.sortedInterests;

        Services.obs.notifyObservers(null, "chart-update",
          JSON.stringify({"type": "interestDashboard", "data": this.storage.chartData.interestDashboardData}));
        this.results = this.storage.chartData.interestDashboardData;
      },
    }, {storage: storageBackend || storage});
    return node;
  }
}

exports.InterestDashboardDataProcessorBolt = InterestDashboardDataProcessorBolt;
