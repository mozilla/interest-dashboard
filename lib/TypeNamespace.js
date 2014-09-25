/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Category} = require("Category");

function TypeNamespace(type, namespace) {
  this._type = type;
  this._namespace = namespace;
  this.maxDay = 0;
  this.categories = {};
  this.capturedRankings = {};
  this.sortedInterests = [];
  this.sortedIntents = [];
}

TypeNamespace.deserialize = function(typeNamespaceJSON) {
  let newTNObj = new TypeNamespace(typeNamespaceJSON._type, typeNamespaceJSON._namespace);
  newTNObj.xMax = typeNamespaceJSON.xMax;
  newTNObj.xMin = typeNamespaceJSON.xMin;
  newTNObj.yMax = typeNamespaceJSON.yMax;
  newTNObj.yMin = typeNamespaceJSON.yMin;
  newTNObj.capturedRankings = typeNamespaceJSON.capturedRankings;
  newTNObj.maxDay = typeNamespaceJSON.maxDay;
  for (let category in typeNamespaceJSON.categories) {
    newTNObj.categories[category] =
      Category.deserialize(typeNamespaceJSON.categories[category]);
  }
  return newTNObj;
}

TypeNamespace.prototype = {
  _propertyComparator: function(property) {
    return function(a, b) {
        return a[property] - b[property];
    };
  },

  _categoriesToArray: function(categoryList) {
    for (let category in this.categories) {
      let arrayObj = {};
      for (let property in this.categories[category]) {
        arrayObj[property] = this.categories[category][property];
      }
      categoryList.push(arrayObj);
    }
  },

  setXYMaxMin: function(storedData) {
    let categories = Object.keys(this.categories);
    let xVals = categories.map((categoryName) => {
      return this.categories[categoryName].x;
    });
    this.xMax = Math.max.apply(null, xVals);
    this.xMin = Math.min.apply(null, xVals);

    let yVals = categories.map((categoryName) => {
      return this.categories[categoryName].y;
    });
    this.yMax = Math.max.apply(null, yVals);
    this.yMin = Math.min.apply(null, yVals);
  },

  sortCategoryVisits: function() {
    for (let categoryName in this.categories) {
      let categoryObj = this.categories[categoryName];
      categoryObj.sortVisitIDs();
    }
  },

  _saveRanks: function() {
    for (let i = 0; i < this.sortedInterests.length; i++) {
      this.categories[this.sortedInterests[i].name].setRank(i + 1);
    }
  },

  _checkAndUpdateCapturedRankings: function() {
    let oneDay = 24 * 60 * 60 * 1000;
    let todayTimestamp = (new Date()).getTime();
    let today = parseInt(todayTimestamp / oneDay);
    let yesterday = parseInt((new Date(todayTimestamp - oneDay).getTime()) / oneDay);

    let sevenDaysAgoTimestamp = new Date(todayTimestamp - 7 * oneDay).getTime();
    let sevenDaysAgo = parseInt(sevenDaysAgoTimestamp / oneDay);

    let rankedInterests = {};
    let rankedIntents = {};
    for (let i = 0; i < this.sortedInterests.length; i++) {  // Assuming sortedInterests and sortedIntents have the same length (which they should)
      rankedInterests[this.sortedInterests[i].name] = (i + 1);
      rankedIntents[this.sortedIntents[i].name] = (i + 1);
    }

    // Capture rankings for 3 scenarios:
    //    1) If no previous ranking exists, capture rankings 1 week prior to today
    //    2) If a week or more has passed since the last capture, recapture.
    //    3) If no current ranking exists, capture ranking for yesterday.
    let previousCapturedRankingExists = this.capturedRankings.previousRanks;
    let captured = {
      "rankedInterests": rankedInterests,
      "rankedIntents": rankedIntents
    };
    if (!previousCapturedRankingExists && this.maxDay >= sevenDaysAgo) {
      this.capturedRankings.previousRanks = captured;
      this.capturedRankings.date = today;
    }
    if (previousCapturedRankingExists && this.capturedRankings.date <= sevenDaysAgo) {
      this.capturedRankings.previousRanks = this.capturedRankings.currentRanks;
      this.capturedRankings.currentRanks = captured;
      this.capturedRankings.date = today;
    }
    if (this.maxDay >= yesterday) {
      this.capturedRankings.currentRanks = captured;
      this.capturedRankings.date = today;
    }
  },

  addDayToCategory: function(categoryName, day, domainsToCountMap, visitIDs) {
    if (day > this.maxDay) {
      this.maxDay = day;
    }

    let categoryObj = this.categories[categoryName];
    if (!categoryObj) {
      categoryObj = new Category(categoryName);
      this.categories[categoryName] = categoryObj;
    }
    categoryObj.addDay(day, domainsToCountMap, visitIDs);
  },

  setIntentAndInterestDistForCategories: function() {
    for (let categoryName in this.categories) {
      this.categories[categoryName].setDist("intentDist", this.xMin, this.yMax);
      this.categories[categoryName].setDist("interestDist", this.xMax, this.yMax);
    }
    this.sortedIntents = [];
    this.sortedInterests = [];
    this._categoriesToArray(this.sortedIntents);
    this._categoriesToArray(this.sortedInterests);
    this.sortedIntents.sort(this._propertyComparator("intentDist"));
    this.sortedInterests.sort(this._propertyComparator("interestDist"));
    this._checkAndUpdateCapturedRankings();
    this._saveRanks();
  },

  sortCategories: function(sortProperty, setVal) {
    let sorted = [];
    this._categoriesToArray(sorted);
    sorted.sort(this._propertyComparator(sortProperty));

    let rankProperty = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && (sorted[i - 1][sortProperty] != sorted[i][sortProperty])) {
        rankProperty++;
      }
      let category = this.categories[sorted[i].name];
      setVal == "x" ? category.setX(rankProperty) : category.setY(rankProperty);
    }
  },
}

exports.TypeNamespace = TypeNamespace;