function TimelineChart() {
  this._chart = nv.models.scatterChart()
                .showDistX(true)
                .showDistY(true)
                .showLegend(false)
                .color(d3.scale.category20().range())
                .transitionDuration(300);

  this._chart.tooltipContent((key, y, e, graph) => {
    return "<h2>" + graph.point.size + (graph.point.size > 1 ? " visits" : " visit") + "</h2>";
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
    let chartJSON = [];
    this._interestList = Object.keys(data[this._currentType][this._currentNamespace]);
    for (let i = 0; i < this._interestList.length; i++) {
      let dataPoints = data[this._currentType][this._currentNamespace][this._interestList[i]]["dates"];
      chartJSON.push({
        key: this._interestList[i],
        values: Object.keys(dataPoints).map(key => {
          dataPoints[key]["y"] = i;
          return dataPoints[key];
        })
      });
    }
    d3.select('#interestsTimeline svg')
      .datum(chartJSON)
      .transition().duration(500)
      .call(this._chart);

    nv.utils.windowResize(this._chart.update);
  }
}