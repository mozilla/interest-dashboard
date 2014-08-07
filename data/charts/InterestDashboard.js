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
  _getMaxDate: function(days) {
    let max = 0;
    for (let day in days) {
      if (Number(day) > max) {
        max = Number(day);
      }
    }
    return d3.time.format('%x')(new Date(days[max].x));
  },

  _addTableRows: function(data, table) {
    for (let i = 0; i < data.tableData.length; i++) {
      let categoryObj = data.tableData[i];
      table.row.add([
        (i + 1),
        categoryObj.name,
        this._getMaxDate(categoryObj.days),
        null
      ]).draw();

      table
        .column(-1)
        .nodes()
        .to$() // Convert to a jQuery object
        .addClass('details-control');
    }
    table.columns.adjust();
  },

  graph: function(data, table) {
    d3.select('#interestPie').selectAll("*").remove();
    d3.select('#areaGraph').selectAll("*").remove();
    table.clear();

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

    this._addTableRows(data, table);
  }
}