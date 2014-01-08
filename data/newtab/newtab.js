/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function makeXHTMLelement(elem) {
  return $(document.createElementNS("http://www.w3.org/1999/xhtml",elem))
}

function requestContent() {
  self.port.emit("recommend");
}

self.port.on("style", function(file) {
  let link = document.createElementNS('http://www.w3.org/1999/xhtml',"link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.documentElement.appendChild(link);
});

let tabGrid = $("#newtab-grid");
let sideMargin = $(".newtab-side-margin").clone();
let sideBar = $("<div>").
                  attr("id","sidebar").
                  css({"display": "-moz-box"}).
                  addClass("linkGrid");

tabGrid.parent().append(sideBar);
tabGrid.parent().append(sideMargin);

sideBar.scroll(function (event) {
  let jnode = $(event.target);
  //dump(event.target.scrollTop + " " + event.target.scrollHeight + " " + event.target.clientHeight + " " + jnode.innerHeight() + "\n");
});

self.port.on("show", function(data) {
  let ul = makeXHTMLelement("ul").addClass("linkList");
  sideBar.empty();
  sideBar.append(ul);
  for(let i in data.d) {
    let item = data.d[i];
    let itemNode = makeXHTMLelement("li").addClass("linkItem");
    if (item.media && Array.isArray(item.media)) {
      let mediaData = item.media[0]["media-metadata"];
      let imageUrl = mediaData[0].url;
      if (imageUrl) {
        itemNode.append(makeXHTMLelement("img").attr("src",imageUrl).addClass("linkImage"));
        itemNode.append(
          makeXHTMLelement("div").addClass("linkDiv").append(
            makeXHTMLelement("a").attr("href", item.url).text(item.title).addClass("linkRef"))
        );
      }
      else {
        itemNode.append(makeXHTMLelement("a").attr("href", item.url).text(item.title).addClass("linkRef"));
      }
    }
    else {
      itemNode.append(makeXHTMLelement("a").attr("href", item.url).text(item.title).addClass("linkRef"));
    }
    ul.append(itemNode);
  }
});

requestContent();
