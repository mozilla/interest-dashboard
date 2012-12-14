/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


importScripts("WorkerUtils.js");
importScripts("../lib/DemographicProcessor.js");

var gDemographicProcessor = null;

self.onmessage = function (event) {

  var data = event.data;
  if (data.command == "consume") {
    gDemographicProcessor.consumeHistoryPlace(data.placeData);
  }
  else if (data.command == "load") {
    let json = data.json;
    if (json == null) {
      if (typeof sitesDemographics == "undefined") {
        importScripts("sitesDemographicsGenerated.js");
      }
      json = sitesDemographics;
      // undefine sitesDemographics to garbage clean it if DemographicProcessor reloads
      sitesDemographics = null;
    }
    gDemographicProcessor = new DemographicProcessor(json);
    console.log("DemographicProcessor loaded");
  }
  else if (data.command == "getData") {
    var stuff = gDemographicProcessor.getDemographicBukets();
    self.postMessage(stuff);
  }
};

