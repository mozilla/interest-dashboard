/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Add some buttons to recompute some amount of history
const recomputeDays = [0, 3, 7, 15, 30, 60, 120, 240];
recomputeDays.forEach(days => {
  let parentDiv = document.getElementById("recompute");
  let button = document.createElement("button");
  button.textContent = days + " days";
  parentDiv.appendChild(button);

  // Don't allow more clicks and start recomputing
  button.addEventListener("click", () => {
    parentDiv.classList.add("disabled");
    self.port.emit("call_service", "resubmitRecentHistoryVisits", [days]);
  });
});

// Call the service to get the buckets and display results
self.port.emit("call_service", "getInterestsByNamespace", ["", {interestLimit: 100}]);

// Dispatch service responses to the appropriate function
self.port.on("called_service", function(method, args, result) {
  this["on" + method](args, result);
});

// Reload the page on a completed resubmit
function onresubmitRecentHistoryVisits(args, result) {
  location.reload();
}

// Update the table with top interests
function ongetInterestsByNamespace(args, result) {
  let table = document.getElementById("interestTable");
  result.forEach(({diversity, meta, name, recency, score}) => {
    let {duration, sharable, threshold} = meta;
    let {immediate, recent, past} = recency;
    let tr = document.createElement("tr");
    tr.innerHTML = "<td>" + name + "</td>" +
      "<td>" + immediate + "</td>" +
      "<td>" + recent + "</td>" +
      "<td>" + past + "</td>" +
      "<td>" + score + "</td>" +
      "<td>" + diversity + "</td>" +
      "<td><input type=\"checkbox\"/></td>";
    table.appendChild(tr);

    // Set the share status and allow toggling
    let checkbox = tr.lastChild.firstChild;
    checkbox.checked = sharable;
    checkbox.addEventListener("click", event => {
      let action = checkbox.checked ? "_unsetIgnoredForInterest" : "_setIgnoredForInterest";
      self.port.emit("call_service", action, [name]);
    });
  });
}

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});
