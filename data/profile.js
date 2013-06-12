/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let daysVisited;
self.port.on("daysVisited", function(data) {
  daysVisited = data;

  let sortedKeys = Object.keys(data).sort(function(a, b) data[b] - data[a]);
  let domainText = sortedKeys.map(function(key) key + " " + data[key]).join("<br>");
  document.getElementById("domains").innerHTML = domainText;

  updateOutput();
});

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});

function updateOutput() {
  let output = [];

  let categoryData = document.getElementById("categories").value.trim().split("\n");
  categoryData.forEach(function(line) {
    let domains = line.split(/\s+/);
    let name = domains.shift();

    let itemDays = domains.map(function(key) daysVisited[key] || 0);
    let totalDays = itemDays.reduce(function(item, sum) sum + item, 0);
    output.push(name + ": " + totalDays + " = " + itemDays.join(" + "));
  });

  document.getElementById("output").value= output.join("\n");
}

document.getElementById("categories").addEventListener("input", updateOutput);
