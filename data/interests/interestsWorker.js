/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

importScripts("tokenizerFactory.js");

function InterestsWorkerError(message) {
    this.name = "InterestsWorkerError";
    this.message = message || "InterestsWorker has errored";
}

function log(msg) {
  dump("-*- interestsWorker -*- " + msg + '\n')
}

InterestsWorkerError.prototype = new Error();
InterestsWorkerError.prototype.constructor = InterestsWorkerError;

let gNamespace = null;
let gRegionCode = null;
let gTokenizer = null;
let gInterestsData = null;

// XXX The original splitter doesn't apply to chinese:
//   /[^-\w\xco-\u017f\u0380-\u03ff\u0400-\u04ff]+/;
const kSplitter = /[\s-]+/;

// bootstrap the worker with data and models
function bootstrap(aMessageData) {
  // expects : {interestsData, interestsDataType, interestsUrlStopwords, workerRegionCode}
  gRegionCode = aMessageData.workerRegionCode;

  gNamespace = aMessageData.workerNamespace;
  swapRules(aMessageData);

  if (aMessageData.interestsUrlStopwords) {
    gTokenizer = tokenizerFactory.getTokenizer({
      urlStopwordSet: aMessageData.interestsUrlStopwords,
      regionCode: gRegionCode,
      rules: gInterestsData
    });
  }

  self.postMessage({
    message: "bootstrapComplete"
  });
}

// swap out rules
function swapRules({interestsData, interestsDataType}) {
  if (interestsDataType == "dfr") {
    gInterestsData = interestsData;
  }
}

function interestFinalizer(interests) {
  // This is a function to make the decision between a series of rules matched in the DFR
  // Accepts: an array containing either lists-of-strings, or lists-of-pairs where the pairs
  // are [string, float]
  // Returns: [string, string, ...]
  // Input: ["xyz",["golf",0.7],["foo",0.5],"bar"]

  let finalInterests = {};
  let highestWeight = 0;
  let bestWeightedInterest;
  interests.forEach(item => {
    if (Array.isArray(item)) {
      if (item[1] > highestWeight) {
        highestWeight = item[1];
        bestWeightedInterest = item[0];
      }
    } else {
      finalInterests[item] = true;
    }
  });
  if (bestWeightedInterest) finalInterests[bestWeightedInterest] = true;
  //log(JSON.stringify(interests));

  return Object.keys(finalInterests);
}

function parseVisit(host, baseDomain, path, title, url, options) {
  // words object will contain terms and bigrams found in url and title
  let words = {};

  // this function populates words object with terms
  // it adds apropriate suffix (it case of host chunks)
  // or prefix (in case of paths) to the chunks supplied
  function addToWords(chunks, options = {}) {
    let prev;
    let prefix = options.prefix || "";
    let suffix = options.suffix || "";

    for (let i in chunks) {
      if (chunks[i]) {
        words[prefix + chunks[i] + suffix] = true;
        if (prev) {
          // add bigram
          words[prefix + prev + chunks[i] + suffix] = true;
        }
        prev = chunks[i];
      }
    }
  };

  // tokenize and add url and title text to words object
  addToWords(gTokenizer.tokenize(url, title));
  // tokenize and add url only chunks
  addToWords(gTokenizer.tokenize(url), {suffix: "_u"});
  // parse and add hosts chunks
  addToWords(host.substring(0, host.length - baseDomain.length).split("."), {suffix: "."});
  // parse and add path chunks
  let pathChunks = path.split("/");
  for (let i in pathChunks) {
    addToWords(gTokenizer.tokenize(pathChunks[i], ""), {prefix: "/"});
  }

  return words;
}

function formatClassificationResults(cats) {
  let formattedClassification = {};
  if (cats.length == 0) {
    return [{"category": "uncategorized", "subcat": "dummy"}];
  }

  // populate formattedClassification object with top and sub categories
  for (let i = 0; i < cats.length; i++) {
    let cat = cats[i];
    if (cat.indexOf("/") == -1) {
      // This is a top category
      if (!formattedClassification[cat]) {
        formattedClassification[cat] = "general_" + i;
      }
    }
    else {
      // this is a subcategory
      let chunks = cat.split("/");
      let topCat = chunks[0];
      let subCat = chunks[1];
      if (!formattedClassification[topCat] ||
          formattedClassification[topCat].indexOf("general") != -1) {
        formattedClassification[topCat] = subCat + "_" + i;
      }
    }
  }

  // The final result is an ordered list of {category: <>, subcat: <>}.
  let finalResult = new Array(Object.keys(formattedClassification).length);
  for (let category in formattedClassification) {
    let split = formattedClassification[category].split("_");
    let subcat = split[0];
    let index = split[1];
    finalResult[index] = {"category": category, "subcat": subcat};
  }


  return finalResult;
}

// classify a page using rules
function ruleClassify({host, baseDomain, path, title, url}) {
  let interests = [];

  // check if rules are applicable at all
  if (!gInterestsData || (!gInterestsData[baseDomain] && !gInterestsData["__ANY"])) {
    return interests;
  }

  // populate words object with visit data
  let words = parseVisit(host, baseDomain, path, title, url);

  // this funcation tests for exitence of rule terms in the words object
  // if all rule tokens are found in the wrods object return true
  function matchedAllTokens(tokens) {
    return tokens.every(function(token) {
      return words[token];
    });
  }

  // match a rule and collect matched interests
  function matchRuleInterests(rule) {
    Object.keys(rule).forEach(function(key) {
      if (key == "__HOME" && (path == null || path == "" || path == "/" || path.indexOf("/?") == 0)) {
        interests = interests.concat(rule[key]);
      }
      else if (key.indexOf("__") < 0 && matchedAllTokens(key.split(kSplitter))) {
        interests = interests.concat(rule[key]);
      }
    });
  }

  // process __ANY rule first
  if (gInterestsData["__ANY"]) {
    matchRuleInterests(gInterestsData["__ANY"]);
  }

  let domainRule = gInterestsData[baseDomain];

  let keyLength = domainRule ? Object.keys(domainRule).length : 0;
  if (!keyLength)
    return interestFinalizer(interests);

  if (domainRule["__ANY"]) {
    interests = interests.concat(domainRule["__ANY"]);
    keyLength--;
  }

  if (!keyLength)
    return interestFinalizer(interests);

  matchRuleInterests(domainRule);

  return interestFinalizer(interests);
}

// Figure out which interests are associated to the document
function getInterestsForDocument(aMessageData) {

  function dedupeInterests(interests) {
    // remove duplicates
    if (interests.length > 1) {
      // insert interests into hash and reget the keys
      let theHash = {};
      interests.forEach(function(aInterest) {
        if (!theHash[aInterest]) {
          theHash[aInterest]=1;
        }
      });
      interests = Object.keys(theHash);
    }
    return interests;
  };

  aMessageData.message = "InterestsForDocument";
  aMessageData.namespace = gNamespace;

  // Submitting a msg for rule classification
  try {
    let interests = ruleClassify(aMessageData);
    let formatted = formatClassificationResults(interests);
    let results = [{type: "rules", interests: formatted}];

    aMessageData.results = results;
    self.postMessage(aMessageData);
  }
  catch (ex) {
    log(ex)
  }
}

// Dispatch the message to the appropriate function
self.onmessage = function({data}) {
  self[data.command](data.payload);
};

