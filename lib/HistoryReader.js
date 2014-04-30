/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {data} = require("sdk/self");
const {storage} = require("sdk/simple-storage");
const timers = require("sdk/timers");
const {URL} = require("sdk/url");

const {PlacesInterestsUtils} = require("PlacesInterestsUtils");
const {DateUtils} = require("DateUtils");
const {getPlacesHostForURI} = require("Utils");

const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const MS_PER_DAY = 86400000;

function HistoryReader(workers, dayBuffer, lastTimeStamp = 0) {
  this._workers = workers;
  this._ResubmitRecentHistoryLastTimeStamp = lastTimeStamp;
  this._dayBuffer = dayBuffer;
  this._tldCounter = {};
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
      // save classification results in _workersData array untill all have responded
      this._workersData.push(aData);
      // and check if this is the last interest in the resubmit bunch
      if (aData.messageId == "resubmit") {
        // decrement url count and check if we have seen them all
        this._ResubmitRecentHistoryUrlCount--;
        if (this._ResubmitRecentHistoryUrlCount == 0) {
          // now that all of the calsification results have been received
          // add these results to the day buffer and persist lastTimeStamp
          this._ResubmitRecentHistoryLastTimeStamp = this._chunkLastTimeStamp;
          this._workersData.forEach(data => {
            this._dayBuffer.addInterestMessage(data, this._urlCollector[data.url]["dates"]);
          });
          // spill tldCounter into storage
          if (storage.tldCounter == null) {
            storage.tldCounter = this._tldCounter;
          } else {
            Object.keys(this._tldCounter).forEach(pubSufix => {
              if (storage.tldCounter[pubSufix] == null) {
                storage.tldCounter[pubSufix] = {};
              }
              Object.keys(this._tldCounter[pubSufix]).forEach(domain => {
                storage.tldCounter[pubSufix][domain] = 1;
              });
            });
          }
          // clean unneeded _urlCollector and _workersData
          this._workersData = [];
          this._urlCollector = [];
          this._tldCounter = {};
          // tell dayBuffer to push interests
          this._dayBuffer.pushInterests();
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
      }
    }.bind(this));
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
    this._ResubmitRecentHistoryUrlCount = 0;
    this._urlCollector = {};
    this._workersData = [];
    this._tldCounter = {};
    this._chunkLastTimeStamp = this._ResubmitRecentHistoryLastTimeStamp;

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
          this._urlCollector[url].message.message = "getInterestsForDocument";
          this._urlCollector[url].message.url = url;
          this._urlCollector[url].message.title = item.title;
          this._urlCollector[url].message.host = host;
          this._urlCollector[url].message.path = uri["path"];
          this._urlCollector[url].message.tld = this._getBaseDomain(host);
          this._urlCollector[url].message.metaData = {};
          this._urlCollector[url].message.language = "en";
          this._urlCollector[url].message.messageId = "resubmit";
          // this is needed for tld counting
          this._urlCollector[url].publicSuffix = this._getPublicSuffix(host);
        }
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
        let tld = this._urlCollector[url].message.tld;
        if (tld == "") {
          // empty TLD indicates a one-word host (e.g. localhost)
          pubSuffix = "no-suffix";
          tld = this._urlCollector[url].message.host;
        }
        if (pubSuffix != null) {
          if (this._tldCounter[pubSuffix] == null) {
            this._tldCounter[pubSuffix] = {};
          }
          this._tldCounter[pubSuffix][tld] = 1;
        }
        // call history visitor
        if (this._historyVisitor) {
          this._historyVisitor.consumeHistoryVisit(item, this._urlCollector[url].message);
        }
      }
      catch(ex) {
        console.log(ex + " ERROR\n");
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
          this._ResubmitRecentHistoryUrlCount += this._workers.length;
          this._workers.forEach(worker => {
            this._callMatchingWorker(worker,this._urlCollector[url].message);
          });
        });
      }
    }).then(() => {
       // check if _ResubmitRecentHistoryDeferred exists and url count == 0
       // then if the history returns nothing for the this query, we can resolve
       // the resubmit promise
       if (this._ResubmitRecentHistoryDeferred && this._ResubmitRecentHistoryUrlCount == 0) {
         this._resolveResubmitHistoryPromise();
       }
    }); // end of getRecentHistory
  },

  _resolveResubmitHistoryPromise: function I__resolveResubmitHistoryPromise() {
    if (this._ResubmitRecentHistoryDeferred != null) {
      let thePromise = this._ResubmitRecentHistoryDeferred;
      this._ResubmitRecentHistoryDeferred = null;
      this._urlCollector = null;
      this._workers.forEach(worker => {
        worker.removeEventListener("message", this);
        worker.removeEventListener("error", this);
      });
      thePromise.resolve(this._dayBuffer.getInterests());
    }
  },

  _getBaseDomain: function I__getBaseDomain(host) {
    try {
      return Services.eTLD.getBaseDomainFromHost(host);
    }
    catch (ex) {
      switch (ex.result) {
        case Cr.NS_ERROR_HOST_IS_IP_ADDRESS:
          return host;
          break;
      }
      return "";
    }
  },

  _getPublicSuffix: function I__getPublicSuffix(host) {
    try {
      return Services.eTLD.getPublicSuffixFromHost(host);
    }
    catch (ex) {
      switch (ex.result) {
        case Cr.NS_ERROR_HOST_IS_IP_ADDRESS:
          return "is-ip";
          break;
      }
      return null;
    }
  },

  _convertDateToDays: function IS__convertDateToDays(time=null) {
    // Default to today and truncate to an integer number of days
    return Math.floor((time || Date.now()) / MS_PER_DAY);
  },

}

exports.HistoryReader = HistoryReader;

exports.getTLDCounts = function() {
  let returnObject = {};
  if (storage.tldCounter != null) {
    Object.keys(storage.tldCounter).forEach(pubSuffix => {
      returnObject[pubSuffix] = Object.keys(storage.tldCounter[pubSuffix]).length;
    });
  }
  return returnObject;
}
