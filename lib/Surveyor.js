/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu} = require("chrome");

let Surveyor = {

  orderInterestsForSurvey: function(scoringInterests, allInterests) {
    let orderedInterests = [];

    // scoringInterests could be null if history is empty
    if (scoringInterests == null) {
      scoringInterests = {};
    }

    Object.keys(scoringInterests).sort(function (a,b) {
      return scoringInterests[b] - scoringInterests[a];
    }).forEach(it => {
      orderedInterests.push({interest: it, score: scoringInterests[it]});
    });

    if (orderedInterests.length < 10) {
      // simply add randomly picked scoringInterests from taxonomy
      // that are not among non-zero scoringInterests. And avoid duplicates
      let noDupes = {};
      while (orderedInterests.length < 10) {
        let index = Math.floor(allInterests.length * Math.random());
        let emptyInterest = allInterests[index];
        if (scoringInterests[emptyInterest] == null && noDupes[emptyInterest] == null) {
          orderedInterests.push({interest: emptyInterest, score: 0});
          noDupes[emptyInterest] = 1;
        }
      }
    }
    else if (orderedInterests.length > 10) {
      let delta = Math.round(orderedInterests.length / 3);
      let newInterests = [];

      // we must choose 4 top, 3 medium and 3 low
      // start with top ones
      let index = 0;
      while (index <= 3) {
        newInterests.push(orderedInterests[index++]);
      }

      // now 3 medium
      delta = (delta > 4) ? delta : 4;
      index = delta;
      while (index < (delta+3)) {
        newInterests.push(orderedInterests[index++]);
      }

      // now 3 low
      delta *= 2;
      index = delta;
      while (index < (delta+3)) {
        newInterests.push(orderedInterests[index++]);
      }
      orderedInterests = newInterests;
    }
    return orderedInterests;
  }
}

exports.Surveyor = Surveyor;
