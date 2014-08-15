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
const {getFaviconForHistoryVisit} = require("Utils");
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

      _sortDomains: function(domainsObjs) {
        let sortable = [];
        for (let domain in domainsObjs) {
          sortable.push([domain, domainsObjs[domain].count, domainsObjs[domain].visitID]);
        }
        sortable.sort(function(a, b) { return b[1] - a[1] });
        return sortable;
      },

      _appendSiteCount: function(categories) {
        storage.chartData.interestDashboardData.totalVisits = 0;
        storage.chartData.interestDashboardData.totalViews = 0;
        storage.chartData.interestDashboardData.totalDailyAvg = 0;
        storage.chartData.interestDashboardData.totalWeeklyAvg = 0;

        for (let categoryName in categories) {
          let category = categories[categoryName];
          category.viewCount = 0;
          let domains = {};
          for (let day in category.days) {
            let domainList = category.days[day].domainList;
            for (let domain in domainList) {
              domains[domain] = true;
              category.viewCount += domainList[domain];
            }
          }
          category.visitCount = Object.keys(domains).length;
          category.dailyAvg = category.viewCount / Object.keys(category.days).length;
          category.weeklyAvg = category.dailyAvg * 7;

          storage.chartData.interestDashboardData.totalVisits += category.visitCount;
          storage.chartData.interestDashboardData.totalViews += category.viewCount;
          storage.chartData.interestDashboardData.totalDailyAvg += category.dailyAvg;
          storage.chartData.interestDashboardData.totalWeeklyAvg += category.weeklyAvg;
        }
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

      getFaviconsForTopSites: function() {
        let topDomains = storage.chartData.interestDashboardData.sortedDomains.slice(0, 10);
        return Task.spawn(function() {
          for (let domainIndex = 0; domainIndex < topDomains.length; domainIndex++) {
            let visitID = topDomains[domainIndex][2];
            yield getFaviconForHistoryVisit(domainIndex, visitID);
          }
        });
      },

      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("interestDashboardData", this.storage);
        this.storage.chartData.interestDashboardData.sortedDomains =
          this._sortDomains(this.storage.domains);

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
        let chartJSON = {};
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

        // Generate full chart data
        let values = [];
        let categoryValues = {};
        let otherValues = {};
        for (let i = 0; i < sortedDays.length; i++) {
          let day = sortedDays[i];
          let totalVisits = 0;
          for (let category of interests) {
            if (!categoryValues[category]) {
              categoryValues[category] = [];
            }
            let dataPoints = interestDashboardTypeNamespace.categories[category].days;
            let categoryVisitCount = dataPoints[day] ? dataPoints[day].size : 0;
            let value = [this._daysPostEpochToDate(day), categoryVisitCount];
            categoryValues[category].push(value); // Store value for a category.
            totalVisits += categoryVisitCount; // Increment total value.
          }
          values.push([this._daysPostEpochToDate(day), totalVisits]);
          for (let category of interests) {
            if (!otherValues[category]) {
              otherValues[category] = [];
            }
            otherValues[category].push([this._daysPostEpochToDate(day), totalVisits - categoryValues[category][i][1]]);
          }
        }

        // Add total values to chartJSON.
        chartJSON["total"] = [];
        chartJSON.total.push({
          key: "",
          values: values
        });
        for (let category of interests) {
          chartJSON[category] = [];
          chartJSON[category].push({
            key: category,
            values: categoryValues[category]
          });
          chartJSON[category].push({
            key: "OTHER",
            values: otherValues[category]
          });
        }

        this.storage.chartData.interestDashboardData.areaData = chartJSON;
        this.storage.chartData.interestDashboardData.tableData = interestDashboardTypeNamespace.sortedInterests;
        this.storage.chartData.interestDashboardData.categories = interestDashboardTypeNamespace.categories;
        this._appendSiteCount(this.storage.chartData.interestDashboardData.categories);

        Services.obs.notifyObservers(null, "chart-update",
          JSON.stringify({"type": "interestDashboard", "data": this.storage.chartData.interestDashboardData}));
        this.results = this.storage.chartData.interestDashboardData;
      },
    }, {storage: storageBackend || storage});
    return node;
  }
}

exports.InterestDashboardDataProcessorBolt = InterestDashboardDataProcessorBolt;
