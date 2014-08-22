/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
function Category(categoryName) {
  this.maxWeight = this.visitCount = 0;
  this.name = categoryName;
  this.days = {};
  this.visitIDs = [];
}

Category.deserialize = function(categoryJSON) {
  let newCategoryObj = new Category(categoryJSON.name);
  newCategoryObj.x = categoryJSON.x;
  newCategoryObj.y = categoryJSON.y;
  newCategoryObj.visitCount = categoryJSON.visitCount;
  newCategoryObj.visitIDs = categoryJSON.visitIDs;
  newCategoryObj.days = categoryJSON.days;
  newCategoryObj.maxWeight = categoryJSON.maxWeight;
  newCategoryObj.maxWeightDate = categoryJSON.maxWeightDate;
  newCategoryObj.dayCount = categoryJSON.dayCount;
  return newCategoryObj;
}

Category.prototype = {
  _cartesianDistance: function(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(y1 - y2, 2) + Math.pow((x1 - x2), 2));
  },

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

  setX: function(x) {
    this.x = x;
  },

  setY: function(y) {
    this.y = y;
  },

  sortVisitIDs: function() {
    this.visitIDs.sort();
  },

  setDist: function(distName, compareX, compareY) {
    let dist = this._cartesianDistance(compareX, compareY, this.x, this.y);
    if (distName == "intentDist") {
      this.intentDist = dist;
    } else {
      this.interestDist = dist;
    }
  },

  addDay: function(day, domainsToCountMap, visitIDs) {
    let visitCountSum = this._arraySum(domainsToCountMap);
    this.visitCount += visitCountSum;
    this.visitIDs = this.visitIDs.concat(visitIDs);
    this.days[day] = {"x": this._daysPostEpochToDate(day), "size": visitCountSum, "domainList": domainsToCountMap};

    if (visitCountSum > this.maxWeight) {
      this.maxWeight = visitCountSum;
      this.maxWeightDate = day;
    }
    this.dayCount = Object.keys(this.days).length;
  }
}
exports.Category = Category;