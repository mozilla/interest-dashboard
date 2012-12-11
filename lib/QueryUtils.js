/* ***** BEGIN LICENSE BLOCK *****
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
   * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const {Cc,Ci,Cm,Cr,Cu,components} = require("chrome");
Cu.import("resource://gre/modules/PlacesUtils.jsm", this);

exports.executeQuery  = function execQuery(where, query , params , callbacks) {
try {

    let connection;
    if(where == "form") {
     connection = Cc["@mozilla.org/satchel/form-history;1"].getService(Ci.nsIFormHistory2).DBConnection;
    }
    else {
     connection = PlacesUtils.history.QueryInterface(Ci.nsPIPlacesDatabase).DBConnection;
    }

    let statement = connection.createAsyncStatement(query);

    console.log(connection , statement , query);

    if (params) {
      for (let param in params) {
        console.log("MorePlacesUtils._getAsyncStatement: param: " + param + " = " + params[param]);
        statement.params[param] = params[param];
      }
    }
    statement.executeAsync({

        handleResult: function (result) {
        try {
          //console.log("MorePlacesUtils._executeAsyncStatement:handleResult " + JSON.stringify(result));
          let rows = [];
          let row = null;
          while (row = result.getNextRow()) {
            if(callbacks.onRow) {
                callbacks.onRow(row);
            }
           }  // eof while
          } catch (er) {
              console.log("exception " + er);
          }
        },
        handleCompletion: function (reason) {
          //console.log("MorePlacesUtils._executeAsyncStatement:handleCompletion " + reason);
          if(callbacks.onCompletion) { callbacks.onCompletion(reason); }
        },
        handleError: function (error) {
          //console.log("MorePlacesUtils._executeAsyncStatement:handleError");
          if(callbacks.onError) callbacks.onError(error);
        }

    });

} catch (ex) {
    console.log("Exception " + ex);
}
} // end of execQuery
