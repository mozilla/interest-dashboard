/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 expandtab
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const kNotWordPattern = /[^a-z0-9 ]+/g;
const kMinimumMatchTokens = 3;
const kSimilarityCutOff = Math.log(0.95);

function PlaceTokenizer({urlStopwordSet, model, regionCode}) {
  this._urlStopwordSet = urlStopwordSet;
  this._regionCode = regionCode;

  if (regionCode == 'zh-CN' && model) {
    this._cnTokenizer = new ChineseTokenizer(model);
  }
}

PlaceTokenizer.prototype = {
  tokenize: function(aUrl, aTitle, aKeywords) {
    aUrl = aUrl.toLowerCase().replace(kNotWordPattern, " ");
    aTitle = (aTitle) ? aTitle.toLowerCase().replace(kNotWordPattern, " ") : "";

    let tokens = [];

    let urlTokens = aUrl.split(/\s+/);
    urlTokens.forEach(function(token) {
      if (!(this._urlStopwordSet.hasOwnProperty(token))) {
        tokens.push(token);
      }
    }, this);

    aKeywords = aKeywords || '';

    if (this._regionCode == 'zh-CN') {
      tokens = tokens.concat(this._cnTokenizer.tokenize(aTitle + ' ' + aKeywords));
    } else {
      tokens = tokens.concat(aTitle.split(/\s+/));
      tokens = tokens.concat(aKeywords.split(/\s+/));
    }

    return tokens;
  }
};

/**
 * A very simple Reverse Maximum Match tokenizer, the dictionary is
 * generated from the text classifier model.
 */
function ChineseTokenizer(aModel) {
  this._hash = [];
  this.initialize(aModel);
}

ChineseTokenizer.prototype = {
  initialize: function(aModel) {
    for (let key in aModel.logLikelihoods) {
      this._addDict(key);
    }
  },

  _addDict: function(s) {
    let n = s.length;

    if (!this._hash[n]) {
      this._hash[n] = {};
    }

    this._hash[n][s] = true;
  },

  tokenize: function(sen) {
    let max = Math.min(sen.length, this._hash.length - 1);
    for (let n = max; n > 0; n--) {
      if (!this._hash[n]) {
        continue;
      }

      let section = sen.slice(sen.length - n);
      if (this._hash[n][section]) {
        return sen.length >= n
          ? this.tokenize(sen.slice(0, sen.length - n)).concat([section])
          : [];
      }
    }

    return sen.length >= 1
      ? this.tokenize(sen.slice(0, sen.length - 1))
      : [];
  }
};

function NaiveBayesClassifier(aModel) {
  this._classes = aModel.classes;
  this._logLikelihoods = aModel.logLikelihoods;
  this._logPriors = aModel.logPriors;
}

NaiveBayesClassifier.prototype = {
  classify: function(aTokens) {
    if (!Array.isArray(aTokens)) {
      throw new TypeError("invalid input data");
    }

    let posteriors = [];

    for (var index=0; index < this._logPriors.length; index++) {
      posteriors.push(this._logPriors[index]);
    }

    let tokenMatchCount = 0;
    for (let tokenIndex=0; tokenIndex < aTokens.length; tokenIndex++) {
      let token = aTokens[tokenIndex];
      if (this._logLikelihoods.hasOwnProperty(token)) {
        tokenMatchCount += 1;
        for (var index=0; index < posteriors.length; index++) {
          posteriors[index] += this._logLikelihoods[token][index];
        }
      }
    }

    let classMatches = [];
    if (tokenMatchCount > kMinimumMatchTokens) {
      let maxValue = -Infinity;

      while(true) {
        let currentMax = Math.max.apply(Math, posteriors);
        let max_index;
        if (currentMax > maxValue) {
          // set max value, setup to get next biggest probability
          max_index = posteriors.indexOf(currentMax);
          maxValue = currentMax;
          classMatches.push(this._classes[max_index]);
          posteriors[max_index] = -Infinity;
        } else if ((currentMax-maxValue) >= kSimilarityCutOff) {
          max_index = posteriors.indexOf(currentMax);
          classMatches.push(this._classes[max_index]);
          posteriors[max_index] = -Infinity;
        } else {
          // selection is done, the next nearest item is less similar than the threshold
          break;
        }
      }
      return classMatches;
    }
    return null;
  }
}
