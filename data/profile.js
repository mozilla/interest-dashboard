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

self.port.on("style", function(file) {
  $("head").append($("<link>").attr({
    href: file,
    rel: "stylesheet",
    type: "text/css"
  }));
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
