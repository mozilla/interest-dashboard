/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const timers = require("timers");
const {data} = require("self");
const {URL} = require("url");
const {PlacesInterestsUtils} = require("PlacesInterestsUtils");
const {DateUtils} = require("DateUtils");

const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const MS_PER_DAY = 86400000;

function HistoryReader(workers, dayBuffer, lastVisitID = 0) {
  this._workers = workers;
  this._ResubmitRecentHistoryLargestId = lastVisitID;
  this._dayBuffer = dayBuffer;
  this._init();
}

HistoryReader.prototype = {

  // the stopping logic bellow:
  // 1. set the stop flag and cancel places query
  // 2. if we are reading places:
  //    - places query is canceled
  //    - collected urls data is ignored
  //    - the state prior to the chunk read is reatined
  // 3. if we are categorizing:
  //    - workers are allowed to finish
  //    - then promise is resolved
  // 4. if we are waiting for timeout to start next chunk
  //    - timeout is canceled
  //    - promise is resolved without going to chunk read
  stop: function() {
    this._stop = true;
    // cancel any pending database reads
    PlacesInterestsUtils.stop();
    if (this._ResubmitRecentHistoryDeferred) {
      // the promise exists - we processing history
      // check if the next-chunk-timer has been set
      // if so, cancel the time and resolve the promise
      if (this._chunkedTimeoutID != null) {
        timers.clearTimeout(this._chunkedTimeoutID);
        this._resolveResubmitHistoryPromise();
      }
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

    let startDay = options.startDay || (DateUtils.today() - 120);
    let chunkSize = options.chunkSize || 100;
    return this._resubmitRecentHistory(startDay, chunkSize);
  },

  getLastVisitId: function() {
    return this._ResubmitRecentHistoryLargestId;
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
      // add classification results and visit count to databucket
      this._dayBuffer.addInterestMessage(aData, this._urlCollector[aData.url]["dates"]);
      // and check if this is the last interest in the resubmit bunch
      if (aData.messageId == "resubmit") {
        // decerement url count and check if we have seen them all
        this._ResubmitRecentHistoryUrlCount--;
        if (this._ResubmitRecentHistoryUrlCount == 0) {
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
    this._chunkLargestVisitId = this._ResubmitRecentHistoryLargestId;

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
          let host = this._getPlacesHostForURI(uri);
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
        }
        // accumualte visists per day
        if (this._urlCollector[url]["dates"][item.visitDate] == null) {
          this._urlCollector[url]["dates"][item.visitDate] = 0;
        }
        this._urlCollector[url]["dates"][item.visitDate] ++;
        // store largest visit ID
        if (this._chunkLargestVisitId < item.id) {
          this._chunkLargestVisitId = item.id;
        }
      }
      catch(ex) {
        console.log(ex + " ERROR\n");
      }
    },
    {
      chunkSize: this._ResubmitRecentHistoryChunkSize,
      lastVisitId: this._ResubmitRecentHistoryLargestId,
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
        this._ResubmitRecentHistoryLargestId = this._chunkLargestVisitId;
      }
    }).then(() => {
       // check if _ResubmitRecentHistoryDeferred exists and url count == 0
       // then if the history returns nothing for the this query, we can resolve
       // the resubmit promise
       if (this._ResubmitRecentHistoryDeferred && this._ResubmitRecentHistoryUrlCount == 0) {
         this._resolveResubmitHistoryPromise();
       }
       // issue en event that history resubmission is done
      Services.obs.notifyObservers({wrappedJSObject: this._dayBuffer.getInterests()},
                                   "interest-history-submission-complete",
                                   null);
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
