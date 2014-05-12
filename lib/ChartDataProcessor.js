/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {storage} = require("sdk/simple-storage");
const {Cu} = require("chrome");

Cu.import("resource://gre/modules/Services.jsm");

function TimelineDataProcessor() {
}

TimelineDataProcessor.prototype = {
  _arraySum: function(arr) {
    sum = 0;
    for (element in arr) {
      sum += parseInt(arr[element]);
    }
    return sum;
  },

  _daysPostEpochToDate: function(dayCount) {
    return parseInt(dayCount) * 24 * 60 * 60 * 1000;
  },

  consume: function(bucketData) {
    if (!storage.chartData) {
      storage.chartData = {};
    }
    if (!storage.chartData.timelineData) {
      storage.chartData.timelineData = {};
    }
    for (var day in bucketData) {
      for (var type in bucketData[day]) {
        for (var namespace in bucketData[day][type]) {
          if (!storage.chartData.timelineData[type]) {
            storage.chartData.timelineData[type] = {};
          }
          if (!storage.chartData.timelineData[type][namespace]) {
            storage.chartData.timelineData[type][namespace] = {};
          }

          for (var interest in bucketData[day][type][namespace]) {
            if (!storage.chartData.timelineData[type][namespace][interest]) {
              storage.chartData.timelineData[type][namespace][interest] = {};
            }
            visitCountArr = bucketData[day][type][namespace][interest];
            storage.chartData.timelineData[type][namespace][interest][day] =
              {x: this._daysPostEpochToDate(day), size: this._arraySum(visitCountArr)};
          }
        }
      }
    }
    Services.obs.notifyObservers(null, "chart-update",
      JSON.stringify({"type": "timeline", "data": storage.chartData.timelineData}));
  },
}

exports.TimelineDataProcessor = TimelineDataProcessor;