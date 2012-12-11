/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const file = require("file");
const timers = require("timers");
const {URL} = require("url");
const {data} = require("self");
const passwords = require("passwords");

const {Cc,Ci,Cm,Cr,Cu,components} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);

const {ItemJar} = require("ItemJar");
const {EventTrigger} = require("EventTrigger");
const {hostsToCats} = require("hostsToCats");

function BlekkoProcessor(firstNDomains) {
    this.hostMap = hostsToCats;
    this.mySites = {};
    this.cats = {};
    this.firstNDomains = firstNDomains || 1000;
    this.newSitesSeen = 0;
    this.eventTrigger = new EventTrigger();

    // we are always ready
    this.flagCompletion();
}

BlekkoProcessor.prototype = {

  isReady: function() { return this.eventTrigger.isReady(); } ,
  onReady: function(cb) { return this.eventTrigger.onReady(cb); } ,
  flagCompletion: function() { return this.eventTrigger.flagCompletion(); } ,

  matchCats: function(domain,siteUrl) {
    let cats = {};
    if(this.hostMap.simple[domain]) {
      this.hostMap.simple[domain].forEach(function(cat) {cats[cat]=1;});
    } else if(this.hostMap.complex[domain] && siteUrl) {
      // remove everything up to the path
      let url = new URL(siteUrl);
      let path = url.path;
      // process the matching rules
      this.hostMap.complex[domain].forEach(function(entry) {
        let match = entry[0];
        if(match.indexOf("*") != -1) { 
          let re = new RegExp(match);
          //console.log( domain + " " + "trying re " + path + " " + match );
          if(path.match(re)) {
            //console.log( domain + " " + "RE match " + path + " " + match );
            entry[1].forEach(function(cat) {cats[cat]=1;});
          }
        } else if(match.charAt(match.length - 1) == "/" ) {
          // match prefix
          if(path.indexOf(match) == 0) {
            entry[1].forEach(function(cat) {cats[cat]=1;});
            //console.log( domain + " " + "PREFIX match " + path + " " + match );
          }
        } else if(match == path) {
          entry[1].forEach(function(cat) {cats[cat]=1;});
          //console.log( domain + " " + "LITERAL match " + path + " " + match );
        }
      }.bind(this));
    }
    return cats;
  },

  consumeHistoryPlace: function(placeData) {

    let domain = placeData.domain;
    if(!domain || (!this.hostMap.simple[domain] && !this.hostMap.complex[domain])) return;

    if(!this.mySites[domain]) {
      this.mySites[domain] = {vcount: 0 , frecency: 0};
    }
    this.mySites[domain].vcount += placeData.vcount;
    this.mySites[domain].frecency += placeData.frecency;
    //console.log(JSON.stringify(placeData), placeData.url);
    this.mySites[domain]["cats"] = this.matchCats(domain,placeData.url); 
    this.newSitesSeen = 1;
  },

  analyzeHistory: function() {
    try {
      this.cats = {};
      // compute highest frecency sites
      let orderedSites = Object.keys(this.mySites).sort(function(a, b) {
        return this.mySites[b].frecency - this.mySites[a].frecency;
      }.bind(this));

      for (let index in orderedSites ) {
        if( index >= this.firstNDomains ) break;
        let domain = orderedSites[index];
        Object.keys(this.mySites[domain]["cats"]).forEach(function(cat) {
          if(!this.cats[cat]) {
             this.cats[cat] = { vcount: 0 , champs: new ItemJar(20) };
          }

          if(this.mySites[domain].frecency < 0) return;

          //let contrib = Math.log(1+this.mySites[domain].frecency);
          let contrib = (this.mySites[domain].frecency);
          this.cats[cat].vcount += contrib;
          this.cats[cat].champs.addItem({domain: domain, vcount: contrib}, contrib)

        }.bind(this));
      }

      //console.log(JSON.stringify(this.cats));
      this.newSitesSeen = 0;
     } catch( ex ) { console.log( "ERRR " + ex  ); }
  },

  getBlekkoCats: function() { 
    if(this.newSitesSeen) {
      this.analyzeHistory();
    }
    return this.cats; 
  }
}

exports.BlekkoProcessor = BlekkoProcessor;
