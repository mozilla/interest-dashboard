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

NYTimesHistoryVisitor = {

  _extractFromPath: function(path) {
    // extract actual path and query parts
    let queryStart = path.indexOf("?");
    let actualPath = (queryStart != -1) ? path.substring(0, queryStart) : path;
    let query = (queryStart != -1) ? path.substring(queryStart+1) : null;

    // remove date from the start of the path
    if (/^\/201[0-9]\//.test(actualPath)) {
      actualPath = "/_DATE/".concat(actualPath.substring(12));
    }

    // remove title.html , but keep index.html
    if (actualPath.length >= 10 && actualPath.substring(actualPath.length - 10) != "index.html") {
      let lastSlash = actualPath.lastIndexOf("/");
      actualPath = actualPath.substring(0, lastSlash);
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
    // return a cleansed path object
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
