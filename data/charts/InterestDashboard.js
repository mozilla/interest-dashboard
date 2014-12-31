function InterestDashboard($scope) {
  this.debugReport = [];

  try {
    this.debugReport.push("Initializing pie chart.");
    this._pieChart = nv.models.pieChart()
        .showLegend(false)
        .x(function(d) { return d.label })
        .y(function(d) { return d.value })
        .showLabels(false)
        .color(d3.scale.category10().range())
        .tooltipContent((category, count, e, graph) => {
          return '<div class="pie-tooltip">' +
            '<div class="rank">' + html_sanitize(this._data.categories[category].rank) + '</div>' +
            '<div class="category">' + html_sanitize(category) + '</div>' +
            '<div class="count">(' + html_sanitize(this._numberWithCommas(parseInt(count.replace(/,/g, '')))) + ')</div>' +
          '</div>';
        });

    nv.addGraph(function() {
      return this._pieChart;
    });

    this.debugReport.push("Initializing area graph.");
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
    this._handleRowExpand($scope);

    this._today = new Date();
    this._oneDay = 24 * 60 * 60 * 1000;
    this._thirtyAgo = new Date(this._today.getTime() - 30 * this._oneDay);
    this._fourteenAgo = new Date(this._today.getTime() - 14 * this._oneDay);

    this._flaggedVisits = [];
  } catch (ex) {
    this.debugReport.push("Exception while initializing InterestDashboard: " + ex);
  }
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

  _getMinDate: function(days) {
    let min = 10000000000000000;
    for (let day of days) {
      if (day < min) {
        min = day;
      }
    }
    return parseInt(min / 1000);
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

  _handleIntensityPercentages: function(data, categoryObj, i) {
    if (data.capturedRankings.previousRanks && data.capturedRankings.currentRanks &&
      data.capturedRankings.previousRanks.rankedIntents[categoryObj.name] &&
      data.capturedRankings.currentRanks.rankedIntents[categoryObj.name]) {

      let rankChangePercents =
        parseInt((data.capturedRankings.previousRanks.rankedIntents[categoryObj.name] -
                  data.capturedRankings.currentRanks.rankedIntents[categoryObj.name]) /
                  Object.keys(data.capturedRankings.currentRanks.rankedIntents).length * 100);

      if (rankChangePercents > 0) {
        $(".intensityChange" + i + " .symbol").addClass('increasingArrow');
        $(".intensityChange" + i + " .intensityPercent").addClass('increasingPercent');
        $(".intensityChange" + i + " .increasingPercent").html(rankChangePercents + "%");
      } else if (rankChangePercents < 0) {
        $(".intensityChange" + i + " .symbol").addClass('decreasingArrow');
        $(".intensityChange" + i + " .intensityPercent").addClass('decreasingPercent');
        $(".intensityChange" + i + " .decreasingPercent").html(Math.abs(rankChangePercents) + "%");
      } else if (rankChangePercents == 0) {
        $(".intensityChange" + i + " .symbol").addClass('neutral');
        $(".intensityChange" + i + " .intensityPercent").addClass('neutralPercent');
        $(".intensityChange" + i + " .neutralPercent").html(rankChangePercents + "%");
      }
      return rankChangePercents;
    }
  },

  _addTableRows: function(data, table) {
    let sortedIntensityPercents = [];
    for (let i = 0; i < data.tableData.length; i++) {
      let categoryObj = data.tableData[i];
      table.row.add([
        "<div class='rank-container'>" + html_sanitize(i + 1) + "</div>",
        "<div class='category-name'>" + html_sanitize(categoryObj.name) + "</div>" +
        "<div class='category-count'> (" + html_sanitize(this._numberWithCommas(categoryObj.visitCount)) + ")</div>",
        "<div></div>",
        this._getMaxDate(categoryObj.visitIDs),
        "<div class='intensityChange" + i + "'><div class='symbol'></div><div class='intensityPercent'></div></div>",
        "<div class='iconIndicator" + i + "'></div>",
        null
      ]).draw();

      let intensityPercent = this._handleIntensityPercentages(data, categoryObj, i);
      sortedIntensityPercents.push({"index": i, "intensityPercent": intensityPercent});

      if (this._getMinDate(categoryObj.visitIDs) > this._fourteenAgo.getTime()) {
        $(".iconIndicator" + i).addClass('new');
        $(".iconIndicator" + i).html('NEW');
        $(".intensityChange" + i + " .symbol").addClass('newIntensitySymbol');
        $(".intensityChange" + i + " .intensityPercent").addClass('neutralPercent');
        $(".intensityChange" + i + " .neutralPercent").html("---");
      }

      // Add classes
      table.column(-1).nodes().to$().addClass('details-control');
    }
    sortedIntensityPercents.sort(function(a, b) { return b["intensityPercent"] - a["intensityPercent"] });
    for (let i = 0; i < 5; i++) {
      let rowIndex = sortedIntensityPercents[i].index;
      $(".iconIndicator" + rowIndex).addClass('fire');
    }
    table.columns.adjust();
  },

  _addTopSites: function(list, $scope) {
    for (let item of list) {
      item[1] = this._numberWithCommas(item[1]);
    }
    $scope.list = list;
  },

  _numberWithCommas: function(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },

  _setStats: function(data, $scope) {
    let {score, previousScore, rank, rankDetails, percentChange,
         visitCount, visitCountDetails, scoreTitle, visitCountTitle, rankTitle} = data;
    $scope.rankTitle = rankTitle;
    $scope.scoreTitle = scoreTitle;
    $scope.visitCountTitle = visitCountTitle;
    $scope.rankDetails = rankDetails;

    $scope.score = score;
    $scope.previousScore = previousScore + " last week";
    $scope.rank = rank;

    // Clear out previous classes.
    $("#visitCountUsageHighlights .symbol").removeClass('increasingArrow');
    $("#visitCountUsageHighlights .symbol").removeClass('decreasingArrow');
    $("#visitCountUsageHighlights .symbol").removeClass('neutral');
    $("#visitCountUsageHighlights .intensityPercent").removeClass('increasingPercent');
    $("#visitCountUsageHighlights .intensityPercent").removeClass('decreasingPercent');
    $("#visitCountUsageHighlights .intensityPercent").removeClass('neutralPercent');
    $("#interestScoreHighlights .symbol").removeClass('increasingArrow');
    $("#interestScoreHighlights .symbol").removeClass('decreasingArrow');
    $("#interestScoreHighlights .symbol").removeClass('neutral');
    $("#interestScoreHighlights .intensityPercent").removeClass('increasingPercent');
    $("#interestScoreHighlights .intensityPercent").removeClass('decreasingPercent');
    $("#interestScoreHighlights .intensityPercent").removeClass('neutralPercent');

    let scoreChange = parseInt((score - previousScore) / previousScore * 100);
    $("#interestScoreHighlights .intensityPercent").html(Math.abs(scoreChange) + "%");
    if (scoreChange > 0) {
      $("#interestScoreHighlights .symbol").addClass('increasingArrow');
      $("#interestScoreHighlights .intensityPercent").addClass('increasingPercent');
    } else if (scoreChange < 0) {
      $("#interestScoreHighlights .symbol").addClass('decreasingArrow');
      $("#interestScoreHighlights .intensityPercent").addClass('decreasingPercent');
    } else if (scoreChange == 0) {
      $("#interestScoreHighlights .symbol").addClass('neutral');
      $("#interestScoreHighlights .intensityPercent").addClass('neutralPercent');
    }

    if (percentChange > 0) {
      $("#visitCountUsageHighlights .symbol").addClass('increasingArrow');
      $("#visitCountUsageHighlights .intensityPercent").addClass('increasingPercent');
    } else if (percentChange < 0) {
      $("#visitCountUsageHighlights .symbol").addClass('decreasingArrow');
      $("#visitCountUsageHighlights .intensityPercent").addClass('decreasingPercent');
    } else if (isNaN(percentChange) || percentChange == 0) {
      $("#visitCountUsageHighlights .symbol").addClass('neutral');
      $("#visitCountUsageHighlights .intensityPercent").addClass('neutralPercent');
      percentChange = 0;
    }
    $("#visitCountUsageHighlights .intensityPercent").html(Math.abs(percentChange) + "%");

    $scope.visitCount = visitCount;
    $scope.visitCountDetails = visitCountDetails;
  },

  _isNewDay: function(currentTimestamp, newTimestamp) {
    let currDate = new Date(currentTimestamp / 1000);
    let newDate = new Date(newTimestamp / 1000);

    return (currDate.getDate() != newDate.getDate()) ||
           (currDate.getMonth() != newDate.getMonth()) ||
           (currDate.getYear() != newDate.getYear());
  },

  _formatSubtable: function(category) {
    let table = '<div id="' + this._escapeHTML(category) + '" class="subtable"><table cellpadding="5" cellspacing="0" border="0"><tbody>';
    table +=
      '<tr>' +
        '<td colspan = "5"><div class="loading"></div></td>' +
      '</tr>';
    table += '</tbody></table></div>';
    return table;
  },

  _escapeHTML: function(str) {
    if (str) {
      return str.replace(/[&"<>]/g, function (m) ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[m]);
    }
    return "";
  },

  _getRowsHTML: function(historyVisits, currentDay, complete) {
    let rows = "";
    for (let visitIndex = 0; visitIndex < historyVisits.length; visitIndex++) {
      let visit = historyVisits[visitIndex];
      let time = this._computeTimeString(visit.timestamp);
      let lastOrFirstVisitString = (visitIndex == 0) ? 'firstVisit' : '';
      if (visitIndex == (historyVisits.length - 1)) {
        if (lastOrFirstVisitString == "firstVisit") {
          lastOrFirstVisitString = 'firstAndLastVisit';
        } else {
          lastOrFirstVisitString = 'lastVisit';
        }
      }

      let bookmarked = visit.isBookmarked ? "bookmarked" : "unbookmarked";
      $(".headerCircle").addClass("alwaysVisible");

      if (this._isNewDay(currentDay, visit.timestamp)) {
        rows += '<tr class="subtable-row date-header">' +
          '<td></td>' +
          '<td></td>' +
          '<td style="width: 23px"><div class="subtitleCircle alwaysVisible"></div></td>' +
          '<td colspan = "2" class="date-subheader">' + html_sanitize(d3.time.format('%A, %B %e, %Y')(new Date(visit.timestamp / 1000))); + '</td>' +
          '<td></td>' +
          '<td></td>' +
        '</tr>';
        currentDay = visit.timestamp;
      }

      rows += '<tr class="subtable-row" data-visit=\'' + this._escapeHTML(JSON.stringify(visit)) + '\'>' +
        '<td class="subcat">' + html_sanitize(visit.subcat) + '</td>' +
        '<td class="time historyVisit">' + html_sanitize(time) + '</td>' +
        '<td style="width: 23px"><div class="timelineCircle ' + this._escapeHTML(lastOrFirstVisitString) + '"></div></td>' +
        '<td><img class="favicon" src="' + this._escapeHTML(visit.favicon) + '" alt=""></img></td>' +
        '<td style="width: 380px"><div class="domain" data-toggle="tooltip" title="' + this._escapeHTML(visit.url) + '">' +
          '<a href="' + this._escapeHTML(visit.url) + '">' + html_sanitize(visit.domain) + '</a>' +
        '</div>' +
        '<div class="visitTitle historyVisit" data-toggle="tooltip" title="' + this._escapeHTML(visit.url) + '">' +
          '<a href="' + this._escapeHTML(visit.url) + '">- ' + html_sanitize(visit.title) + '</a>' +
        '</div></td>' +
        '<td class="charms"><div class="' + this._escapeHTML(bookmarked) + '"></div>' +
            '<div class="flag" title="Flag for feedback"></div></td>' +
      '</tr>';
    }
    if (!complete) {
      rows += '<tr>' +
        '<td colspan = "5"><div class="loading"></div></td>' +
      '</tr>';
    }
    return rows;
  },

  _checkListFullAndAppend: function(category, categoryID, $scope) {
    let screenHeight = ($(window).height() - 195);
    let heightOfLastEntry = ($('#' + categoryID + ' tr').length * parseFloat($('.subtable tr').css("height")));

    let subcatLineHeight = 900;
    if (heightOfLastEntry < screenHeight) {
       subcatLineHeight = heightOfLastEntry + 5;
    }
    $('body').append('<style>#test .shown .category-name:before{height: ' + subcatLineHeight + 'px;}</style>');

    let listFull = heightOfLastEntry > screenHeight;
    if (!listFull) {
      this._appendingVisits = true;
      $scope._requestCategoryVisits(category);
    }
  },

  _getStartIndex: function(historyVisits, pageResponseSize) {
    // Start index is 0 for our first page.
    if (pageResponseSize == historyVisits.length) {
      return 0;
    }

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

  receiveTopSitesFromMainScript: function(topsites, category) {
    this._scope.safeApply(() => {
      this._addTopSites(topsites.byInterest[category], this._scope);
    });
  },

  receiveDebugReportFromMainScript: function(debugLogs) {
    let fulldebugReport = ["DATA PROCESSING LOGS\n====================="];
    fulldebugReport = fulldebugReport.concat(debugLogs);
    fulldebugReport = fulldebugReport.concat("\nDASHBOARD UI LOGS\n===================");
    fulldebugReport = fulldebugReport.concat(this.debugReport);
    this._scope.debugLog = fulldebugReport.toString().replace(/,/g, '\n');
    $('#debug-modal').modal();
  },

  appendCategoryVisitData: function(category, historyVisits, pageResponseSize, complete, $scope) {
    try {
      this.debugReport.push("Appending category visit data for [" + category + "] with page size [" + pageResponseSize + "]");
      let categoryID = this._categoryToID(category);
      let nextEntryIndex = this._getStartIndex(historyVisits, pageResponseSize);
      if ($('#' + categoryID + ' tr').length > 0) {
        $('#' + categoryID + ' tr:last').remove();
        if (nextEntryIndex < historyVisits.length) {
          $('#' + categoryID + ' tr:last .timelineCircle').removeClass("lastVisit");
        }
      }

      let currentDayIndex = nextEntryIndex == 0 ? 0 : nextEntryIndex - 1;
      $('#' + categoryID + ' tbody').append(
        this._getRowsHTML(historyVisits.slice(
          nextEntryIndex, historyVisits.length), historyVisits[currentDayIndex].timestamp, complete));
      this._appendingVisits = false;

      this._checkListFullAndAppend(category, categoryID, $scope);

      $('.bookmarked, .unbookmarked').off('click').on('click', function() {
        if ($(this).hasClass('bookmarked')) {
          $(this).removeClass("bookmarked");
          $(this).addClass("unbookmarked");
        } else {
          $(this).removeClass("unbookmarked");
          $(this).addClass("bookmarked");
        }
        let {url, title} = $(this).parent().parent().data("visit");
        $scope._requestBookmarkChange(url, title);
      });

      let self = this;
      $('.flag').off('click').on('click', function() {
        let visit = $(this).parent().parent().data("visit");
        self._flaggedVisits.push([category, visit.subcat, visit.title, visit.url]);

        $("#flag-alert").addClass("shown");

        $("#flag-compose").off('click').on('click', function() {
          let mailBody = "Here's some feedback about the addon:\n...\n\n" +
            "I've flagged these pages as needing improvement:\n\n" +
            self._flaggedVisits.map(([category, subcat, title, url]) => {
              return "cat: " + category + "\nsub: " + subcat + "\ntitle: " + title + "\nurl: " + url;
            }).join("\n\n");
          let message = "To: up-feedback@mozilla.com\n" +
            "Subject: Dashboard Feedback\n" +
            "Message: " + mailBody;
          $scope._copyToClipboard(message);

          $(this).text("Copied! Click to copy again.");
        });
      });
    } catch (ex) {
      this.debugReport.push("Error in InterestDashboard.appendCategoryVisitData(): " + ex);
    }
  },

  cancelAppendVisits: function() {
    this._appendingVisits = false;
  },

  _getTopsitesForCategory: function(category, $scope) {
    $scope._requestSortedDomainsForCategory(category);
  },

  _categoryToID: function(category) {
    let decoded = category.replace(/ /g, '-');
    return decoded.replace(/&/g, 'and');
  },

  _idToCategory: function(categoryID) {
    let decoded = categoryID.replace(/-/g, ' ');
    return decoded.replace(/and/g, '&');
  },

  _openRowDetails: function(row, tr, category, $scope, table) {
    try {
      this.debugReport.push("InterestDashboard._openRowDetails() [" + category + "]");
      // Close all other open rows.
      let self = this;
      $("#test tr").each(function() {
        self._closeRowDetails(table.row($(this)), $(this), self._data, $scope);
      });
      self._getTopsitesForCategory(category, $scope);
      let categoryID = self._categoryToID(category);

      // Open this row
      row.child(this._formatSubtable(categoryID)).show();

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
          $scope._requestCategoryVisits(self._idToCategory(e.currentTarget.id));

          $('body').append('<style>#test .shown .category-name:before{height: ' + ($(window).height() - 195) + 'px;}</style>');
        }
      });
      tr.addClass('shown');
      this._checkListFullAndAppend(category, categoryID, $scope);
      $('table.dataTable thead th').css("pointer-events", "none"); // Remove ability to sort while a subtable is open.
    } catch (ex) {
      this.debugReport.push("Error in InterestDashboard._openRowDetails(): " + ex);
    }
  },

  _closeRowDetails: function(row, tr, data, $scope) {
    try {
      // This row is already open - close it
      let self = this;
      $scope.$apply(function() {
        self._addTopSites(data.sortedDomains.all, $scope);
      });
      $(".headerCircle").removeClass("alwaysVisible");
      this._preventScroll = false;
      row.child.hide();
      this.cancelAppendVisits();
      tr.removeClass('shown');
      $('div.dataTables_scrollBody').css("overflow", "auto");
      $('table.dataTable thead th').css("pointer-events", "all");
    } catch (ex) {
      this.debugReport.push("Error in InterestDashboard._closeRowDetails(): " + ex);
    }
  },

  _handleRowExpand: function($scope) {
    // Add event listener for opening and closing details
    let self = this;

    // tbody and td do not yet exist when this click handler is added,
    // so they must be a parameter and not part of the selector.
    $('#test').on('click', 'tbody tr[role="row"] td', function() {
      let tr = $(this).closest('tr');
      let row = self._table.row(tr);

      // Get the category that was clicked
      let parser = new DOMParser();
      let node = parser.parseFromString(row.data()[1], "text/html");
      let category = node.querySelector('.category-name').textContent;

      if (row.child.isShown()) {
        self.debugReport.push("InterestDashboard._closeRowDetails() [" + category + "]");
        self._closeRowDetails(row, tr, self._data, self._scope);
        $scope.$apply(function() {
          $scope._requestResetCategoryVisits(category);
        });
      } else {
        self._openRowDetails(row, tr, category, self._scope, self._table);
      }
    });
  },

  _renderPieCircles: function(cx, cy, r, style) {
    d3.select("#interestPie")
      .append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", r)
      .style(style)
  },


  _renderPieGraph: function(data) {
    d3.select('#interestPie').selectAll("*").remove();

    this._renderPieCircles(195, 200, 148, {'fill': '#E6E6E6', 'border': '2px solid rgb(230, 230, 230)',
      'border-radius': '390px'});

    this._renderPieCircles(195, 200, 145, {'fill': '#FFFFFF'});

    d3.select("#interestPie")
      .attr("class", "pie-graph-margin-fix")
      .datum(data.pieData)
      .transition().duration(350)
      .call(this._pieChart);

    this._renderPieCircles(195, 200, 77, {'fill': 'white'})

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
      $scope.pastXDays = "(past 30 days)";

      let topRankedCategory = data.tableData[0].name;
      let rankPercent = Math.round(data.categories[topRankedCategory].viewCount / data.totalViews * 10000) / 100;
      rankPercent = rankPercent >= 1 ? parseInt(rankPercent) : rankPercent;

      if (Object.keys(data.capturedRankings).length < 3) {
        return;
      }
      let normalizedIntentScore = self._getValueInNewRange(data.capturedRankings.currentRanks.rankedIntents[topRankedCategory]);
      let normalizedInterestScore = self._getValueInNewRange(data.capturedRankings.currentRanks.rankedInterests[topRankedCategory]);
      let previousnNormalizedIntentScore = self._getValueInNewRange(data.capturedRankings.previousRanks.rankedIntents[topRankedCategory]);
      let previousNormalizedInterestScore = self._getValueInNewRange(data.capturedRankings.previousRanks.rankedInterests[topRankedCategory]);

      let statsData = {
        score: parseInt(500 - (normalizedIntentScore + normalizedInterestScore)),
        previousScore: parseInt(500 - (previousnNormalizedIntentScore + previousNormalizedInterestScore)),
        totalVisits: data.totalVisits,
        rank: topRankedCategory,
        rankDetails: rankPercent + "% of total activity",
        percentChange: parseInt((data.dailyAvgVisitCountThisWeek - data.dailyAvgVisitCountLastWeek) /
                          data.dailyAvgVisitCountLastWeek * 100),
        visitCount: self._numberWithCommas(parseInt(data.dailyAvgVisitCountThisWeek)) + " sites",
        visitCountDetails: self._numberWithCommas(parseInt(data.dailyAvgVisitCountLastWeek)) + " sites avg. last week",
        scoreTitle: "Top Interest Score",
        visitCountTitle: "Sites Visited Per Day",
        rankTitle: "Top Ranking"
      };
      self._setStats(statsData, $scope);
    });

    d3.select('#areaGraph').selectAll("*").remove();
    d3.select("#areaGraph")
      .attr("class", "area-graph-margin-fix")
      .datum(data.areaData.total)
      .transition().duration(350)
      .call(this._areaGraph);

    this._setTooltip($scope);
  },

  _handleProgressBarAndBannerVisibility: function(diffDaysMin, $scope) {
    // Handle visibility of progress bar and incompletion banner.
    if ($scope.percentProcessed == "100%") {
      if (diffDaysMin <= 0) {
        $('body').removeClass("banner-visible");
      }
      $("#visual-header-overlay").addClass("fade-out");
      $("#main-overlay").addClass("fade-out");
      $("#tutorial-popover").addClass("shownTutorialPanel");
    } else {
      setTimeout(() => {
        if (!$scope.percentProcessed) {
          $scope.updateProgressBar("100");
        }
      }, 1000);
      setTimeout(() => {
        if ($scope.percentProcessed == "100%") {
          if (diffDaysMin <= 0) {
            $('body').removeClass("banner-visible");
          }
          $("#visual-header-overlay").addClass("fade-out");
          $("#main-overlay").addClass("fade-out");
        }
      }, 2000);
    }
  },

  _getValueInNewRange: function(value) {
    let oldMin = newMin = 1
    let oldRange = this._data.sortedIntents.length - oldMin;
    let newRange = 249; // new max - new min
    return (((value - oldMin) * newRange) / oldRange) + newMin;
  },

  _nvSliceClicked: function(event, self, data, $scope, clickTarget) {
    try {
      self._sliced = true;
      $('.back').addClass("visibleBack");
      $('.back').on('click', () => {
        self.debugReport.push("Back clicked to go to initial state.");
        self._setInitialState($scope, data);
      });

      self._areaGraph.xAxis.tickFormat((d) => {
        return "<strong>" + d3.time.format('%A %B %e, %Y')(new Date(d)) + "</strong>";
      });

      $scope.$apply(function() {
        // Grey out the unselected pie pieces.
        $(".nvd3.nv-pie path").css("fill-opacity", 0.1);
        clickTarget.find('path').css("fill-opacity", 1);
        self._areaGraph.color([clickTarget.find('path').css("fill"), "#E6E6E6"]);

        let categoryClicked = event.data.label;
        $scope.graphHeader = categoryClicked;
        self.debugReport.push("[" + categoryClicked + "] slice clicked.");

        // Redraw area graph
        d3.select('#areaGraph').selectAll("*").remove();
        d3.select("#areaGraph")
          .attr("class", "area-graph-margin-fix")
          .datum(data.areaData[categoryClicked])
          .transition().duration(350)
          .call(self._areaGraph);

        self._areaGraph.stacked.dispatch.on("areaClick", null);
        self._areaGraph.stacked.dispatch.on("areaClick.toggle", null);
        self._areaGraph.stacked.scatter.dispatch.on("elementClick", null);
        self._setTooltip($scope);

        // Update stats below graph
        if (Object.keys(data.capturedRankings).length < 3) {
          return;
        }
        let normalizedIntentScore = self._getValueInNewRange(data.capturedRankings.currentRanks.rankedIntents[categoryClicked]);
        let normalizedInterestScore = self._getValueInNewRange(data.capturedRankings.currentRanks.rankedInterests[categoryClicked]);
        let previousnNormalizedIntentScore = self._getValueInNewRange(data.capturedRankings.previousRanks.rankedIntents[categoryClicked]);
        let previousNormalizedInterestScore = self._getValueInNewRange(data.capturedRankings.previousRanks.rankedInterests[categoryClicked]);
        let rankPercent = Math.round(data.categories[categoryClicked].viewCount / data.totalViews * 10000) / 100;
        rankPercent = rankPercent >= 1 ? parseInt(rankPercent) : rankPercent;

        let statsData = {
          score: parseInt(500 - (normalizedIntentScore + normalizedInterestScore)),
          previousScore: parseInt(500 - (previousnNormalizedIntentScore + previousNormalizedInterestScore)),
          rank: "#" + data.categories[categoryClicked].rank + " (" + rankPercent + "% of total)",
          rankDetails: "#" + data.capturedRankings.previousRanks.rankedInterests[categoryClicked] + " interest last week",
          percentChange: parseInt((data.categories[categoryClicked].totalVisitsThisWeek - data.categories[categoryClicked].totalVisitsLastWeek) /
                            data.categories[categoryClicked].totalVisitsLastWeek * 100),
          visitCount: self._numberWithCommas(data.categories[categoryClicked].totalVisitsThisWeek) + "x",
          visitCountDetails: self._numberWithCommas(data.categories[categoryClicked].totalVisitsLastWeek) + " visits last week",
          scoreTitle: "Interest Score",
          visitCountTitle: "Total Visits",
          rankTitle: "Rank"
        };
        self._setStats(statsData, $scope);
      });
    } catch (ex) {
      this.debugReport.push("Error in InterestDashboard._nvSliceClicked(): " + ex);
    }
  },

  graph: function(data, table, $scope) {
    try {
      // Show the recommend tab messaging in the cog only when viewing the recommend tab.
      $('#interests_tab').on('click', () => {
        $('.dropdown-menu .report-bugs').css("display", 'none');
      });
      $('#recommend_tab').on('click', () => {
        $('.dropdown-menu .report-bugs').css("display", 'inherit');
      });

      // We got some data so make the Dashboard view active and the 'no history' view inactive
      $('#yourInterests').addClass("active");
      $('#noHistory').removeClass("active");

      this._data = data;
      this._table = table;
      this._scope = $scope;
      if (Object.keys(data.capturedRankings).length == 3) {
        $scope.lastUpdate = "Updated " + d3.time.format('%m/%d/%Y at %I:%M%p')(new Date(data.capturedRankings.date[1]));
      }
      $('[data-toggle="tooltip"]').tooltip({'placement': 'bottom'});
      $('[data-toggle="popover"]').popover({'placement': 'bottom'});
      table.clear();

      // Render graphs.
      let self = this;
      this._drawGraphMarkers();
      this._renderPieGraph(data, data.tableData.length);
      d3.selectAll('.nv-slice').on('click', function(event) {
        self._nvSliceClicked(event, self, data, $scope, $(this));
      });
      this._setInitialState($scope, data);
      nv.utils.windowResize(this._areaGraph.update);
      nv.utils.windowResize(this._pieChart.update);


      // Computations for banner and progress bar.
      let maxDate = new Date(data.maxDay);
      let minDate = new Date(data.minDay);
      let diffDays = Math.round(Math.abs((maxDate.getTime() - this._thirtyAgo.getTime())/(this._oneDay)));
      let diffDaysMin = Math.round((minDate.getTime() - this._thirtyAgo.getTime() - this._oneDay)/(this._oneDay));

      // 795 is width of svg rect, 60 is 30 for margin + 30 to show up after next day
      let left = 795 / 30 * diffDays + 60 + (795 / 30)
      $("#percentComplete").css("left", left);
      $(".mostRecentMarker").css("left", left - 10); // Subtract 10 to center.
      $("#mostRecentDate").css("left", left - 35);

      let mostRecentDate = new Date(maxDate.getTime() + this._oneDay);
      $scope.percentage = parseInt(diffDays / 28 * 100);
      $scope.isComplete = $scope.percentage >= 100;
      $scope.isAtAnEnd = diffDays < 2 || diffDays > 26;
      $scope.mostRecentDate = d3.time.format('%x')(mostRecentDate);
      if (diffDaysMin > 0) {
        $scope.monthXX = d3.time.format('%B %e')(new Date(this._today.getTime() + diffDaysMin + this._oneDay));
        $('body').addClass("banner-visible");
      }
      this._handleProgressBarAndBannerVisibility(diffDaysMin, $scope);


      // If we are processing data, prevent scroll.
      this._preventScroll = false;
      if ($scope.daysLeft) {
        this._preventScroll = true;
      }
      document.addEventListener('DOMMouseScroll', (e) => { this._mouseScroll(e); }, false);

      this._addTopSites(data.sortedDomains.all, $scope);
      this._addTableRows(data, table);
      $scope.generateDebugReport = () => {
        $scope.debugReportRequest();
      };
    } catch (ex) {
      this.debugReport.push("Error in InterestDashboard.graph(): " + ex);
    }
  }
}
