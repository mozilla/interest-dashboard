/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {testUtils} = require("./helpers");
const {Cc, Ci, Cu, ChromeWorker} = require("chrome");

exports["test array comparisons"] = function test_array_comparisons(assert){
  
  //tests the helper that can find array deep equality regardless of array order
  let a1 =  [{"type":"rules","interests":["computers"]},{"type":"combined","interests":["computers"]},{"type":"keywords","interests":[]}]
  let a2 =  [{"type":"rules","interests":["computers"]},{"type":"keywords","interests":[]},{"type":"combined","interests":["computers"]}]
  assert.ok(testUtils.compareArrayOrderIrrelevant(a1, a2), "compareArrayOrderIrrelevant works :-)")
  
}

require("sdk/test").run(exports);
