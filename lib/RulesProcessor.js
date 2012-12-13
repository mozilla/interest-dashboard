/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function RulesProcessor(rulesJSON) {
  // Compile the rules into a format better for processing
  this.compileRules(rulesJSON);
}

RulesProcessor.prototype = {
  // Convert the rules data to formats
  compileRules: function(inputRules) {
    this.rules = {};
    this.domainRules = {};

    // Convert the input rules into stored data
    Object.keys(inputRules).forEach(function(name) {
      let inputRule = inputRules[name];

      // Calculate cutoffs
      let now = Date.now() * 1000;
      let microAgo = inputRule.duration * 24 * 60 * 60 * 1000 * 1000;

      // Preprocess some data that's independent of consuming history
      this.rules[name] = {
        shortCutoff: now - microAgo / 2,
        longCutoff: now - microAgo,
        threshold: inputRule.threshold
      };

      // Convert the comma separated keywords into an array
      this.rules[name].keywords = inputRule.keywords.trim().toLowerCase().split(/\s*,\s*/).map(function(t) t.split(/\s+/));

      // Figure out which rules are watching which domains
      inputRule.domains.trim().toLowerCase().split(/\s*,\s*/).forEach(function(domain) {
        if (this.domainRules[domain] == null) {
          this.domainRules[domain] = [name];
        }
        else {
          this.domainRules[domain].push(name);
        }
      }.bind(this));
    }.bind(this));

    // Initialize the buckets for each rule
    this.results = {};
    Object.keys(this.rules).forEach(function(name) {
      this.results[name] = [0, 0, 0];
    }.bind(this));

    // Mark all rules as not needing updates
    this.updatedResults = {};

    // Load the cached thresholded results
    this.thresholdedResults = {};
  },

  consumeHistoryPlace: function({domain, lastVisit, title, url}) {
    // Only process rules for the domains we care about
    let relevantRules = this.domainRules[domain];
    if (relevantRules == null) {
      return;
    }

    // Split on non-dash, alphanumeric, latin-small, greek, cyrillic
    const splitter = /[^-\w\xco-\u017f\u0380-\u03ff\u0400-\u04ff]+/;
    let words = (url + " " + title).toLowerCase().split(splitter);

    // Check if each token matches somewhere in the list of words
    function matchedAllTokens(tokens) {
      return tokens.every(function(word) {
        return words.indexOf(word) != -1;
      });
    }

    // Process each of the rules that care about this domain
    relevantRules.forEach(function(name) {
      // Check if the keywords for the rules match the words
      let {keywords, longCutoff, shortCutoff} = this.rules[name];
      if (keywords.some(matchedAllTokens)) {
        // Figure out what time bucket this page falls into
        let bucket = 2;
        if (lastVisit > shortCutoff) {
          bucket = 0;
        }
        else if (lastVisit > longCutoff) {
          bucket = 1;
        }
        this.results[name][bucket]++;

        // Remember that this rule was processed
        this.updatedResults[name] = true;
      }
    }.bind(this));
  },

  getThresholdedResults: function() {
    // Convert the raw counts into thresholded output
    let toProcess = Object.keys(this.updatedResults);
    if (toProcess.length > 0) {
      toProcess.forEach(function(name) {
        let {threshold} = this.rules[name];
        let [first, second, rest] = this.results[name];
        this.thresholdedResults[name] = (rest >= threshold) << 2 |
                                        (second >= threshold) << 1 |
                                        (first >= threshold) << 0;
      }.bind(this));

      // Clear out the list of rules that had pending threshold updates
      this.updatedResults = {};
    }

    return this.thresholdedResults;
  }
}

exports.RulesProcessor = RulesProcessor;
