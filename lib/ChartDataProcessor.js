/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {storage} = require("sdk/simple-storage");
const {Cu} = require("chrome");

Cu.import("resource://gre/modules/Services.jsm");

function ChartDataProcessor() {
}

function TimelineDataProcessor() {
}

function WeightIntensityDataProcessor() {
}

function IntentInterestDataProcessor() {
}

DataProcessorHelper = {
  initChartInStorage: function(dataNameString) {
    if (!storage.chartData) {
      storage.chartData = {};
    }
    if (!storage.chartData[dataNameString]) {
      storage.chartData[dataNameString] = {};
    }
  },

  iterateOverTypeNamespace: function(bucketData, storageData, dataProcessingFunction) {
    for (let type in bucketData) {
      for (let namespace in bucketData[type]) {
        if (!storageData[type]) {
          storageData[type] = {};
        }
        if (!storageData[type][namespace]) {
          storageData[type][namespace] = {};
        }
        dataProcessingFunction(bucketData[type][namespace], storageData[type][namespace]);
      }
    }
  },

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

ChartDataProcessor.prototype = {
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

  _setMaxWeightAndDateCount: function(storedData, interest, newDayWeight, date) {
    if (!storedData["interests"][interest]["maxWeight"] ||
        newDayWeight > storedData["interests"][interest]["maxWeight"]) {
      storedData["interests"][interest]["maxWeight"] = newDayWeight;
      storedData["interests"][interest]["maxWeightDate"] = date;
    }
    storedData["interests"][interest]["dayCount"] =
      Object.keys(storedData["interests"][interest]["dates"]).length;
  },

  _setXYMaxMin: function(storedData) {
    let categories = Object.keys(storedData["interests"]);
    let xVals = categories.map((category) => {
      return storedData["interests"][category]["x"];
    });
    storedData["xMax"] = Math.max.apply(null, xVals);
    storedData["xMin"] = Math.min.apply(null, xVals);

    let yVals = categories.map((category) => {
      return storedData["interests"][category]["y"];
    });
    storedData["yMax"] = Math.max.apply(null, yVals);
    storedData["yMin"] = Math.min.apply(null, yVals);
  },

  _cartesianDistance: function(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(y1 - y2, 2) + Math.pow((x1 - x2), 2));
  },

  consume: function(bucketData) {
    DataProcessorHelper.initChartInStorage("genericChartData");
    // STEP 1
    for (let day in bucketData) {
      DataProcessorHelper.iterateOverTypeNamespace(bucketData[day], storage.chartData.genericChartData, (bucketData, storedData) => {
        if (!storedData["interests"]) {
          storedData["interests"] = {};
        }
        for (let interest in bucketData) {
          if (!storedData["interests"][interest]) {
            storedData["interests"][interest] = {};
            storedData["interests"][interest]["dates"] = {};
          }
          let domainsToCountMap = bucketData[interest];
          let visitCountSum = this._arraySum(domainsToCountMap);
          storedData["interests"][interest]["dates"][day] =
            {x: this._daysPostEpochToDate(day), size: visitCountSum, domainList: domainsToCountMap};
          this._setMaxWeightAndDateCount(storedData, interest, visitCountSum, day);
        }
      });
    }

    let currentData = storage.chartData.genericChartData;
    DataProcessorHelper.iterateOverTypeNamespace(currentData, currentData, (bucketData, storedData) => {
      // STEP 2
      // Sort interests by maxWeight and dayCount.
      let sortedByWeights = [];
      let sortedByDayCount = [];
      DataProcessorHelper.interestsToArray(storedData["interests"], sortedByWeights);
      DataProcessorHelper.interestsToArray(storedData["interests"], sortedByDayCount);
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

        storedData["interests"][sortedByDayCount[i]["category"]]["x"] = rankDayCount;
        storedData["interests"][sortedByWeights[i]["category"]]["y"] = rankMaxWeight;
        storedData["interests"][sortedByWeights[i]["category"]]["maxWeightDate"] = sortedByWeights[i]["maxWeightDate"];
      }
      this._setXYMaxMin(storedData);

      // STEP 3
      let intentX = storedData["xMin"];
      let intentY = storedData["yMax"];
      let interestX = storedData["xMax"];
      let interestY = storedData["yMax"];

      let sortedInterests = [];
      let sortedIntents = [];
      for (let category in bucketData["interests"]) {
        let categoryX = storedData["interests"][category]["x"];
        let categoryY = storedData["interests"][category]["y"];

        storedData["interests"][category]["intentDist"] =
          this._cartesianDistance(intentX, intentY, categoryX, categoryY);
        storedData["interests"][category]["interestDist"] =
          this._cartesianDistance(interestX, interestY, categoryX, categoryY);
      }
      DataProcessorHelper.interestsToArray(storedData["interests"], sortedInterests);
      DataProcessorHelper.interestsToArray(storedData["interests"], sortedIntents);
      sortedInterests.sort(DataProcessorHelper.propertyComparator("interestDist"));
      sortedIntents.sort(DataProcessorHelper.propertyComparator("intentDist"));

      storedData["sortedIntents"] = sortedIntents;
      storedData["sortedInterests"] = sortedInterests;
    });
    return storage.chartData.genericChartData;
  }
}

