/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Transforms the output from a DayBufferSpout into a series of visits counts,
 * stripping out the host identifier.
 */
function HostnameStripper() {
}

HostnameStripper.prototype = {
  consume: function(bucketData) {
    for (let dayKey in bucketData) {
      let day = bucketData[dayKey];
      for (let typeKey in day) {
        let type = day[typeKey];
        for (let nsKey in type) {
          let namespace = type[nsKey];
          for (let interestKey in namespace) {
            let interest = namespace[interestKey];
            let counts = [];
            for (let hostKey in interest) {
              counts.push(interest[hostKey]);
            }
            namespace[interestKey] = counts;
          }
        }
      }
    }
    return bucketData;
  },
}

exports.HostnameStripper = HostnameStripper;
