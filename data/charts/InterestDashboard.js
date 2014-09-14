function InterestDashboard() {
  /* Initing the pie chart */
  this._pieChart = nv.models.pieChart()
      .showLegend(false)
      .x(function(d) { return d.label })
      .y(function(d) { return d.value })
      .showLabels(false)
      .color(d3.scale.category10().range())
      .tooltipContent((category, count, e, graph) => {
        return '<div class="pie-tooltip">' +
          '<div class="rank">' + this._categories[category].rank + '</div>' +
          '<div class="category">' + category + '</div>' +
          '<div class="count">(' + this._numberWithCommas(parseInt(count.replace(/,/g, ''))) + ')</div>' +
        '</div>';
      });

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

  $('.cog').on('show.bs.dropdown', function () {
    $('.cog-btn').addClass('cog-clicked');
  })
  $('.cog').on('hide.bs.dropdown', function () {
    $('.cog-btn').removeClass('cog-clicked');
  })
}

InterestDashboard.prototype = {
  _getMaxDate: function(days) {
    let max = 0;
    for (let day of days) {
      if (day > max) {
        max = day;
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
        this._getMaxDate(categoryObj.visitIDs),
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
    table += this._getRowsHTML(category, historyVisits, historyVisits[0].timestamp, complete);
    table += '</table></div>';
    return table;
  },

  _getRowsHTML: function(category, historyVisits, currentDay, complete) {
    let rows = "";
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

      // Escape html tags in the titles.
      let html = visit.title;
      let div = document.createElement("div");
      div.innerHTML = html;
      let title = div.textContent || div.innerText || "";

      rows += '<tr>' +
        '<td class="time historyVisit">' + time + '</td>' +
        '<td style="width: 23px"><div class="timelineCircle ' + lastVisitString + '"></div></td>' +
        '<td><img class="favicon" src="' + visit.favicon + '"></img></td>' +
        '<td><div class="domain" data-toggle="tooltip" title="' + visit.url + '">' +
          '<a href="' + visit.url + '">' + visit.domain + '</a>' +
        '</div>' +
        '<div class="visitTitle historyVisit" data-toggle="tooltip" title="' + visit.url + '">' +
          '<a href="' + visit.url + '">- ' + title + '</a>' +
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

  _checkListFullAndAppend: function(visitData, category, $scope) {
    let screenHeight = ($(window).height() - 195);
    let listFull = ($('#' + category + ' tr').length * parseFloat($('.subtable tr').css("height"))) > screenHeight;
    if (!listFull) {
      self._appendingVisits = true;
      $scope._requestCategoryVisits(category);
    }
  },

  _getStartIndex: function(historyVisits, pageResponseSize) {
    // If the first entry of the new page is the same as the last entry of the previous page,
    // skip that entry.
    let latestEntry = historyVisits[historyVisits.length - pageResponseSize - 1];
    let nextEntryIndex = historyVisits.length - pageResponseSize;
    let nextEntry = historyVisits[nextEntryIndex];

    let lastEntryKey = this._computeTimeString(latestEntry.timestamp) + latestEntry.domain + latestEntry.title;
    let nextEntryKey = this._computeTimeString(nextEntry.timestamp) + nextEntry.domain + nextEntry.title;
    if (lastEntryKey == nextEntryKey) {
      nextEntryIndex++;
    }
    return nextEntryIndex;
  },

  appendCategoryVisitData: function(category, historyVisits, pageResponseSize, complete, $scope) {
    let nextEntryIndex = this._getStartIndex(historyVisits, pageResponseSize);
    if ($('#' + category + ' tr').length > 0) {
      $('#' + category + ' tr:last').remove();
      if (nextEntryIndex < historyVisits.length) {
        $('#' + category + ' tr:last .timelineCircle').removeClass("lastVisit");
      }
    }

    $('#' + category + ' tr:last').after(
      this._getRowsHTML(category, historyVisits.slice(
        nextEntryIndex, historyVisits.length), historyVisits[nextEntryIndex - 1].timestamp, complete));
    this._appendingVisits = false;
    this._checkListFullAndAppend(historyVisits, category, $scope);
  },

  cancelAppendVisits: function() {
    this._appendingVisits = false;
  },

  _openRowDetails: function(row, tr, category, $scope, data, table) {
    // Close all other open rows.
    let self = this;
    $("#test tr").each(function() {
      self._closeRowDetails(table.row($(this)), $(this));
    });

    // Open this row
    row.child(this._formatSubtable(category, data.historyVisits[category].visitData,
                                   data.historyVisits[category].complete)).show();

    // Height of open row should fill the rest of the screen.
    let bannerShown = $("body").hasClass("banner-visible");
    $('.subtable').css("height", ($(window).height() - 195 - (bannerShown ? 138 : 0)) + "px");

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
    this._checkListFullAndAppend(data.historyVisits[category].visitData, category, $scope);
    $('table.dataTable thead th').css("pointer-events", "none"); // Remove ability to sort while a subtable is open.
  },

  _closeRowDetails: function(row, tr) {
    // This row is already open - close it
    this._preventScroll = false;
    row.child.hide();
    this.cancelAppendVisits();
    tr.removeClass('shown');
    $('div.dataTables_scrollBody').css("overflow", "auto");
    $('table.dataTable thead th').css("pointer-events", "all");
  },

  _handleRowExpand: function(data, table, $scope) {
    // Add event listener for opening and closing details
    let self = this;
    $('#test tbody td').on('click', function() {
      let tr = $(this).closest('tr');
      let row = table.row(tr);

      // Get the category that was clicked
      let parser = new DOMParser();
      let node = parser.parseFromString(row.data()[1], "text/html");
      let category = node.getElementsByClassName('category-name')[0].innerHTML;

      if (row.child.isShown()) {
        self._closeRowDetails(row, tr);
        $scope._requestResetCategoryVisits(category);
      } else {
        self._openRowDetails(row, tr, category, $scope, data, table);
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

  _setTooltip: function($scope) {
    // A bit of a hack for creating a custom tooltip since the nvd3 tooltip
    // is a hassle to customize.
    let self = this;
    $('.nv-interactiveGuideLine').bind('DOMAttrModified', function(e) {
      if (self._sliced) {
        $(".nvtooltip").addClass("sliced");
      }
      $('.nvtooltip').css("margin-left", "-170px");
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
    for (let i = 1; i < 30; i++) {
      $(".graphMarkers").append(
        "<div class='graphMarker' style='left:" + (24 + i * (795 / 30)) + "px'></div>"
      );
    }
  },

  _setInitialState: function($scope, data) {
    this._sliced = false;
    let self = this;
    $('.back').removeClass("visibleBack");
    this._areaGraph.xAxis.tickFormat((d) => {
      let activity = data.areaData.maxCategories[d] == "" ? "No Activity" : ("Max Activity: " + data.areaData.maxCategories[d]);
      return "<strong>" + d3.time.format('%A %B %e, %Y')(new Date(d)) + "</strong><br>" + activity;
    });
    this._areaGraph.color(["#F76B1C"]);

    $(".nvd3.nv-pie path").css("fill-opacity", 1);
    $scope.safeApply(function() {
      $scope.graphHeader = "Total usage - all categories ";
      $scope.pastXDays = "(past 30 days)"
      self._setStats(data.totalVisits,
                     data.totalViews,
                     data.totalWeeklyAvg.toFixed(0),
                     data.totalDailyAvg.toFixed(0), $scope);
    })

    d3.select('#areaGraph').selectAll("*").remove();
    d3.select("#areaGraph")
      .attr("class", "area-graph-margin-fix")
      .datum(data.areaData.total)
      .transition().duration(350)
      .call(this._areaGraph);

    this._setTooltip($scope);
  },

  graph: function(data, table, $scope) {
    this._categories = data.categories;
    this._setInitialState($scope, data);
    d3.select('#interestPie').selectAll("*").remove();
    table.clear();

    let areaGraph = this._areaGraph;
    let self = this;
    $('.back').on('click', () => { self._setInitialState($scope, data); });

    this._drawGraphMarkers();

    let today = new Date();
    let oneDay = 24 * 60 * 60 * 1000;
    let maxDate = new Date(data.maxDay);
    let thirtyAgo = new Date(today.getTime() - 30 * oneDay);
    let diffDays = Math.round(Math.abs((maxDate.getTime() - thirtyAgo.getTime())/(oneDay)));

    // 795 is width of svg rect, 60 is 30 for margin + 30 to show up after next day
    let left = 795 / 30 * diffDays + 60 + (795 / 30)
    $("#percentComplete").css("left", left);
    $(".mostRecentMarker").css("left", left - 10); // Subtract 10 to center.
    $("#mostRecentDate").css("left", left - 35);

    let mostRecentDate = new Date(maxDate.getTime() + oneDay);
    $scope.percentage = parseInt(diffDays / 28 * 100);
    $scope.isComplete = $scope.percentage >= 100;
    $scope.isAtAnEnd = diffDays < 2 || diffDays > 26;
    $scope.mostRecentDate = d3.time.format('%x')(mostRecentDate);
    //$scope.monthXX = d3.time.format('%B %e')(new Date(mostRecentDate.getTime() + (28 - diffDays) * oneDay));
    $scope.monthXX = d3.time.format('%B %e')(new Date(today.getTime() + oneDay));

    this._renderPieGraph(data, data.tableData.length);
    document.addEventListener('DOMMouseScroll', (e) => { this._mouseScroll(e); }, false);

    d3.selectAll('.nv-slice')
      .on('click', function(event) {
        self._sliced = true;
        $('.back').addClass("visibleBack");
        areaGraph.xAxis.tickFormat((d) => {
          return "<strong>" + d3.time.format('%A %B %e, %Y')(new Date(d)) + "</strong>";
        });

        let clickTarget = $(this);
        $scope.$apply(function() {
          // Grey out the unselected pie pieces.
          $(".nvd3.nv-pie path").css("fill-opacity", 0.1);
          clickTarget.find('path').css("fill-opacity", 1);
          areaGraph.color([clickTarget.find('path').css("fill"), "#E6E6E6"]);

          let categoryClicked = event.data.label;
          $scope.graphHeader = categoryClicked;

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

          // Update stats below graph
          self._setStats(data.categories[categoryClicked].visitCount,
                         data.categories[categoryClicked].viewCount,
                         data.categories[categoryClicked].weeklyAvg.toFixed(0),
                         data.categories[categoryClicked].dailyAvg.toFixed(0),
                         $scope);
        });
    });

    // If we are processing data, prevent scroll.
    this._preventScroll = false;
    if ($scope.daysLeft) {
      this._preventScroll = true;
    }

    $('[data-toggle="tooltip"]').tooltip({'placement': 'bottom'});

    nv.utils.windowResize(this._areaGraph.update);
    nv.utils.windowResize(this._pieChart.update);

    this._addTopSites(data, $scope);
    this._addTableRows(data, table);
    this._handleRowExpand(data, table, $scope);

    if ($scope.percentProcessed == "100%") {
      if (28 - diffDays <= 0) {
        $('body').removeClass("banner-visible");
      }
      $("#visual-header-overlay").addClass("fade-out");
      $("#main-overlay").addClass("fade-out");
    } else {
      setTimeout(() => {
        if (!$scope.percentProcessed) {
          $scope.updateProgressBar("100");
        }
      }, 1000);
      setTimeout(() => {
        if ($scope.percentProcessed == "100%") {
          if (28 - diffDays <= 0) {
            $('body').removeClass("banner-visible");
          }
          $("#visual-header-overlay").addClass("fade-out");
          $("#main-overlay").addClass("fade-out");
        }
      }, 2000);
    }
  }
}