/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const timers = require("timers");
const {Cc, Ci} = require("chrome");
const {ChromeWorker} = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;
var workerIndex = 0;

function WorkerProcessor(jsFile,jsonLoadData) {
  console.log("starting worker" , jsFile);
  this.worker = new ChromeWorker(jsFile);
  this.worker.onerror = function (event) {
    console.log("ERROR " + event.message ,event.filename,event.lineno);
  };

  this.id = workerIndex++;
  let self = this;

  // call load
  this.worker.postMessage({"command": "load", "json": jsonLoadData});
  // timers.setTimeout(function report() {
  //   console.log("i am the timer for worker " + self.id);
  //   timers.setTimeout(report,10000);
  // }, 10000);
}

WorkerProcessor.prototype = {

  consumeHistoryPlace: function(placeData) {
    this.worker.postMessage({"command": "consume", "placeData": placeData});
  },

  requestData: function(callBack) {
    // recomputes stuff and return i
    this.worker.onmessage = function(event) {
      callBack(event.data);
    };
    this.worker.postMessage({"command": "getData"});
  }

}

exports.WorkerProcessor = WorkerProcessor;
