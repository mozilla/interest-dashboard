"use strict";

let newsDebugApp = angular.module("newsDebugApp", []);

newsDebugApp.filter('escape', function() {
  return window.escape;
});

newsDebugApp.controller("newsDebugCtrl", function($scope) {
  $scope.newsDebug = null;
  $scope.doConfigureSites = true;
  $scope.Math = window.Math;

  $scope.refreshSiteInfo = function(site) {
    console.log("sending refresh");
    self.port.emit("refreshSiteInfo");
  }

  $scope.getResentDocs = function(site) {
    self.port.emit("recentDocs", site);
  }

  $scope.removeSite = function(site) {
    self.port.emit("removeSite", site);
  }

  $scope.clearSite = function(site) {
    self.port.emit("clearSite", site);
  }

  $scope.submitSite = function() {
    delete $scope.error;
    self.port.emit("addSite", $scope.site);
  }

  $scope.showRanked = function(site) {
    self.port.emit("getRanked", site);
  }

  $scope.clearRanked = function() {
    $scope.rankedDocs = null;
  }

  self.port.on("updateRanked", function(data) {
    $scope.$apply(_ => {
      $scope.rankedDocs = JSON.stringify(data, null, 1);
    });
  });

  self.port.on("updateSites", function(sites) {
    $scope.$apply(_ => {
      $scope.sites = [];
      Object.keys(sites).forEach(site => {
        let entry = sites[site];
        $scope.sites.push({
          site: site,
          lastUpdated: new Date(entry.lastUpdated),
          sequenceID: entry.sequenceId,
          docCount: entry.docCount,
        });
      });
    });
  });

  self.port.on("addSiteError", function(data) {
    $scope.$apply(_ => {
      $scope.error = data.error;
    });
  });

  self.port.emit("data-url");
  self.port.on("data-url", function(url) {
    $scope.dataUrl = url;
  });

});

const PAGE_LEN = 10;

newsDebugApp.filter("docPage", function() {
  return function(input, page) {
    if (!input) return [];
    var pageLen = PAGE_LEN;
    if (page * pageLen >= input.length) {
      page = Math.floor(input.length / pageLen);
    }
    return input.slice(page*pageLen, (page+1)*pageLen);
  };
});

newsDebugApp.controller("newsShowCtrl", function($scope) {
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
    console.log($scope.siteName);
    console.log($scope.rankerName);
    console.log($scope.siteName, $scope.rankerName);
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

  self.port.emit("data-url");
  self.port.on("data-url", function(url) {
    $scope.dataUrl = url;
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

self.port.on("bootstrap", function() {
  angular.bootstrap(document, ['newsDebugApp']);
});
