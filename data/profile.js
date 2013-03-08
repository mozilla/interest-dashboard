/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Make an explicit list of interests to ask for
const interests = ["arts", "banking", "blogging", "business", "career", "cars", "clothes", "computers", "consumer-electronics", "cuisine", "dance", "discounts", "drinks", "education", "email", "entertainment", "family", "fashion", "finance", "food", "games", "government", "health", "history", "hobby", "home", "image-sharing", "law", "maps", "marketing", "men", "motorcycles", "movies", "music", "news", "outdoors", "pets", "photography", "politics", "radio", "reading", "real-estate", "reference", "relationship", "religion", "reviews", "science", "shoes", "shopping", "society", "sports", "technology", "travel", "tv", "video-games", "weather", "women", "writing"];

// Call the service to get the buckets and display results
self.port.emit("call_service", "_getBucketsForInterests", [interests]);
self.port.on("called_service", function(method, args, result) {
  let table = document.getElementById("interestTable");
  Object.keys(result).forEach(function(interest) {
    let tr = document.createElement("tr");
    tr.innerHTML = "<td>" + interest + "</td>" +
      "<td>" + result[interest].immediate + "</td>" +
      "<td>" + result[interest].recent + "</td>" +
      "<td>" + result[interest].past + "</td>";
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
