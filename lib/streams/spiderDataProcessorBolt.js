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
      MAX_NODE_RADIUS: 100,
      MIN_NODE_RADIUS: 30,
      identifier: "spiderDataProcessorBolt",
      listenType: "chartData", // Can also listen to other chart data processors
      emitType: "spiderData",

      _getRadius: function(recommendationCount) {
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

      _populateGraphDFS: function(root, parentID) {
        if (Object.keys(root).length > 0) {
          for (let child in root) {
            let currLength = this._originalNodes.length;
            let weight = root[child]["weight"];
            if (weight == 0) {
              continue;
            }
            if (weight < this._minWeight) {
              this._minWeight = weight;
            }

            // For demo purposes, generate a random number of recommendations between 1-50.
            let demoRecommendationCount = Math.floor(Math.random() * 50) + 1;

            let hasChildren = root[child]["children"];
            this._originalNodes.push({"id": currLength,
                                      "demoCount": demoRecommendationCount,
                                      "radius": this._getRadius(demoRecommendationCount),
                                      "interest": weight,
                                      "name": child});
            this._links.push({"source": parentID, "target": currLength});
            if (hasChildren) {
              this._populateGraphDFS(root[child]["children"], currLength);
            }
          }
        }
      },

      // Makes a copy of the existing hierarchy and adds weights to it where applicable
      _addWeightsToHierarchy: function(hierarchyRoot, interestsRoot, categories) {
        let weight = 0;
        if (Object.keys(hierarchyRoot).length > 0) {
          for (var child in hierarchyRoot) {
            if (!interestsRoot["children"][child] &&
                (Object.keys(hierarchyRoot[child]).length > 0 || categories[child])) {
              interestsRoot["children"][child] = {"children": {}};
            }
            if (categories[child]) {
              let childWeight = categories[child]["visitCount"];
              interestsRoot["children"][child]["weight"] = childWeight;
              weight += childWeight;
            }
            weight += this._addWeightsToHierarchy(hierarchyRoot[child], interestsRoot["children"][child], categories);
            interestsRoot["weight"] = weight;
          }
        }
        return weight;
      },

      _appendSubcatsAndWeightsToRoot: function(interestsRoot, categories) {
        interestsRoot.weight = 0;
        for (let category in categories) {
          if (!interestsRoot.children[category]) {
            interestsRoot.children[category] = {"children": {}, "weight": 0};
          }
          let subcats = categories[category].subcats;
          for (let subcatID in subcats) {
            let subcat = subcats[subcatID];
            if (!interestsRoot.children[category].children[subcat]) {
              interestsRoot.children[category].children[subcat] = {"children": {}, "weight": 0};
            }
            interestsRoot.children[category].children[subcat].weight++;
          }
          // Set category's overall weight.
          interestsRoot.children[category].weight += Object.keys(subcats).length;
          interestsRoot.weight += interestsRoot.children[category].weight;
        }
      },

      ingest: function _HSB_ingest(message) {
        DataProcessorHelper.initChartInStorage("spiderData", this.storage);
        let categories = message.chartData.lwca["58-cat"].categories;

        this._minWeight = 1000000000;
        this._originalNodes = [{"id": 0,
                                "name": "YOU",
                                "fixed": true}];
        this._links = [];
        this._appendSubcatsAndWeightsToRoot(this._spiderInput, categories);
        this._populateGraphDFS(this._spiderInput["children"], 0);
        this._originalNodes[0]["radius"] = 160;

        this.storage.chartData.spiderData.nodes = this._originalNodes;
        this.storage.chartData.spiderData.links = this._links;

        // Update the graph every 30 data updates
        Services.obs.notifyObservers(null, "chart-update",
          JSON.stringify({"type": "spider", "data": node.storage.chartData.spiderData}));
        this.results = message;
      },
    }, {storage: storageBackend || storage});
    return node;
  }
}

exports.SpiderDataProcessorBolt = SpiderDataProcessorBolt;
