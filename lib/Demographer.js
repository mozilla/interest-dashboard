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

const queryUtils = require("QueryUtils");
const {EventTrigger} = require("EventTrigger");
const {DemographicProcessor} = require("DemographicProcessor");
const {BlekkoProcessor} = require("BlekkoProcessor");

function Demographer() {
  this.historyProcessors = [];
  this.eventTrigger = new EventTrigger();

  // create processors
  this.dProc = new DemographicProcessor();
  this.addHistoryProcessor(this.dProc);

  this.bProc = new BlekkoProcessor();
  this.addHistoryProcessor(this.bProc);

  this.historyRead = 0;
  this.readHistory();
}

Demographer.prototype = {

  getDemographics: function() {
    return this.dProc.getDemographicBukets();
  },

  getCategories: function() {
    return this.bProc.getBlekkoCats();
  },

  addHistoryProcessor: function(processor) {
    processor.onReady(function() {
      this.testCompletion();
    }.bind(this));
    this.historyProcessors.push(processor);
  },

  isReady: function() { return this.eventTrigger.isReady(); } ,
  onReady: function(cb) { return this.eventTrigger.onReady(cb); } ,
  flagCompletion: function() { return this.eventTrigger.flagCompletion(); } ,

  testCompletion: function() {
    for (let x in this.historyProcessors) {
      if(!this.historyProcessors[x].isReady()) {
         return;
      }
    }
    if(this.historyRead) {
      this.flagCompletion();
    }
  },

  consumeOnePageVisit: function(pageUrl) {
    let url = new URL(pageUrl);
    let placeData = {
      vcount: 1,
      frecency: 100,
      url: pageUrl ,
      last_date: Date.now() ,
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

  readHistory: function(cb) {
    let query = " select p.visit_count , p.rev_host, p.frecency , p.url , p.last_visit_date from moz_places p " +
                " where rev_host is not null and visit_count > 0";

    var s1 = Date.now();
    queryUtils.executeQuery("places",query, null, {
        onRow: function(row) {
          let placeData = {
            vcount: row.getResultByIndex(0),
            frecency: row.getResultByIndex(2),
            url: row.getResultByIndex(3),
            last_date: row.getResultByIndex(4),
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
          console.log("sql exec", s2 - s1);
          this.historyProcessors.forEach(function(proc) {
            console.log("colling anal");
            proc.analyzeHistory();
          });

          this.historyRead = 1;
          this.testCompletion();
        }.bind(this),

        onError: function(error) {
          console.log(error);
        }.bind(this),
     });
  },
}

exports.Demographer = Demographer;
