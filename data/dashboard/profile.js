/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const NEG_COLOR = "#c99";
const POS_COLOR = "#9c9";

const DEMOG_NAMES = {
  male: "Male",
  female: "Female",
  age_18: "18-24",
  age_25: "25-34",
  age_35: "35-44",
  age_45: "45-54",
  age_55: "55-64",
  age_65: "65+",
  children: "Yes",
  no_children: "No",
  no_college: "No College",
  some_college: "Some College",
  college: "College",
  graduate: "Graduate School",
  home: "Home",
  school: "School",
  work: "Work",
};

$(document).ready(function() {
  self.port.emit("donedoc");
});

self.port.on("unhide", function() {
  setTimeout(function() {
    document.body.style.opacity = 1;
  }, 50);
});

self.port.on("style", function(file) {
  $("head").append($("<link>").attr({
    href: file,
    rel: "stylesheet",
    type: "text/css"
  }));
});

self.port.on("show_rules", function(rules) {
  let parentNode = $("#rules");
  Object.keys(rules).forEach(function(ruleName) {
    parentNode.append(
      $("<div/>").text(ruleName + ":" + rules[ruleName])
    );
  });
});

self.port.on("show_cats", function(cats, totalAcross, intentCats) {
  //console.log("GOT CATS " + cats);
  let catBukets = {};
  let aliases = [];

  // Figure out the count for each top level category
  let topLevel = {};
  let largest = 0;
  Object.keys(cats).forEach(function(cat) {
    let top = cat.replace(/\/.*/, "");
    let {vcount} = cats[cat];
    topLevel[top] = (topLevel[top] || 0) + vcount;
    if (largest < vcount) {
       largest = vcount;
    }
  });

  let seriesColors = ["#aae", "#eaa", "#eea", "#aea", "#eae", "#aee", "#acf",
    "#fca", "#fac", "#ffc", "#cfa", "#afc", "#fcf", "#cff"];

  // Convert the data for the plotter and assign colors
  let sortedTops = [];
  let topColors = {};
  Object.keys(topLevel).sort(function(a, b) {
    return topLevel[b] - topLevel[a];
  }).slice(0, 15).forEach(function(top, pos) {
    sortedTops.push([top, topLevel[top]]);
    topColors[top] = seriesColors[pos];
  });

  // Plot the pie graph for the categories
  let catsPie = $.jqplot("catsPie", [sortedTops], {
    grid: {
      background: "transparent",
      drawBorder: false,
      shadow: false,
    },
    legend: {
      location: "e",
      show: true,
    },
    seriesColors: seriesColors,
    seriesDefaults: {
      renderer: $.jqplot.PieRenderer,
      rendererOptions: {
        dataLabelPositionFactor: .6,
        dataLabelThreshold: 4,
        highlightMouseOver: false,
        showDataLabels: true,
        sliceMargin: 2,
        startAngle: -90,
      },
      shadow: false,
    },
  });
  displayCats( cats , "cats" , topColors );
  //displayCats( intentCats , "intent" , topColors );
});

