/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
function Annotator() {
}

Annotator.prototype = {
  consume: function(bucketData) {
    bucketData.forEach(day => {
      day.forEach(type => {
        type.forEach(namespace => {
          namespace.forEach(interest => {
            let counts = [];
            interest.forEach(host => {
              counts.push(interest[host]);
            });
            namespace[interest] = counts;
          });
        });
      });
    });
  },
}

exports.Annotator = Annotator;
