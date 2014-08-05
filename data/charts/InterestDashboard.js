function InterestDashboard() {
  this._chart = nv.models.pieChart()
      .showLegend(false)
      .x(function(d) { return d.label })
      .y(function(d) { return d.value })
      .showLabels(false);

  nv.addGraph(function() {
    return this._chart;
  });
}

InterestDashboard.prototype = {
  graph: function(data) {
    d3.select('#interestPie').selectAll("*").remove();

    let div = d3.select("#interestPie")
      .attr("class", "margin-fix")
      .datum(data)
      .transition().duration(350)
      .call(this._chart);
  }
}