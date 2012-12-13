/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


importScripts("WorkerUtils.js");
importScripts("hostsToCats.js");
importScripts("../lib/CategoryProcessor.js");

// now create category instance
var gCategoryProcessor = new CategoryProcessor(hostsToCats);
console.log("CategoryProcessor loaded");

self.onmessage = function (event) {

  var data = event.data;
  if( data.command == "consume" ) {
    gCategoryProcessor.consumeHistoryPlace(data.placeData);
  }
  else if( data.command == "getData" ) {
    var cats = gCategoryProcessor.getBlekkoCats();
    self.postMessage(cats);
  }
};
