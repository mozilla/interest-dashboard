/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Class} = require("sdk/core/heritage");
const {data} = require("self");
const {HistoryReader} = require("HistoryReader");
const {Factory, Unknown} = require("api-utils/xpcom");
const Observer = require("observer-service");
const {PageMod} = require("page-mod");
const Preferences = require("simple-prefs");
const {storage} = require("simple-storage");
const tabs = require("tabs");
const {XMLHttpRequest} = require("xhr");

const {Ci,Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

exports.main = function(options, callbacks) {
  if (storage.rules == null) {
    storage.rules = {
      "car brands": {
        "duration": 120,
        "threshold": 10,
        "keywords": "acura,audi,bmw,buick,cadillac,chevrolet,chrysler,dodge,ford,gmc,honda,hyundai,infiniti,jaguar,jeep,kia,lexus,lincoln,mercedes,nissan,porsche,toyota,volkswagen",
        "domains": "automobiles.honda.com,autos.aol.com,autos.msn.com,autos.yahoo.com,www.cargurus.com,www.chevrolet.com,www.edmunds.com,www.ford.com,www.fueleconomy.gov,www.hyundaiusa.com,www.infinitiusa.com,www.kbb.com,www.kia.com,www.leftlanenews.com,www.lexus.com,www.nadaguides.com,www.nissanusa.com,www.thecarconnection.com,www.toyota.com,www.truecar.com,www.vw.com"
      },
      "small cars": {
        "duration": 90,
        "threshold": 5,
        "keywords": "civic,corolla,matrix,elantra,focus,cruz,jetta",
        "domains": "automobiles.honda.com,autos.aol.com,autos.msn.com,autos.yahoo.com,www.cargurus.com,www.chevrolet.com,www.edmunds.com,www.ford.com,www.fueleconomy.gov,www.hyundaiusa.com,www.kbb.com,www.kia.com,www.leftlanenews.com,www.nadaguides.com,www.nissanusa.com,www.thecarconnection.com,www.toyota.com,www.truecar.com,www.vw.com"
      },
      "asian cars": {
        "duration": 90,
        "threshold": 5,
        "keywords": "honda,hyundai,infiniti,kia,lexus,nissan,toyota",
        "domains": "automobiles.honda.com,autos.aol.com,autos.msn.com,autos.yahoo.com,www.cargurus.com,www.edmunds.com,www.fueleconomy.gov,www.hyundaiusa.com,www.infinitiusa.com,www.kbb.com,www.kia.com,www.leftlanenews.com,www.lexus.com,www.nadaguides.com,www.nissanusa.com,www.thecarconnection.com,www.toyota.com,www.truecar.com"
      }
    };
  }
  if (storage.etherpad == null) {
    storage.etherpad = "ed";
  }

  let historyReader;
  let initData = {};
  function processHistory() {
    if (historyReader != null) {
      historyReader.stop();
    }

    initData.rules = storage.rules;
    historyReader = new HistoryReader(initData);
  }
  processHistory();

  // Handle about:profile requests
  Factory({
    contract: "@mozilla.org/network/protocol/about;1?what=profile",

    Component: Class({
      extends: Unknown,
      interfaces: ["nsIAboutModule"],

      newChannel: function(uri) {
        let chan = Services.io.newChannel(data.url("dashboard/index.html"), null, null);
        chan.originalURI = uri;
        return chan;
      },

      getURIFlags: function(uri) {
        return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
      }
    })
  });

  // Add functionality into about:profile page loads
  PageMod({
    contentScriptFile: [
      data.url("dashboard/js/jquery-1.8.2.js"),
      data.url("dashboard/js/jquery-ui.js"),
      data.url("dashboard/js/jquery.isotope.min.js"),
      data.url("dashboard/js/jquery.simpletip-1.3.1.min.js"),
      data.url("dashboard/jquery/jquery.jqplot.min.js"),
      data.url("dashboard/jquery/jqplot.pieRenderer.min.js"),
      data.url("dashboard/jquery/jqplot.donutRenderer.min.js"),
      data.url("dashboard/profile.js"),
    ],

    include: ["about:profile"],

    onAttach: function(worker) {
      worker.port.on("donedoc", function() {
        // Give the base path for images
        worker.port.emit("img_path", data.url("dashboard/"));

        worker.port.emit("style", data.url("dashboard/profile.css"));
        worker.port.emit("style", data.url("dashboard/jquery/jquery.jqplot.min.css"));
        worker.port.emit("style", data.url("dashboard/css/reset.css"));
        worker.port.emit("style", data.url("dashboard/css/text.css"));
        worker.port.emit("style", data.url("dashboard/css/960.css"));
        worker.port.emit("style", data.url("dashboard/css/demo.css"));
        worker.port.emit("style", data.url("dashboard/css/jquery-ui.css"));
        worker.port.emit("style", data.url("dashboard/css/style.css"));
        worker.port.emit("unhide");
      });

      worker.port.on("get_data", function() {
        historyReader.getCategories(function(cats) {
          worker.port.emit("show_cats", cats);
        });

        historyReader.getDemographics(function(demogs) {
          worker.port.emit("show_demog", demogs);
        });

        historyReader.getRules(function(rules) {
          worker.port.emit("show_rules", rules);
        });
      });

      // Add support for input rules
      worker.port.on("donedoc", function() {
        worker.port.emit("set_rules", storage.rules);
        worker.port.emit("set_rulesetherpad", storage.etherpad);
      });

      worker.port.on("revert_rules", function() {
        worker.port.emit("set_rules", storage.rules);
      });

      worker.port.on("view_rules", function(pad) {
        tabs.open("https://etherpad.mozilla.org/up-" + pad);
      });

      worker.port.on("import_rules", function(pad) {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", "https://etherpad.mozilla.org/ep/pad/export/up-" + pad + "/latest?format=txt", false);
        xhr.send();

        try {
          let rules = JSON.parse(xhr.responseText);
          storage.etherpad = pad;
          worker.port.emit("set_rules", rules);
        }
        catch(ex) {
          worker.port.emit("set_rules", {});
        }
      });

      worker.port.on("process_rules", function(ruleData) {
        if (JSON.stringify(ruleData) != JSON.stringify(storage.rules)) {
          storage.rules = ruleData;
          processHistory();
        }
      });
    }
  });

  PageMod({
    include: "*" ,
    onAttach: function(worker) {
      if (worker.url.indexOf("http") == 0) {
        historyReader.consumeOnePageVisit(worker.url, worker.tab.title);
      }
    }
  });

  // Watch for preference changes to detect which pages to inject APIs
  let allowedDomains;
  const ALLOWED_API_PREF = "allowedAPIDomains";
  Preferences.on(ALLOWED_API_PREF, updateAPIDomains);
  function updateAPIDomains() {
    allowedDomains = {};

    // Short circuit if there's nothing to do
    let userValue = Preferences.prefs[ALLOWED_API_PREF].trim();
    if (userValue == "") {
      return;
    }

    // Convert the array of domains to an object
    userValue.split(",").forEach(function(domain) {
      allowedDomains[domain] = true;
    });
  }
  updateAPIDomains();

  // Inject navigator.profile APIs into desired pages
  Observer.add("document-element-inserted", function apiInjector(document) {
    // Allow injecting into certain pages
    let {defaultView, location} = document;
    if (defaultView == null || allowedDomains[location.host] == null) {
      return;
    }

    // Expose to the content of the page some profile APIs
    let {navigator} = defaultView.wrappedJSObject;
    navigator.profile = {
      __exposedProps__: {
        getCategories: "r",
        getDemographics: "r",
        getRules: "r"
      },

      // Allow getting categories with raw weighting
      getCategories: function(callback) {
        let result = {
          __exposedProps__: {}
        };

        historyReader.getCategories(function(rawData) {
          // Compute the percent and expose them
          Object.keys(rawData).sort(function(a, b) {
            return rawData[b].vcount - rawData[a].vcount;
          }).forEach(function(category) {
            result.__exposedProps__[category] = "r";
            result[category] = rawData[category].vcount;
          });

          callback(result);
        });
      },

      // Allow getting demographics with raw weighting
      getDemographics: function(callback) {
        let result = {
          __exposedProps__: {}
        };

        historyReader.getDemographics(function(rawData) {
          // Compute the percent and expose them
          Object.keys(rawData).forEach(function(category) {
            result.__exposedProps__[category] = "r";
            result[category] = rawData[category].vtotal;
          });

          callback(result);
        });
      },

      // Allow getting rules with thresholded results
      getRules: function(callback) {
        let result = {
          __exposedProps__: {}
        };

        historyReader.getRules(function(rawData) {
          // Compute the percent and expose them
          Object.keys(rawData).forEach(function(category) {
            result.__exposedProps__[category] = "r";
            result[category] = rawData[category];
          });

          callback(result);
        });
      }
    };
  });

  // Automatically open a tab unless it's a regular firefox restart
  if (options.loadReason != "startup") {
    tabs.open("about:profile");
  }
};
