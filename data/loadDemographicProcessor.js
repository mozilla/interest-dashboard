/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


importScripts("WorkerUtils.js");
importScripts("sitesDemographicsGenerated.js");
importScripts("../lib/DemographicProcessor.js");

var gDemographicProcessor = new DemographicProcessor(sitesDemographics);
console.log("DemographicProcessor loaded");

self.onmessage = function (event) {

  var data = event.data;
  if( data.command == "consume" ) {
    gDemographicProcessor.consumeHistoryPlace(data.placeData);
  }
  else if( data.command == "getData" ) {
    var stuff = gDemographicProcessor.getDemographicBukets();
    self.postMessage(stuff);
  }
};

