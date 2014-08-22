/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Category} = require("Category");

function TypeNamespace(type, namespace) {
  this._type = type;
  this._namespace = namespace;
  this.categories = {};
  this.sortedInterests = [];
  this.sortedIntents = [];
}

TypeNamespace.deserialize = function(typeNamespaceJSON) {
  let newTNObj = new TypeNamespace(typeNamespaceJSON._type, typeNamespaceJSON._namespace);
  newTNObj.xMax = typeNamespaceJSON.xMax;
  newTNObj.xMin = typeNamespaceJSON.xMin;
  newTNObj.yMax = typeNamespaceJSON.yMax;
  newTNObj.yMin = typeNamespaceJSON.yMin;
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

  addDayToCategory: function(categoryName, day, domainsToCountMap, visitIDs) {
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