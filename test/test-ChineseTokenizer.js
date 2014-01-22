/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {testUtils} = require("./helpers");
const {data} = require("self");
const {Cc, Ci} = require("chrome");
const test = require("sdk/test");

let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
scriptLoader.loadSubScript(data.url("models/urlStopwords.json"));
scriptLoader.loadSubScript(data.url("models/zh-CN/41-cat/domainRules.json"));
scriptLoader.loadSubScript(data.url("models/zh-CN/41-cat/textModel.json"));
scriptLoader.loadSubScript(data.url("interests/tokenizers/zh-CN.js"));

exports["test ChineseTokeinzer"] = function test_ChineseTokenizer(assert) {
  testUtils.isIdentical(assert, !!Tokenizer_ZH_CN, true);

  let tokenizer = new Tokenizer_ZH_CN({
    urlStopwordSet: interestsUrlStopwords,
    model: {
      classes: {
        '0': 'sports',
        '1': 'soccer'
      },
      logLikelihoods: {
        // 曼联
        '\u66FC\u8054': [-11, -12],
        // 鲁尼
        '\u9C81\u5C3C': [-11, -12],
        // 范佩西
        '\u8303\u4F69\u897F': [-11, -12],
      }
    },
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
    must_have: ['sports', 'sina', 'com', '英超', '曼联', '鲁尼', '范佩西'],
    must_not_have: ['助攻', '绝杀']
  }];

  tests.forEach(test => {
    let results = tokenizer.tokenize(test.url, test.title);
    test.must_have.forEach(k => {
      testUtils.isIdentical(assert, testUtils.itemsHave(results, k), true);
    });

    test.must_not_have.forEach(k => {
      testUtils.isIdentical(assert, testUtils.itemsHave(results, k), false);
    });
  });
};

test.run(exports);
