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
    if (!this._charts["spider"]) {
      this._charts["spider"] = new SpiderGraph();
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