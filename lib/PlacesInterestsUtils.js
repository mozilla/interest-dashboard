/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc,Ci,Cm,Cr,Cu,components,ChromeWorker} = require("chrome");

Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils", "resource://gre/modules/PlacesUtils.jsm");

const {DateUtils,MS_PER_DAY} = require("DateUtils");
const kChunkSize = 10000000;

/**
 * Store the SQL statements used for this file together for easy reference
 */
let SQL = {
  getRecentHistory:
    "SELECT v.visit_date timeStamp, " +
           "v.id visitId, " +
           "v.from_visit fromVisitId, " +
           "p.title title, " +
           "p.url url,  " +
           "(v.visit_date - v.visit_date % (:MS_PER_DAY*1000))/(:MS_PER_DAY*1000) visitDate " +
    "FROM moz_historyvisits as v " +
    "LEFT JOIN moz_places as p " +
    "ON v.place_id = p.id " +
    "WHERE v.visit_date > :lastTimeStamp AND " +
          "v.visit_date >= (:startDay * :MS_PER_DAY*1000) AND " +
          "p.hidden = 0 AND " +
          "p.visit_count > 0 " +
    "ORDER BY timeStamp " +
    "LIMIT :limit",

  getHistoryDetails:
    "SELECT v.id visitID, " +
           "v.visit_date timestamp, " +
           "p.title title, " +
           "p.url url, " +
           "f.url favicon " +
    "FROM moz_historyvisits as v " +
    "LEFT JOIN moz_places as p " +
    "ON v.place_id = p.id " +
    "LEFT JOIN moz_favicons as f " +
    "ON p.favicon_id = f.id " +
    "WHERE v.id IN (",

  getFaviconForHistoryVisit:
    "SELECT f.url favicon " +
    "FROM moz_historyvisits as v " +
    "LEFT JOIN moz_places as p " +
    "ON v.place_id=p.id " +
    "LEFT JOIN moz_favicons as f " +
    "ON p.favicon_id=f.id " +
    "WHERE v.id = :visitID",

  getMozHosts:
    "SELECT host, frecency " +
    "FROM moz_hosts " +
    "ORDER BY frecency DESC " +
    "LIMIT :limit",

};

