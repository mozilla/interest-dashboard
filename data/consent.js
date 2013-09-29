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

let consentMenu = angular.module("consentMenu", []);
consentMenu.service("dataService", DataService);

consentMenu.controller("consentCtrl", function($scope, dataService) {
  /** UI functionality **/
  $scope.acceptStudy = function() {
    dataService.send("survey_run");
  }

  $scope.rejectStudy = function() {
    dataService.send("uninstall");
  }
});

angular.bootstrap(document, ['consentMenu']);

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});
