/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const file = require("file");
const timers = require("timers");
const {data} = require("self");
const passwords = require("passwords");

const {Cc,Ci,Cm,Cr,Cu,components} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
const {sitesDemographics} = require("sitesDemographicsGenerated");
const {ItemJar} = require("ItemJar");
const {EventTrigger} = require("EventTrigger");

const demogBuckets = [
  "age_18",    // 0 
  "age_25",    // 1 
  "age_35",    // 2 
  "age_45",    // 3 
  "age_55",    // 4 
  "age_65",    // 5 
  "no_college",      // 6 
  "some_college",    // 7 
  "college",         // 8 
  "graduate",        // 9 
  "male",            // 10 
  "female",          // 11
  "children",        // 12
  "no_children"      // 13
];

function DemographicProcessor(firstNDomains) {
    this.sitesDemographics = sitesDemographics;
    this.mySites = {};
    this.demog = {};
    this.firstNDomains = firstNDomains || 200;
    this.newSitesSeen = 0;

    this.eventTrigger = new EventTrigger();
    // we are always ready
    this.flagCompletion();
}

DemographicProcessor.prototype = {

  isReady: function() { return this.eventTrigger.isReady(); } ,
  onReady: function(cb) { return this.eventTrigger.onReady(cb); } ,
  flagCompletion: function() { return this.eventTrigger.flagCompletion(); } ,

  extractDomain: function(domain) {

    // attempt to go to the root domain, keep the lastDomain
    // so that we never ran into endless loop if regex does not replace
    // anything.  Hence, regex failes on strings starting with '.'
    let lastDomain = domain;
    let siteData = this.sitesDemographics[domain];
    while (!siteData) {
      domain = domain.replace(/^[^.]+[.]/, "");
      if (domain == lastDomain || domain.length <= 1 || domain.indexOf(".") < 0) {
        domain = null;
        // no need to go further
        break;
      }
      siteData = this.sitesDemographics[domain];
    }
    if(!siteData) return null;
    if (domain.charAt(0) == '.') {
        domain = domain.slice(1);
    }
    return domain;
  }, 

  computeBuketDrop: function(siteData,index) {
    if( index >= 0 && index <= 6 ) {  // age bukets
      if( siteData["dValues"][index] == 0 ) return 0; 
      // sign of Ds algorithm for all Ds
      return (siteData["dValues"][index]>0) ? 1 : -1;
    }
    else if(index >= 10 && index <= 11) {
      if( siteData["dValues"][index] < 40 ) return 0;
      // otherwise return 1
      return 1;
    }
    else {
      // everything else - use sign of Ds for D > 10
      if( siteData["dValues"][index] < 10 && siteData["dValues"][index] > -10 )  return 0;
      return (siteData["dValues"][index] > 0 ) ? 1 : -1;
    }
  },

  consumeHistoryPlace: function(placeData) {

    let domain = this.extractDomain(placeData.domain);
    if(!domain) return;

    if(!this.mySites[domain]) {
      this.mySites[domain] = { vcount: 0 , frecency: 0 };
    }
    this.mySites[domain].vcount += placeData.vcount;
    this.mySites[domain].frecency += placeData.frecency;
    this.newSitesSeen = 1;
  },

  analyzeHistory: function() {
    try {
      this.demog = {};
      // compute highest frecency sites
      let orderedSites = Object.keys(this.mySites).sort(function(a, b) {
        return this.mySites[b].frecency - this.mySites[a].frecency;
      }.bind(this));

      for (let index in orderedSites ) {
        if( index >= this.firstNDomains ) break;
        let domain = orderedSites[index];
        let siteData = this.sitesDemographics[domain];
        if (siteData) {
          // so we have demographics data - add it to bukets
          for (let x in demogBuckets) {
            let buketName = demogBuckets[x];
            let bucketDrop  = this.computeBuketDrop(siteData,x);
            if(!this.demog[buketName]) {
              this.demog[buketName] = {vtotal: 0, positive: [], negative: []};
            }
            this.demog[buketName].vtotal += bucketDrop;
            if( bucketDrop > 0 ) this.demog[buketName].positive.push(domain);
            else if(bucketDrop < 0) this.demog[buketName].negative.push(domain);
          }
        } // end of siteData exists
      } // and of sites walk
      this.newSitesSeen = 0;
     } catch( ex ) { console.log( "ERRR " + ex  ); }
  },

  getDemographicBukets: function() { 
    if(this.newSitesSeen) {
      this.analyzeHistory();
    }
    return this.demog;
  }

}

exports.DemographicProcessor = DemographicProcessor;
