/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/Task.jsm");

const MS_PER_DAY = 86400000;

exports.MS_PER_DAY = MS_PER_DAY;
exports.MICROS_PER_DAY = 86400000000;

exports.DateUtils = {

  convertDateToDays: function(time=null) {
    // Default to today and truncate to an integer number of days
    return Math.floor((time || Date.now()) / MS_PER_DAY);
  },

  today: function() {
    return this.convertDateToDays();
  },

  yesterday: function() {
    return this.today() - 1;
  },
};

