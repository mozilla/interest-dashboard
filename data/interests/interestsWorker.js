/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

importScripts("tokenizerFactory.js");
importScripts("naiveBayesClassifier.js");

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
let gInterestsData = null;

// XXX The original splitter doesn't apply to chinese:
//   /[^-\w\xco-\u017f\u0380-\u03ff\u0400-\u04ff]+/;
const kSplitter = /[\s-]+/;

// bootstrap the worker with data and models
function bootstrap(aMessageData) {
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

// classify a page using rules
function ruleClassify({host, language, baseDomain, path, title, url}) {
  let interests = [];

  if (!gInterestsData || !gInterestsData[baseDomain]) {
    return interests;
  }

  let rule = gInterestsData[baseDomain];

  let keyLength = rule ? Object.keys(rule).length : 0;
  if (!keyLength)
    return interests;

  if (rule["__ANY"]) {
    interests = interests.concat(rule["__ANY"]);
    keyLength--;
  }

  if (!keyLength)
    return interests;

  let words = gTokenizer.tokenize(url, title);

  // subdomain tokens, for example:
  //   host="foo.bar.rootdomain.com", we got ["foo.", "bar."]
  words = words.concat(host.substring(0, host.length - baseDomain.length).match(/[^.\/]+\./gi));
  // path tokens, for example:
  //   path="/foo/bar/blabla.html", we got ["/foo", "/bar", "/blabla.html"]
  words = words.concat(path.match(/\/[^\/#?]+/gi));

  let matchedAllTokens = function(tokens) {
    return tokens.every(function(word) {
      return words.indexOf(word) != -1;
    });
  }

  Object.keys(rule).forEach(function(key) {
    if (key == "__HOME" && (path == null || path == "" || path == "/" || path.indexOf("/?") == 0)) {
      interests = interests.concat(rule[key]);
    }
    else if (key.indexOf("__") < 0 && matchedAllTokens(key.split(kSplitter))) {
      interests = interests.concat(rule[key]);
    }
  });

  return interests;
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

