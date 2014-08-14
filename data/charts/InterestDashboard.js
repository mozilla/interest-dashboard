function InterestDashboard() {
  /* Initing the pie chart */
  this._pieChart = nv.models.pieChart()
      .showLegend(false)
      .x(function(d) { return d.label })
      .y(function(d) { return d.value })
      .showLabels(false);

  nv.addGraph(function() {
    return this._pieChart;
  });

  /* Initing the area graph */
  this._areaGraph = nv.models.stackedAreaChart()
                .margin({right: 100})
                .x(function(d) { return d[0] })
                .y(function(d) { return d[1] })
                .useInteractiveGuideline(true)
                .showLegend(false)
                .showYAxis(false)
                .showXAxis(false)
                .showControls(false)
                .transitionDuration(300);

  this._areaGraph.xAxis
    .tickFormat((d) => { return d3.time.format('%x')( new Date(d)); });

  this._areaGraph.yAxis
    .tickFormat((d) => { return d; });

  nv.addGraph(() => {
    return this._areaGraph;
  });
}

InterestDashboard.prototype = {
  _getMaxDate: function(days) {
    let max = 0;
    for (let day in days) {
      if (Number(day) > max) {
        max = Number(day);
      }
    }
    return d3.time.format('%x')(new Date(days[max].x));
  },

  _computeTimeString: function(timestamp) {
    let AMorPM = "am";
    let date = new Date(timestamp);
    let hours = date.getHours();
    let minutes = date.getMinutes() < 10 ? ("0" + date.getMinutes()) : date.getMinutes();
    if (hours > 12) {
      hours -= 12;
      AMorPM = "pm";
    }
    return hours + ":" + minutes + " " + AMorPM;
  },

  _addTableRows: function(data, table) {
    for (let i = 0; i < data.tableData.length; i++) {
      let categoryObj = data.tableData[i];
      table.row.add([
        "<div class='rank-container'>" + (i + 1) + "</div>",
        categoryObj.name,
        this._getMaxDate(categoryObj.days),
        null
      ]).draw();

      // Add classes
      table.column(-1).nodes().to$().addClass('details-control');
    }
    table.columns.adjust();
  },

  _addTopSites: function(data, $scope) {
    $scope.list = data.sortedDomains.slice(0, 10);
  },

  _addStats: function(data, $scope) {
    $scope.totalVisits = data.totalVisits;
    $scope.totalViews = data.totalViews;
    $scope.weeklyAvg = data.totalWeeklyAvg.toFixed(0);
    $scope.dailyAvg = data.totalDailyAvg.toFixed(0);
  },

  _formatSubtable: function(historyVisits) {
    let table = '<table cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">';
    for (let visit of historyVisits) {
      let time = this._computeTimeString(visit.timestamp);

      table += '<tr>' +
        '<td>' + time + '</td>' +
        '<td><img src="' + visit.favicon + '"></img></td>' +
        '<td>' + visit.url + '</td>' +
        '<td>' + visit.title + '</td>' +
      '</tr>';
    }
    table += '</table>';
    return table;
  },

  _handleRowExpand: function(data, table) {
    // Add event listener for opening and closing details
    let self = this;
    $('#test tbody').on('click', 'td.details-control', function() {
      let tr = $(this).closest('tr');
      let row = table.row(tr);

      if (row.child.isShown()) {
        // This row is already open - close it
        row.child.hide();
        tr.removeClass('shown');
      } else {
        // Open this row
        row.child(self._formatSubtable(data.historyVisits[row.data()[1]])).show();
        tr.addClass('shown');
      }
    });
  },

  graph: function(data, table, $scope) {
    d3.select('#interestPie').selectAll("*").remove();
    d3.select('#areaGraph').selectAll("*").remove();
    table.clear();

    $scope.graphHeader = "Total usage - all categories (past 30 days)";
    $scope.interestCount = data.tableData.length;

    d3.select("#interestPie")
      .attr("class", "pie-graph-margin-fix")
      .datum(data.pieData)
      .transition().duration(350)
      .call(this._pieChart);

    $('div.dataTables_scrollBody').scroll(function(e) {
      let scrollPosition = $('div.dataTables_scrollBody').scrollTop();
      let shiftableBottom = document.getElementById("main-row-background");

      if (scrollPosition > 1) {
        shiftableBottom.classList.add('shift-animate');
      } else {
        shiftableBottom.classList.remove('shift-animate');
      }
    });

    let areaGraph = this._areaGraph;
    d3.selectAll('.nv-slice')
      .on('click', function(event) {
        $scope.$apply(function() {
          let categoryClicked = event.data.label;
          d3.select('#areaGraph').selectAll("*").remove();
          d3.select("#areaGraph")
            .attr("class", "area-graph-margin-fix")
            .datum(data.areaData[categoryClicked])
            .transition().duration(350)
            .call(areaGraph);

          $scope.totalVisits = data.categories[categoryClicked].visitCount;
          $scope.totalViews = data.categories[categoryClicked].viewCount;
          $scope.weeklyAvg = data.categories[categoryClicked].weeklyAvg.toFixed(0);
          $scope.dailyAvg = data.categories[categoryClicked].dailyAvg.toFixed(0);
        });
    });

    d3.select("#areaGraph")
      .attr("class", "area-graph-margin-fix")
      .datum(data.areaData.total)
      .transition().duration(350)
      .call(this._areaGraph);

    nv.utils.windowResize(this._areaGraph.update);
    nv.utils.windowResize(this._pieChart.update);

    this._addTopSites(data, $scope);
    this._addStats(data, $scope);
    this._addTableRows(data, table);
    this._handleRowExpand(data, table);
  }
}