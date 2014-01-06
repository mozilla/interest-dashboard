/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

importScripts("interestsTextClassifier.js");

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
let gInterestsDataInRegExp = null;

const kSplitter = /[^-\w\xco-\u017f\u0380-\u03ff\u0400-\u04ff]+/;

// bootstrap the worker with data and models
function bootstrap(aMessageData) {
  // expects : {interestsData, interestsDataType, interestsClassifierModel, interestsUrlStopwords, workerRegionCode}
  gRegionCode = aMessageData.workerRegionCode;

  gNamespace = aMessageData.workerNamespace;
  swapRules(aMessageData);

  if (aMessageData.interestsUrlStopwords) {
    gTokenizer = new PlaceTokenizer({
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

// XXX Only support regexp with wildcard
function buildMappingWithWildcard() {
  gInterestsDataInRegExp = [];

  Object.keys(gInterestsData).forEach(function(domain) {
    if (domain.indexOf("*") < 0)
      return;

    gInterestsDataInRegExp.push(domain);
  });
}

function _getValidRule(hostRule, path) {
  let result = [];

  if (!hostRule)
    return result;

  if (hostRule["__ANY"])
    result.push(hostRule);

  if (!path || path == "/")
    return result;

  // check path
  let pathRules = hostRule["__PATH"];
  if (pathRules) {
    for (let p in pathRules) {
      /**
       * For path:
       *   '/path'
       * there are four cases to be matched:
       *   '/path'
       *   '/path/'
       *   '/path?kw='
       *   '/path#hash'
       */
      if (p == path || path.indexOf(path) == 0 &&
          /[#?\/]/i.test(path.substring(p.length, p.length + 1))) {
        result.push(pathRules[p])
      }
    }
  }

  return result;
}

function getMatchedHostRule(host, path) {
  let result = _getValidRule(gInterestsData[host], path);
  if (result.length > 0)
    return result;

  // Check domains in regexp.
  for (let idx = 0; idx < gInterestsDataInRegExp.length; idx++) {
    let exp = gInterestsDataInRegExp[idx];
    let re = new RegExp("^" + exp.replace(/\./g, "\\.").replace("*", ".+") + "$", "i");
    if (re.test(host)) {
      return _getValidRule(gInterestsData[exp], path);
    }
  }

  return [];
}

// swap out rules
function swapRules({interestsData, interestsDataType}) {
  if (interestsDataType == "dfr") {
    gInterestsData = interestsData;
    buildMappingWithWildcard();
  }
}

function doRuleClassify(rule, title, url, path) {
  let keyLength = rule ? Object.keys(rule).length : 0;
  if (!keyLength)
    return [];

  let interests = [];
  if (rule["__ANY"]) {
    interests = interests.concat(rule["__ANY"]);
    keyLength--;
  }

  if (!keyLength)
    return interests;

  let words = gTokenizer.tokenize(url, title);

  let matchedAllTokens = function(tokens) {
    return tokens.every(function(word) {
      return words.indexOf(word) != -1;
    });
  }

  Object.keys(rule).forEach(function(key) {
    if (key == "__HOME" && (path == null || path == "" || path == "/" || path.indexOf("/?") == 0)) {
      interests = interests.concat(rule[key]);
    }
    else if (key.indexOf("__") < 0 && matchedAllTokens(key.split(/[\s-]+/))) {  // XXXX original splitter doesn't apply to chinese.
      interests = interests.concat(rule[key]);
    }
  });

  return interests;
}

// classify a page using rules
function ruleClassify({host, language, tld, metaData, path, title, url}) {
  if (gInterestsData == null) {
    return [];
  }

  let interests = [];

  getMatchedHostRule(host, path).forEach(rule => {
    interests = interests.concat(doRuleClassify(rule, title, url, path));
  });

  if (host != tld) {
    getMatchedHostRule(tld, path).forEach(rule => {
      interests = interests.concat(doRuleClassify(rule, title, url, path));
    });
  }

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
  try {
    interests = ruleClassify(aMessageData);
    results.push({type: "rules", interests: dedupeInterests(interests)});

    let rulesWorked = interests.length > 0;
    if (rulesWorked) {
      results.push({type: "combined", interests: dedupeInterests(interests)});
    }

    interests = textClassify(aMessageData);
    results.push({type: "keywords", interests: dedupeInterests(interests)});
    if (!rulesWorked) {
      results.push({type: "combined", interests: dedupeInterests(interests)});
    }
    aMessageData.results = results;
    self.postMessage(aMessageData);
  }
  catch (ex) {
    log("getInterestsForDocument: " + ex)
  }
}

// Dispatch the message to the appropriate function
self.onmessage = function({data}) {
  self[data.message](data);
};

