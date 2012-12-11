/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
   * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const timers = require("timers");


function EventTrigger() {
	this.ready = 0;
  this.waitingReady = [];
}

EventTrigger.prototype = {
  isReady: function() {
    return this.ready;
  },

  onReady: function(cb) {
    if (this.ready) {
      timers.setTimeout(function() cb());
    }
    else {
      this.waitingReady.push(cb);
    }
  },

  flagCompletion: function() {
    this.ready = true;
    this.waitingReady.slice().forEach(function(cb) {
      try {
         cb();
      }
      catch(ex) {}
    });
    this.waitingReady.length = 0;
  }, 
}

exports.EventTrigger = EventTrigger;

