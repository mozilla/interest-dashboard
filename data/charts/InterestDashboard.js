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
        "<div class='category-count'> (" + this._numberWithCommas(categoryObj.visitCount) + ")</div>",
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
    let list = data.sortedDomains.slice(0, 10);
    for (let item of list) {
      item[1] = this._numberWithCommas(item[1]);
    }
    $scope.list = list;
  },

  _numberWithCommas: function(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },

  _setStats: function(totalVisits, totalViews, weeklyAvg, dailyAvg, $scope) {
    $scope.totalVisits = this._numberWithCommas(totalVisits);
    $scope.totalViews = this._numberWithCommas(totalViews);
    $scope.weeklyAvg = this._numberWithCommas(weeklyAvg);
    $scope.dailyAvg = this._numberWithCommas(dailyAvg);
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

      if (this._lastTimestamp &&
          this._lastTimestamp == time &&
          this._lastDomain == visit.domain &&
          this._lastTitle == visit.title) {
        this._lastTimestamp = time;
        this._lastDomain = visit.domain;
        this._lastTitle = visit.title
        continue;
      }
      this._lastTimestamp = time;
      this._lastDomain = visit.domain;
      this._lastTitle = visit.title

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
        '<td><div class="domain" data-toggle="tooltip" title="' + visit.url + '">' +
          '<a href="' + visit.url + '">' + visit.domain + '</a>' +
        '</div>' +
        '<div class="visitTitle historyVisit" data-toggle="tooltip" title="' + visit.url + '">' +
          '<a href="' + visit.url + '">- ' + visit.title + '</a>' +
        '</div></td>'
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

  _openRowDetails: function(row, tr, data, $scope, table) {
    // Close all other open rows.
    let self = this;
    $("#test tr").each(function() {
      self._closeRowDetails(table.row($(this)), $(this));
    });

    // Get the category that was clicked
    let parser = new DOMParser();
    let node = parser.parseFromString(row.data()[1], "text/html");
    let category = node.getElementsByClassName('category-name')[0].innerHTML;

    // Open this row
    row.child(this._formatSubtable(category, data.historyVisits[category].visitData,
                                   data.historyVisits[category].complete)).show();

    // Height of open row should fill the rest of the screen.
    $('.subtable').css("height", ($(window).height() - 195) + "px");

    // Shift main table up and scroll the category up to be a header.
    let shiftableBottom = document.getElementById("main-row-background");
    shiftableBottom.classList.add('shift-animate');
    $('div.dataTables_scrollBody').scrollTop(50 * tr.prevAll().length);
    $('div.dataTables_scrollBody').css("overflow", "hidden");
    this._preventScroll = true;

    // Infinite scrolling.
    $(".subtable").scroll(function(e) {
      // Check if we've scrolled to the bottom.
      let elem = $(e.currentTarget);
      if (!self._appendingVisits && elem[0].scrollHeight - elem.scrollTop() == elem.outerHeight()) {
        self._appendingVisits = true;
        $scope._requestCategoryVisits(e.currentTarget.id);
      }
    });
    tr.addClass('shown');
  },

  _closeRowDetails: function(row, tr) {
    // This row is already open - close it
    this._preventScroll = false;
    row.child.hide();
    this.cancelAppendVisits();
    tr.removeClass('shown');
    $('div.dataTables_scrollBody').css("overflow", "auto");
  },

  _handleRowExpand: function(data, table, $scope) {
    // Add event listener for opening and closing details
    let self = this;
    $('#test tbody td').on('click', function() {
      let tr = $(this).closest('tr');
      let row = table.row(tr);

      if (row.child.isShown()) {
        self._closeRowDetails(row, tr);
      } else {
        self._openRowDetails(row, tr, data, $scope, table);
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

  _setTooltip: function($scope, dataFunction) {
    // A bit of a hack for creating a custom tooltip since the nvd3 tooltip
    // is a hassle to customize.
    let self = this;
    $('.nv-interactiveGuideLine').bind('DOMAttrModified', function(e) {
      if (self._sliced) {
        $(".nvtooltip").addClass("sliced");
      }
      $('.nvtooltip').css("margin-left", "-150px");
    });
  },

  _mouseScroll: function(e) {
    if (this._preventScroll) {
      return;
    }
    let delta = e.detail ? e.detail : e.wheelDelta;
    let shiftableBottom = document.getElementById("main-row-background");
    let tableScrollTop = document.getElementsByClassName('dataTables_scrollBody')[0].scrollTop;
    if (delta < 0 && tableScrollTop <= 1) {
      shiftableBottom.classList.remove('shift-animate');
    } else if (delta > 0) {
      shiftableBottom.classList.add('shift-animate');
    }
    let total = tableScrollTop + delta;
    document.getElementsByClassName('dataTables_scrollBody')[0].scrollTop = total;
  },

  _drawGraphMarkers: function() {
    for (let i = 0; i < 30; i++) {
      $(".graphMarkers").append(
        "<div class='graphMarker' style='left:" + (38 + i * (795 / 30)) + "px'></div>"
      );
    }
  },

  graph: function(data, table, $scope) {
    d3.select('#interestPie').selectAll("*").remove();
    d3.select('#areaGraph').selectAll("*").remove();
    table.clear();

    this._drawGraphMarkers();

    let today = new Date();
    let oneDay = 24 * 60 * 60 * 1000;
    let maxDate = new Date(data.maxDay);
    let thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    let diffDays = Math.round(Math.abs((maxDate.getTime() - thirtyAgo.getTime())/(oneDay)));

    // 795 is width of svg rect, 65 is is 35 for margin + 30 to show up after next day
    $("#percentComplete").css("left", 795 / 30 * diffDays + 65);
    $scope.percentage = parseInt(diffDays / 30 * 100);

    $scope.graphHeader = "Total usage - all categories (past 30 days)";
    this._renderPieGraph(data, data.tableData.length);

    document.addEventListener('DOMMouseScroll', (e) => { this._mouseScroll(e); }, false);

    let areaGraph = this._areaGraph;
    let self = this;
    d3.selectAll('.nv-slice')
      .on('click', function(event) {
        self._sliced = true;
        areaGraph.xAxis.tickFormat((d) => {
          return "<strong>" + d3.time.format('%x')(new Date(d)) + "</strong>";
        });

        let clickTarget = $(this);
        $scope.$apply(function() {
          // Grey out the unselected pie pieces.
          $(".nvd3.nv-pie path").css("fill-opacity", 0.1);
          clickTarget.find('path').css("fill-opacity", 1);

          let categoryClicked = event.data.label;
          $scope.graphHeader = categoryClicked + " (past 30 days)";

          // Redraw area graph
          d3.select('#areaGraph').selectAll("*").remove();
          d3.select("#areaGraph")
            .attr("class", "area-graph-margin-fix")
            .datum(data.areaData[categoryClicked])
            .transition().duration(350)
            .call(areaGraph);

          areaGraph.stacked.dispatch.on("areaClick", null);
          areaGraph.stacked.dispatch.on("areaClick.toggle", null);
          areaGraph.stacked.scatter.dispatch.on("elementClick", null);
          self._setTooltip($scope);

          d3.selectAll('.nv-point').filter(function(d){ return d.shape === 'circle' })
            .classed('hidden-point', true);

          // Update stats below graph
          self._setStats(data.categories[categoryClicked].visitCount,
                         data.categories[categoryClicked].viewCount,
                         data.categories[categoryClicked].weeklyAvg.toFixed(0),
                         data.categories[categoryClicked].dailyAvg.toFixed(0),
                         $scope);
        });
    });

    d3.select("#areaGraph")
      .attr("class", "area-graph-margin-fix")
      .datum(data.areaData.total)
      .transition().duration(350)
      .call(this._areaGraph);

    this._setTooltip($scope);
    this._areaGraph.xAxis.tickFormat((d) => {
      let activity = data.areaData.maxCategories[d] == "" ? "No Activity" : ("Max Activity: " + data.areaData.maxCategories[d]);
      return "<strong>" + d3.time.format('%x')(new Date(d)) + "</strong><br>" + activity;
    });
    $('[data-toggle="tooltip"]').tooltip({'placement': 'bottom'});

    nv.utils.windowResize(this._areaGraph.update);
    nv.utils.windowResize(this._pieChart.update);

    this._addTopSites(data, $scope);
    this._setStats(data.totalVisits,
                   data.totalViews,
                   data.totalWeeklyAvg.toFixed(0),
                   data.totalDailyAvg.toFixed(0), $scope);
    this._addTableRows(data, table);
    this._handleRowExpand(data, table, $scope);
  }
}