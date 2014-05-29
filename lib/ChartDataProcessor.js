/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {storage} = require("sdk/simple-storage");
const {Cu} = require("chrome");
const {TypeNamespace} = require("TypeNamespace");

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
        dataProcessingFunction(bucketData[type][namespace], storageData[type][namespace], type, namespace);
      }
    }
  },
}

ChartDataProcessor.prototype = {
  consume: function(bucketData) {
    DataProcessorHelper.initChartInStorage("genericChartData");
    let storageData = storage.chartData.genericChartData;
    for (let day in bucketData) {
      for (let type in bucketData[day]) {
        for (let namespace in bucketData[day][type]) {
          if (!storageData[type]) {
            storageData[type] = {};
          }
          if (!storageData[type][namespace]) {
            storageData[type][namespace] = new TypeNamespace(type, namespace);
          }
          if (!(storageData[type][namespace] instanceof TypeNamespace)) {
            storageData[type][namespace] = TypeNamespace.deserialize(storageData[type][namespace]);
          }
          for (let category in bucketData[day][type][namespace]) {
            let domainsToCountMap = bucketData[day][type][namespace][category];
            storageData[type][namespace].addDayToCategory(category, day, domainsToCountMap);
          }
        }
      }
    }

    for (let type in storageData) {
      for (let namespace in storageData[type]) {
        if (!storageData[type][namespace]) {
          storageData[type][namespace] = new TypeNamespace(type, namespace);
        }
        if (!(storageData[type][namespace] instanceof TypeNamespace)) {
          typeNamespace = storageData[type][namespace] = TypeNamespace.deserialize(typeNamespace);
        }
        storageData[type][namespace].sortCategories("dayCount", "x");
        storageData[type][namespace].sortCategories("maxWeight", "y");
        storageData[type][namespace].setXYMaxMin();
        storageData[type][namespace].setIntentAndInterestDistForCategories();
      }
    }
    return storage.chartData.genericChartData;
  }
}

TimelineDataProcessor.prototype = {
  consume: function(bucketData) {
    DataProcessorHelper.initChartInStorage("timelineData");
    DataProcessorHelper.iterateOverTypeNamespace(bucketData, storage.chartData.timelineData, (bucketData, storedData) => {
      let chartJSON = [];
      let interestList = Object.keys(bucketData.categories);
      for (let i = 0; i < interestList.length; i++) {
        let dataPoints = bucketData.categories[interestList[i]].days;
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

      storedData["xMin"] = bucketData.xMin;
      storedData["yMin"] = bucketData.yMin;
      storedData["xMax"] = bucketData.xMax;
      storedData["yMax"] = bucketData.yMax;

      for (let categoryName in bucketData.categories) {
        let x = bucketData.categories[categoryName].x;
        let y = bucketData.categories[categoryName].y;
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

      for (let intentData of bucketData.sortedIntents.splice(0, 10)) {
        let maxWeightDate = intentData.maxWeightDate;
        let domainList = intentData.days[maxWeightDate]["domainList"];
        let maxIntentDate = (new Date(intentData.days[maxWeightDate]["x"])).toLocaleDateString();
        let title = intentData.name + " (" + maxIntentDate + ")";
        let chartJSON = this._createChartData(domainList, storedData, "sortedIntents", title);
      }
      for (let interestData of bucketData["sortedInterests"].splice(0, 10)) {
        let domainList = {};
        for (let dateInfo in interestData.days) {
          for (let domain in interestData.days[dateInfo]["domainList"]) {
            if (!domainList[domain]) {
              domainList[domain] = 0;
            }
            domainList[domain] += interestData.days[dateInfo]["domainList"][domain];
          }
        }
        let title = interestData.name;
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
