"use strict";

/////     Chart initialization     /////
nv.dev = false;

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
    ChartManager.appendToGraph(data.type, data.data);
  });

  $scope.$on("chart_init", function(event, data) {
    ChartManager.graphAllFromScratch(data);
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
  let table = $('#test').DataTable({
    "scrollY":        "553px",
    "scrollCollapse": true,
    "paging":         false,
    "searching":      false,
    "columns": [{},{},{},
      {
        "class":          'details-control',
        "orderable":      false,
        "data":           null,
        "defaultContent": ''
      },
    ],
  });

  // Add event listener for opening and closing details
  $('#test tbody').on('click', 'td.details-control', function () {
    let tr = $(this).closest('tr');
    let row = table.row( tr );

    if (row.child.isShown()) {
      // This row is already open - close it
      row.child.hide();
      tr.removeClass('shown');
    } else {
      // Open this row
      row.child(format()).show();
      tr.addClass('shown');
    }
  });
});

function format ( d ) {
    // `d` is the original data object for the row
    return '<table cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">'+
        '<tr>'+
            '<td>Full name:</td>'+
            '<td>BEEP</td>'+
        '</tr>'+
        '<tr>'+
            '<td>Extension number:</td>'+
            '<td>BOOP</td>'+
        '</tr>'+
        '<tr>'+
            '<td>Extra info:</td>'+
            '<td>And any further details here (images etc)...</td>'+
        '</tr>'+
    '</table>';
}
