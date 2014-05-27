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
  graphAllFromScratch: function(data, type, namespace) {
    if (!this._charts["timeline"]) {
      this._charts["timeline"] = new TimelineChart();
    }
    if (!this._charts["weightIntensity"]) {
      this._charts["weightIntensity"] = new WeightIntensityChart();
    }
    if (!this._charts["intentInterest"]) {
      this._charts["intentInterest"] = new IntentInterestCharts();
    }
    for (let chart in this._charts) {
      this._charts[chart].setTypeAndNamespace(type, namespace);
      this._charts[chart].graph(data[chart + "Data"], true);
    }
  },

  appendToGraph: function(chartType, data) {
    this._charts[chartType].graph(data, false);
  }
}