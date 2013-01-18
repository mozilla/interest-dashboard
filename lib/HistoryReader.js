/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const timers = require("timers");
const {data} = require("self");
const {URL} = require("url");
//const {hostsToCats} = require("hostsToCats");

// this requires are needed for WorkerProcessor loads starting from sdk-1.12,
// cfx xpi will not include lib/*js files that are not requires anywhere hence
// we MUST require our Processor files here
require("DemographicProcessor");
require("RulesProcessor");
require("CategoryProcessor");

const {Cc,Ci,Cm,Cr,Cu,components} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
const {Worker} = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;

const queryUtils = require("QueryUtils");
const {EventTrigger} = require("EventTrigger");
const {WorkerProcessor} = require("WorkerProcessor");

function HistoryReader(initDataObject) {
  this.historyPlaceProcessors = [];
  this.historyFormProcessors = [];
  this.eventTrigger = new EventTrigger();

  let demographicsInitData = (initDataObject) ? initDataObject.demographics : null;
  let categoriesInitData = (initDataObject) ? initDataObject.categories : null;
  let rulesInitData = (initDataObject) ? initDataObject.rules : null;

  // create processors
  this.demogProc = new WorkerProcessor(data.url("loadDemographicProcessor.js"),demographicsInitData);
  this.addHistoryPlaceProcessor(this.demogProc);
  this.addHistoryFormProcessor(this.demogProc);

  this.categoryProc = new WorkerProcessor(data.url("loadCategoryProcessor.js"),categoriesInitData);
  this.addHistoryPlaceProcessor(this.categoryProc);

  this.ruleProc = new WorkerProcessor(data.url("loadRulesProcessor.js"),rulesInitData);
  this.addHistoryPlaceProcessor(this.ruleProc);

  this.readPlaces();
  this.readForms();

  this.stopped = false;
}

HistoryReader.prototype = {

  stop: function() {
    this.stopped = true;
  },

  getDemographics: function(callBack) {
    this.onReady(function() {
      this.demogProc.requestData(function(demog) {
        callBack(demog);
      });
    }.bind(this));
  },

  getCategories: function(callBack) {
    this.onReady(function() {
      this.categoryProc.requestData(function(cats) {
        callBack(cats);
      });
    }.bind(this));
  },

  getRules: function(callBack) {
    this.onReady(function() {
      this.ruleProc.requestData(function(rules) {
        callBack(rules);
      });
    }.bind(this));
  },

  addHistoryPlaceProcessor: function(processor) {
    this.historyPlaceProcessors.push(processor);
  },

  addHistoryFormProcessor: function(processor) {
    this.historyFormProcessors.push(processor);
  },

  onReady: function(cb) { return this.eventTrigger.onReady(cb); } ,
  flagCompletion: function() { return this.eventTrigger.flagCompletion(); } ,

  consumeOnePageVisit: function(pageUrl, pageTitle) {
    let url = new URL(pageUrl);
    let placeData = {
      domain: this.fixDomain(url.host),
      frecency: 100,
      lastVisit: Date.now() * 1000,
      title: pageTitle,
      url: pageUrl,
      vcount: 1
    };

    if (!placeData.domain || placeData.domain == "") { return; }

    this.historyPlaceProcessors.forEach(function(proc) {
      proc.consumeHistoryPlace(placeData);
    });
  },

  fixDomain: function(domain) {
    let re = /^[.]?www[.]/;
    domain = domain.replace(re, "");

    // if host is preceeded with '.', remove it
    if (domain.charAt(0) == '.') {
        domain = domain.slice(1);
    }

    return domain;
  },

  readPlaces: function(offset) {
    // Initialize to read from the beginning of history
    if (offset == null) {
      offset = -1;
    }

    // Go through places data by chunks to spread out the load
    let query = "SELECT visit_count, rev_host, frecency, url, last_visit_date, title, id " +
                "FROM moz_places " +
                "WHERE rev_host IS NOT null AND visit_count > 0 AND hidden = 0 AND id > :offset " +
                "ORDER BY id " +
                "LIMIT 1000";

    var s1 = Date.now();
    let lastId;
    queryUtils.executeQuery("places", query, {offset: offset}, {
        onRow: function(row) {
          // Stop processing if we're stopping
          if (this.stopped) {
            return;
          }

          // Remember if we saw a place entry
          lastId = row.getResultByIndex(6);

          let domain = this.fixDomain(row.getResultByIndex(1).split("").reverse().join(""));
          if (!domain || domain == "") {
            return;
          }

          let placeData = {
            domain: domain,
            frecency: row.getResultByIndex(2),
            lastVisit: row.getResultByIndex(4),
            title: row.getResultByIndex(5),
            url: row.getResultByIndex(3),
            vcount: row.getResultByIndex(0)
          };

          this.historyPlaceProcessors.forEach(function(proc) {
            proc.consumeHistoryPlace(placeData);
          });

        }.bind(this),

        onCompletion: function(reason) {
          // Don't start a new query if we're stopping
          if (this.stopped) {
            return;
          }

          var s2 = Date.now();
          //console.log("sql exec", s2 - s1, lastId);

          // Continue reading history if we got any results
          if (lastId != null) {
            timers.setTimeout(function() {
              this.readPlaces(lastId);
            }.bind(this), 500);
          }

          this.flagCompletion();
        }.bind(this),

        onError: function(error) {
          console.log(error);
        }.bind(this),
     });
  },

  readForms: function() {
    let query = "select fieldname , value , timesUsed from moz_formhistory where fieldname like \"%dob%\" OR " +
                                                                    "fieldname like \"%birth%\" OR " +
                                                                    "fieldname like \"%gender%\" OR " +
                                                                    "fieldname like \"email\" OR " +
                                                                    "fieldname like \"%first%name%\"";

    queryUtils.executeQuery("form", query, null, {
        onRow: function(row) {
          let formData = {
            fieldname: row.getResultByIndex(0),
            value: row.getResultByIndex(1),
            timesUsed: row.getResultByIndex(2)
          };
          this.historyFormProcessors.forEach(function(proc) {
            proc.consumeHistoryForm(formData);
          });
        }.bind(this),

        onCompletion: function(reason) {
          this.flagCompletion();
        }.bind(this),

        onError: function(error) {
          console.log(error);
        }.bind(this),
    });

  },
}

exports.HistoryReader = HistoryReader;
