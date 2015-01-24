let ChartManager = {
  _charts: {},

  /**
   * this._charts uses an index for each chart object that is the same
   * as the index used for its data to be stored but without "Data"
   * appended to the end.
   *
   * E.g. The data for the object at this._charts["timeline"] can be found
   *      at data["timelineData"]
   *
   * @data - storage.chartData object which contains data for all charts
   */
  graphAllFromScratch: function(data, table, $scope) {
    if (!this._charts["interestDashboard"]) {
      this._charts["interestDashboard"] = new InterestDashboard($scope);
    }
    if (!this._charts["spider"]) {
      this._charts["spider"] = new SpiderGraph($scope);
    }
    for (let chart in this._charts) {
      this._charts[chart].graph(data[chart + "Data"], table, $scope);
    }
  },

  appendToGraph: function(chartType, data, table, $scope) {
    if (!this._charts["interestDashboard"]) {
      this._charts["interestDashboard"] = new InterestDashboard($scope);
    }
    if (!this._charts["spider"]) {
      this._charts["spider"] = new SpiderGraph($scope);
    }
    this._charts[chartType].graph(data, table, $scope);
  },

  sendDebugReport: function(debugLogs) {
    this._charts["interestDashboard"].receiveDebugReportFromMainScript(debugLogs);
  },

  populateTopsites: function(topsites, category) {
    this._charts["interestDashboard"].receiveTopSitesFromMainScript(topsites, category);
  },

  appendCategoryVisitData: function(category, historyVisits, pageResponseSize, complete, $scope) {
    this._charts["interestDashboard"].appendCategoryVisitData(category, historyVisits, pageResponseSize, complete, $scope);
  },

  cancelAppendVisits: function() {
    this._charts["interestDashboard"].cancelAppendVisits();
  }
}