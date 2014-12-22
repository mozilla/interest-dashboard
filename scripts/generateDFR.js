#!/usr/local/bin/node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var fs = require("fs");
var tld = require('tldjs');
var RevMap = require("../refData/IAB").RevMap;

var dfr = {};
var allJSONObjects = [];

// adds categories for a given key under a given domain
function addCats(domain, key, cats) {
  if (!dfr[domain]) {
    dfr[domain] = {};
  }
  if (!dfr[domain][key]) {
    dfr[domain][key] = {};
  }
  for (var i in cats) {
    dfr[domain][key][cats[i]] = true;
  }
}

// generate __ANY domain rules
function processDomainRules(rules) {
  Object.keys(rules).forEach(function(domain) {
    addCats(domain, "__ANY", RevMap[rules[domain]]);
  });
}

// generate rules for subdomain
function processHostRules(rules) {
  Object.keys(rules).forEach(function(host) {
    var domain = tld.getDomain(host);
    var subs = host.substring(0, host.length - domain.length);
    var cats = RevMap[rules[host]];
    if (subs == "www." || subs == "" || !subs) {
      addCats(domain, "__ANY", cats);
    }
    else {
      var key = subs.replace(".",". ").replace(/ $/,"");
      addCats(domain, key, cats);
    }
  });
}

// generate a key from a string of terms
// for example: "foo bar baz" with prefix '/' will result in
// "/foobar /baz" - the first to terms are always form a bigram
function makeKey(str, prefix, suffix) {
  prefix = prefix || "";
  suffix = suffix || "";
  var terms = str.split(/[^a-zA-Z0-9]+/);
  if (terms.length > 1) {
    terms.unshift(terms.shift() + terms.shift());
  }
  return terms.map(function(term) { return prefix + term + suffix;}).join(" ");
}

// process path rules of the form domain/path
function processPathRules(rules) {
  Object.keys(rules).forEach(function(hostPath) {
    var chunks = hostPath.split("/");
    var domain = chunks[0];
    var key = makeKey(chunks[1], "/");
    addCats(domain, key, RevMap[rules[hostPath]]);
  });
}

// process free terms matching inside URLs
function processUrlWordsRules(rules) {
  Object.keys(rules).forEach(function(term) {
    var key = makeKey(term, null, "_u");
    addCats("__ANY", key, RevMap[rules[term]]);
  });
}

// process a rule set for a given section key (like domains or paths)
function processRuleSet(jsonObject, sectionKey) {
  var rules = jsonObject[sectionKey];
  if (!rules) return;
  switch (sectionKey) {
    case 'domains': processDomainRules(rules); break;
    case 'hosts':   processHostRules(rules); break;
    case 'paths':   processPathRules(rules); break;
    case 'url_words': processUrlWordsRules(rules); break;
  }
}

// process json objects for each section
function doForAll(sectionKey) {
  for (var i in allJSONObjects) {
    processRuleSet(allJSONObjects[i], sectionKey);
  }
}

// finalize DFR before output
// 1. map objects that represent categorial assignment to []
// 2. remove rules superseded by domain __ANY rule
function finalizeDFR() {
  Object.keys(dfr).forEach(function(domain) {
    var domainRule = {};
    if (domain != "__ANY") {
      // store domain __ANY rule categories
      domainRule = dfr[domain]["__ANY"] || {};
    }
    Object.keys(dfr[domain]).forEach(function(key) {
      if (key != "__ANY") {
        // test for category existence in domainRule
        Object.keys(dfr[domain][key]).forEach(function(cat) {
          // if cateory exists in the domain "__ANY" rule, remove it
          if (domainRule[cat]) {
            delete dfr[domain][key][cat];
          }
        });
      }
      // replace categories objects categories array
      var cats = Object.keys(dfr[domain][key]);
      if (cats.length == 0) {
        delete dfr[domain][key];
      }
      else {
        dfr[domain][key] = cats;
      }
    });
  });
}

/********** main section ************/
Getopt = require('node-getopt');

var opt = new Getopt ([
  ['h' , 'help', 'display this help'],
])
.bindHelp()
.setHelp("USAGE: generateDFR.js [JSON FILES]")
.parseSystem();

// read json files
for (var i in opt.argv) {
  var fileContent = fs.readFileSync(opt.argv[i], "utf8");
  var jsonObj = JSON.parse(fileContent.toLowerCase());
  allJSONObjects.push(jsonObj);
}

doForAll("domains");
doForAll("hosts");
doForAll("paths");
doForAll("url_words");
finalizeDFR();

console.log(JSON.stringify(dfr, null, 1));

