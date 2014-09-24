/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {data} = require("sdk/self");
const {storage} = require("sdk/simple-storage");
const timers = require("sdk/timers");
const {URL} = require("sdk/url");

const {PlacesInterestsUtils} = require("PlacesInterestsUtils");
const {DateUtils} = require("DateUtils");
const {getPlacesHostForURI, getBaseDomain, getPublicSuffix} = require("Utils");

const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const MS_PER_DAY = 86400000;

function HistoryReader(workers, streamObjects, lastTimeStamp = 0, storageBackend) {
  this._workers = workers;
  this._ResubmitRecentHistoryLastTimeStamp = lastTimeStamp;
  this._streamObjects = streamObjects;
  this._tldCounter = {};
  this.storage = storageBackend || storage;
  this._init();
}

HistoryReader.prototype = {

  // the stopping logic bellow:
  // 1. set the stop flag and cancel places query
  // 2. if we are reading places:
  //    - places query is canceled
  //    - collected urls data and last timestamp are ignored
  // 3. if we are categorizing:
  //    - classification data and last timestamp are ignored
  // 4. if we are waiting for timeout to start next chunk
  //    - timeout is canceled
  // 5. If HistoryPromise exists it is resolved
  stop: function() {
    this._stop = true;
    // cancel any pending database reads
    PlacesInterestsUtils.stop();
    if (this._ResubmitRecentHistoryDeferred) {
      // the promise exists - we processing history
      // clear the next-chunk-timer
      if (this._chunkedTimeoutID != null) {
        timers.clearTimeout(this._chunkedTimeoutID);
      }
      // and resolve the promise
      this._resolveResubmitHistoryPromise();
    }
  },

  resubmitHistory: function(options = {}) {
    // return rigth away if aready stopped
    if (this._stop) {
      return null;
    }
    // make sure that PlacesInterestsUtils are functional
    if (PlacesInterestsUtils.isStopped()) {
      PlacesInterestsUtils.restart();
    }

    // initialize history visitor
    this._historyVisitor = options.historyVisitor;
    let startDay = options.startDay || (DateUtils.today() - 120);
    let chunkSize = options.chunkSize || 100;
    return this._resubmitRecentHistory(startDay, chunkSize);
  },

  getLastTimeStamp: function() {
    return this._ResubmitRecentHistoryLastTimeStamp;
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsIDOMEventListener

  handleEvent: function(aEvent) {
    let eventType = aEvent.type;
    if (eventType == "message") {
      let msgData = aEvent.data;

      if (msgData.messageId == "resubmit") {
        if (msgData.message == "InterestsForDocument") {
          this._handleInterestsResults(msgData);
        }
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
    for (let workerType in this._workers) {
      this._workers[workerType].forEach(worker => {
        worker.addEventListener("message", this, false);
        worker.addEventListener("error", this, false);
      });
    }
  },

  _handleInterestsResults: function I__handleInterestsResults(aData) {
    if (aData.messageId == "resubmit") {
      // save classification results in _interestsWorkersData array untill all have responded
      this._interestsWorkersData.push(aData);
      // decrement url count and check if we have seen them all
      this._ResubmitRecentHistoryUrlCount.interests--;
      if (this._ResubmitRecentHistoryUrlCount.interests == 0) {

        let interestData = [];
        this._interestsWorkersData.forEach(data => {
          interestData.push({details: data, dateVisits: this._urlCollector[data.url]["dates"]});
        });
        this._streamObjects.stream.push("interest", interestData)
        this._interestsWorkersDeferred.resolve();
      }
    }
  },

  _resubmitRecentHistory: function I__resubmitRecentHistory(startDay, chunkSize = 1000) {
      // check if history is in progress
      if (this._ResubmitRecentHistoryDeferred != null) {
        return this._ResubmitRecentHistoryDeferred.promise;
      }
      this._ResubmitRecentHistoryDeferred = Promise.defer();
      this._ResubmitRecentHistoryStartDay = startDay;
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
    this._ResubmitRecentHistoryUrlCount = {interests: 0};
    this._urlCollector = {};
    this._interestsWorkersData = [];
    this._tldCounter = {};
    this._chunkLastTimeStamp = this._ResubmitRecentHistoryLastTimeStamp;
    this._interestsWorkersDeferred = Promise.defer();

    Promise.all([this._interestsWorkersDeferred.promise]).then(() => {
      try {
        // now that all of the worker results have been received, persist lastTimeStamp
        this._ResubmitRecentHistoryLastTimeStamp = this._chunkLastTimeStamp;

        // spill tldCounter into storage
        if (this.storage.tldCounter == null) {
          this.storage.tldCounter = this._tldCounter;
        }
        else {
          Object.keys(this._tldCounter).forEach(pubSufix => {
            if (this.storage.tldCounter[pubSufix] == null) {
              this.storage.tldCounter[pubSufix] = {};
            }
            Object.keys(this._tldCounter[pubSufix]).forEach(domain => {
              this.storage.tldCounter[pubSufix][domain] = 1;
            });
          });
        }

        // clean unneeded _urlCollector and _*WorkersData
        this._interestsWorkersData = [];
        this._urlCollector = [];
        this._tldCounter = {};
        this._interestsWorkersDeferred = Promise.defer();
        // start another chunked resubmission or close the doors
        if (!this._stop) {
          // store the rimeout ID to cancel it on stop call
          this._chunkedTimeoutID = timers.setTimeout(() => {
            this._chunkedTimeoutID = null;
            this._resubmitRecentHistoryChunk();
          },100);
        }
        else {
          // we are stopping => resolve the promise
          this._resolveResubmitHistoryPromise();
        }
      }
      catch(ex) {
        console.error(ex);
      }
    });


    // read moz_places data and accumulate data in this._urlCollector
    // if the query gets canceled, we fall into the first then()
    // and check for _stop flag (which will be set), so we fall
    // through to second then() and close the factory
    return PlacesInterestsUtils.getRecentHistory(this._ResubmitRecentHistoryStartDay, item => {
      try {
        // populate url collector
        let url = item.url;
        if (this._urlCollector[url] == null) {
          let uri = NetUtil.newURI(url);
          let host = getPlacesHostForURI(uri);
          this._urlCollector[url] = {};
          this._urlCollector[url].message = {};
          this._urlCollector[url].dates = {};
          this._urlCollector[url].message.url = url;
          this._urlCollector[url].message.title = item.title;
          this._urlCollector[url].message.visitIDs = {};
          this._urlCollector[url].message.host = host;
          this._urlCollector[url].message.path = uri["path"];
          this._urlCollector[url].message.baseDomain = getBaseDomain(host);
          this._urlCollector[url].message.messageId = "resubmit";
          // this is needed for tld counting
          this._urlCollector[url].publicSuffix = getPublicSuffix(host);
        }
        if (this._urlCollector[url].message.visitIDs[item.visitDate] == null) {
          this._urlCollector[url].message.visitIDs[item.visitDate] = [];
        }
        this._urlCollector[url].message.visitIDs[item.visitDate].push(item.timeStamp);

        // accumualte visists per day
        if (this._urlCollector[url]["dates"][item.visitDate] == null) {
          this._urlCollector[url]["dates"][item.visitDate] = 0;
        }
        this._urlCollector[url]["dates"][item.visitDate] ++;
        // store largest time stamp
        if (this._chunkLastTimeStamp < item.timeStamp) {
          this._chunkLastTimeStamp = item.timeStamp;
        }
        // update tldCounter
        let pubSuffix = this._urlCollector[url].publicSuffix;
        let baseDomain = this._urlCollector[url].message.baseDomain;
        if (baseDomain == "") {
          // empty TLD indicates a one-word host (e.g. localhost)
          pubSuffix = "no-suffix";
          baseDomain = this._urlCollector[url].message.host;
        }
        if (pubSuffix != null) {
          if (this._tldCounter[pubSuffix] == null) {
            this._tldCounter[pubSuffix] = {};
          }
          this._tldCounter[pubSuffix][baseDomain] = 1;
        }
        // call history visitor
        if (this._historyVisitor) {
          this._historyVisitor.consumeHistoryVisit(item, this._urlCollector[url].message);
        }
      }
      catch(ex) {
        console.error(ex);
      }
    },
    {
      chunkSize: this._ResubmitRecentHistoryChunkSize,
      lastTimeStamp: this._ResubmitRecentHistoryLastTimeStamp,
    }).then(() => {
      // if not stopped, send the collected url data to workers
      // otherwise fall through to next then() without submitting
      // collected url data to the workers. The url count in this case
      // is 0 and we will resolve the promise and close processing
      if (!this._stop) {
        Object.keys(this._urlCollector).forEach(url => {
          this._ResubmitRecentHistoryUrlCount.interests += this._workers.interests.length;
          this._workers.interests.forEach(worker => {
            worker.postMessage({
              payload: this._urlCollector[url].message,
              command: "getInterestsForDocument",
            });
          });
        });
      }
    }).then(() => {
       // check if _ResubmitRecentHistoryDeferred exists and url count == 0
       // then if the history returns nothing for the this query, we can resolve
       // the resubmit promise
       if (this._ResubmitRecentHistoryDeferred && this._ResubmitRecentHistoryUrlCount.interests == 0) {
         this._resolveResubmitHistoryPromise();
       }
    }); // end of getRecentHistory
  },

  _resolveResubmitHistoryPromise: function I__resolveResubmitHistoryPromise() {
    if (this._ResubmitRecentHistoryDeferred != null) {
      let thePromise = this._ResubmitRecentHistoryDeferred;
      this._ResubmitRecentHistoryDeferred = null;
      this._urlCollector = null;
      for (let workerType in this._workers) {
        this._workers[workerType].forEach(worker => {
          worker.removeEventListener("message", this);
          worker.removeEventListener("error", this);
        });
      }
      thePromise.resolve();
    }
  },

  _convertDateToDays: function IS__convertDateToDays(time=null) {
    // Default to today and truncate to an integer number of days
    return Math.floor((time || Date.now()) / MS_PER_DAY);
  },

}

exports.HistoryReader = HistoryReader;

exports.getTLDCounts = function(storage) {
  let returnObject = {};
  if (storage.tldCounter != null) {
    Object.keys(storage.tldCounter).forEach(pubSuffix => {
      returnObject[pubSuffix] = Object.keys(storage.tldCounter[pubSuffix]).length;
    });
  }
  return returnObject;
}
