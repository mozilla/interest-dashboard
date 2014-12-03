/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 expandtab
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const simplePrefs = require("sdk/simple-prefs")
const {storage} = require("sdk/simple-storage");
const timers = require("sdk/timers");
const {Taxonomy} = require("./IAB_Taxonomy");

const kNewsFeedUpdate = "news-feed-update";
const kIABUpdate = "iab-update";

let IAB_Collector = {

  init: function() {
    if (!storage.iab) {
      storage.iab = {};
      this.iab = storage.iab;
      this.processTaxonomy();
    }
    this.taxonomy = Taxonomy;
    this.iab = storage.iab;
    Services.obs.addObserver(this, kNewsFeedUpdate, false);
  },

  processTaxonomy: function() {
    let self = this;
    Object.keys(Taxonomy).forEach(function(key) {
      self.iab[key] = {
        count: 0,
        docs: [],
      };
      Object.keys(Taxonomy[key]).forEach(function(subKey) {
        self.iab[subKey] = {
          count: 0,
          docs: [],
        }
      });
    });
  },

  clear: function() {
    delete storage.iab;
  },

  clearAll: function() {
    this.processTaxonomy();
    Services.obs.notifyObservers(null, kIABUpdate, null);
  },

  clearSite: function(site) {
    // we need to search for docs for the deleted site
    //delete this.iabCollector.sites[site];
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic == kNewsFeedUpdate) {
      aSubject = aSubject.wrappedJSObject;
      this.consumeUpdate(aSubject);
    }
  },

  consumeUpdate: function(data) {
    let {site, docs} = data;
    console.debug("Consuming: ", site, docs.length);
    // consume documents
    let updated = false;
    for (let j in docs) {
      let doc = docs[j];
      // rankSiteDocument must return {rank: numericalRank, reason: {arbitrary object}}
      if (doc.iab && doc.iab.length > 0) {
        // insert document into iab object
        let docEntry = {
            url: doc.url,
            title: doc.title,
            published: doc.harvested * 1000,
            publishedDate: new Date(doc.harvested * 1000),
            summary: doc.content.substring(0, 600),
            image: doc.image,
            iab: doc.iab,
            site: site,
            rank: Math.round(Math.random()*100),
        };
        // walk over iab cats
        doc.iab.forEach(cat => {
          this.iab[cat].count++;
          this.iab[cat].docs.push(docEntry);
          if (this.iab[cat].docs.length > simplePrefs.prefs.maxCatDocs) {
            this.iab[cat].docs.pop();
          }
        });
        updated = true;
      } // end of non-empty rank
    } // end of docs loop
    if (updated) {
      Services.obs.notifyObservers(null, kIABUpdate, null);
    }
  },

  getData: function() {
    return {
      taxonomy: this.taxonomy,
      iab: this.iab,
    };
  },
};



exports.IAB_Collector = IAB_Collector;
