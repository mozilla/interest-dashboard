/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Class} = require("sdk/core/heritage");
const {data} = require("self");
const {Factory, Unknown} = require("api-utils/xpcom");
const {PageMod} = require("page-mod");
const tabs = require("tabs");

const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils", "resource://gre/modules/PlacesUtils.jsm");

exports.main = function(options, callbacks) {
  // Handle about:profile-domains requests
  Factory({
    contract: "@mozilla.org/network/protocol/about;1?what=profile-domains",

    Component: Class({
      extends: Unknown,
      interfaces: ["nsIAboutModule"],

      newChannel: function(uri) {
        let chan = Services.io.newChannel(data.url("index.html"), null, null);
        chan.originalURI = uri;
        return chan;
      },

      getURIFlags: function(uri) {
        return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
      }
    })
  });

  // Add functionality into about:profile-domains page loads
  PageMod({
    contentScriptFile: [
      data.url("profile.js"),
    ],

    include: ["about:profile-domains"],

    onAttach: function(worker) {
      worker.port.emit("style", data.url("profile.css"));
      worker.port.emit("daysVisited", daysVisited);
    }
  });

  // Compute the domain data for number of days each domain was visited
  let daysVisited = {};
  let visitedDomainOn = {};
  PlacesInterestsStorage._execute(
    "SELECT rev_host, v.visit_date / 86400000000 day " +
    "FROM moz_historyvisits v " +
    "JOIN moz_places h " +
    "ON h.id = v.place_id " +
    "WHERE h.hidden = 0 AND h.visit_count > 0 " +
    "GROUP BY h.rev_host, day", {
    columns: ["rev_host", "day"],
    onRow: ({rev_host, day}) => {
      try {
        let host = rev_host.slice(0, -1).split("").reverse().join("");
        let base = Services.eTLD.getBaseDomainFromHost(host);
        visitedDomainOn[base] = visitedDomainOn[base] || {};
        visitedDomainOn[base][day] = true;
      }
      catch(ex) {}
    }
  }).then(() => {
    Object.keys(visitedDomainOn).forEach(key => {
      daysVisited[key] = Object.keys(visitedDomainOn[key]).length;
    });
  }).then(() => {
    // Automatically open a tab unless it's a regular firefox restart
    if (options.loadReason != "startup") {
      tabs.open("about:profile-domains");
    }
  });
};

let PlacesInterestsStorage = {
  _execute: function PIS__execute(sql, optional={}) {
    let {columns, key, listParams, onRow, params} = optional;

    // Convert listParams into params and the desired number of identifiers
    if (listParams != null) {
      params = params || {};
      Object.keys(listParams).forEach(listName => {
        let listIdentifiers = [];
        for (let i = 0; i < listParams[listName].length; i++) {
          let paramName = listName + i;
          params[paramName] = listParams[listName][i];
          listIdentifiers.push(":" + paramName);
        }

        // Replace the list placeholders with comma-separated identifiers
        sql = sql.replace(":" + listName, listIdentifiers, "g");
      });
    }

    // Initialize the statement cache and the callback to clean it up
    if (this._cachedStatements == null) {
      this._cachedStatements = {};
      PlacesUtils.registerShutdownFunction(() => {
        Object.keys(this._cachedStatements).forEach(key => {
          this._cachedStatements[key].finalize();
        });
      });
    }

    // Use a cached version of the statement if handy; otherwise created it
    let statement = this._cachedStatements[sql];
    if (statement == null) {
      statement = this._db.createAsyncStatement(sql);
      this._cachedStatements[sql] = statement;
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
    else if (key != null) {
      results = {};
    }
    else if (columns != null) {
      results = [];
    }

    // Execute the statement and update the promise accordingly
    let deferred = Promise.defer();
    statement.executeAsync({
      handleCompletion: reason => {
        deferred.resolve(results);
      },

      handleError: error => {
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
          // Store the result keyed on the result key
          else if (key != null) {
            results[row.getResultByName(key)] = result;
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
};

XPCOMUtils.defineLazyGetter(PlacesInterestsStorage, "_db", function() {
  return PlacesUtils.history.QueryInterface(Ci.nsPIPlacesDatabase).DBConnection;
});
