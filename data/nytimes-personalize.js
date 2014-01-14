/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

self.port.on("recommend_on_page", function(data) {
  if(!data || !data.length) return;

  let mostEmailedWidget = document.querySelector("aside.marginalia.most-emailed-marginalia");
  if (mostEmailedWidget) {
    console.debug("adding marginalia element for new-style pages");
    let main = mostEmailedWidget.parentNode;
    let recommendations = document.createElement("aside");
    recommendations.className = "marginalia headliner-marginalia";
    recommendations.attributes["data-truncate-enabled"] = true;

    let header = document.createElement("header");
    let h2 = document.createElement("h2");
    h2.className = "module-heading";
    h2.innerHTML = "Recommended for you";
    header.appendChild(h2);

    let content = document.createElement("ol");
    for (let item of data) {
      let lineItem = document.createElement("li");

      let link = document.createElement("a");
      link.className = "story-link";
      link.href = item.url;

      let article = document.createElement("article");
      article.className = "story theme-summary";
      if (data.thumbUrl) {
        let thumbDiv = document.createElement("div");
        let thumbImg = document.createElement("img");
        thumbImg.attributes["src"] = item.thumbUrl;
        thumbDiv.className = "thumb";
        thumbDiv.appendChild(thumbImg);
        article.appendChild(thumbDiv);
      }
      let articleHeader = document.createElement("h2");
      articleHeader.className = "story-heading";
      articleSpan = document.createElement("span");
      articleSpan.className = "story-text truncate-text";
      articleSpan.innerHTML = item.title;

      articleHeader.appendChild(articleSpan);
      article.appendChild(articleHeader);
      link.appendChild(article);
      lineItem.appendChild(link);
      content.appendChild(lineItem);
    }

    recommendations.appendChild(header);
    recommendations.appendChild(content);
    main.insertBefore(recommendations, mostEmailedWidget);
  }


  let mostPopWidget = document.querySelector("#mostPopWidget");
  if (mostPopWidget) {
    console.debug("modifying mostPopular widget");

    // hide nytimes tabs
    let mostEmailedTab = document.querySelector("#mostPopTabMostEmailed");
    mostEmailedTab.style.display = "block";
    mostEmailedTab.className = "tab";
    let mostViewedTab = document.querySelector("#mostPopTabMostViewed");
    mostViewedTab.style.display = "none";
    mostViewedTab.className = "tab";
    let recommendationsTab = document.querySelector("#mostPopTabRecommendations");
    recommendationsTab.style.display = "none";
    recommendationsTab.className = "tab";

    // headliner tab
    let headlinerTab = document.createElement("li");
    headlinerTab.id = "mostPopTabHeadliner";
    headlinerTab.className = "tab selected";
    let headlinerTabLink = document.createElement("a");
    headlinerTabLink.href = "https://mozilla.org";
    headlinerTabLink.innerHTML = "Recommended for you";
    headlinerTab.appendChild(headlinerTabLink);

    let tabs = mostPopWidget.querySelector(".tabs");
    tabs.appendChild(headlinerTab);

    // hide nytimes content
    let mostEmailedContent = document.querySelector("#mostPopContentMostEmailed");
    mostEmailedContent.style.display = "none";
    mostEmailedContent.className = "tabContent";
    let mostViewedContent = document.querySelector("#mostPopContentMostViewed");
    mostViewedContent.style.display = "none";
    mostViewedContent.className = "tabContent";
    let recommendations = document.querySelector("#mostPopContentRecommendations");
    recommendations.style.display = "none";
    recommendations.className = "tabContent";

    // create and show headliner content
    let headlinerContent = document.createElement("div");
    headlinerContent.id = "mostPopContentHeadliner";
    headlinerContent.className = "tabContent tabContentActive";
    headlinerContent.style.display = "block";

    let contentTable = document.createElement("table");
    contentTable.className = "leftAlignedMostPop";
    let contentBody = document.createElement("tbody");
    for (let index in data) {
      let item = data[index];
      let contentRow = document.createElement("tr");

      let numberColumn = document.createElement("td");
      numberColumn.className = "listNumber";
      numberColumn.innerHTML = (parseInt(index)+1) + ".";

      let titleColumn = document.createElement("td");
      titleColumn.className = "mostPopularTitle";
      if (item.topic) {
        let topicHeader = document.createElement("h6");
        topicHeader.className = "kicker";
        topicHeader.innerHTML = item.topic;
        titleColumn.appendChild(topicHeader);
      }
      let title = document.createElement("h4");
      let titleLink = document.createElement("a");
      titleLink.href = item.url;
      titleLink.innerHTML = item.title;

      title.appendChild(titleLink);
      titleColumn.appendChild(title);
      contentRow.appendChild(numberColumn);
      contentRow.appendChild(titleColumn);
      contentBody.appendChild(contentRow);
    }

    contentTable.appendChild(contentBody);
    headlinerContent.appendChild(contentTable);
    mostPopWidget.appendChild(headlinerContent);
  }
});
