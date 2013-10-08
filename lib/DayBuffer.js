/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {storage} = require("sdk/simple-storage");
const {DateUtils} = require("DateUtils");

function DayBuffer(pipeline) {
  this._pipeline = pipeline;
}

DayBuffer.prototype = {

  consume: function _consume(dataBucket) {
    // add the lastDrop to the dataBucket
    if (storage.lastDrop) {
      dataBucket.addDataBucketDaySlice(storage.lastDrop.data, storage.lastDrop.date);
      storage.lastDrop = null;
    }

    // keep today's slice in the storage
    let today = DateUtils.today() + "";
    if (dataBucket.interests[today]) {
      storage.lastDrop = {};
      storage.lastDrop.data = dataBucket.interests[today];
      storage.lastDrop.date = today;
      delete dataBucket.interests[today];
    }
    // now push the bucketData through the pipeline
    // the order should not matter since dates are all disjoin
    if (Object.keys(dataBucket.interests).length > 0) {
      this._pipeline.push(dataBucket.interests)
    }
  },

  clear: function _clear() {
    storage.lastDrop = null;
  },

  getLastDrop: function() {
    return storage.lastDrop;
  },

  flush: function() {
    if (storage.lastDrop) {
      let pushObj = {};
      pushObj[storage.lastDrop.date] = storage.lastDrop.data;
      this._pipeline.push(pushObj);
      storage.lastDrop = null;
    }
  },
}

exports.DayBuffer = DayBuffer;
