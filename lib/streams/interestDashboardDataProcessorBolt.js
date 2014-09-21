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
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
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

      getDebugLogs: function() {
        return this.debugReport;
      },

      populateHistoryVisitDetails: function() {
        let categoryList = storage.chartData.interestDashboardData.tableData;
        return Task.spawn(function() {
          for (let category of categoryList) {
            yield this.getNextHistoryVisitPage(category.name);
          }
        }.bind(this));
      },

      getNextHistoryVisitPage: function(categoryName) {
        return Task.spawn(function() {
          let category = storage.chartData.interestDashboardData.categories[categoryName];
          let pageNum = (!storage.chartData.interestDashboardData.historyVisits ||
                        !storage.chartData.interestDashboardData.historyVisits[category.name]) ? 1 :
                        storage.chartData.interestDashboardData.historyVisits[category.name].pageNum + 1;
          let pageSize = 50;
          let visitIDLength = category.visitIDs.length;

          let startIndex = visitIDLength - (pageSize * pageNum);
          let endIndex = startIndex + pageSize;
          if (startIndex < 0) {
            startIndex = 0;
          }

          let visitQueryList = category.visitIDs.slice(startIndex, endIndex);
          yield getHistoryDetails(categoryName, visitQueryList, startIndex == 0, pageNum);
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
        try {
          this.debugReport.push("~*~* interestDashboardDataProcessorBolt ingest() start *~*~");
          this.debugReport = this.debugReport.concat(message.errorData);
          DataProcessorHelper.initChartInStorage("interestDashboardData", this.storage);
          this.storage.chartData.interestDashboardData.sortedDomains =
            this._sortDomains(this.storage.domains);
          let interestDashboardTypeNamespace = message.chartData["keywords"]["58-cat"];

          this.debugReport.push("Processing data for pie chart");
          let chartData = [];
          for (let interestData of interestDashboardTypeNamespace.sortedInterests) {
            let obj =  {
              "label": interestData.name,
              "value": interestData.visitCount
            };
            chartData.push(obj);
          }
          this.storage.chartData.interestDashboardData.pieData = chartData;

          this.debugReport.push("Processing data for area graph");
          let chartJSON = {};
          let sortedCategories = interestDashboardTypeNamespace.sortedInterests;
          let interests = sortedCategories.map(interest => {
            return interest.name;
          });

          // Create a list of dates for past 30 days.
          let sortedDays = [];
          for (let i = 30; i >= 0; i--) {
            let today = new Date();
            let newDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
            sortedDays.push(parseInt(newDate.getTime() / 24 / 60 / 60 / 1000).toString());
          }

          // Generate full chart data
          let values = [];
          let maxCategories = {};
          let categoryValues = {};
          let otherValues = {};
          for (let i = 0; i < sortedDays.length; i++) {
            let day = sortedDays[i];
            let totalVisits = 0;
            let maxCategory = "";
            let maxCategoryVisitCount = 0;
            for (let category of interests) {
              if (!categoryValues[category]) {
                categoryValues[category] = [];
              }
              let dataPoints = interestDashboardTypeNamespace.categories[category].days;
              let categoryVisitCount = dataPoints[day] ? dataPoints[day].size : 0;
              let value = [this._daysPostEpochToDate(day), categoryVisitCount];
              categoryValues[category].push(value); // Store value for a category.
              totalVisits += categoryVisitCount; // Increment total value.

              // Keep track of max category for a given day.
              if (categoryVisitCount > maxCategoryVisitCount) {
                maxCategoryVisitCount = categoryVisitCount;
                maxCategory = category;
              }
            }
            maxCategories[this._daysPostEpochToDate(day)] = maxCategory;
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
          chartJSON["maxCategories"] = maxCategories;
          for (let category of interests) {
            chartJSON[category] = [];
            chartJSON[category].push({
              key: category,
              values: categoryValues[category]
            });
            chartJSON[category].push({
              key: "Total",
              values: otherValues[category]
            });
          }

          this.debugReport.push("Setting variables in storage.chartData.interestDashboardData");
          this.storage.chartData.interestDashboardData.maxDay = this._daysPostEpochToDate(interestDashboardTypeNamespace.maxDay);
          this.storage.chartData.interestDashboardData.areaData = chartJSON;
          this.storage.chartData.interestDashboardData.tableData = interestDashboardTypeNamespace.sortedInterests;
          this.storage.chartData.interestDashboardData.sortedIntents = interestDashboardTypeNamespace.sortedIntents;
          this.storage.chartData.interestDashboardData.categories = interestDashboardTypeNamespace.categories;
          this._appendSiteCount(this.storage.chartData.interestDashboardData.categories);

          this.storage.chartData.interestDashboardData.historyVisits = {};
          let visitPromise = this.populateHistoryVisitDetails();
          let faviconPromise = this.getFaviconsForTopSites();
          Promise.all([faviconPromise, visitPromise]).then(() => {
            Services.obs.notifyObservers(null, "chart-update",
              JSON.stringify({"type": "interestDashboard", "data": this.storage.chartData.interestDashboardData}));
            this.results = this.storage.chartData.interestDashboardData;
          });
        } catch (ex) {
          this.debugReport.push("Error in interestDashboardDataProcessorBolt.ingest(): " + ex);
        }
        this.debugReport.push("~*~* interestDashboardDataProcessorBolt ingest() complete *~*~");
      },
    }, {storage: storageBackend || storage, debugReport: []});
    return node;
  }
}

exports.InterestDashboardDataProcessorBolt = InterestDashboardDataProcessorBolt;
