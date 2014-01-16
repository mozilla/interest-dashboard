/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 expandtab
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var tokenizerFactory = {
  getTokenizer: function({regionCode, urlStopwordSet, model, rules}) {
    if (regionCode == 'zh-CN') {
      importScripts("tokenizers/zh-CN.js");
    } else {
      importScripts("tokenizers/en-US.js");
    }

    return new Tokenizer({
      urlStopwordSet: urlStopwordSet,
      model: model,
      rules: rules
    });
  }
};
