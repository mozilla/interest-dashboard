/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm", this);
const kSubmissionCompleteEvent = "interest-history-submission-complete";

function Pipeline() {
  this.processors = arguments;
  this._init();
}

Pipeline.prototype = {
  _init: function _init() {
    Services.obs.addObserver(this, kSubmissionCompleteEvent, false);
  },

  observe: function observe(aSubject, aTopic, aData) {
    if (aTopic == kSubmissionCompleteEvent) {
      let data = aSubject.wrappedJSObject;
      if (data && Object.keys(data).length) {
        this.push(data);
      }
    }
  },

  push: function push(data) {
    for (let i =0; i<this.processors.length; i++) {
      let processor = this.processors[i];
      data = processor.consume(data);
      if (data == null) {
        break;
      }
    }
  },
}

exports.Pipeline = Pipeline;
