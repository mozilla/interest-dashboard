#!/usr/local/bin/node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// this script generates url words to category mapping
var fs = require("fs");

// read the first script argument into JSON object
var tree = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
var map = {};

// iterate over tree keys and generate flat mapping from LICA words to interests
Object.keys(tree).forEach(function(cat) {
  Object.keys(tree[cat]).forEach(function(subcat) {
    var terms = tree[cat][subcat];
    if (subcat == "general") {
      subcat = cat;
    }
    var mappedTerms = {};
    terms.forEach(function(term) {
      // remove spaces, which will turn spaced phrases into bigrams
      var mappedTerm = term.replace(/  */,"");
      if (!map[mappedTerm]) {
        // assign a category
        map[mappedTerm] = subcat;
      }
    });
  });
});

// print out JSON for LICA words to cats mapping
console.log(JSON.stringify({url_words: map},null,1));

