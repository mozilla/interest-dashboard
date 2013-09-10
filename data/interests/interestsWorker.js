/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

importScripts("interestsTextClassifier.js");

function InterestsWorkerError(message) {
    this.name = "InterestsWorkerError";
    this.message = message || "InterestsWorker has errored";
}
InterestsWorkerError.prototype = new Error();
InterestsWorkerError.prototype.constructor = InterestsWorkerError;

let gNamespace = null;
let gTokenizer = null;
let gClassifier = null;
let gInterestsData = null;
const kSplitter = /[^-\w\xco-\u017f\u0380-\u03ff\u0400-\u04ff]+/;

// bootstrap the worker with data and models
function bootstrap(aMessageData) {
  //expects : {interestsData, interestsDataType, interestsClassifierModel, interestsUrlStopwords}
  if (aMessageData.interestsUrlStopwords) {
    gTokenizer = new PlaceTokenizer(aMessageData.interestsUrlStopwords);
  }
  if (aMessageData.interestsClassifierModel) {
    gClassifier = new NaiveBayesClassifier(aMessageData.interestsClassifierModel);
  }

  gNamespace = aMessageData.workerNamespace;

  swapRules(aMessageData);

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
function ruleClassify({host, language, tld, metaData, path, title, url}) {
  if (gInterestsData == null) {
    return [];
  }
  let interests = [];
  let hostKeys = (gInterestsData[host]) ? Object.keys(gInterestsData[host]).length : 0;
  let tldKeys = (host != tld && gInterestsData[tld]) ? Object.keys(gInterestsData[tld]).length : 0;

  if (hostKeys || tldKeys) {
    // process __ANY first
    if (hostKeys && gInterestsData[host]["__ANY"]) {
      interests = interests.concat(gInterestsData[host]["__ANY"]);
      hostKeys--;
    }
    if (tldKeys && gInterestsData[tld]["__ANY"]) {
      interests = interests.concat(gInterestsData[tld]["__ANY"]);
      tldKeys--;
    }

    // process keywords
    if (hostKeys || tldKeys) {
      // Split on non-dash, alphanumeric, latin-small, greek, cyrillic
      let words = (url + " " + title).toLowerCase().split(kSplitter);

      let matchedAllTokens = function(tokens) {
        return tokens.every(function(word) {
          return words.indexOf(word) != -1;
        });
      }

      let processDFRKeys = function(hostObject) {
        Object.keys(hostObject).forEach(function(key) {
          if (key != "__ANY" && matchedAllTokens(key.split(kSplitter))) {
            interests = interests.concat(hostObject[key]);
          }
        });
      }

      if (hostKeys) {
        processDFRKeys(gInterestsData[host]);
      }
      if (tldKeys) {
        processDFRKeys(gInterestsData[tld]);
      }
    }
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
  let message = {
    host: aMessageData.host,
    message: "InterestsForDocument",
    url: aMessageData.url,
    visitDate: aMessageData.visitDate,
    visitCount: aMessageData.visitCount,
    messageId: aMessageData.messageId,
    namespace: gNamespace,
  };

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

  // we need to submit 3 messages
  // - for rule classification
  // - for keyword classification
  // - for combined classification
  let interests = [];
  try {
    interests = ruleClassify(aMessageData);
    message.interests = dedupeInterests(interests);
    message.type = "rules";
    self.postMessage(message);

    let rulesWorked = interests.length > 0;
    if (rulesWorked) {
      message.type = "combined";
      self.postMessage(message);
    }

    interests = textClassify(aMessageData);
    message.interests = dedupeInterests(interests);
    message.type = "keywords";
    self.postMessage(message);

    if (!rulesWorked) {
      message.type = "combined";
      self.postMessage(message);
    }

  }
  catch (ex) {
    Components.utils.reportError(ex);
  }
}

// Classify document via text only
function getInterestsForDocumentText(aMessageData) {
  let interests = textClassify(aMessageData);

  // Respond with the interests for the document
  self.postMessage({
    host: aMessageData.host,
    interests: interests,
    message: "InterestsForDocumentText",
    url: aMessageData.url
  });
}

// Classify document via rules only
function getInterestsForDocumentRules(aMessageData) {
  let interests = ruleClassify(aMessageData);

  // Respond with the interests for the document
  self.postMessage({
    host: aMessageData.host,
    interests: interests,
    message: "InterestsForDocumentRules",
    url: aMessageData.url
  });
}

// Dispatch the message to the appropriate function
self.onmessage = function({data}) {
  self[data.message](data);
};

