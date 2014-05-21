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
    let xVals = this._values.map((value) => {
      return value["x"];
    });
    let xMax = Math.max.apply(null, xVals);
    let xMin = Math.min.apply(null, xVals);
    if (tick == xMin) {
      return "Fewer Days Visited"
    } else if (tick == xMax) {
      return "More Days Visited";
    }
    return "";
  });

  this._chart.yAxis.tickFormat((tick) => {
    let yVals = this._values.map((value) => {
      return value["y"];
    });
    let yMax = Math.max.apply(null, yVals);
    let yMin = Math.min.apply(null, yVals);
    if (tick == yMin) {
      return "Fewer Visits Per Day"
    } else if (tick == yMax) {
      return "More Visits Per Day";
    }
    return "";
  });

  nv.addGraph(() => {
    nv.utils.windowResize(this._chart.update);
    return this._chart;
  });
}

WeightIntensityChart.prototype = {
  setTypeAndNamespace: function(type, namespace) {
    this._currentType = type;
    this._currentNamespace = namespace;
  },

  graph: function(data, clearChart) {
    // _pointToInterestsMap is used to make up for a bug in nvd3 where multiple points can't
    // appear in the same location.
    this._pointToInterestsMap = {};
    this._values = [];
    d3.select('#weightIntensityChart svg').selectAll("*").remove();

    for (let interest in data[this._currentType][this._currentNamespace]) {
      let x = data[this._currentType][this._currentNamespace][interest]["x"];
      let y = data[this._currentType][this._currentNamespace][interest]["y"];
      let hash = x.toString() + y.toString();

      if (!this._pointToInterestsMap[hash]) {
        this._pointToInterestsMap[hash] = [];
        let point = data[this._currentType][this._currentNamespace][interest];
        this._values.push(point);
      }
      this._pointToInterestsMap[hash].push(interest);
    }

    let chartJSON = [{
      key: "test",
      values: this._values
    }];
    d3.select('#weightIntensityChart svg')
      .datum(chartJSON)
      .transition().duration(500)
      .call(this._chart);

    nv.utils.windowResize(this._chart.update);
  }
}