let PlacesInterestsUtils = {
  //////////////////////////////////////////////////////////////////////////////
  //// PlacesInterestsUtils

  /**
   * Fetch recent history visits to process by page and day of visit
   *
   * @param   startDay
   *          a day to start from
   * @param   handleVisit
   *          Callback handling a visits for a page
   * @param   options
   *          extra options are:
   *          chunkSize - a number of raws to be processed by a query
   *          lastTimeStamp - visit timestamp to start from
   * @returns Promise for when all the recent pages have been processed
   */
  getRecentHistory: function PIS_getRecentHistory(startDay, handleVisit, options={}) {
    return this._execute(SQL.getRecentHistory, {
      columns: ["timeStamp", "title", "url", "visitDate", "visitId", "fromVisitId"],
      onRow: handleVisit,
      params: {
        startDay: startDay,
        MS_PER_DAY: MS_PER_DAY,
        limit: options.chunkSize || kChunkSize,
        lastTimeStamp: options.lastTimeStamp || 0,
      },
    });
  },

  getHistoryDetails: function PIS_getHistoryDetails(historyIDs, handleDetails) {
    // Adding the history IDs for the "where..on" clause.
    let query = SQL.getHistoryDetails;
    for (let id of historyIDs) {
      query += id + ", ";
    }
    query = query.substring(0, query.length - 2); // Remove extra comma.
    query += ") " +
    "ORDER BY timestamp DESC";

    return this._execute(query, {
      columns: ["visitID", "timestamp", "title", "url", "favicon"],
      onRow: handleDetails
    });
  },

  getFaviconForHistoryVisit: function PIS_getFaviconForHistoryVisit(historyID, handleFavicon, options={}) {
    return this._execute(SQL.getFaviconForHistoryVisit, {
      columns: ["favicon"],
      onRow: handleFavicon,
      params: {
        visitID: options.visitID
      },
    });
  },

  /**
   * Fetch hosts and frecency
   *
   * @returns Promise resolved upon query completion
   */
  getMozHosts: function PIS_getMozHosts(handleHost, options={}) {
    return this._execute(SQL.getMozHosts, {
      columns: ["host", "frecency"],
      onRow: handleHost,
      params: {
        limit: options.limit || 10000
      },
    });
  },

  /**
   * cancel pending statements and finalize
   *
   */
  stop: function PIS_onStop() {
    this._stop = true;
    if (this._cachedStatements) {
      Object.keys(this._cachedStatements).forEach(sql => {
        if (this._cachedStatements[sql].pending) {
          this._cachedStatements[sql].pending.cancel();
        }
        this._cachedStatements[sql].statement.finalize();
      });
      this._cachedStatements = {};
    }
  },

  /**
   * re-enable PlacesInterestsUtils after the stop
   *
   */
  restart: function PIS_onRestart() {
    this._stop = false;
  },

  /**
   * returnes a stopped status
   *
   */
  isStopped: function() {
    return (this._stop == true);
  },

  //////////////////////////////////////////////////////////////////////////////
  //// PlacesInterestsUtils Helpers

  /**
   * Execute a SQL statement with various options
   *
   * @param   sql
   *          The SQL statement to execute
   * @param   [optional] optional {see below}
   *          columns: Array of column strings to read for array format result
   *          onRow: Function callback given the columns for each row
   *          params: Object of keys matching SQL :param to bind values
   * @returns Promise for when the statement completes with value dependant on
   *          the optional values passed in.
   */
  _execute: function PIS__execute(sql, optional={}) {
    let {columns, onRow, params} = optional;

    // Check for stop flag
    if (this._stop) return null;

    // Initialize the statement cache and the callback to clean it up
    if (this._cachedStatements == null) {
      this._cachedStatements = {};
    }

    // Use a cached version of the statement if handy; otherwise create it
    if (this._cachedStatements[sql] == null) {
      this._cachedStatements[sql] = {statement: null, pending: null};
    }
    let statement = this._cachedStatements[sql].statement;
    if (statement == null) {
      statement = this._db.createAsyncStatement(sql);
      this._cachedStatements[sql].statement = statement;
    }

    // Bind params if we have any
    if (params != null) {
      Object.keys(params).forEach(param => {
        statement.bindByName(param, params[param]);
      });
    }

    // Determine the type of result as nothing, a keyed object or array of columns
    let results;
    if (onRow != null) {}
    else if (columns != null) {
      results = [];
    }

    // Execute the statement and update the promise accordingly
    let deferred = Promise.defer();
    this._cachedStatements[sql].pending = statement.executeAsync({
      handleCompletion: reason => {
        // make sure cache exists before nullifing pending
        if (this._cachedStatements[sql] &&
            this._cachedStatements[sql].pending) {
          this._cachedStatements[sql].pending = null;
        }
        if (this._stop) {
          deferred.resolve(null);
        }
        else {
          deferred.resolve(results);
        }
      },

      handleError: error => {
        // make sure cache exists before nullifing pending
        if (this._cachedStatements[sql] &&
            this._cachedStatements[sql].pending) {
          this._cachedStatements[sql].pending = null;
        }
        deferred.reject(new Error(error.message));
      },

      handleResult: resultSet => {
        let row;
        while (row = resultSet.getNextRow()) {
          // Read out the desired columns from the row into an object
          let result;
          if (columns != null) {
            // For just a single column, make the result that column
            if (columns.length == 1) {
              result = row.getResultByName(columns[0]);
            }
            // For multiple columns, put as valyes on an object
            else {
              result = {};
              columns.forEach(column => {
                result[column] = row.getResultByName(column);
              });
            }
          }

          // Give the packaged result to the handler
          if (onRow != null) {
            onRow(result);
          }
          // Append the result in order
          else if (columns != null) {
            results.push(result);
          }
        }
      }
    });

    return deferred.promise;
  },
}

XPCOMUtils.defineLazyGetter(PlacesInterestsUtils, "_db", function() {
  return PlacesUtils.history.QueryInterface(Ci.nsPIPlacesDatabase).DBConnection;
});

exports.PlacesInterestsUtils = PlacesInterestsUtils;
