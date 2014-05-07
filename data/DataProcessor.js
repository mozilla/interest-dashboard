var DataProcessor = {
  timelineData: {},

  arraySum: function(arr) {
    sum = 0;
    for (element in arr) {
      sum += parseInt(arr[element]);
    }
    return sum;
  },

  daysPostEpochToDate: function(dayCount) {
    return parseInt(dayCount) * 24 * 60 * 60 * 1000;
  },

  processAndStore: function(aData) {
    for (var day in aData) {
      for (var type in aData[day]) {
        for (var namespace in aData[day][type]) {
          if (!this.timelineData[type]) {
            this.timelineData[type] = {};
          }
          if (!this.timelineData[type][namespace]) {
            this.timelineData[type][namespace] = {};
          }

          for (var interest in aData[day][type][namespace]) {
            if (!this.timelineData[type][namespace][interest]) {
              this.timelineData[type][namespace][interest] = {};
            }
            visitCountArr = aData[day][type][namespace][interest];
            this.timelineData[type][namespace][interest][day] = {x: this.daysPostEpochToDate(day), size: this.arraySum(visitCountArr)};
          }
        }
      }
    }
    ChartUpdater.updateTimelineWithInterests(this.timelineData);
  }
}

var ChartUpdater = {
  interestList: [],
  currentType: "keywords",
  currentNamespace: "58-cat",

  init: function(type, namespace, interestList) {
    if (typeof type !== 'undefined') { this.currentType = type };
    if (typeof namespace !== 'undefined') { this.currentNamespace = namespace };
    if (typeof interestList !== 'undefined') { this.interestList = interestList };

    var self = this;
    nv.addGraph(function() {
      self.chart = nv.models.scatterChart()
                    .showDistX(true)
                    .showDistY(true)
                    .showLegend(false)
                    .color(d3.scale.category20().range())
                    .transitionDuration(300);
      self.chart.tooltipContent(function(key, y, e, graph) {
        return "<h2>" + graph.point.size + (graph.point.size > 1 ? " visits" : " visit") + "</h2>";
      });

      self.chart.xAxis.tickFormat(self.xAxisFormat);
      self.chart.yAxis.tickFormat(self.yAxisFormat);
      nv.utils.windowResize(self.chart.update);
      return self.chart;
    });
  },

  xAxisFormat: function(d) {
    return d3.time.format('%x')(new Date(d));
  },

  yAxisFormat: function(num) {
    return ChartUpdater.interestList[num];
  },

  updateTimelineWithInterests: function(data) {
    var chartJSON = [];
    this.interestList = Object.keys(data[this.currentType][this.currentNamespace]);
    for (var i = 0; i < this.interestList.length; i++) {
      var dataPoints = data[this.currentType][this.currentNamespace][this.interestList[i]];
      chartJSON.push({
        key: this.interestList[i],
        values: Object.keys(dataPoints).map(key => {
          dataPoints[key]["y"] = i;
          return dataPoints[key];
        })
      });
    }
    d3.select('#interestsTimeline svg')
      .datum(chartJSON)
      .transition().duration(500)
      .call(this.chart);

      nv.utils.windowResize(this.chart.update);
  }
}