/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu} = require("chrome");

Cu.import("resource://services-crypto/WeaveCrypto.js");

const {data} = require("sdk/self");
let base64 = require("sdk/base64");
let crypto = new WeaveCrypto();

const HASHID_SALT = "2828382378495957";
const ENCKEY_SALT = "1234567878910112";

let Crypto = {
  _mappedDictionary: null,

  _getMappedDictionary: function() {
    if (this._mappedDictionary == null) {
      let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
      scriptLoader.loadSubScript(data.url("models/en-US/edrules/uuidMapping.json"));
      this._mappedDictionary = uuidMapping;
    }
    return this._mappedDictionary;
  },

  hasMappedInterests: function(uuid) {
    let dict = this._getMappedDictionary();
    let idHash = this.uuidHash(uuid);
    return (dict && dict[idHash] != null);
  },

  generateSalt: function() {
    return base64.encode(crypto.generateRandomBytes(16));
  },

  uuidHash: function(uuid) {
    return base64.encode(crypto.deriveKeyFromPassphrase(uuid, HASHID_SALT));
  },

  uuidEncrypt: function(clearText, uuid, iv) {
    let key = base64.encode(crypto.deriveKeyFromPassphrase(uuid, ENCKEY_SALT));
    return base64.encode(crypto.encrypt(clearText, key, iv));
  },

  uuidDecrypt: function(cipherText, uuid, iv) {
    let key = base64.encode(crypto.deriveKeyFromPassphrase(uuid, ENCKEY_SALT));
    return crypto.decrypt(base64.decode(cipherText), key, iv);
  },

  uuidAddCryptoInterestsToDictionary: function(uuid, interests, dict) {
    let hashedId = this.uuidHash(uuid);
    let uuidSalt = this.generateSalt();
    let interestsLen = JSON.stringify(interests).length;
    let paddingLen = (512 > interestsLen) ? (512-interestsLen) : 1;
    let padding = crypto.generateRandomBytes(paddingLen);
    let uuidInterests = this.uuidEncrypt(
                          JSON.stringify({interests: interests, padding: padding}),
                          uuid,
                          uuidSalt);
    dict[hashedId] = {interests: uuidInterests, salt: uuidSalt};
  },

  uuidGetInterestsFromDictionary: function(uuid, dict) {
    let idHash = this.uuidHash(uuid);
    if (dict[idHash]) {
      let iv = dict[idHash].salt;
      let clearText = this.uuidDecrypt(
               dict[idHash].interests,
               uuid,
               dict[idHash].salt
             );
      let object = JSON.parse(clearText);
      return (object) ? object.interests : null;
    }
    return null;
  },

  uuidGetMappedInterests: function(uuid) {
    let dict = this._getMappedDictionary();
    return (dict) ? this.uuidGetInterestsFromDictionary(uuid, dict) : null;
  },

};

exports.Crypto = Crypto;
