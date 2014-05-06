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
  }
}

var ChartUpdater = {

}