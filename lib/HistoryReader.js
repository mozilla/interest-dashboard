/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const timers = require("timers");
const {data} = require("self");
const {URL} = require("url");
const {PlacesInterestsUtils} = require("PlacesInterestsUtils");
const {DataBucket} = require("DataBucket");
const {DateUtils} = require("DateUtils");

const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const MS_PER_DAY = 86400000;

function HistoryReader(workers, lastVisitID = 0) {
  this.stopped = false;
  this._workers = workers;
  this._ResubmitRecentHistoryLargestId = lastVisitID;
  this.dataBucket = new DataBucket();
  this._init();
}

HistoryReader.prototype = {

  stop: function() {
    this.stopped = true;
  },

  resubmitHistory: function(options = {}) {
    let startDay = options.startDay || (DateUtils.today() - 120);
    let endDay = options.endDay || (DateUtils.today() + 1);;
    let chunkSize = options.chunkSize || 1000;
    return this._resubmitRecentHistory(startDay, endDay, chunkSize);
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsIDOMEventListener

  handleEvent: function(aEvent) {
    let eventType = aEvent.type;
    if (eventType == "message") {
      let msgData = aEvent.data;
      if (msgData.message == "InterestsForDocument") {
        this._handleInterestsResults(msgData);
      }
    }
    else if (eventType == "error") {
      //TODO:handle error
      Cu.reportError(aEvent.message);
    }
  },

  //////////////////////////////////////////////////////////////////////////////
  //// Helpers

  _init: function() {
    this._workers.forEach(worker => {
      worker.addEventListener("message", this, false);
      worker.addEventListener("error", this, false);
    });
  },

  _callMatchingWorker: function I__callMatchingWorker(worker,callObject) {
    worker.postMessage(callObject);
  },

  _handleInterestsResults: function I__handleInterestsResults(aData) {
      // generate "interest-visit-saved" event
    Task.spawn(function() {
      // tell the world we have added this interest
      Services.obs.notifyObservers({wrappedJSObject: aData},
                                   "interest-visit-saved",
                                   null);
      // add this to databucket 
      this.dataBucket.addInterestMessage(aData);

      // and check if this is the last interest in the resubmit bunch
      if (aData.messageId == "resubmit") {
        // decerement url count and check if we have seen them all
        this._ResubmitRecentHistoryUrlCount--;
        if (this._ResubmitRecentHistoryUrlCount == 0) {
          // one chunked resubmission is finished - start another
          timers.setTimeout(() => {this._resubmitRecentHistoryChunk();},0);
        }
      }
    }.bind(this));
  },

  _resubmitRecentHistory: function I__resubmitRecentHistory(startDay, endDay, chunkSize = 1000) {
      // check if history is in progress
      if (this._ResubmitRecentHistoryDeferred) {
        return this._ResubmitRecentHistoryDeferred.promise;
      }
      this._ResubmitRecentHistoryDeferred = Promise.defer();
      this._ResubmitRecentHistoryStartDay = startDay;
      this._ResubmitRecentHistoryEndDay = endDay;
      this._ResubmitRecentHistoryChunkSize = chunkSize;
      // spawn a Task to resubmit history
      Task.spawn(function() {
        // run the first chunk of history resubmission
        yield this._resubmitRecentHistoryChunk();
      }.bind(this));  // end of Task.spawn
      return this._ResubmitRecentHistoryDeferred.promise;
  },

  _resubmitRecentHistoryChunk: function I__ResubmitRecentHistoryChunk() {
    // clear out url count
    this._ResubmitRecentHistoryUrlCount = 0;
    // read moz_places data and message it to the worker
    return PlacesInterestsUtils.getRecentHistory(this._ResubmitRecentHistoryStartDay, item => {
      try {
        let uri = NetUtil.newURI(item.url);
        item["message"] = "getInterestsForDocument";
        item["host"] = this._getPlacesHostForURI(uri);
        item["path"] = uri["path"];
        item["tld"] = this._getBaseDomain(item["host"]);
        item["metaData"] = {};
        item["language"] = "en";
        item["messageId"] = "resubmit";
        item["visitDate"] = this._convertDateToDays(item["visitDate"]);
        this._ResubmitRecentHistoryUrlCount += this._workers.length;
        this._workers.forEach(worker => {
          this._callMatchingWorker(worker,item);
        });
        // keep track of the largest Id for this resubmission chunk
        if (this._ResubmitRecentHistoryLargestId < item["id"]) {
          this._ResubmitRecentHistoryLargestId = item["id"];
        }
      }
      catch(ex) {
        console.log(ex + " ERROR\n");
      }
    },
    {
      chunkSize: this._ResubmitRecentHistoryChunkSize,
      lastPlacesId: this._ResubmitRecentHistoryLargestId,
      endDay: this._ResubmitRecentHistoryEndDay,
    }).then(() => {
       // check if _ResubmitRecentHistoryDeferred exists and url count == 0
       // then if the history returns nothing for the this query, we can resolve
       // the resubmit promise
       if (this._ResubmitRecentHistoryDeferred && this._ResubmitRecentHistoryUrlCount == 0) {
         this._resolveResubmitHistoryPromise();
       }
       // issue en event that history resubmission is done
      Services.obs.notifyObservers({wrappedJSObject: this.dataBucket.interests},
                                   "interest-history-submission-complete",
                                   null);
    }); // end of getRecentHistory
  },

  _resolveResubmitHistoryPromise: function I__resolveResubmitHistoryPromise() {
    if (this._ResubmitRecentHistoryDeferred != null) {
      this._ResubmitRecentHistoryDeferred.resolve(this.dataBucket.interests);
      this._ResubmitRecentHistoryDeferred = null;
    }
  },
  _normalizeHostName: function I__normalizeHostName(host) {
     return host.replace(/^www\./, "");
  },

  _getPlacesHostForURI: function I__getPlacesHostForURI(uri) {
    try {
      return this._normalizeHostName(uri.host);
    }
    catch(ex) {}
    return "";
  },

  _getBaseDomain: function I__getBaseDomain(host) {
    try {
      return Services.eTLD.getBaseDomainFromHost(host);
    }
    catch (ex) {
      return "";
    }
  },

  _convertDateToDays: function IS__convertDateToDays(time=null) {
    // Default to today and truncate to an integer number of days
    return Math.floor((time || Date.now()) / MS_PER_DAY);
  },

}

exports.HistoryReader = HistoryReader;
