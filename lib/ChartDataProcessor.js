/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {storage} = require("sdk/simple-storage");
const {Cu} = require("chrome");

Cu.import("resource://gre/modules/Services.jsm");

function TimelineDataProcessor() {
}

function WeightIntensityDataProcessor() {
}

function IntentInterestDataProcessor() {
}

DataProcessorHelper = {
  interestsToArray: function(interestObjects, interestList) {
    for (let category in interestObjects) {
      let arrayObj = {"category": category};
      for (let property in interestObjects[category]) {
        arrayObj[property] = interestObjects[category][property];
      }
      interestList.push(arrayObj);
    }
  },

  propertyComparator: function(property) {
    return function(a, b) {
        return a[property] - b[property];
    };
  },
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

  _setMaxWeightAndDateCount: function(type, namespace, interest, newDayWeight) {
    if (!storage.chartData.timelineData[type][namespace][interest]["maxWeight"] ||
        newDayWeight > storage.chartData.timelineData[type][namespace][interest]["maxWeight"]) {
      storage.chartData.timelineData[type][namespace][interest]["maxWeight"] = newDayWeight;
    }
    storage.chartData.timelineData[type][namespace][interest]["dayCount"] =
      Object.keys(storage.chartData.timelineData[type][namespace][interest]["dates"]).length;
  },

  consume: function(bucketData) {
    if (!storage.chartData) {
      storage.chartData = {};
    }
    if (!storage.chartData.timelineData) {
      storage.chartData.timelineData = {};
    }
    for (let day in bucketData) {
      for (let type in bucketData[day]) {
        for (let namespace in bucketData[day][type]) {
          if (!storage.chartData.timelineData[type]) {
            storage.chartData.timelineData[type] = {};
          }
          if (!storage.chartData.timelineData[type][namespace]) {
            storage.chartData.timelineData[type][namespace] = {};
          }

          for (let interest in bucketData[day][type][namespace]) {
            if (!storage.chartData.timelineData[type][namespace][interest]) {
              storage.chartData.timelineData[type][namespace][interest] = {};
              storage.chartData.timelineData[type][namespace][interest]["dates"] = {};
            }
            visitCountSum = this._arraySum(bucketData[day][type][namespace][interest]);
            storage.chartData.timelineData[type][namespace][interest]["dates"][day] =
              {x: this._daysPostEpochToDate(day), size: visitCountSum};

            this._setMaxWeightAndDateCount(type, namespace, interest, visitCountSum);
          }
        }
      }
    }
    Services.obs.notifyObservers(null, "chart-update",
      JSON.stringify({"type": "timeline", "data": storage.chartData.timelineData}));
    return storage.chartData.timelineData;
  },
}

WeightIntensityDataProcessor.prototype = {
  _setXYMaxMin: function(type, namespace) {
    let categories = Object.keys(storage.chartData.weightIntensityData[type][namespace]["interests"]);
    let xVals = categories.map((category) => {
      return storage.chartData.weightIntensityData[type][namespace]["interests"][category]["x"];
    });
    storage.chartData.weightIntensityData[type][namespace]["xMax"] = Math.max.apply(null, xVals);
    storage.chartData.weightIntensityData[type][namespace]["xMin"] = Math.min.apply(null, xVals);

    let yVals = categories.map((category) => {
      return storage.chartData.weightIntensityData[type][namespace]["interests"][category]["y"];
    });
    storage.chartData.weightIntensityData[type][namespace]["yMax"] = Math.max.apply(null, yVals);
    storage.chartData.weightIntensityData[type][namespace]["yMin"] = Math.min.apply(null, yVals);
  },

  consume: function(bucketData) {
    if (!storage.chartData) {
      storage.chartData = {};
    }
    if (!storage.chartData.weightIntensityData) {
      storage.chartData.weightIntensityData = {};
    }
    for (let type in bucketData) {
      for (let namespace in bucketData[type]) {
        if (!storage.chartData.weightIntensityData[type]) {
          storage.chartData.weightIntensityData[type] = {};
        }
        if (!storage.chartData.weightIntensityData[type][namespace]) {
          storage.chartData.weightIntensityData[type][namespace] = {};
          storage.chartData.weightIntensityData[type][namespace]["interests"] = {};
        }

        // Sort interests by maxWeight and dayCount.
        let sortedByWeights = [];
        let sortedByDayCount = [];
        DataProcessorHelper.interestsToArray(bucketData[type][namespace], sortedByWeights);
        DataProcessorHelper.interestsToArray(bucketData[type][namespace], sortedByDayCount);
        sortedByWeights.sort(DataProcessorHelper.propertyComparator("maxWeight"));
        sortedByDayCount.sort(DataProcessorHelper.propertyComparator("dayCount"));

        // Rank interests.
        let rankMaxWeight = 1;
        let rankDayCount = 1;
        for (let i = 0; i < sortedByWeights.length; i++) {
          if (i > 0 && (sortedByWeights[i - 1]["maxWeight"] != sortedByWeights[i]["maxWeight"])) {
            rankMaxWeight++;
          }
          if (i > 0 && (sortedByDayCount[i - 1]["dayCount"] != sortedByDayCount[i]["dayCount"])) {
            rankDayCount++;
          }

          if (!storage.chartData.weightIntensityData[type][namespace]["interests"][sortedByWeights[i]["category"]]) {
            storage.chartData.weightIntensityData[type][namespace]["interests"][sortedByWeights[i]["category"]] = {};
          }
          if (!storage.chartData.weightIntensityData[type][namespace]["interests"][sortedByDayCount[i]["category"]]) {
            storage.chartData.weightIntensityData[type][namespace]["interests"][sortedByDayCount[i]["category"]] = {};
          }
          storage.chartData.weightIntensityData[type][namespace]["interests"][sortedByDayCount[i]["category"]]["x"] = rankDayCount;
          storage.chartData.weightIntensityData[type][namespace]["interests"][sortedByWeights[i]["category"]]["y"] = rankMaxWeight;
        }
        this._setXYMaxMin(type, namespace);
      }
    }
    Services.obs.notifyObservers(null, "chart-update",
      JSON.stringify({"type": "weightIntensity", "data": storage.chartData.weightIntensityData}));
    return storage.chartData.weightIntensityData;
  },
}

IntentInterestDataProcessor.prototype = {
  consume: function(bucketData) {

  },
}

exports.TimelineDataProcessor = TimelineDataProcessor;
exports.WeightIntensityDataProcessor = WeightIntensityDataProcessor;
exports.IntentInterestDataProcessor = IntentInterestDataProcessor;
