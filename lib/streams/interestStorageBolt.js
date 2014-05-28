"use strict";

const {createNode} = require("streams/core");
const {storage} = require("sdk/simple-storage");
const {mergeObjects} = require("Utils");

let InterestStorageBolt = {
  create: function _ISB_create(storageBackend) {
    let interestStorageBolt = createNode({
      identifier: "interestStorageBolt",
      listenType: "hostlessInterests",
      emitType: null,

      init: function _ISB_init() {
        if (!this.storage.interests) {
          this.storage.interests = {};
        }
      },

      ingest: function _ISB_ingest(message) {
        mergeObjects(this.storage.interests, message);
      },

      clearData: function _ISB_clearData() {
        this.storage.interests = {};
      },

      clearStorage: function _ISB_clearStorage() {
        delete this.storage.interests;
      },
    }, {storage: storageBackend || storage});
    return interestStorageBolt;
  }
};
exports.InterestStorageBolt = InterestStorageBolt;
