function WeightIntensityChart() {
  this._chart = nv.models.scatterChart()
                .showLegend(false)
                .color(d3.scale.category20().range())
                .transitionDuration(300);

  this._chart.tooltipContent((key, y, e, graph) => {
    let categoryList = this._pointToInterestsMap[graph.point.x.toString() + graph.point.y.toString()];
    let label = "";
    for (let category of categoryList) {
      label += "<h2>" + category + "</h2>"
    }
    return label;
  });

  // A hack to show clearer labels on the x and y axis where we want them
  this._chart.xAxis.tickFormat((tick) => {
    return this._setTicks(tick, this._xMin, "Fewer Days Visited", this._xMax, "More Days Visited");
  });

  this._chart.yAxis.tickFormat((tick) => {
    return this._setTicks(tick, this._yMin, "Fewer Visits Per Day", this._yMax, "More Visits Per Day");
  });

  nv.addGraph(() => {
    nv.utils.windowResize(this._chart.update);
    return this._chart;
  });
}

WeightIntensityChart.prototype = {
  _setTicks: function(tick, minVal, minString, maxVal, maxString) {
    if (tick == minVal) {
      return minString;
    } else if (tick == maxVal) {
      return maxString;
    }
    return "";
  },

  setTypeAndNamespace: function(type, namespace) {
    this._currentType = type;
    this._currentNamespace = namespace;
  },

  graph: function(data, clearChart) {
    // _pointToInterestsMap is used to make up for a bug in nvd3 where multiple points can't
    // appear in the same location.
    this._pointToInterestsMap = data[this._currentType][this._currentNamespace]["pointToInterestsMap"];
    this._xMin = data[this._currentType][this._currentNamespace]["xMin"];
    this._yMin = data[this._currentType][this._currentNamespace]["yMin"];
    this._xMax = data[this._currentType][this._currentNamespace]["xMax"];
    this._yMax = data[this._currentType][this._currentNamespace]["yMax"];

    d3.select('#weightIntensityChart svg').selectAll("*").remove();
    d3.select('#weightIntensityChart svg')
      .datum(data[this._currentType][this._currentNamespace]["chartJSON"])
      .transition().duration(500)
      .call(this._chart);

    nv.utils.windowResize(this._chart.update);
  }
}