/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 expandtab
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const kNotWordPattern = /[^a-z0-9 ]+/g;

/**
 * A very simple Reverse Maximum Match tokenizer, the dictionary is
 * generated from the text classifier model and rule keywords.
 */
function Tokenizer_ZH_CN({urlStopwordSet, model, rules}) {
  this._urlStopwordSet = urlStopwordSet;
  this._hash = [];
  this.initialize(model, rules);
}

Tokenizer_ZH_CN.prototype = {
  initialize: function(aModel, aRules) {
    if (aModel) {
      Object.keys(aModel.logLikelihoods).forEach(key => {
        this._addDict(key);
      });
    }

    if (aRules) {
      this._addRuleKeywords(aRules);
    }
  },

  _addRuleKeywords: function(rules) {
    let self = this;
    Object.keys(rules).forEach(domain => {
      let domainRules = rules[domain];

      Object.keys(domainRules).forEach(key => {
        if (key.indexOf("__") < 0) {
          key.split(/[\s-]+/).forEach(this._addDict.bind(this));
        } else if (key == "__PATH") {
          this._addRuleKeywords(domainRules["__PATH"]);
        }
      });
    });
  },

  _addDict: function(s) {
    let n = s.length;

    if (!this._hash[n]) {
      this._hash[n] = {};
    }

    this._hash[n][s] = true;
  },

  _tokenizeCNText: function(sen) {
    let max = Math.min(sen.length, this._hash.length - 1);
    for (let n = max; n > 0; n--) {
      if (!this._hash[n]) {
        continue;
      }

      let section = sen.slice(sen.length - n);
      if (this._hash[n][section]) {
        return sen.length >= n
          ? this._tokenizeCNText(sen.slice(0, sen.length - n)).concat([section])
          : [];
      }
    }

    return sen.length >= 1
      ? this._tokenizeCNText(sen.slice(0, sen.length - 1))
      : [];
  },

  tokenize: function(aUrl, aTitle) {
    aUrl = aUrl.toLowerCase().replace(kNotWordPattern, " ");

    let tokens = [];

    let urlTokens = aUrl.split(/\s+/);
    urlTokens.forEach(function(token) {
      if (!(this._urlStopwordSet.hasOwnProperty(token))) {
        tokens.push(token);
      }
    }, this);

    tokens = tokens.concat(this._tokenizeCNText(aTitle));

    return tokens;
  }
};

