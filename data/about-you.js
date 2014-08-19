"use strict";

let table;

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

let aboutYou = angular.module("aboutYou", []);
aboutYou.service("dataService", DataService);

aboutYou.controller("vizCtrl", function($scope, dataService) {
  $scope._initialize = function () {
    dataService.send("chart_data_request");
  }
  $scope._initialize();

  $scope.$on("json_update", function(event, data) {
    ChartManager.appendToGraph(data.type, data.data, table, $scope);
  });

  $scope.$on("chart_init", function(event, data) {
    ChartManager.graphAllFromScratch(data, table, $scope);
  });
});

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});

self.port.on("init", function() {
  table = $('#test').DataTable({
    "scrollY":        ($(window).height() - 145) + "px",
    "scrollCollapse": true,
    "paging":         false,
    "searching":      false,
  });
});