TimelineDataProcessor.prototype = {
  consume: function(bucketData) {
    DataProcessorHelper.initChartInStorage("timelineData");
    DataProcessorHelper.iterateOverTypeNamespace(bucketData, storage.chartData.timelineData, (bucketData, storedData) => {
      let chartJSON = [];
      let interestList = Object.keys(bucketData["interests"]);
      for (let i = 0; i < interestList.length; i++) {
        let dataPoints = bucketData["interests"][interestList[i]]["dates"];
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
    return bucketData;
  },
}

WeightIntensityDataProcessor.prototype = {
  consume: function(bucketData) {
    DataProcessorHelper.initChartInStorage("weightIntensityData");
    DataProcessorHelper.iterateOverTypeNamespace(bucketData, storage.chartData.weightIntensityData, (bucketData, storedData) => {
      // pointToInterestsMap is used to make up for a bug in nvd3 where multiple points can't
      // appear in the same location.
      let pointToInterestsMap = {};
      let values = [];

      storedData["xMin"] = bucketData["xMin"];
      storedData["yMin"] = bucketData["yMin"];
      storedData["xMax"] = bucketData["xMax"];
      storedData["yMax"] = bucketData["yMax"];

      for (let interest in bucketData["interests"]) {
        let x = bucketData["interests"][interest]["x"];
        let y = bucketData["interests"][interest]["y"];
        let hash = x.toString() + y.toString();

        if (!pointToInterestsMap[hash]) {
          pointToInterestsMap[hash] = [];
          values.push({"x": x, "y": y});
        }
        pointToInterestsMap[hash].push(interest);
      }

      storedData["chartJSON"] = [{
        key: "key",
        values: values
      }];
      storedData["pointToInterestsMap"] = pointToInterestsMap;
    });

    Services.obs.notifyObservers(null, "chart-update",
      JSON.stringify({"type": "weightIntensity", "data": storage.chartData.weightIntensityData}));
    return bucketData;
  },
}

IntentInterestDataProcessor.prototype = {
  _createChartData: function(domainList, storedData, dataType, title) {
    let chartData = [];
    for (let domain in domainList) {
      let obj =  {
        "label": domain,
        "value": domainList[domain]
      };
      chartData.push(obj);
    }
    storedData[dataType].push({
      "chartJSON": chartData,
      "title": title
    });
  },

  consume: function(bucketData) {
    DataProcessorHelper.initChartInStorage("intentInterestData");
    DataProcessorHelper.iterateOverTypeNamespace(bucketData, storage.chartData.intentInterestData, (bucketData, storedData) => {
      storedData["sortedInterests"] = [];
      storedData["sortedIntents"] = [];

      for (let intentData of bucketData["sortedIntents"].splice(0, 10)) {
        let maxWeightDate = intentData["maxWeightDate"];
        let domainList = intentData["dates"][maxWeightDate]["domainList"];
        let maxIntentDate = (new Date(intentData["dates"][maxWeightDate]["x"])).toLocaleDateString();
        let title = intentData["category"] + " (" + maxIntentDate + ")";
        let chartJSON = this._createChartData(domainList, storedData, "sortedIntents", title);
      }
      for (let interestData of bucketData["sortedInterests"].splice(0, 10)) {
        let domainList = {};
        for (let dateInfo in interestData["dates"]) {
          for (let domain in interestData["dates"][dateInfo]["domainList"]) {
            if (!domainList[domain]) {
              domainList[domain] = 0;
            }
            domainList[domain] += interestData["dates"][dateInfo]["domainList"][domain];
          }
        }
        let title = interestData["category"];
        let chartJSON = this._createChartData(domainList, storedData, "sortedInterests", title);
      }
    });
    Services.obs.notifyObservers(null, "chart-update",
      JSON.stringify({"type": "intentInterest", "data": storage.chartData.intentInterestData}));
  },
}

exports.ChartDataProcessor = ChartDataProcessor;
exports.TimelineDataProcessor = TimelineDataProcessor;
exports.WeightIntensityDataProcessor = WeightIntensityDataProcessor;
exports.IntentInterestDataProcessor = IntentInterestDataProcessor;
