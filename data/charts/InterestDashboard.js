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

  this._areaGraph.yAxis
    .tickFormat((d) => { return d; });

  nv.addGraph(() => {
    return this._areaGraph;
  });
}

InterestDashboard.prototype = {
  _getMaxDate: function(days) {
    let max = 0;
    for (let day of days) {
      if (day.timestamp > max) {
        max = day.timestamp;
      }
    }
    return d3.time.format('%A, %B %e, %Y')(new Date(max / 1000));
  },

  _computeTimeString: function(timestamp) {
    let AMorPM = "am";
    let date = new Date(timestamp / 1000);
    let hours = date.getHours();
    let minutes = date.getMinutes() < 10 ? ("0" + date.getMinutes()) : date.getMinutes();
    if (hours > 12) {
      hours -= 12;
      AMorPM = "pm";
    }
    if (hours == 12) AMorPM = "pm";
    if (hours == 0) hours = 12;
    return hours + ":" + minutes + " " + AMorPM;
  },

  _addTableRows: function(data, table) {
    for (let i = 0; i < data.tableData.length; i++) {
      let categoryObj = data.tableData[i];
      table.row.add([
        "<div class='rank-container'>" + (i + 1) + "</div>",
        "<div class='category-name'>" + categoryObj.name + "</div>" +
        "<div class='category-count'> (" + categoryObj.visitCount + ")</div>",
        "<div class='subtitleCircle'></div>",
        this._getMaxDate(data.historyVisits[categoryObj.name].visitData),
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

  _isNewDay: function(currentTimestamp, newTimestamp) {
    let currDate = new Date(currentTimestamp / 1000);
    let newDate = new Date(newTimestamp / 1000);

    return (currDate.getDate() != newDate.getDate()) ||
           (currDate.getMonth() != newDate.getMonth()) ||
           (currDate.getYear() != newDate.getYear());
  },

  _formatSubtable: function(category, historyVisits, complete) {
    let table = '<div id="' + category + '" class="subtable"><table cellpadding="5" cellspacing="0" border="0">';
    table += this._getRowsHTML(category, historyVisits, complete);
    table += '</table></div>';
    return table;
  },

  _getRowsHTML: function(category, historyVisits, complete) {
    let rows = "";
    let currentDay = historyVisits[0].timestamp;
    for (let visitIndex = 0; visitIndex < historyVisits.length; visitIndex++) {
      let visit = historyVisits[visitIndex];
      let time = this._computeTimeString(visit.timestamp);
      let lastVisitString = visitIndex == (historyVisits.length - 1) ? 'lastVisit' : '';

      if (this._isNewDay(currentDay, visit.timestamp)) {
        rows += '<tr>' +
          '<td></td>' +
          '<td style="width: 23px"><div class="subtitleCircle alwaysVisible"></div></td>' +
          '<td colspan = "2" class="date-subheader">' + d3.time.format('%A, %B %e, %Y')(new Date(visit.timestamp / 1000)); + '</td>' +
          '<td></td>' +
          '<td></td>' +
        '</tr>';
        currentDay = visit.timestamp;
      }

      rows += '<tr>' +
        '<td class="time historyVisit">' + time + '</td>' +
        '<td style="width: 23px"><div class="timelineCircle ' + lastVisitString + '"></div></td>' +
        '<td><img class="favicon" src="' + visit.favicon + '"></img></td>' +
        '<td><div class="domain">' + visit.url + '</div>' +
        '<div class="visitTitle historyVisit"> - ' + visit.title + '</div></td>'
      '</tr>';
    }
    if (!complete) {
      rows += '<tr>' +
        '<td colspan = "5"><div class="loading"></div></td>' +
      '</tr>';
    }
    return rows;
  },

  appendCategoryVisitData: function(category, historyVisits, pageNum, complete) {
    if ($('#' + category + ' tr').length > 0) {
      $('#' + category + ' tr:last').remove();
    }
    $('#' + category + ' tr:last').after(
      this._getRowsHTML(category, historyVisits.slice(
        (pageNum * 50) - 50, historyVisits.length), complete));
    this._appendingVisits = false;
  },

  cancelAppendVisits: function() {
    this._appendingVisits = false;
  },

  _handleRowExpand: function(data, table, $scope) {
    // Add event listener for opening and closing details
    let self = this;
    $('#test tbody').on('click', 'td.details-control', function() {
      let tr = $(this).closest('tr');
      let row = table.row(tr);

      if (row.child.isShown()) {
        // This row is already open - close it
        row.child.hide();
        self.cancelAppendVisits();
        tr.removeClass('shown');
      } else {
        let parser = new DOMParser();
        let node = parser.parseFromString(row.data()[1], "text/html");
        let category = node.getElementsByClassName('category-name')[0].innerHTML;

        // Open this row
        row.child(self._formatSubtable(category, data.historyVisits[category].visitData,
                                       data.historyVisits[category].complete)).show();

        $(".subtable").scroll(function(e) {
          // Check if we've scrolled to the bottom.
          let elem = $(e.currentTarget);
          if (!self._appendingVisits && elem[0].scrollHeight - elem.scrollTop() == elem.outerHeight()) {
            self._appendingVisits = true;
            $scope._requestCategoryVisits(e.currentTarget.id);
          }
        });
        tr.addClass('shown');
      }
    });
  },

  _renderPieGraph: function(data) {
    d3.select("#interestPie")
      .attr("class", "pie-graph-margin-fix")
      .datum(data.pieData)
      .transition().duration(350)
      .call(this._pieChart);

    d3.select("#interestPie")
      .append("circle")
      .attr("cx", 195)
      .attr("cy", 200)
      .attr("r", 77)
      .style("fill", "white")

    let tableLength = data.tableData.length;
    d3.select("#interestPie")
      .append("text")
      .attr("id", "interest-count")
      .attr("x", 170)
      .attr("y", 195)
      .text( function (d) { return tableLength > 9 ? tableLength : "0" + tableLength; });

    d3.select("#interestPie")
      .append("text")
      .attr("class", "title-font")
      .attr("x", 145)
      .attr("y", 223)
      .text( function (d) { return "Interests"; });
  },

  graph: function(data, table, $scope) {
    d3.select('#interestPie').selectAll("*").remove();
    d3.select('#areaGraph').selectAll("*").remove();
    table.clear();

    $scope.graphHeader = "Total usage - all categories (past 30 days)";
    this._renderPieGraph(data, data.tableData.length);

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

    // A bit of a hack for creating a custom tooltip since the nvd3 tooltip
    // is a hassle to customize.
    $('.nv-interactiveGuideLine').bind('DOMAttrModified', function(e) {
      $('.tooltip').css("visibility", "visible");
      $scope.$apply(function() {
        $scope.maxCategory = $('.nvtooltip > table > thead .x-value').html();
      });
      $('.tooltip').css("left", $(".nv-guideline").attr("x1") + "px");
    });
    this._areaGraph.stacked.dispatch.on("areaMouseout", function() {
      $('.tooltip').css("visibility", "hidden");
    });
    this._areaGraph.xAxis.tickFormat((d) => {
      return data.areaData.maxCategories[d];
    });

    nv.utils.windowResize(this._areaGraph.update);
    nv.utils.windowResize(this._pieChart.update);

    this._addTopSites(data, $scope);
    this._addStats(data, $scope);
    this._addTableRows(data, table);
    this._handleRowExpand(data, table, $scope);
  }
}