var NYTD = NYTD || {};
NYTD.mostPopWidgetHeadliner = (function() {
  // Config
  var mostPoplimit = 10;
  NYTD.MostPop = {};

  // Service URLs
  var mostEmailedUrl = '/svc/most-popular/getdata.json?type=mostemailed';
  var mostViewedUrl  = '/svc/most-popular/getdata.json?type=mostviewed';
  var recommendedUrl = '';

  // Get page content type
  NYTD.MostPop.CG = $$('meta[name=CG]')[0].content;
  NYTD.MostPop.PST = $$('meta[name=PST]')[0].content;
  if (NYTD.MostPop.CG == "Homepage") {
    NYTD.MostPop.contentType = 'Homepage';
    mostEmailedUrl += '&hp=1';
    mostViewedUrl += '&hp=1';
    recommendedUrl += '&hp=1';
  } else if (NYTD.MostPop.CG == 'opinion') {
    NYTD.MostPop.contentType = 'Opinion';
  } else if (NYTD.MostPop.CG == 'Member Center' && NYTD.MostPop.PST == 'Error Page') {
    NYTD.MostPop.contentType = 'Error Page';
  }

  NYTD.MostPop.EventLog = {
    "mostPopContentRecommendationsHeadliner" : "unloaded",
    "mostPopContentMostEmailedHeadliner" : "unloaded",
    "mostPopContentMostViewedHeadliner" : "unloaded"
  };

  function activateRecommended() {
    $('mostPopTabRecommendationsHeadliner').setStyle({"display":"block"}).addClassName('selected');
    $('mostPopTabMostEmailedHeadliner').setStyle({"display":"block"}).removeClassName('selected');
    $('mostPopContentMostEmailedHeadliner').setStyle({"display":"none"}).removeClassName('tabContentActive');
    $('mostPopContentRecommendationsHeadliner').setStyle({"display":"block"}).addClassName('tabContentActive');
    $('mostPopTabMostViewedHeadliner').setStyle({"display":"none"}).removeClassName('selected');
    $('mostPopContentMostViewedHeadliner').setStyle({"display":"none"}).removeClassName('tabContentActive');
    $$('.showRecommended').each(function(el){
      el.setStyle({"display":"none"});
    });

    if (NYTD.MostPop.EventLog['mostPopContentRecommendationsHeadliner'] != "loaded") {
      loadData(recommendedUrl, 'mostPopContentRecommendationsHeadliner');
    }
  }

  function deactivateRecommended() {
    $('mostPopTabMostViewedHeadliner').setStyle({"display":"block"});
    $('mostPopTabMostEmailedHeadliner').setStyle({"display":"block"}).addClassName('selected');
    $('mostPopContentMostEmailedHeadliner').setStyle({"display":"block"}).addClassName('tabContentActive');
    $('mostPopTabRecommendationsHeadliner').setStyle({"display":"none"}).removeClassName('selected');
    $('mostPopContentRecommendationsHeadliner').setStyle({"display":"none"}).removeClassName('tabContentActive');
    $$('.showRecommended').each(function(el){
      el.setStyle({"display":"block"});
    });

    if (NYTD.MostPop.EventLog['mostPopContentMostEmailedHeadliner'] != "loaded") {
      loadData(mostEmailedUrl, 'mostPopContentMostEmailedHeadliner');
    }
  }

  // Ajax Calls

  function loadData(url, id) {
    if (id == "mostPopContentRecommendationsHeadliner") {
      var json = headlinerOldStyleRubric;
      var tracking = '';
      if (json && json.length > 0) {
        populateMostPop(json, $(id), tracking, id);
        NYTD.MostPop.EventLog[id] = "loaded";
      }
      else {             
        if (id == "mostPopContentRecommendationsHeadliner") { 
          deactivateRecommended();
        }
        else {
          errorMessage($(id));
        }             
      }
      $$('#'+id+' .loader').invoke('remove');
    }
    else {
      new Ajax.Request(url, {
        method: 'get',
        onComplete: function(transport) {

          try {
            var response = transport.responseText.evalJSON();
          } 
          catch(e) {
            errorMessage($(id));
          }

          switch(id) {
            case "mostPopContentMostEmailedHeadliner":
              var json = response.articles;
              var tracking = '?src=me&ref=general';
              break;
            case "mostPopContentMostViewedHeadliner":
              var json = response.articles;
              var tracking = '?src=mv&ref=general';
              break;
            default:
              var json = response.articles;
              var tracking = '?src=mv&ref=general';
          }
          if (json && json.length > 0) {
            populateMostPop(json, $(id), tracking, id);
            NYTD.MostPop.EventLog[id] = "loaded";
          }
          else {             
            if (id == "mostPopContentRecommendationsHeadliner") { 
              deactivateRecommended();
            }
            else {
              errorMessage($(id));
            }             
          }
          $$('#'+id+' .loader').invoke('remove');
        },
          onFailure: function(transport) {
            errorMessage($(id));
          }
      }); 
    }
  }

  // Create Error Message

  function errorMessage(target) {
    if(target == $("mostPopContentRecommendationsHeadliner")){
      errorHTML = '<div class="errorMessage"><p><b>We don&rsquo;t have any personalized recommendations for you at this time. Please try again later.</b></p></div>';
      target.childElements().each(function(el){
        el.setStyle({"display":"none"});
      });
    } else {
      errorHTML = '<div class="errorMessage"><p><b>This article list is not currently available. Please try again later.</b></p></div>';
    }
    target.select('.loader').invoke('remove');
    target.select('.errorMessage').invoke('remove');
    target.insert({ top : errorHTML});
  }

  // Inject HTML
  function populateMostPop(item, target, tracking, id) {  
    // Build HTML
    var mostPopHTML = '<table class="leftAlignedMostPop"><tbody>';
    var img = "";
    var kicker;
    for (var i=0, len = item.length; i < len; i++) {
      var title = item[i].title;
      if (i >= mostPoplimit) {
        break;
      }
      if (id == "mostPopContentRecommendationsHeadliner") {
        if (item[i].item_type == "Video") {
          title = "Video: "+item[i].title;
        }
      }
      if (NYTD.MostPop.contentType !== "Homepage") {
        if (item[i].thumbnail != null) {
          var img = '<td class="mostPopularImg"><a title="Click to go to this article" href="'+Bleach.sanitizeURL(item[i].url + tracking) +
                    '"><img src="'+Bleach.sanitizeURL(item[i].thumbnail.url)+'"></a></td>';
        } 
        else { 
          var img = "<td></td>"; 
        }
      }
      if (item[i].kicker != null) {
        if (item[i].kicker === "Op-Ed Columnist") {
          kicker = item[i].byline.substr(3);
        }
        else {
          kicker = item[i].kicker;
        } 
      } 
      else {  
        kicker = ""; 
      }
      mostPopHTML += '<tr>'+ 
        img +'<td class="listNumber">'+ 
        (i+1) +'.</td><td class="mostPopularTitle"><h6 class="kicker">'+ Bleach.sanitize(kicker) + '</h6><h4><a title="Click to go to this article" href="'+
        Bleach.sanitizeURL(item[i].url + tracking, true) +'">'+
        Bleach.sanitize(title) +'</a></h4></td></tr>\n';
    }
    mostPopHTML += '</tbody></table>';
    //Clean Up existing stuff
    var existingTable = target.select('table.leftAlignedMostPop');
    var isTable = existingTable.length;
    if (!isTable) {} 
    else { 
      existingTable[0].remove();
    }
    var errors = target.select('.errorMessage');
    var isError = errors.length;
    if (!isError) {} 
    else { 
      errors[0].remove();
    }
    // Print 
    target.insert({ top : mostPopHTML});
  }

  // New CSS styles
  var cssStyle = '#mostPopWidgetHeadliner.doubleRule { background:url("'+ NYTD.Hosts.imageHost +'/images/global/borders/aColumnHorizontalBorder.gif") repeat-x scroll 0 16px transparent !important; border-width:0 !important; clear:both; height:auto !important; margin-bottom:0 !important; } \
#mostPopWidgetHeadliner .kicker{ margin:0; font-size:10px !important; font-family: arial, helvetica, sans-serif; font-weight:normal; text-transform:uppercase;}\
#mostPopWidgetHeadliner h4{ font-weight: bold }\
#mostPopWidgetHeadliner ol{display:none;}\
#mostPopWidgetHeadliner #tabsContainer{position:static; bottom:0; left:0 !important}\
#mostPopWidgetHeadliner .tabs{padding:0 0 0 6px !important;text-transform:uppercase; margin-bottom: -1px; }\
#mostPopWidgetHeadliner .tabs li{ width:150px;border-top-width:0 !important;border-right-width:0 !important;border-bottom-width:0 !important;border-left-width:0 !important;background:none;text-align:center;height:24px !important;line-height:2.25em;margin:0 -2px 0 0 !important;padding-top:13px !important ;font-weight:bold;}\
#mostPopWidgetHeadliner .tabs li.selected{ background:url("'+ NYTD.Hosts.imageHost +'/images/recommendations/plainTab160Tall.gif") no-repeat scroll center bottom !important;border-right:0 none !important;margin:0 0 0 0 !important;height:23px !important;}\
#mostPopWidgetHeadliner .tabContent{ padding:4px 0 0 0;border:0;border-top:1px solid #cacaca;}\
#mostPopWidgetHeadliner .tabContent .loader {text-align: center; padding:40px 0; }\
#mostPopWidgetHeadliner .tabContent .loader img { width:18px; height: 18px; }\
#mostPopWidgetHeadliner .tabContent table{border-collapse:collapse; width:100%; }\
#mostPopWidgetHeadliner .tabContent table td{text-align:left !important; font-size:13px !important; height:35px; vertical-align:top; padding:6px 0 4px 0; border-bottom:1px solid #E2E2E2;}\
#mostPopWidgetHeadliner .tabContent table tr.last td{border-bottom:0px;}\
#mostPopWidgetHeadliner .tabContent table td.listNumber{padding:6px 10px 4px 3px;font-size:1.3em; text-align:right !important}\
#mostPopWidgetHeadliner .tabContent table td.mostPopularImg{width:30px; padding: 4px 6px 4px 0; }\
#mostPopWidgetHeadliner .tabContent table td.mostPopularTitle{padding-top:7px;}\
#mostPopWidgetHeadliner .tabContent table.leftAlignedMostPop td.mostPopularImg{ padding-right:6px; }\
#mostPopWidgetHeadliner .tabContent table.rightAlignedMostPop td.mostPopularImg{ padding-right:0px; padding-left:6px; }\
#mostPopWidgetHeadliner .tabContent td.mostPopularImg img{ width:48px;}\
#mostPopWidgetHeadliner .tabContent h4{ font-weight:normal; text-align:left !important; text-transform:none !important; font-size:13px !important;line-height:1.15em !important;margin-bottom:3px !important;font-family:georgia,"times new roman",times,serif !important;}\
#mostPopWidgetHeadliner .mostFooter {  font-family: arial, helvetica, sans-serif; margin:8px 0 0 0;}\
#mostPopWidgetHeadliner .mostFooter p {font-size: 11px;} \
#articlesPastMonth { font-size: 34px; margin-right: 9px; float:left; line-height:30px}\
#recommendedAdContainer { text-align:center}\
#recommendedAdContainer iframe { border:0; }\
#recommendedAdContainer #recommendedAd { margin-top: 5px; }\
#recommendedAdContainer span {font-size:7px; text-transform: uppercase; color:#999;}\
                 .hideRecommended:hover,\
                 .showRecommended:hover,\
#mostPopWidgetHeadliner .tabContent .errorMessage { padding:30px 20px; color: #999; font-family: arial, helvetica, sans-serif; border-bottom: 1px solid #E2E2E2; }\
#mostPopWidgetHeadliner .tabContent .errorMessage p{ font-size:11px;  } \
                 ';

                 // Homepage style

                 if (NYTD.MostPop.contentType == "Homepage") {
                   cssStyle += " \
#home #mostPopWidgetHeadliner .tabContent table td{ border-bottom: 0 !important; height: auto; padding-bottom: 2px;} \
#home #mostPopWidgetHeadliner .tabContent table td.mostPopularTitle h4 { font-weight: bold !important; font-size: 12px !important; }\
#home #mostPopWidgetHeadliner .tabContent table { margin: 4px 0 6px; }\
#home #mostPopWidgetHeadliner .mostFooter { margin:0; padding-top: 8px; border-top: 1px solid #E2E2E2 !important; }\
#home #mostPopWidgetHeadliner .tabContent .errorMessage { border-bottom: none;  } \
                                ";
                 }


  if (NYTD.MostPop.contentType == "Opinion") {
    cssStyle += '#mostPopWidgetHeadliner .tabs li.selected {\
      background: #F4F4F4 !important;\
        border-top:1px solid #ccc !important;\
        border-left:1px solid #ccc !important;\
        border-right:1px solid #ccc !important;\
        height:23px !important;\
        margin:0 !important;\
    }\
#mostPopWidgetHeadliner .tabs li {\
  background: none !important;\
  border:0 none !important;\
  height:23px !important;\
  margin:0 !important;\
}'; 
    }

if (NYTD.MostPop.contentType == "Error Page") {
  cssStyle += '#mostPopWidgetHeadliner #tabsContainer {\
    display: none;\
      padding-top: 0;\
  }\
#mostPopWidgetHeadliner.doubleRule {\
  background: none !important;\
  padding-top: 0;\
}\
#mostPopWidgetHeadliner .tabContent {\
  border: 0 !important;\
  padding-top: 0;\
}\
#mostPopWidgetHeadliner .tabContent h4 {\
  font-family: arial,helvetica,sans-serif !important;\
  font-size: 14px !important;\
}\
#mostPopWidgetHeadliner .tabContent table td.mostPopularTitle {\
  padding-top: 6px;\
}\
#mostPopWidgetHeadliner .tabContent table td {\
  border-bottom: 0;\
  font-size: 14px !important;\
}\
#mostPopWidgetHeadliner .tabContent table td.listNumber {\
  font-weight: bold;\
  width: 20px;\
}\
#mostPopWidgetHeadliner .showRecommended {\
  display: none !important;\
}\
#mostPopWidgetHeadliner .tabContent table.leftAlignedMostPop td.mostPopularImg {\
  padding: 6px 6px 6px 0;\
}\
  '; 
  }

  // Load CSS 
  function appendStyleTag(styleStr) {
    var newNode = document.createElement('style');
    newNode.setAttribute("type", "text/css");
    if (newNode.styleSheet) {
      // IE
      newNode.styleSheet.cssText = styleStr;
    } else {
      newNode.appendChild(document.createTextNode(styleStr));
    }
    $$('head')[0].appendChild(newNode);
  }

  appendStyleTag(cssStyle);

  var mostPopShell = '<!-- MOST POPULAR MODULE STARTS -->\
                   <div id="tabsContainer">\
                   <ul class="tabs">\
                   <li id="mostPopTabMostEmailedHeadliner" class="tab" style="display: none;"><a href="http://www.nytimes.com/gst/mostpopular.html">MOST EMAILED</a></li>\
                   <li id="mostPopTabMostViewedHeadliner" class="tab" style="display: none;"><a href="http://www.nytimes.com/gst/mostpopular.html">MOST VIEWED</a></li>\
                   <li id="mostPopTabRecommendationsHeadliner" class="tab" style="display: none;"><a href="#">RECOMMENDED FOR YOU</a></li>\
                   </ul>\
                   </div>\
                   \
                   <div id="mostPopContentMostEmailedHeadliner" class="tabContent" style="display: none;">\
                   <div class="loader"><img src="'+ NYTD.Hosts.imageHost +'/images/loaders/loading-grey-lines-circle-18.gif" /></div>\
                   <div class="mostFooter opposingFloatControl wrap"><p class="element1"><a href="http://www.nytimes.com/gst/mostpopular.html">Go to Complete List &raquo;</a></p>\
                   <p class="element2"><a class="showRecommended">Show My Recommendations</a></p></div>\
                   </div>\
                   \
                   <div id="mostPopContentMostViewedHeadliner" class="tabContent" style="display: none;">\
                   <div class="loader"><img src="'+ NYTD.Hosts.imageHost +'/images/loaders/loading-grey-lines-circle-18.gif" /></div>\
                   <div class="mostFooter opposingFloatControl wrap"><p class="element1"><a href="http://www.nytimes.com/gst/mostpopular.html">Go to Complete List &raquo;</a></p>\
                   <p class="element2"><a class="showRecommended">Show My Recommendations</a></p></div>\
                   </div>\
                   \
                   <div id="mostPopContentRecommendationsHeadliner" class="tabContent" style="display: none;">\
                   <div class="loader"><img src="'+ NYTD.Hosts.imageHost +'/images/loaders/loading-grey-lines-circle-18.gif" /></div>\
                   \
                   </div>\
                   \
                   <!-- MOST POPULAR MODULE ENDS -->';

  // Init 

  var init = (function() {

    //Build initial HTML
    $('mostPopWidgetHeadliner').insert(mostPopShell);

    // Click Handlers

    $('mostPopTabMostEmailedHeadliner').observe('click', respondToClickMostEmailed);
    function respondToClickMostEmailed(event) {
      var url = mostEmailedUrl;
      if (NYTD.MostPop.EventLog['mostPopContentMostEmailedHeadliner'] != "loaded") {
        loadData(url, "mostPopContentMostEmailedHeadliner");
      }
    }

    $('mostPopTabMostViewedHeadliner').observe('click', respondToClickMostViewed);
    function respondToClickMostViewed(event) {
      var url = mostViewedUrl;
      if (NYTD.MostPop.EventLog['mostPopContentMostViewedHeadliner'] != "loaded") {
        loadData(url, "mostPopContentMostViewedHeadliner");
      }
    } 

    $('mostPopTabRecommendationsHeadliner').observe('click', respondToClickRecommendations);
    function respondToClickRecommendations(event) {
      var url = recommendedUrl;
      if (NYTD.MostPop.EventLog['mostPopContentRecommendationsHeadliner'] != "loaded") {
        loadData(url, "mostPopContentRecommendationsHeadliner");
      }
    }

    // Hide Rec Handler
    $$('.hideRecommended').each(function(el){ 
      el.observe('click', deactivateRecommended);
    });

    // Show Rec Handler
    $$('.showRecommended').each(function(el){ 
      el.observe('click', activateRecommended);
    });

    activateRecommended();
    new Accordian("mostPopWidgetHeadliner");
  })();   

})();
