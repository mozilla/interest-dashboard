"use strict";

/////     Chart initialization     /////
let types = ["url_title", "title"];

let DataService = function($rootScope) {
  this.rootScope = $rootScope;

  // relay messages from the addon to the page
  self.port.on("message", message => {
    this.rootScope.$apply(_ => {
      this.rootScope.$broadcast(message.content.topic, message.content.data);
    });
  });
}

DataService.prototype = {
  send: function _send(message, obj) {
    self.port.emit(message, obj);
  },
}

let aboutKeywords = angular.module("aboutKeywords", []);
aboutKeywords.service("dataService", DataService);

aboutKeywords.controller("vizCtrl", function($scope, dataService) {
  /** controller helpers **/
  $scope.getTypes = function () {
    return types;
  }

  $scope._initialize = function () {
    $scope.historyComputeInProgress = false;
    $scope.historyComputeComplete = false;
    $scope.emptyMessage = "Your History was not analysed, please run the Full History Analysis.";
    $scope.countsAvailable = false;
    $scope.keywordCounts = [];
    $scope.daysLeft = null;
    $scope.daysLeftStart = null;
    dataService.send("chart_data_request");
  }
  $scope._initialize();

  /** UI functionality **/

  $scope.processHistory = function() {
    $scope._initialize();
    dataService.send("history_process");
    $scope.historyComputeInProgress = true;
  }

  $scope.updateGraphs = function() {
    dataService.send("chart_data_request");
  }

  $scope.$on("days_left", function(event, data) {
    $scope.historyComputeInProgress = true;
    if (!$scope.daysLeftStart) {
      $scope.daysLeftStart = data;
    }
    $scope.daysLeft = data;
    $scope.updateProgressBar();
  });

  $scope.$watch("selectedType", () => {
    $scope.updateRankingDisplay();
  });

  $scope.updateRankingDisplay = function() {
    let data = $scope.keywordCounts[$scope.selectedType];
    $scope.typeKeywords = data;
  }

  $scope.$on("chart_init", function(event, data) {
    //ChartManager.graphKeywordsFromScratch(data, $scope.selectedType);
    $scope.keywordCounts = data;
    $scope.updateRankingDisplay();
  });

  $scope.updateProgressBar = function() {
    let elem = document.querySelector("#progressBar");
    elem.style.width = (100 - Math.round($scope.daysLeft/$scope.daysLeftStart*100)) + "%";
  }
});

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});
