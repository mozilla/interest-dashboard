/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {createNode} = require("streams/core");
const {storage} = require("sdk/simple-storage");
const {TypeNamespace} = require("TypeNamespace");
const {DataProcessorHelper} = require("Utils");
const {data} = require("sdk/self");
const {Cu, Cc, Ci} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

/*
 * Takes chartData messages and manipulates the data
 * to be suitable for the spider chart
 */
let count = 0;

let SpiderDataProcessorBolt = {
  create: function _SDPB_create(storageBackend) {
    let node = createNode({
      _spiderInput: {"children": {}, "weight": 100},
      NUM_NODES_PER_LAYER: 4,
      identifier: "spiderDataProcessorBolt",
      listenType: "chartData", // Can also listen to other chart data processors
      emitType: "spiderData",

      _getRadius: function(isToplevel, parentRadius) {
        if (!isToplevel) {
          return parentRadius / 3.5; // A subcat should be 3.5 times smaller than its parent.
        }

        // For demo purposes, generate a random number of recommendations between 1-50.
        let recommendationCount = Math.floor(Math.random() * 50) + 1;

        let radius = 0;
        if (recommendationCount <= 10) {
          radius = 50;
        } else if (recommendationCount > 10 && recommendationCount <= 20) {
          radius = 60;
        } else if (recommendationCount > 20 && recommendationCount <= 30) {
          radius = 70;
        } else if (recommendationCount > 30 && recommendationCount <= 40) {
          radius = 95;
        } else if (recommendationCount > 40 && recommendationCount <= 50) {
          radius = 110;
        }
        return radius;
      },

      _propertyComparator: function(property) {
        return function(a, b) {
            return a[property] - b[property];
        };
      },

      _computeLayersForNodes: function() {
        this._mainNodes.sort(this._propertyComparator("interest"));
        let numLayers = Math.floor(this._mainNodes.length / this.NUM_NODES_PER_LAYER);
        let numNodesPerLayer = Math.ceil(this._mainNodes.length / numLayers);

        for (let i = 0; i < this._mainNodes.length; i++) {
          this._mainNodes[i].layer = 0;
          if (this._mainNodes[i].interest != 0) {
            let layer = Math.floor((this._mainNodes.length - 1 - i) / numNodesPerLayer);
            this._mainNodes[i].layer = layer;
          }
        }

        this._mainNodes.sort(this._propertyComparator("id"));
      },

      _generateStructForD3: function(categories) {
        this._categoricalNodes = {};
        this._categoricalLinks = {};
        for (let category in categories) {
          // Handling top level categories.
          let id = this._mainNodes.length;
          let parentRadius = this._getRadius(true);
          let topLevelNode = {"id": id,
                              "radius": parentRadius,
                              "interest": categories[category].visitCount,
                              "name": category}
          this._mainNodes.push(topLevelNode);
          this._mainLinks.push({"source": 0, "target": id});

          // Gathering all possible subcats.
          this._categoricalNodes[category] = [JSON.parse(JSON.stringify(topLevelNode))]; // Making a copy so we can edit it on the next line
          this._categoricalNodes[category][0].id = 0;
          this._categoricalLinks[category] = [];
          let subcats = categories[category].subcats;

          let subcatSet = {};
          for (let subcatID in subcats) {
            subcatSet[subcats[subcatID]] = 1;
          }

          // Handling second level categories.
          for (let subcat in subcatSet) {
            // Need id, radius, name
            let subID = this._categoricalNodes[category].length;
            this._categoricalNodes[category].push({
              "id": subID,
              "radius": this._getRadius(false, parentRadius),
              "name": subcat
            });
            this._categoricalLinks[category].push({"source": 0,"target": subID});
          }
        }
      },

      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("spiderData", this.storage);
        let data = message.chartData.lwca["58-cat"];
        let categories = data.categories;

        this._mainNodes = [{"id": 0,
                            "name": "YOU",
                            "fixed": true,
                            "minDay": data.minDay,
                            "numInterests": Object.keys(categories).length,
                            "radius": 160}];
        this._mainLinks = [];

        this._generateStructForD3(categories);
        this._computeLayersForNodes();

        this.storage.chartData.spiderData.nodes = this._mainNodes;
        this.storage.chartData.spiderData.links = this._mainLinks;
        this.storage.chartData.spiderData.categoricalNodes = this._categoricalNodes;
        this.storage.chartData.spiderData.categoricalLinks = this._categoricalLinks;

        Services.obs.notifyObservers(null, "chart-update",
          JSON.stringify({"type": "spider", "data": node.storage.chartData.spiderData}));
        this.results = message;
      },
    }, {storage: storageBackend || storage});
    return node;
  }
}

exports.SpiderDataProcessorBolt = SpiderDataProcessorBolt;
