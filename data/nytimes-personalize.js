/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

self.port.on("recommend_on_page", function([data, ribbonScriptUrl, oldStyleRubricScriptUrl]) {

  let ribbon = document.querySelector("#ribbon");
  if (ribbon) {
    console.debug("replace ribbon-menu element for new-style pages");

    let newRibbon = document.createElement("nav");
    newRibbon.id = "ribbon-headliner";
    newRibbon.className = "ribbon ribbon-start nocontent";
    newRibbon.setAttribute("role", "complementary");
    newRibbon.innerHTML = '<ol class="ribbon-menu"><li class="collection ribbon-loader"><div class="loader"><span class="visually-hidden">Loading...</span></div></li></ol><div class="ribbon-navigation-container"><nav class="ribbon-navigation next"><span class="visually-hidden">See next articles</span><div class="arrow arrow-right"><div class="arrow-conceal"></div></div></nav><nav class="ribbon-navigation previous"><span class="visually-hidden">See previous articles</span><div class="arrow arrow-left"><div class="arrow-conceal"></div></div></nav></div>';
    let node = document.querySelector("#shell").replaceChild(newRibbon, ribbon);

    let articles = [];
    for (let item of data) {
      let article = {};
      article.title = item.title;
      article.headline = item.title;
      article.kicker = item.topic;
      article.link = item.url;
      article.guid = item.url;
      article.description = "";
      article.byline = "";
      article.authors = [];
      article.type = "article";
      article.promotional_media = {
        type: "image",
        image: {
          image_crops: {
            thumbStandard: {
              width: 75,
              height: 75,
              url: item.thumbUrl,
            }
          }
        }
      };
      articles.push(article);
    }

    let collection = {
      items: articles
    }

    let ribbonDataElem = document.createElement("script");
    ribbonDataElem.type = "text/javascript";
    ribbonDataElem.textContent = "var headlinerRibbonData = " + JSON.stringify(articles) + ";";
    document.body.appendChild(ribbonDataElem);

    // inject new backbone collection, view and more
    let ribbonScriptElem = document.createElement("script");
    ribbonScriptElem.id = "headliner-script"
    ribbonScriptElem.src = ribbonScriptUrl;
    ribbonScriptElem.type = "text/javascript";
    document.body.appendChild(ribbonScriptElem);
  }

  if(!data || !data.length) return;

  let mostEmailedWidget = document.querySelector("aside.marginalia.most-emailed-marginalia");
  if (mostEmailedWidget) {
    console.debug("adding marginalia element for new-style pages");
    let main = mostEmailedWidget.parentNode;
    let recommendations = document.createElement("aside");
    recommendations.className = "marginalia headliner-marginalia";
    recommendations.setAttribute("data-truncate-enabled", true);

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
      if (item.thumbUrl) {
        let thumbDiv = document.createElement("div");
        let thumbImg = document.createElement("img");
        thumbImg.src = item.thumbUrl;
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
    console.debug("replacing mostPopular widget");

    let mostEmailedTab = document.querySelector("#mostPopTabMostEmailed");

    if (mostEmailedTab) {
      // old-style rubric
      let articles = [];
      for (let item of data) {
        let article = {};
        article.title = item.title;
        article.item_type = "article";
        article.url = item.url;
        article.kicker = item.topic;
        article.thumbnail = {
          url: item.thumbUrl,
        }
        articles.push(article);
      }
      let widgetElem = document.createElement("div");
      widgetElem.id = "mostPopWidgetHeadliner";
      widgetElem.className = "doubleRule nocontent";

      let scriptElem = document.createElement("script");
      scriptElem.type = "text/javascript";
      scriptElem.src = oldStyleRubricScriptUrl;
      widgetElem.appendChild(scriptElem);

      let scriptDataElem = document.createElement("script");
      scriptDataElem.type = "text/javascript";
      scriptDataElem.textContent = "var headlinerOldStyleRubric = " + JSON.stringify(articles) + ";";
      document.body.appendChild(scriptDataElem);
      mostPopWidget.parentNode.replaceChild(widgetElem, mostPopWidget);
    }
    else {
      // new-style rubric
      mostPopWidget.style.display = "block !important";
      let recommendedHeader = document.createElement("li");
      recommendedHeader.className = "selected";
      recommendedHeader.innerHTML = "<a href=\"#\">Recommended</a>"
      let currentSelected = mostPopWidget.querySelector(".tabs .selected");
      currentSelected.className = "";

      let tabHeaders = mostPopWidget.querySelector("ul.tabs");
      let tabs = tabHeaders.querySelectorAll("li");
      tabHeaders.replaceChild(recommendedHeader, tabs[tabs.length-1]);

      // hide nytimes content
      let mostEmailedContent = document.querySelector("#mostEmailed");
      if (mostEmailedContent) {
        mostEmailedContent.style.display = "none";
        mostEmailedContent.className = "tabContent";
      }
      let mostViewedContent = document.querySelector("#mostViewed");
      if (mostViewedContent) {
        mostViewedContent.style.display = "none";
        mostViewedContent.className = "tabContent";
      }
      let blogged = document.querySelector("#mostBlogged");
      if (blogged) {
        blogged.style.display = "none";
        blogged.className = "tabContent";
      }
      let searched = document.querySelector("#mostSearched");
      if (searched) {
        searched.style.display = "none";
        searched.className = "tabContent";
      }

      let mostRecommended = document.createElement("div");
      mostRecommended.className = "tabContent tabContentActive";
      mostRecommended.id = "mostRecommended";
      mostRecommended.style.overflow = "hidden";
      mostRecommended.style.display = "block";

      let olRecommended = document.createElement("ol");
      for (let item of data) {
        let container = document.createElement("li");
        container.setAttribute("kicker", item.topic || "")
        container.setAttribute("img", item.thumbUrl || "")
        let link = document.createElement("a");
        link.href = item.url;
        link.setAttribute("title", "Click to go to this article");
        link.innerHTML = item.title;
        container.appendChild(link);
        olRecommended.appendChild(container);
      }
      mostRecommended.appendChild(olRecommended);
      let mozLink = document.createElement("a");
      mozLink.className = "more";
      mozLink.href = "https://mozilla.org";
      mostRecommended.appendChild(mozLink);
      mostPopWidget.appendChild(mostRecommended);
    }
  }
});