function displayCats( cats , rootNodeID , topColors ) {
  // Pick out the top (any-level) categories
  let catNames = Object.keys(cats).sort(function(a, b) {
    return cats[b].vcount - cats[a].vcount;
  }).slice(0, 20);

  let largest = null;
  let lastTop = "";
  let rootNode = $("#" + rootNodeID);
  for (x in catNames) {
    let name = catNames[x];
    let top = name.replace(/\/.*/, "");
    let catData = cats[name];

    // remove the path prefix
    name = name.replace(/^.*\//, "").replace(/_/g, " ");

    let champs = catData.champs.items;
    if (!largest) {
      largest = catData.vcount;
    }
    let barWidth = Math.floor((250.00 * catData.vcount) / largest);
    if (barWidth < 5) {
      barWidth = 5;
    }

    // Display a bar colored based on the category
    let catNode = $("<cpan/>").addClass("cat").append(
      $("<span/>").addClass("label").text(name + " " + Math.round(catData.vcount)),
      $("<div/>").addClass("bar").text("_").css({
        "background-color": topColors[top],
        "width": barWidth + "px"
      }));

    rootNode.append(catNode);
    let explaneNode = $("<cpan/>").addClass("explain").hide();
    for (x in champs) {
      explaneNode.append($("<li/>").text(champs[x].item.domain + " " + Math.round(champs[x].item.vcount)));
    }
    rootNode.append(explaneNode);
    catNode.click(function() {
      if (explaneNode.attr("shown") == "1") {
        explaneNode.hide();
        explaneNode.attr("shown", "0");
      }
      else {
        explaneNode.show();
        explaneNode.attr("shown", "1");
      }
    });
  }
}

function displayDemogs(demog, category, buketNames) {
  let parentNode = $("#demog_" + category);

  let largest = 0;
  let largestBuket;
  for (x in buketNames) {
    let bucket = buketNames[x];
    if( largest < demog[bucket].vtotal ) {
      largestBuket = bucket;
      largest = demog[bucket].vtotal;
    }
  }
  for(x in buketNames) {
    let bucket = buketNames[x];
    let value = demog[bucket].vtotal;

    let theNode = $("<cpan/>").addClass("demog").append(
      $("<span/>").addClass("dmog_label").text(DEMOG_NAMES[bucket]),
      $("<span/>").addClass("demog_bar").text(value));

    if( bucket == largestBuket ) {
      theNode.css({ "color" : "olive" });
    }

    parentNode.append(theNode)

    let explaneNode = $("<div/>").hide();

    let posNode = $("<ul/>").addClass("inliner");
    champs = demog[bucket].positive;
    for (x in champs) {
      posNode.append($("<li/>").css({ "color" : "olive" }).text(champs[x]));
    }
    explaneNode.append(posNode);

    let negNode = $("<ul/>").addClass("inliner");
    champs = demog[bucket].negative;
    for (x in champs) {
      negNode.append($("<li/>").css({ "color" : "blue" }).text(champs[x]));
    }
    explaneNode.append(negNode);

    parentNode.append(explaneNode);

    theNode.click(function() {
      if (explaneNode.attr("shown") == "1") {
        explaneNode.hide();
        explaneNode.attr("shown", "0");
      }
      else {
        explaneNode.show();
        explaneNode.attr("shown", "1");
      }
    });
  }
}

self.port.on("show_demog", function(demog) {
  //console.log("GOT DEMOG " + demog);

  displayDemogs(demog, "gender", ["male", "female"]);
  displayDemogs(demog, "age", ["age_18", "age_25", "age_35", "age_45", "age_55", "age_65"]);
  displayDemogs(demog, "education", ["no_college", "some_college", "college", "graduate"]);
  displayDemogs(demog, "children", ["children", "no_children"]);
});

$(function() {

    // hover on the interest/demographic icon, the associted bars should highlight
    $("#demographic .icon img").mouseover(function(){
          $("#demographic .level1").animate({opacity: 0.5});
        }).mouseout(function(){
          $("#demographic .level1").animate({opacity: 1});
        });

    $("#interest-1 .icon img").mouseover(function(){
          $("#interest-1 .level1").animate({opacity: 0.5});
        }).mouseout(function(){
          $("#interest-1 .level1").animate({opacity: 1});
        });

    $("#interest-2 .icon img").mouseover(function(){
          $("#interest-2 .level1").animate({opacity: 0.5});
        }).mouseout(function(){
          $("#interest-2 .level1").animate({opacity: 1});
        });


    $("#interest-3 .icon img").mouseover(function(){
          $("#interest-3 .level1").animate({opacity: 0.5});
        }).mouseout(function(){
          $("#interest-3 .level1").animate({opacity: 1});
        });

    $("#interest-4 .icon img").mouseover(function(){
          $("#interest-4 .level1").animate({opacity: 0.5});
        }).mouseout(function(){
          $("#interest-4 .level1").animate({opacity: 1});
        });

    // hover over a box, and the associated interest bars and icon will fade
    $("#boxes .off.coarse").mouseover(function(){
          $("#interest-1 .level1").animate({opacity: 0.5});
        }).mouseout(function(){
          $("#interest-1 .level1").animate({opacity: 1});
        });


    // fade in bars onLOAD
      $("#demographic .level1").css({ opacity: 0.1 }).animate({ opacity:1 }, 1000);
    $("#interest-1 .level1").css({ opacity: 0.1 }).animate({ opacity:1 }, 1200);
    $("#interest-2 .level1").css({ opacity: 0.1 }).animate({ opacity:1 }, 1400);
    $("#interest-3 .level1").css({ opacity: 0.1 }).animate({ opacity:1 }, 1600);
    $("#interest-4 .level1").css({ opacity: 0.1 }).animate({ opacity:1 }, 1800);

    // TO DO LIST

    // 1) onLOAD I would like to have the slider move to COARSE, and the COARSE bars fadeIN
    // 2) also I would like to have all the images on the right shuffle into place onLOAD
    // 3) fix slider on COARSE, so images on the right side dont show MISC images, this is only for onLOAD
    // 4) make the icons on the DEMO/INTEREST side look actionable, so you can hover over them.  Maybe make them look like buttons.
    // 5) fix hover animation on the icons so theyre not so jerky and smoother


    $( "#slider" ).slider({
      range: "min",
            value:0,
            min: 0,
            max: 2,
            step: 1,
            slide: function( event, ui ) {
        const filters = ["off", "coarse", "medium", "fine"];
        updateUI(filters[ui.value] || "off");
      }
    });

    function updateUI(filter) {
        // set to OFF
        if (filter == "off") {
          $('#slider-eye').fadeTo("slow", 0.1);
          $('.icon').fadeTo("slow", 0.1);
          $('.level1').fadeTo("slow", 0.1);
          $('.level2').fadeTo("slow", 0.1);
          $('.level3').fadeTo("slow", 0.1);
        }
        // set to COARSE
        else if (filter == "coarse") {
          $('#slider-eye').fadeTo("slow", 1);
          $('.icon').fadeTo("slow", 1);
          $('.level1').fadeTo("slow", 1);
          $('.level2').fadeTo("slow", 0.1);
          $('.level3').fadeTo("slow", 0.1);


        }
        // set to Medium
        else if (filter == "medium") {
          $('.level2').fadeTo("slow", 1);
          $('.level3').fadeTo("slow", 0.1);

          $("#demographic .icon").simpletip({
            fixed: true,
            position: "right",
            offset: [-5,0],
            content: "DEMOGRAPHIC<br/>You are a 39 year old female."
          });

          $("#interest-1 .icon").simpletip({
            fixed: true,
            position: "right",
            offset: [-5,0],
            content: "INTEREST<br/>You are interested in <b>Small cars</b>."
          });

          $("#interest-2 .icon").simpletip({
            fixed: true,
            position: "right",
            offset: [-5,0],
            content: "INTEREST<br/>You are interested in <b>Tents</b>."
          });

          $("#interest-3 .icon").simpletip({
            fixed: true,
            position: "right",
            offset: [-5,0],
            content: "INTEREST<br/>You are interested in <b>T-shirts</b>."
          });

          $("#interest-4 .icon").simpletip({
            fixed: true,
            position: "right",
            offset: [-5,0],
            content: "INTEREST<br/>You are interested in the <b>Caribbean</b>."
          });

        }
        // set to Fine
        else if (filter == "fine") {
          $('.level3').fadeTo("slow", 1);
        }

        // Update the sample browser content
        var count = 0;
        $("#boxes .off").each(function() {
        if (this.classList.contains(filter)) {
          this.style.opacity = 1;
          switch (filter) {
            case "off":
            case "coarse":
              this.style.width = "110px";
              this.style.height = "70px";
              this.style.left = (count % 5) * 120 + "px";
              this.style.top = Math.floor(count / 5) * 80 + "px";
              break;

            case "medium":
              this.style.width = "190px";
              this.style.height = "100px";
              this.style.left = (count % 3) * 200 + "px";
              this.style.top = Math.floor(count / 3) * 110 + "px";
              break;

            case "fine":
              this.style.width = "290px";
              this.style.height = "200px";
              this.style.left = (count % 2) * 300 + "px";
              this.style.top = Math.floor(count / 2) * 210 + "px";
              break;
          }
          count++;
        }
        else {
          this.style.opacity = 0;
        }
        });
       }

    updateUI("coarse");

});



$(document).ready(function() {

      $("a.ui-slider-handle.ui-state-default.ui-corner-all").animate({
        left: '+=110'
      }, "swing");

      $(".ui-slider-range.ui-widget-header.ui-slider-range-min").animate({
        width: "110px"
      }, "swing");

});
