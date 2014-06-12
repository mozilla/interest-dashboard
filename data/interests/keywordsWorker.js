/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

importScripts("tokenizerFactory.js");

function KeywordsWorkerError(message) {
    this.name = "KeywordsWorkerError";
    this.message = message || "KeywordsWorker has errored";
}

function log(msg) {
  dump("-*- keywordsWorker -*- " + msg + '\n')
}

KeywordsWorkerError.prototype = new Error();
KeywordsWorkerError.prototype.constructor = KeywordsWorkerError;

let gNamespace = null;
let gRegionCode = null;
let gTokenizer = null;

// XXX The original splitter doesn't apply to chinese:
//   /[^-\w\xco-\u017f\u0380-\u03ff\u0400-\u04ff]+/;
const kSplitter = /[\s-]+/;

// bootstrap the worker with data and models
function bootstrap(aMessageData) {
  gRegionCode = aMessageData.workerRegionCode;
  gNamespace = aMessageData.workerNamespace;

  if (aMessageData.urlStopwordSet) {
    gTokenizer = tokenizerFactory.getTokenizer({
      urlStopwordSet: aMessageData.urlStopwordSet,
      regionCode: gRegionCode,
    });
  }

  self.postMessage({
    message: "bootstrapComplete"
  });
}

// obtain unique keywords from a url and a title
function extractUniqueKeywords({url, title, publicSuffix}) {
  if (gTokenizer == null) {
    return [];
  }

  let tokens = gTokenizer.tokenize(url, title);
  let tokenSet = {};
  for (let token of tokens) {
    tokenSet[token] = true;
  }

  // remove public suffix tokens
  if (publicSuffix && publicSuffix != "") {
    let psTokens = gTokenizer.tokenize("", publicSuffix);
    for (let part of psTokens) {
      if (tokenSet[part]) {
        delete tokenSet[part];
      }
    }
  }

  return Object.keys(tokenSet);
}

function getKeywordsForDocument(aMessageData) {
  aMessageData.message = "KeywordsForDocument";
  aMessageData.namespace = gNamespace;

  let results = [];
  try {
    let keywords = extractUniqueKeywords(aMessageData);
    results.push({type: "url_title", keywords: keywords});

    keywords = extractUniqueKeywords({url: "", title: aMessageData.title});
    results.push({type: "title", keywords: keywords});

    aMessageData.results = results;
    self.postMessage(aMessageData);
  }
  catch (ex) {
    log("getKeywordsForDocument: " + ex)
  }
}

// Dispatch the message to the appropriate function
self.onmessage = function({data}) {
  self[data.message](data);
};

