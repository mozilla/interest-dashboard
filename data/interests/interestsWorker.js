/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

importScripts("tokenizerFactory.js");
importScripts("naiveBayesClassifier.js");
importScripts("lwca_refined.js");

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
let gClassifier = null;
let gLWCAClassifier = null;
let gInterestsData = null;

// XXX The original splitter doesn't apply to chinese:
//   /[^-\w\xco-\u017f\u0380-\u03ff\u0400-\u04ff]+/;
const kSplitter = /[\s-]+/;

// bootstrap the worker with data and models
function bootstrap(aMessageData) {
  gLWCAClassifier = new LWCAClassifier(aMessageData);

  // expects : {interestsData, interestsDataType, interestsClassifierModel, interestsUrlStopwords, workerRegionCode}
  gRegionCode = aMessageData.workerRegionCode;

  gNamespace = aMessageData.workerNamespace;
  swapRules(aMessageData);

  if (aMessageData.interestsUrlStopwords) {
    gTokenizer = tokenizerFactory.getTokenizer({
      urlStopwordSet: aMessageData.interestsUrlStopwords,
      model: aMessageData.interestsClassifierModel,
      regionCode: gRegionCode,
      rules: gInterestsData
    });
  }

  if (aMessageData.interestsClassifierModel) {
    gClassifier = new NaiveBayesClassifier(aMessageData.interestsClassifierModel);
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

// classify a page using rules
function ruleClassify({host, language, baseDomain, path, title, url}) {
  let interests = [];

  if (!gInterestsData || (!gInterestsData[baseDomain] && !gInterestsData["__ANY"])) {
    return interests;
  }

  let words = gTokenizer.tokenize(url, title);

  // subdomain tokens, for example:
  //   host="foo.bar.rootdomain.com", we got ["foo.", "bar."]
  let hostChunks = host.substring(0, host.length - baseDomain.length).match(/[^.\/]+\./gi);
  words = words.concat(hostChunks);
  // path tokens, for example:
  //   path="/foo/bar/blabla.html", we got ["/foo", "/bar", "/blabla.html"]
  words = words.concat(path.match(/\/[^\/#?]+/gi));

  function matchedAllTokens(tokens) {
    return tokens.every(function(word) {
      return words.indexOf(word) != -1;
    });
  }

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

// classify a page using text
function textClassify({url, title}) {
  if (gTokenizer == null || gClassifier == null) {
    return [];
  }

  let tokens = gTokenizer.tokenize(url, title);
  let interest = gClassifier.classify(tokens);

  if (interest != null) {
    return interest;
  }
  return [];
}

function lwcaClassify({url, title}) {
  try {
    if (url && title && gNamespace == "58-cat") {
      let classification = gLWCAClassifier.classify(url, title);
      let subcat = classification[1].split("/")[0];
      return {"category": [classification[0]], "subcat": subcat};
    }
  } catch (ex) {
    console.log(ex);
  }
  return [];
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

  // we need to submit 3 messages
  // - for rule classification
  // - for keyword classification
  // - for combined classification
  let interests = [];
  let results = [];
  let combinedInterests = [];
  try {
    interests = lwcaClassify(aMessageData);
    if (Object.keys(interests).length > 0) {
      results.push({type: "lwca", interests: interests.category, subcat: interests.subcat});
    }

    interests = ruleClassify(aMessageData);
    results.push({type: "rules", interests: dedupeInterests(interests)});

    let rulesWorked = interests.length > 0;
    combinedInterests = interests;

    interests = textClassify(aMessageData);
    results.push({type: "keywords", interests: dedupeInterests(interests)});
    combinedInterests = dedupeInterests(combinedInterests.concat(interests));
    results.push({type: "combined", interests: combinedInterests});

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

