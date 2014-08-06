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
                .margin({right: 100})
                .x(function(d) { return d[0] })
                .y(function(d) { return d[1] })
                .useInteractiveGuideline(true)
                .showLegend(false)
                .showControls(false)
                .transitionDuration(300);

  this._areaGraph.xAxis
    .tickFormat((d) => { return d3.time.format('%x')( new Date(d)); });

  this._areaGraph.yAxis
    .tickFormat((d) => { return d; });

  nv.addGraph(() => {
    return this._areaGraph;
  });
}

InterestDashboard.prototype = {
  graph: function(data) {
    d3.select('#interestPie').selectAll("*").remove();
    d3.select('#areaGraph').selectAll("*").remove();

    d3.select("#interestPie")
      .attr("class", "margin-fix")
      .datum(data.pieData)
      .transition().duration(350)
      .call(this._pieChart);

    d3.select("#areaGraph")
      .datum(data.areaData)
      .transition().duration(350)
      .call(this._areaGraph);

    nv.utils.windowResize(this._areaGraph.update);
    nv.utils.windowResize(this._pieChart.update);
  }
}