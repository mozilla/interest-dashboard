"use strict";

let DataService = function($window, $rootScope, $http) {
  this.window = $window;
  this.rootScope = $rootScope;

  // relay messages from the addon to the page
  self.port.on("message", message => {
    this.rootScope.$apply(_ => {
      this.rootScope.$broadcast(message.content.topic, message.content.data);
    });
  });
}

DataService.prototype = {
  send: function _send(message) {
    self.port.emit(message);
  },
}

let studyDbgMenu = angular.module("studyDebugMenu", []);
studyDbgMenu.service("dataService", DataService);

studyDbgMenu.controller("studyCtrl", function($scope, dataService) {
  $scope.historyComputeInProgress = false;
  $scope.historyComputeComplete = false;
  $scope.rankingData = null;
  $scope.dispatchBatch = null;
  $scope.dispatchBatchNotSendable = true;
  $scope.dispatchInProgress = false;
  $scope.dispatchSuccess = null;
  $scope.dispatchError = null;

  $scope.processHistory = function() {
    dataService.send("history_process");
    $scope.historyComputeInProgress = true;
    $scope.dispatchBatchNotSendable = true;
  }

  $scope.dispatchRun = function() {
    dataService.send("dispatch_run");
    $scope.dispatchBatchNotSendable = true;
    $scope.dispatchInProgress = true;
    $scope.dispatchSuccess = null;
    $scope.dispatchError = null;
  }

  $scope.dispatchGetNext = function() {
    dataService.send("dispatch_get_next");
    $scope.dispatchBatchNotSendable = true;
  }

  $scope.$on("dispatch_success", function(event, data) {
    $scope.dispatchSuccess = data;
    $scope.dispatchInProgress = false;
    $scope.dispatchGetNext();
  });

  $scope.$on("dispatch_error", function(event, data) {
    $scope.dispatchError = data;
    $scope.dispatchInProgress = false;
  });

  $scope.$on("ranking_data", function(event, data) {
    $scope.rankingData = data;
    $scope.historyComputeComplete = true;
  });

  $scope.$on("dispatch_batch", function(event, data) {
    $scope.historyComputeComplete = true;
    $scope.rankingComputeInProgress = false;
    $scope.dispatchBatch = data;
    let payload = JSON.parse(data);
    if (Object.keys(payload.interests).length > 0) {
      $scope.dispatchBatchNotSendable = false;
    }
  });
});

angular.bootstrap(document, ['studyDebugMenu']);

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});
