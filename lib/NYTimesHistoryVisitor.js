/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/NetUtil.jsm");

const {storage} = require("sdk/simple-storage");
const STORABLE_PARAMS = {
  ref: 1,
  rref: 1,
  src: 1,
  hp:  1,
  hpw: 1,
  action: 1,
  module: 1,
  region: 1,
  contentCollection: 1,
};
const WHITE_LIST_LITERALS = {
  "nytimes.com": true,
  "www.nytimes.com": true,
  "dealbook.nytimes.com": true,
};
const WHITE_LIST_SUFFIXES = [
  "blogs.nytimes.com",
];

// remove dates and numbers from path
let dateRegex = /\/[12][0-9][0-9][0-9]\/[0-9][0-9]\/[0-9][0-9]\//;
let numRegex = /\/[0-9][0-9]*\//;

NYTimesHistoryVisitor = {

  _extractFromUrl: function(url) {
    // extract file and query parts
    let {filePath, query} = NetUtil.newURI(url).QueryInterface(Ci.nsIURL);

    if (filePath != "/") {
      // remove date from path
      filePath = filePath.replace(dateRegex,"/_DATE/");

      // remove numbers from path
      filePath = filePath.replace(numRegex,"/_NUM/");

      // replace article title with _TITLE
      let pathBits = filePath.split("/");
      // remove trailing ""
      if (pathBits[pathBits.length-1] == "") {
        pathBits.pop();
      }
      // test if last bit of the path is a title, which it is when:
      // - ends with .html but not index.html
      // - or it contains a dash
      let lastBit = pathBits[pathBits.length-1];
      if ((lastBit.endsWith(".html") && !lastBit.endsWith("index.html")) ||
          lastBit.indexOf("-") != -1
         ) {
         // it's a title, replace it with _TITLE
         pathBits[pathBits.length-1] = "_TITLE";
      }

      // reconstruct the path
      filePath = pathBits.join("/");
    }

    // now break query into parameters
    let queryParams = [];
    if (query) {
      query.split("&").forEach(param => {
        // always store moz_ parameters
        if (param.startsWith("moz_")) {
          queryParams.push(param);
        }
        else {
          // check if paramtter is one listed in STORABLE_PARAMS
          let paramName = param.split("=")[0];
          // if parameter name is empty - take the full parameter string
          if (paramName == null) {
            paramName = param;
          }
          if (STORABLE_PARAMS[paramName]) {
            queryParams.push(param);
          }
        }
      });
    }
    // return a cleansed path and filtered query object
    return {
      path: filePath,
      query: queryParams,
    };
  },

  _testDomainSuffixMatch: function(host) {
    for (let i=0; i<WHITE_LIST_SUFFIXES.length; i++) {
      if (host.endsWith(WHITE_LIST_SUFFIXES[i])) {
        return true;
      }
    }
    return false;
  },

  consumeHistoryVisit: function(visitData, visitMeta) {
    if (visitMeta.tld != "nytimes.com") {
      return;
    }

    // test host for a literal match against white list
    // followed by a suffix match
    let host = visitMeta.host;
    if (!WHITE_LIST_LITERALS[host] &&
        !this._testDomainSuffixMatch(host)) {
        // the host failed both test - it's not white listed
        return;
    }

    if (storage.nytimesVisits == null) {
      storage.nytimesVisits = [];
    }

    // extract data from the path
    let visitObject = this._extractFromUrl(visitData.url);
    // add auxiliarly info like timestamp and visitId
    visitObject.host = host;
    visitObject.timeStamp = visitData.timeStamp;
    visitObject.visitId = visitData.visitId;
    visitObject.fromVisitId = visitData.fromVisitId;
    // add visitObject to the storage
    storage.nytimesVisits.push(visitObject);
  },

  getVisits: function() {
    return storage.nytimesVisits;
  },

  clear: function() {
    storage.nytimesVisits = null;
  },
};

exports.NYTimesHistoryVisitor = NYTimesHistoryVisitor;
