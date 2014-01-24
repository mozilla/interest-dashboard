/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
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

let dateRegex = /\/[12][0-9][0-9][0-9]\/[0-9][0-9]\/[0-9][0-9]\//;
let numRegex = /\/[0-9][0-9]*\//;

NYTimesHistoryVisitor = {

  _extractFromPath: function(path) {
    // extract actual path and query parts
    let queryStart = path.indexOf("?");
    let actualPath = (queryStart != -1) ? path.substring(0, queryStart) : path;
    let query = (queryStart != -1) ? path.substring(queryStart+1) : null;

    if (actualPath != "/") {
      // remove date from path
      actualPath = actualPath.replace(dateRegex,"/_DATE/");

      // remove numbers from path
      actualPath = actualPath.replace(numRegex,"/_NUM/");

      // replace article title with _TITLE
      let pathBits = actualPath.split("/");
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
      actualPath = pathBits.join("/");
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
      path: actualPath,
      query: queryParams,
    };
  },

  consumeHistoryVisit: function(visitData, visitMeta) {
    if (visitMeta.tld != "nytimes.com") {
      return;
    }

    if (storage.nytimesVisits == null) {
      storage.nytimesVisits = [];
    }

    // extract data from the path
    let visitObject = this._extractFromPath(visitMeta.path);
    // add auxiliarly info like timestamp and visitId
    visitObject.host = visitMeta.host;
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
