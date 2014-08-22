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
      this._charts["interestDashboard"] = new InterestDashboard();
    }
    for (let chart in this._charts) {
      this._charts[chart].graph(data[chart + "Data"], table, $scope);
    }
  },

  appendToGraph: function(chartType, data, table, $scope) {
    this._charts[chartType].graph(data, table, $scope);
  },

  appendCategoryVisitData: function(category, historyVisits, pageNum, complete) {
    this._charts["interestDashboard"].appendCategoryVisitData(category, historyVisits, pageNum, complete);
  },

  cancelAppendVisits: function() {
    this._charts["interestDashboard"].cancelAppendVisits();
  }
}