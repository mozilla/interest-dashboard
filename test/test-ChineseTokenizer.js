/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {data} = require("sdk/self");
const test = require("sdk/test");

const {testUtils} = require("./helpers");
const {Cc, Ci} = require("chrome");

let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
let interestsUrlStopwords = JSON.parse(data.load("models/urlStopwords.json"));
scriptLoader.loadSubScript(data.url("interests/tokenizers/zh-CN.js"));

exports["test ChineseTokeinzer"] = function test_ChineseTokenizer(assert) {
  assert.deepEqual(!!Tokenizer_ZH_CN, true);

  let tokenizer = new Tokenizer_ZH_CN({
    urlStopwordSet: interestsUrlStopwords,
    rules: {
      'sports.sina.com.cn': {
        '__ANY': ['sports'],
        // 英超
        '\u82F1\u8D85': ['soccer']
      }
    }
  });

  let tests = [{
    url: 'http://sports.sina.com.cn/g/pl/2013-11-11/01036878834.shtml',
    title: '英超-鲁尼助攻范佩西绝杀 曼联胜阿森纳差前四1分',
    must_have: ['sports', 'sina', '英超'],
    must_not_have: ['助攻', '绝杀']
  }];

  tests.forEach(test => {
    let results = tokenizer.tokenize(test.url, test.title);
    test.must_have.forEach(k => {
      assert.deepEqual(testUtils.itemsHave(results, k), true);
    });

    test.must_not_have.forEach(k => {
      assert.deepEqual(testUtils.itemsHave(results, k), false);
    });
  });
};

test.run(exports);
