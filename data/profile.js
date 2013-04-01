/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Call the service to get the buckets and display results
self.port.emit("call_service", "_getTopInterests", [100]);
self.port.on("called_service", function(method, args, result) {
  let table = document.getElementById("interestTable");
  result.forEach(({name, score, diversity, recency}) => {
    let {immediate, recent, past} = recency;
    let tr = document.createElement("tr");
    tr.innerHTML = "<td>" + name + "</td>" +
      "<td>" + immediate + "</td>" +
      "<td>" + recent + "</td>" +
      "<td>" + past + "</td>" +
      "<td>" + score + "</td>" +
      "<td>" + diversity + "</td>";
    table.appendChild(tr);
  });
});

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});
