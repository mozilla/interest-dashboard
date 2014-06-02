function TimelineChart() {
  this._chart = nv.models.scatterChart()
                .showDistX(true)
                .showDistY(true)
                .showLegend(false)
                .color(d3.scale.category20().range())
                .transitionDuration(300);

  this._chart.tooltipContent((key, y, e, graph) => {
    let label = "";
    for (let domain in graph.point.domainList) {
      label += "<h3>" + domain + ": " + graph.point.domainList[domain] + " visit(s)</h3>"
    }
    label += "<h2>Total: " + graph.point.size + (graph.point.size > 1 ? " visits" : " visit") + "</h2>";
    return label;
  });

  this._chart.xAxis.tickFormat((d) => { return d3.time.format('%x')(new Date(d)); });
  this._chart.yAxis.tickFormat((num) => { return this._interestList[num]; });

  nv.addGraph(() => {
    nv.utils.windowResize(this._chart.update);
    return this._chart;
  });
}

TimelineChart.prototype = {
  setTypeAndNamespace: function(type, namespace) {
    this._currentType = type;
    this._currentNamespace = namespace;
  },

  graph: function(data, clearChart) {
    if (clearChart) {
      d3.select('#interestsTimeline svg').selectAll("*").remove();
      this._interestList = [];
    }
    this._interestList = data[this._currentType][this._currentNamespace]["interestList"];
    d3.select('#interestsTimeline svg')
      .datum(data[this._currentType][this._currentNamespace]["chartJSON"])
      .transition().duration(500)
      .call(this._chart);

    nv.utils.windowResize(this._chart.update);
  }
}