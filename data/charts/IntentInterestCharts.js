function IntentInterestCharts() {
  this._chart = nv.models.pieChart()
      .showLegend(false)
      .x(function(d) { return d.label })
      .y(function(d) { return d.value })
      .showLabels(false);

  nv.addGraph(function() {
    return this._chart;
  });
}

IntentInterestCharts.prototype = {
  _graphPie: function(chartType, domainList, title) {
    let chartData = [];
    for (let domain in domainList) {
      let obj =  {
        "label": domain,
        "value": domainList[domain]
      };
      chartData.push(obj);
    }
    let div = d3.select("#" + chartType)
      .append("div")
      .attr("height", 100)
      .attr("class", "span3");

    div.append("h3")
        .text(title)
        .attr("class", "text-center");

    div.append("svg")
      .attr("height", 300)
      .attr("class", "margin-fix")
      .datum(chartData)
      .transition().duration(350)
      .call(this._chart);
  },

  setTypeAndNamespace: function(type, namespace) {
    this._currentType = type;
    this._currentNamespace = namespace;
  },

  graph: function(data, clearChart) {
    d3.select('#intentCharts').selectAll("*").remove();
    d3.select('#interestCharts').selectAll("*").remove();
    for (let intentData of data[this._currentType][this._currentNamespace]["sortedIntents"]) {
      let maxWeightDate = intentData["maxWeightDate"];
      let domainList = intentData["dates"][maxWeightDate]["domainList"];
      let maxIntentDate = d3.time.format('%x')(new Date(intentData["dates"][maxWeightDate]["x"]))
      let title = intentData["category"] + " (" + maxIntentDate + ")";
      this._graphPie("intentCharts", domainList, title);
    }
    for (let interestData of data[this._currentType][this._currentNamespace]["sortedInterests"]) {
      let domainList = {};
      for (let dateInfo in interestData["dates"]) {
        for (let domain in interestData["dates"][dateInfo]["domainList"]) {
          if (!domainList[domain]) {
            domainList[domain] = 0;
          }
          domainList[domain] += interestData["dates"][dateInfo]["domainList"][domain];
        }
      }
      let title = interestData["category"];
      this._graphPie("interestCharts", domainList, title);
    }
  }
}