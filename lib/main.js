/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Controller} = require("Controller");
const {Dashboard} = require("Application");

exports.main = function(options, callbacks) {
  let controller = new Controller(options);
  Dashboard.init(controller);
  Dashboard.start(options);
};

exports.onUnload = function (reason) {
  Dashboard.unload(reason);
};
