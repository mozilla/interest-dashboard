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
    row.child.hide();
    this.cancelAppendVisits();
    tr.removeClass('shown');
    $('div.dataTables_scrollBody').css("overflow", "auto");
  },

  _handleRowExpand: function(data, table, $scope) {
    // Add event listener for opening and closing details
    let self = this;
    $('#test tbody').on('click', 'td', function() {
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
    $('.nv-interactiveGuideLine').bind('DOMAttrModified', function(e) {
      $('.tooltip').css("visibility", "visible");
      $scope.$apply(function() {
        $scope.tooltipData = dataFunction();
      });
      $('.tooltip').css("left", $(".nv-guideline").attr("x1") + "px");
    });
  },

  graph: function(data, table, $scope) {
    d3.select('#interestPie').selectAll("*").remove();
    d3.select('#areaGraph').selectAll("*").remove();
    table.clear();

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
    let self = this;
    d3.selectAll('.nv-slice')
      .on('click', function(event) {
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
          areaGraph.stacked.scatter.dispatch.on("elementClick.area", null);

          self._setTooltip($scope, function() {
            let tooltipTotal = Number($('.nvtooltip > table > tbody').find('tr:eq(0)').find('td:eq(2)').html());
            let tooltipCategory = $('.nvtooltip > table > tbody').find('tr:eq(1)').find('td:eq(2)').html();
            tooltipTotal += Number(tooltipCategory);
            let data =
              "<div>" +
                "<div class='totalColorLabel'></div>" +
                "<div class='tooltipDescription'>Total: " + tooltipTotal + "</div>" +
              "</div>" +
              "<div>" +
                "<div class='categoryColorLabel'></div>" +
                "<div class='tooltipDescription'>" + categoryClicked + ": " + tooltipCategory + "</div>" +
              "</div>";
            return data;
          });

          d3.selectAll('.nv-point').filter(function(d){ return d.shape === 'circle' })
            .classed('hidden-point', true);

          // Update stats below graph
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

    this._setTooltip($scope, function() {
      return "<div>" + $('.nvtooltip > table > thead .x-value').html() + "</div>";
    });
    this._areaGraph.stacked.dispatch.on("areaMouseout", function() {
      $('.tooltip').css("visibility", "hidden");
    });
    this._areaGraph.xAxis.tickFormat((d) => {
      return data.areaData.maxCategories[d];
    });
    $('[data-toggle="tooltip"]').tooltip({'placement': 'bottom'});

    nv.utils.windowResize(this._areaGraph.update);
    nv.utils.windowResize(this._pieChart.update);

    this._addTopSites(data, $scope);
    this._addStats(data, $scope);
    this._addTableRows(data, table);
    this._handleRowExpand(data, table, $scope);
  }
}