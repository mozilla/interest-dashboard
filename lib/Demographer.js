/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const timers = require("timers");
const {data} = require("self");
const {URL} = require("url");
//const {hostsToCats} = require("hostsToCats");

const {Cc,Ci,Cm,Cr,Cu,components} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
const {Worker} = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;

const queryUtils = require("QueryUtils");
const {EventTrigger} = require("EventTrigger");
const {WorkerProcessor} = require("WorkerProcessor");

function Demographer() {
  this.historyProcessors = [];
  this.eventTrigger = new EventTrigger();

  // create processors
  this.dProc = new WorkerProcessor(data.url("loadDemographicProcessor.js"));
  this.addHistoryProcessor(this.dProc);

  this.bProc = new WorkerProcessor(data.url("loadCategoryProcessor.js"));
  this.addHistoryProcessor(this.bProc);

  this.rProc = new WorkerProcessor(data.url("loadRulesProcessor.js"));
  this.addHistoryProcessor(this.rProc);

  this.historyRead = 0;
  this.readHistory();
}

Demographer.prototype = {

  getDemographics: function(callBack) {
    this.onReady(function() {
      this.dProc.requestData(function(demog) {
        callBack(demog);
      });
    }.bind(this));
  },

  getCategories: function(callBack) {
    this.onReady(function() {
      this.bProc.requestData(function(cats) {
        callBack(cats);
      });
    }.bind(this));
  },

  getRules: function(callBack) {
    this.onReady(function() {
      this.rProc.requestData(function(rules) {
        callBack(rules);
      });
    }.bind(this));
  },

  addHistoryProcessor: function(processor) {
    this.historyProcessors.push(processor);
  },

  onReady: function(cb) { return this.eventTrigger.onReady(cb); } ,
  flagCompletion: function() { return this.eventTrigger.flagCompletion(); } ,

  consumeOnePageVisit: function(pageUrl, pageTitle) {
    let url = new URL(pageUrl);
    let placeData = {
      vcount: 1,
      frecency: 100,
      url: pageUrl ,
      lastVisit: Date.now() * 1000,
      title: pageTitle,
      domain: this.fixDomain(url.host)
    };

    if(!placeData.domain || placeData.domain == "") { return; }

    this.historyProcessors.forEach(function(proc) {
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

  readHistory: function(offset) {
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
          // Remember if we saw a place entry
          lastId = row.getResultByIndex(6);

          let placeData = {
            vcount: row.getResultByIndex(0),
            frecency: row.getResultByIndex(2),
            url: row.getResultByIndex(3),
            lastVisit: row.getResultByIndex(4),
            title: row.getResultByIndex(5),
            domain: ""
          };

          let domain = this.fixDomain(row.getResultByIndex(1).split("").reverse().join(""));

          if (!domain || domain == "") {
            return;
          }

          placeData.domain = domain;

          this.historyProcessors.forEach(function(proc) {
            proc.consumeHistoryPlace(placeData);
          });

        }.bind(this),

        onCompletion: function(reason) {
          var s2 = Date.now();
          //console.log("sql exec", s2 - s1, lastId);

          // Continue reading history if we got any results
          if (lastId != null) {
            timers.setTimeout(function() {
              this.readHistory(lastId);
            }.bind(this), 500);
          }

          this.historyRead = 1;
          this.flagCompletion();
        }.bind(this),

        onError: function(error) {
          console.log(error);
        }.bind(this),
     });
  },
}

exports.Demographer = Demographer;
