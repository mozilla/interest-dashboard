#!/usr/local/bin/node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// this script reads stdin into JSON object and recuresevely sorts it by keys
// the result is output to stdout
var fs = require("fs");
var stdinData = "";

// recursively sort the object by keys
// return an object in key sorted order
function sortObj(obj) {
  var sortedObject = {};
  Object.keys(obj)
  .sort(function(a,b) {
    // special case __ANY keyword
    if (a == "__ANY") return -1;
    if (b == "__ANY") return  1;
    if (a < b) return -1;
    if (a == b) return 0;
    return 1;
  })
  .forEach(function(key) {
    var subObject = obj[key];
    if(typeof(subObject) == "object" && !Array.isArray(subObject)) {
      sortedObject[key] = sortObj(subObject);
    }
    else {
      sortedObject[key] = subObject;
    }
  });
  return sortedObject;
}

process.stdin.setEncoding('utf8');
process.stdin.on('readable', function() {
  var chunk = process.stdin.read();
  if (chunk !== null) {
    stdinData += chunk;
  }
});

process.stdin.on('end', function() {
  var obj = JSON.parse(stdinData);
  var sortedObj = sortObj(obj);
  console.log(JSON.stringify(sortedObj, null, 1));
});


// print out JSON for LICA words to cats mapping

