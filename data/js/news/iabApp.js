"use strict";

let iabNewsApp = angular.module("iabNewsApp", ["newsAppControllers"]);

iabNewsApp.config(function($locationProvider, $sceDelegateProvider, $compileProvider) {
   $sceDelegateProvider.resourceUrlWhitelist([
    'self',
    self.options.dataUrl + "/**",
    'docPagingView.html',
   ]);

  $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|resource):/);
});

iabNewsApp.filter("noZeroCat", function() {
  return function(input, iab) {
    if (!input) return [];
    let res = [];
    input.forEach(function(key) {
      if (iab[key].count) {
        res.push(key);
      }
    });
    return res;
  };
});

iabNewsApp.filter("SelectedCats", function() {
  return function(input, selectedCats) {
    if (!input) return [];
    let res = [];
    input.forEach(function(key) {
      if (selectedCats[key]) {
        res.push(key);
      }
    });
    return res;
  };
});

iabNewsApp.controller("iabNewsCtrl", function($scope) {
  $scope.taxonomy = null;
  $scope.dataUrl = self.options.dataUrl;
  $scope.Math = window.Math;
  $scope.topSelected;
  $scope.subSelected;
  $scope.currentCat;
  $scope.checkedCats;
  $scope.checkAll = false;
  $scope.expended = {};

  function setPagerDocuments(cat) {
    let appElement = document.querySelector('#docPage');
    let pagerScope = angular.element(appElement).scope();
    pagerScope.setDocuments(($scope.iab[cat]) ? $scope.iab[cat].docs : []);
    $scope.currentCat = cat;
  }

  $scope.topCatSelect = function(cat) {
    $scope.topSelected = cat;
    $scope.subSelected = null;
    setPagerDocuments(cat);
  };

  $scope.isTopSelected = function(cat) {
    return cat == $scope.topSelected;
  };

  $scope.getTopCatClass = function(cat) {
    if ($scope.isTopSelected(cat)) {
      return "iab-top-cat-selected";
    }
    return "";
  };

  $scope.doShowSeconds = function(cat) {
    return $scope.isTopSelected(cat)
           && $scope.seconds[cat]
           && $scope.seconds[cat].length > 0
           && $scope.iab[$scope.seconds[cat][0]].count > 0;
  };

  $scope.subCatSelect = function(cat) {
    $scope.subSelected = cat;
    setPagerDocuments(cat);
  };

  $scope.isSubSelected = function(cat) {
    return cat == $scope.subSelected;
  };

  $scope.getSubCatClass = function(cat) {
    if ($scope.isSubSelected(cat)) {
      return "iab-sub-cat-selected";
    }
    return "";
  };

  $scope.clearAll = function() {
    self.port.emit("clearAll");
    $scope.currentCat = null;
  };

  $scope.changeAll = function() {
    Object.keys($scope.iab).forEach(cat => {$scope.checkedCats[cat] = $scope.checkAll;});
  };

  $scope.toggelSettings = function() {
    $scope.showConfig = !$scope.showConfig;
  };

  $scope.resetPrefs = function() {
    $scope.checkAll = false;
    self.port.emit("reset");
  };

  $scope.changeCheckedStatus = function(cat) {
    self.port.emit("check-change", cat, $scope.checkedCats[cat]);
  };

  $scope.toggelSubPrefs = function(cat) {
    $scope.expended[cat] = !$scope.expended[cat];
  };

  function compareCats(a,b) {
    if ($scope.settings.scores[b] && $scope.settings.scores[a]) {
      return $scope.settings.scores[b] - $scope.settings.scores[a];
    }
    if($scope.settings.scores[b] && !$scope.settings.scores[a]) return 1;
    if(!$scope.settings.scores[b] && $scope.settings.scores[a]) return -1;

    return $scope.iab[b].count - $scope.iab[a].count;
  };

  self.port.on("full-data", function(data) {
    $scope.$apply(_ => {
      $scope.iab = data.iab;
      $scope.settings = data.settings;
      $scope.tops = Object.keys(data.taxonomy).sort(compareCats);
      $scope.seconds = {};
      $scope.tops.forEach(function(key) {
        $scope.seconds[key] = Object.keys(data.taxonomy[key]).sort(compareCats);
      });
      // set preferences
      $scope.checkedCats = {};
      Object.keys($scope.settings.checked).forEach(cat => {
        $scope.checkedCats[cat] = true;
      });
      // set current Cat
      if ($scope.tops.length) {
        setPagerDocuments($scope.tops[0]);
      }
    });
  });

  self.port.on("update", function(data) {
    $scope.$apply(_ => {
      $scope.iab = data.iab;
      $scope.settings = data.settings;
      Object.keys($scope.checkedCats).forEach(cat => {
        if ($scope.settings.checked[cat])
          $scope.checkedCats[cat] = true;
        else 
          $scope.checkedCats[cat] = false;
      });
      setPagerDocuments($scope.currentCat);
    });
  });
});

// Low-level data injection
self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});

self.port.on("import", function(data) {
  $('head').append(data);
});

self.port.on("bootstrap", function() {
  angular.bootstrap(document, ['iabNewsApp']);
});
