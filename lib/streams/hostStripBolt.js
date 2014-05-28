"use strict";

const {createNode} = require("streams/core");

/*
 * Takes dailyInterests messages and strips the hosts out of them, while keeping
 * the counts.
 */
let HostStripBolt = {
  create: function _HSB_create() {
    let node = createNode({
      identifier: "hostStripBolt",
      listenType: "dailyInterests",
      emitType: "hostlessInterests",
      ingest: function _HSB_ingest(message) {
        for (let timeKey in message) {
          let period = message[timeKey];
          for (let typeKey in period) {
            let type = period[typeKey];
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
        this.results = message;
      },
    });
    return node;
  }
}

exports.HostStripBolt = HostStripBolt;
