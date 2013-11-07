/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu} = require("chrome");

let Surveyor = {

  orderInterestsForSurvey: function(rankings, allInterests, fillNb) {
    let resultRanking = [];
    let orderedRankings = [];

    rankings.forEach(ranking => {
      let orderedInterests = [];
      if (ranking == null) {
        ranking = {};
      }
      Object.keys(ranking).sort(function (a,b) {
        return ranking[b] - ranking[a];
      }).forEach(interest => {
        orderedInterests.push({interest: interest, score: ranking[interest]});
      });
      orderedRankings.push(orderedInterests);
    });

    // get first 5 from the first ranking
    let usedInterests = {};
    let filled = 0;
    while (orderedRankings.length &&
           filled < 6 &&
           filled < fillNb &&
           filled < orderedRankings[0].length) {
      let interest = orderedRankings[0][filled].interest;
      resultRanking.push(orderedRankings[0][filled]);
      filled++;
      usedInterests[interest] = 1;
    }

    // now go round-robbin over rankings and choose top interests
    // that have not been used yet
    let indexes = [];
    let len = orderedRankings.length;
    for (let i = 0; i < len; i++) {
      indexes.push(0);
    }

    let keepGoing = true;
    while (keepGoing && filled < fillNb) {
      keepGoing = false;
      // loop thourh rest of the ordered rankings
      for (let i = 0; i < len; i++) {
        let ranking = orderedRankings[i];
        if (indexes[i] < ranking.length) {
          let item = ranking[indexes[i]];
          if (usedInterests[item.interest] == null) {
            resultRanking.push(item);
            usedInterests[item.interest] = 1;
            filled++;
          }
          indexes[i]++;
          keepGoing = true;
        }
      }
    }

    // we need to fill the result array with zero scored interests
    if (fillNb > allInterests.length) {
      fillNb = allInterests.length;
    }
    while (filled < fillNb) {
      let index = Math.floor(allInterests.length * Math.random());
      let interest = allInterests[index];
      if (usedInterests[interest] == null) {
        resultRanking.push({interest: interest, score: 0});
        filled++;
        usedInterests[interest] = 1;
      }
    }

    return resultRanking;
  }
}

exports.Surveyor = Surveyor;
