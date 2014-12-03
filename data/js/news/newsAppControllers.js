"use strict";

let newsAppControllers = angular.module("newsAppControllers", []);

const PAGE_LEN = 10;

newsAppControllers.filter("docPage", function() {
  return function(input, page) {
    if (!input) return [];
    var pageLen = PAGE_LEN;
    if (page * pageLen >= input.length) {
      page = Math.floor(input.length / pageLen);
    }
    return input.slice(page*pageLen, (page+1)*pageLen);
  };
});

newsAppControllers.controller("docRankingCtr", function($scope, $rootScope) {
  $scope.Math = window.Math;
  $scope.shown = {};
  $scope.docOrder = "date";
  $scope.page = 0;

  $scope.pageWalk = function(where) {
    var maxPage = Math.floor($scope.rankedDocs.length / PAGE_LEN);
    switch(where) {
      case 'first':
        $scope.page = 0;
        break;
      case 'next':
        $scope.page++;
        break;
      case 'prev':
        $scope.page--;
        break;
      case 'last':
        $scope.page = maxPage;
        break;
    }
    if ($scope.page < 0 ) $scope.page = 0;
    if ($scope.page > maxPage) $scope.page = maxPage;
  };

  $scope.showDocs = function() {
    self.port.emit("rankedDocs", $scope.siteName, $scope.rankerName);
  };

  $scope.toggleDocExtras = function(url) {
    $scope.shown[url] = !$scope.shown[url];
  };

  $scope.orderDocs = function() {
    if ($scope.docOrder == "score") {
      $scope.rankedDocs = $scope.docs.sort(function(a, b) {
        return b.ranks[$scope.rankerName].rank - a.ranks[$scope.rankerName].rank;
      });
    } else {
      $scope.rankedDocs = $scope.docs.sort(function(a, b) {
        return b.published - a.published;
      });
    }
  },

  self.port.on("updateNames", function(data) {
    console.log("Controller updates names");
    $scope.$apply(_ => {
      $scope.siteNames = data.sites;
      $scope.rankerNames = data.rankers;
    });
  });

  self.port.on("updateRanked", function(data) {
    $scope.$apply(_ => {
      $scope.docs = data;
      $scope.orderDocs();
    });
  });

  self.port.emit("updateNames");
});

newsAppControllers.controller("docPagingCtr", function($scope, $rootScope) {
  $scope.Math = window.Math;
  $scope.shown = {};
  $scope.docOrder = "date";
  $scope.page = 0;
  $scope.dataUrl = self.options.dataUrl;

  $scope.pageWalk = function(where) {
    var maxPage = Math.floor($scope.rankedDocs.length / PAGE_LEN);
    switch(where) {
      case 'first':
        $scope.page = 0;
        break;
      case 'next':
        $scope.page++;
        break;
      case 'prev':
        $scope.page--;
        break;
      case 'last':
        $scope.page = maxPage;
        break;
    }
    if ($scope.page < 0 ) $scope.page = 0;
    if ($scope.page > maxPage) $scope.page = maxPage;
  };

  $scope.toggleDocExtras = function(url) {
    $scope.shown[url] = !$scope.shown[url];
  };

  $scope.orderDocs = function() {
    if ($scope.docOrder == "score") {
      $scope.rankedDocs = $scope.docs.sort(function(a, b) {
        return b.rank - a.rank;
      });
    } else {
      $scope.rankedDocs = $scope.docs.sort(function(a, b) {
        return b.published - a.published;
      });
    }
  };

  $scope.setDocuments = function(docs) {
    $scope.page = 0;
    $scope.docs = docs;
    $scope.orderDocs();
  };
});

newsAppControllers.controller("siteViewCtr", function($scope) {

  function clearScope() {
    $scope.userDocs = null;
    $scope.siteStats = null;
  };

  $scope.showDocs = function() {
    self.port.emit("siteDocs", $scope.siteName);
  };

  $scope.showStats = function() {
    self.port.emit("siteStats", $scope.siteName);
  };

  $scope.buildRanker = function() {
    console.log("building ranker");
    self.port.emit("buildRanker", $scope.siteName);
  };

  self.port.on("siteDocs", function(data) {
    $scope.$apply(_ => {
      clearScope();
      $scope.userDocs = data.userDocs;
    });
  });

  self.port.on("siteStats", function(data) {
    $scope.$apply(_ => {
      clearScope();
      $scope.siteStats = data;
    });
  });

  self.port.on("updateNames", function(data) {
    $scope.$apply(_ => {
      $scope.siteNames = data.sites;
      $scope.rankerNames = data.rankers;
    });
  });

  self.port.emit("updateNames");
});
