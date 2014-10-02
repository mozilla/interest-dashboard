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

      _getSortedDomains: function(domainsObjs) {
        let allSorted = this._sortDomains(domainsObjs.all).slice(0, 10);
        let byInterestSorted = {};
        for (let interest in domainsObjs.byInterest) {
          byInterestSorted[interest] = this._sortDomains(domainsObjs.byInterest[interest]).slice(0, 10);
        }
        return {"all": allSorted, "byInterest": {}};
      },

      _visitCountsForCategoryAndDates: function(category, startDateIndex, endDateIndex) {
        let domains = {};
        let today = new Date();
        let oneDay = 24 * 60 * 60 * 1000;
        for (let i = endDateIndex; i >= startDateIndex; i--) {
          let newDateInMS = new Date(today.getTime() - i * oneDay);
          let newDateRounded = parseInt(newDateInMS.getTime() / oneDay).toString();
          if (!category.days[newDateRounded]) {
            continue;
          }
          let domainList = category.days[newDateRounded].domainList;
          for (let domain in domainList) {
            domains[domain] = true;
          }
        }
        return Object.keys(domains).length;
      },

      _appendSiteCount: function(categories) {
        let totalVisitsLastWeek = 0;
        let totalVisitsThisWeek = 0;
        for (let categoryName in categories) {
          let category = categories[categoryName];
          category.totalVisitsLastWeek = this._visitCountsForCategoryAndDates(category, 7, 13);
          category.totalVisitsThisWeek = this._visitCountsForCategoryAndDates(category, 0, 6);
          totalVisitsLastWeek += category.totalVisitsLastWeek;
          totalVisitsThisWeek += category.totalVisitsThisWeek;
        }
        storage.chartData.interestDashboardData.dailyAvgVisitCountLastWeek = totalVisitsLastWeek / 7;
        storage.chartData.interestDashboardData.dailyAvgVisitCountThisWeek = totalVisitsThisWeek / 7;
        storage.chartData.interestDashboardData.totalViews = 0;

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
          storage.chartData.interestDashboardData.totalViews += category.viewCount;
        }
      },

      getDebugLogs: function() {
        return this.debugReport;
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

      getFaviconsForTopSites: function(category) {
        let deferred = Promise.defer();
        if (!storage.chartData.interestDashboardData.sortedDomains) {
          storage.chartData.interestDashboardData.sortedDomains = {"all": [], "byInterest": {}};
        }
        let sortedDomains = storage.chartData.interestDashboardData.sortedDomains;
        let domainsObjs = this.storage.domains;

        if (!category) {
          if (sortedDomains.all.length > 0) {
            deferred.resolve();
            return deferred.promise; // favicon values have already been set.
          }
          sortedDomains.all = this._sortDomains(domainsObjs.all).slice(0, 10);

          return Task.spawn(function() {
            for (let domain of sortedDomains.all) {
              let visitID = domain[2];
              yield getFaviconForHistoryVisit(domain, visitID);
            }
          });
        }

        // We do have a category.
        if (sortedDomains.byInterest[category] && sortedDomains.byInterest[category].length > 0) {
          deferred.resolve();
          return deferred.promise; // favicon values have already been set.
        }
        sortedDomains.byInterest[category] = this._sortDomains(domainsObjs.byInterest[category]).slice(0, 10);

        return Task.spawn(function() {
          for (let domain of sortedDomains.byInterest[category]) {
            let visitID = domain[2];
            yield getFaviconForHistoryVisit(domain, visitID);
          }
        });
      },

      ingest: function _HSB_ingest(message) {
        try {
          this.debugReport.push("~*~* interestDashboardDataProcessorBolt ingest() start *~*~");
          this.debugReport = this.debugReport.concat(message.errorData);
          DataProcessorHelper.initChartInStorage("interestDashboardData", this.storage);
          this.storage.chartData.interestDashboardData.sortedDomains = {"all": [], "byInterest": {}};
          let interestDashboardTypeNamespace = message.chartData["combined"]["58-cat"];

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
          this.storage.chartData.interestDashboardData.minDay = this._daysPostEpochToDate(interestDashboardTypeNamespace.minDay);
          this.storage.chartData.interestDashboardData.capturedRankings = interestDashboardTypeNamespace.capturedRankings;
          this.storage.chartData.interestDashboardData.areaData = chartJSON;
          this.storage.chartData.interestDashboardData.tableData = interestDashboardTypeNamespace.sortedInterests;
          this.storage.chartData.interestDashboardData.sortedIntents = interestDashboardTypeNamespace.sortedIntents;
          this.storage.chartData.interestDashboardData.categories = interestDashboardTypeNamespace.categories;
          this._appendSiteCount(this.storage.chartData.interestDashboardData.categories);

          this.storage.chartData.interestDashboardData.historyVisits = {};
          this.getFaviconsForTopSites().then(() => {
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
