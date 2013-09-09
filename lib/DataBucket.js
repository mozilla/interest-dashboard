/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const timers = require("timers");
const {data} = require("self");
const {URL} = require("url");

const {Cc,Ci,Cm,Cr,Cu} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const kVisitSaved = "interest-visit-saved";

function DataBucket() {
  this.interests = {};
}

DataBucket.prototype = {

  init: function() {
    Services.obs.addObserver(this, kVisitSaved, false);
  },

  addInterest: function (host, visitDate, visitCount, namespace, interest) {
    if (!this.interests[namespace]) {
      this.interests[namespace] = {};
    }
    if (!this.interests[namespace][interest]) {
      this.interests[namespace][interest] = {};
    }
    if (!this.interests[namespace][interest][visitDate]) {
      this.interests[namespace][interest][visitDate] = {};
    }
    if (!this.interests[namespace][interest][visitDate][host]) {
      this.interests[namespace][interest][visitDate][host] = visitCount;
    }
  },

  observe: function I_observe(aSubject, aTopic, aData) {
    if (aTopic == kVisitSaved) {
      let {host, visitDate, visitCount, namespace, interests} = aSubject.wrappedJSObject;
      interests.forEach(interest => {
        this.addInterest(host, visitDate, visitCount, namespace, interest);
      });
    }
  },

}

exports.DataBucket = DataBucket;
