/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu} = require("chrome");
const Promise = require("sdk/core/promise");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Task.jsm");

const {Crypto} = require("Crypto");
const {testUtils} = require("./helpers");
var base64 = require("sdk/base64");
const test = require("sdk/test");
const { pathFor } = require('sdk/system');
const file = require("sdk/io/file");

const PLAIN_TEXT = "Hello World";

exports["test uuid_hash"] =
function test_UUIDHash(assert, done) {
  let hash = Crypto.uuidHash("UUID");
  assert.ok( hash == "0tk5fqlilk0S2vYNI8eyH0ruua7nfCZ5NAwbr0mk3eY=", "hash matches");
  assert.ok(true);
  done();
}

exports["test uuid_encryption"] =
function test_UUIDEncryption(assert, done) {
  let iv = Crypto.generateSalt(16);
  let cipherText = Crypto.uuidEncrypt(PLAIN_TEXT, "UUID", iv);
  let plainText = Crypto.uuidDecrypt(cipherText, "UUID", iv);
  assert.ok(plainText = PLAIN_TEXT, "plain text matches");
  assert.ok(true);
  done();
}

// to generate uuidMapping.json, place survey.txt in the profile directory
// and run cfx test --filter=test-Crypto
// the survey.txt is expected to be in this format:
// uuid\tintrest\tsurvey_value\t....
// where survey value is
// 1 - for top5 page choice
// 2 - for second page choice

exports["test WriteMappings"] =
function test_WriteMappings(assert, done) {
  let cwd = pathFor("CurWorkD");
  let filename = file.join(cwd, 'survey.txt');
  if (file.exists(filename)) {
    let uuidDict = {};
    let content = file.read(filename);
    let lines = content.split(/\n/);
    // populate the uiid dictionary with interests
    lines.forEach(line => {
      let bits = line.split(/\s+/);
      let uuid = bits[0];
      let interest = bits[1];
      let value = bits[2];
      if (!uuidDict[uuid]) {
        uuidDict[uuid] = {};
      }
      // give top interests a score of 10 and secondary interests score of 5
      uuidDict[uuid][interest] = ((value == 1) ? 10 : 5);
    });
    // add a test uuid
    uuidDict["NO_SUCH_UUID"] = {};
    uuidDict["NO_SUCH_UUID"]["NO_SUCH_INTREST"] = 1;

    dump("Generating Encrypted uuid dictionary\n");
    let eDict = {};
    Object.keys(uuidDict).forEach(uuid => {
      if (uuid.length) {
        Crypto.uuidAddCryptoInterestsToDictionary(uuid, uuidDict[uuid], eDict);
      }
      dump("^");
    });
    dump("Encrypted " + Object.keys(uuidDict).length + " uuids\n");

    //make sure we can decrypt NO_SUCH_UUID interest
    let nosuchInterest = Crypto.uuidGetInterestsFromDictionary("NO_SUCH_UUID", eDict);
    testUtils.isIdentical(assert, nosuchInterest, {"NO_SUCH_INTREST":1});
    assert.ok(Crypto.uuidGetInterestsFromDictionary("MISSING_UUID", eDict) == null);

    // encrypted dictionary into a file
    let outFile = file.join(cwd, 'uuidMapping.json');
    let stream = file.open(outFile, "w");
    stream.write("var uuidMapping =\n")
    stream.write(JSON.stringify(eDict,null,2));
    stream.write("\n;\n")
    stream.close();
  }
  assert.ok(true);
  done();
}

exports["test uuid_mapping"] =
function test_uuidMappings(assert, done) {
  let nosuchInterest = Crypto.uuidGetMappedInterests("NO_SUCH_UUID");
  testUtils.isIdentical(assert, nosuchInterest, {"NO_SUCH_INTREST":1});
  assert.ok(Crypto.uuidGetMappedInterests("MISSING_UUID") == null);
  done();
}

test.run(exports);
