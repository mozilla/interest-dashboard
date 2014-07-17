function AreaGraph() {
  this._chart = nv.models.stackedAreaChart()
                .margin({right: 100})
                .x(function(d) { return d[0] })
                .y(function(d) { return d[1] })
                .useInteractiveGuideline(true)
                .showLegend(false)
                .showControls(false)
                .transitionDuration(300);

  this._chart.xAxis
    .axisLabel("Date")
    .tickFormat((d) => { return d3.time.format('%x')( new Date(d)); });

  this._chart.yAxis
    .axisLabel("Number of Visits")
    .tickFormat((d) => { return d; });

  nv.addGraph(() => {
    nv.utils.windowResize(this._chart.update);
    return this._chart;
  });
}

AreaGraph.prototype = {
  graph: function(data) {
    if (data) {
      d3.select("#areaGraph svg").selectAll("*").remove();
    }
    d3.select('#areaGraph svg')
      .datum(data["chartJSON"])
      .transition().duration(500)
      .call(this._chart);

    nv.utils.windowResize(this._chart.update);
  }
}