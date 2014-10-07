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
    $scope.daysLeft = null;
    $scope.daysLeftStart = null;
    $scope.percentProcessed = null;
    dataService.send("chart_data_request");
  }
  $scope.safeApply = function(fn) {
    let phase = this.$root.$$phase;
    if(phase == '$apply' || phase == '$digest') {
      if(fn && (typeof(fn) === 'function')) {
        fn();
      }
    } else {
      this.$apply(fn);
    }
  };
  $scope._requestSortedDomainsForCategory = function(categoryName) {
    dataService.send("category_topsites_request", {
      "categoryName": categoryName
    });
  };
  $scope._requestResetCategoryVisits = function(categoryName) {
    dataService.send("category_reset_request", {
      "categoryName": categoryName
    });
  };
  $scope._requestBookmarkChange = function(url, title) {
    dataService.send("bookmark_change_request", {
      "url": url,
      "title": title
    });
  };
  $scope._requestCategoryVisits = function (categoryName) {
    dataService.send("category_visit_request", {
      "categoryName": categoryName
    });
  };
  $scope.debugReportRequest = function() {
    dataService.send("debug_report_request");
  };
  $scope.updateProgressBar = function(value) {
    let val = value ? value : (100 - Math.round($scope.daysLeft / $scope.daysLeftStart * 100));
    $scope.percentProcessed = val + "%"
    $("#progressBar").css("width", $scope.percentProcessed);
  };
  $scope.processHistory = function() {
    if ($scope.daysLeft) {
      return;
    }
    $("#visual-header-overlay").removeClass("fade-out");
    $("#main-overlay").removeClass("fade-out");
    dataService.send("history_process");
  };
  $scope._initialize();

  $scope.$on("json_update", function(event, data) {
    ChartManager.appendToGraph(data.type, data.data, table, $scope);
  });

  $scope.$on("append_visit_data", function(event, data) {
    ChartManager.appendCategoryVisitData(data.category, data.historyVisits, data.pageResponseSize, data.complete, $scope);
  });

  $scope.$on("cancel_append_visits", function(event, data) {
    ChartManager.cancelAppendVisits();
  });

  $scope.$on("chart_init", function(event, data) {
    ChartManager.graphAllFromScratch(data, table, $scope);
  });

  $scope.$on("debug_report", function(event, data) {
    ChartManager.sendDebugReport(data);
  });

  $scope.$on("populate_topsites", function(event, data) {
    ChartManager.populateTopsites(data.topsites, data.category);
  });

  $scope.$on("days_left", function(event, data) {
    if (!$scope.daysLeftStart) {
      $scope.daysLeftStart = data;
    }
    $scope.daysLeft = data;
    $scope.updateProgressBar();
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
    "paging":         false,
    "searching":      false,
    "columns": [
      { "width": "80px" },
      { "width": "231px" },
      { "width": "0px" },
      { "width": "300px" },
      { "width": "40px", "orderable": false },
      { "width": "40px" },
      { "width": "40px" }
    ]
  });

  // Cog show and hide events for css updates.
  $('.cog').on('show.bs.dropdown', function () {
    $('.cog-btn').addClass('cog-clicked');
  });
  $('.cog').on('hide.bs.dropdown', function () {
    $('.cog-btn').removeClass('cog-clicked');
  });
});
