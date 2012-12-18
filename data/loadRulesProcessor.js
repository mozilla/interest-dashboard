/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


importScripts("WorkerUtils.js");
importScripts("../lib/RulesProcessor.js");

// now create rules instance
var gRulesProcessor = null;

self.onmessage = function (event) {

  var data = event.data;
  if (data.command == "consume") {
    gRulesProcessor.consumeHistoryPlace(data.placeData);
  }
  else if (data.command == "load") {
    let json = data.json;
    if (json == null) {
      importScripts("defaultRules.js");
      json = defaultRules;
      // undefine defaultRules to garbage clean it if RulesProcessor reloads
      defaultRules = null;
    }
    gRulesProcessor = new RulesProcessor(json);
    console.log("RulesProcessor loaded");
  }
  else if (data.command == "getData") {
    var results = gRulesProcessor.getThresholdedResults();
    self.postMessage(results);
  }
};
