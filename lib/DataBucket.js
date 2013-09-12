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

  _addInterest: function (host, visitDate, visitCount, namespace, type, interest) {
    if (!this.interests[visitDate]) {
      this.interests[visitDate] = {};
    }
    if (!this.interests[visitDate][type]) {
      this.interests[visitDate][type] = {};
    }
    if (!this.interests[visitDate][type][namespace]) {
      this.interests[visitDate][type][namespace] = {};
    }
    if (!this.interests[visitDate][type][namespace][interest]) {
      this.interests[visitDate][type][namespace][interest] = {};
    }
    this.interests[visitDate][type][namespace][interest][host] = visitCount;
  },

  addInterestMessage: function(interestMessage) {
    let {host, visitDate, visitCount, namespace, results} = interestMessage;
    results.forEach(item => {
      let {type, interests} = item;
      interests.forEach(interest => {
        this._addInterest(host, visitDate, visitCount, namespace, type, interest);
      });
      // TODO add am _EMPTY interest for each type if the intrest list is empty
    });
  },

}

exports.DataBucket = DataBucket;
