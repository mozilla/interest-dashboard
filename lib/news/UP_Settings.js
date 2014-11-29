/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 expandtab
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");

const simplePrefs = require("sdk/simple-prefs")
const {storage} = require("sdk/simple-storage");
const timers = require("sdk/timers");

let UP_Settings = {

  init: function() {
    if (!storage.upSettings) {
      storage.upSettings = {
        checked: {},
        scores: {},
      };
    }
    this.settings = storage.upSettings;
    this.readUpSignal();
  },

  readUpSignal: function() {
    // check if storage has data
    if (!storage.chartData) return;

    let cats = storage.chartData.genericChartData.lwca["58-cat"].categories;
    Object.keys(cats).forEach(cat => {
      this.settings.checked[cat] = true;
      this.settings.scores[cat] = cats[cat].visitCount;
      // deal with sub cats
      Object.keys(cats[cat].subcats).forEach(sub => {
        let value = cats[cat].subcats[sub];
        if (value != "general") {
          this.settings.checked[value] = true;
          this.settings.scores[value] = (this.settings.scores[value] || 0) + 1;
        }
      });
    });
  },

  clear: function() {
    delete storage.upSettings;
  },

  reset: function() {
    this.settings = storage.upSettings = {
      checked: {},
      scores: {},
    };
    this.readUpSignal();
  },

  setChecked: function(cat, value) {
    this.settings.checked[cat] = value;
  },

  setCheckedAll: function(cats, value) {
    if (value) {
      cats.forEach(cat => {
        this.settings.checked[cat] = true;
      });
    } else {
      this.settings.checked = {};
    }
  },

  refresh: function() {
    this.readUpSignal();
  },

  getSettings: function() {
    return this.settings;
  },
};

exports.UP_Settings = UP_Settings;
