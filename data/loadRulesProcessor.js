/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


importScripts("WorkerUtils.js");
importScripts("../lib/RulesProcessor.js");

// now create blekko instance
var gRulesProcessor = new RulesProcessor();
console.log("RulesProcessor loaded");

self.onmessage = function (event) {

  var data = event.data;
  if( data.command == "consume" ) {
    gRulesProcessor.consumeHistoryPlace(data.placeData);
  } 
  else if( data.command == "getData" ) {
    var results = gRulesProcessor.getThresholdedResults();
    self.postMessage(results);
  }
};
