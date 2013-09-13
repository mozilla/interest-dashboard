$(document).ready(function() {
  $("#time_warning").hide();
  $("#history_done").hide();
  $("#history_run").click(function() {
    $("#time_warning").show(); 
    self.port.emit("history_run");
  });
});

self.port.on("history_done", function() {
  self.port.emit("history_data");
});

self.port.on("history_data", function(results) {
  $("#time_warning").hide();
  $("#history_done").show();
  $("#data_show").text(JSON.stringify(results));
});


