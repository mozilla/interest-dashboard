const {Class} = require("sdk/core/heritage");

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/PlacesUtils.jsm")
Cu.import("resource://gre/modules/Services.jsm");

let TopDomains = {
  init: function() {
    let stmt = PlacesUtils.history.DBConnection.createStatement(
      "SELECT host " +
      "FROM moz_hosts " +
      "ORDER BY frecency DESC " +
      "LIMIT 50");
    while (stmt.executeStep()) {
      try {
        let base = Services.eTLD.getBaseDomainFromHost(stmt.row.host);
        if (this.seen[base]) {
          continue;
        }

        this.seen[base] = true;
        this.sorted.push(base);
      }
      catch(ex) {}
    }
  },

  seen: {},
  sorted: [],
};

exports.TopDomains = TopDomains;
