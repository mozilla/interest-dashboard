/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");

function Pipeline() {
  this.processors = arguments;
  this._init();
}

Pipeline.prototype = {
  _init: function _init() {
  },

  push: function push(data) {
    return Task.spawn(function() {
      for (let i =0; i<this.processors.length; i++) {
        let processor = this.processors[i];
        data = yield processor.consume(data);
        if (data == null) {
          break;
        }
      }
    }.bind(this));
  },
}

exports.Pipeline = Pipeline;
