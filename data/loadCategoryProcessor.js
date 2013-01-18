/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


importScripts("WorkerUtils.js");
importScripts("../lib/CategoryProcessor.js");

// now create category instance
var gCategoryProcessor = null;

self.onmessage = function (event) {

  var data = event.data;
  if (data.command == "consume_place") {
    gCategoryProcessor.consumeHistoryPlace(data.data);
  }
  else if (data.command == "load") {
    let json = data.json;
    if (json == null) {
      importScripts("hostsToCats.js");
      json = hostsToCats;
      // undefine hostsToCats to garbage clean it if CategoryProcessor reloads
      hostsToCats = null;
    }
    gCategoryProcessor = new CategoryProcessor(json);
    console.log("CategoryProcessor loaded");

  }
  else if (data.command == "getData") {
    var cats = gCategoryProcessor.getCategories();
    self.postMessage(cats);
  }
};
