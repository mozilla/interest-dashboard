/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
function PipeLine() {
  this.processors = arguments;
}

PipeLine.prototype = {
  push: function(datum) {
    for (let i =0; i<this.processors.length; i++) {
      let processor = this.processors[i];
      datum = processor.consume(datum);
      if (datum == null) {
        break;
      }
    }
  },
}

exports.PipeLine = PipeLine;
