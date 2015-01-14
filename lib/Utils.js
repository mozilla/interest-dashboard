/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu,CC} = require("chrome");

Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/PlacesUtils.jsm");
const {storage} = require("sdk/simple-storage");

const XMLHttpRequest = CC("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");
const simplePrefs = require("sdk/simple-prefs");
const timers = require("sdk/timers");
const prefs = require("sdk/preferences/service");
const {PlacesInterestsUtils} = require("PlacesInterestsUtils");
const bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
const ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

// timeout for fetching favicon
let DEFAULT_TIMEOUT = 3000;

/**
 * Merge obj2 into obj1.
 * @params obj1, obj2 Javascript Objects. obj2's properties will be added to obj1
 *
 * @returns obj1
 */
exports.mergeObjects = function mergeObjects(obj1, obj2) {
  for (var prop in obj2) {
    if ( typeof obj2[prop] == "object" ) {
      if ( !obj1.hasOwnProperty(prop) ) {
        obj1[prop] = obj2[prop];
      }
      else {
        obj1[prop] = mergeObjects(obj1[prop], obj2[prop]);
      }
    } else {
      obj1[prop] = obj2[prop];
    }
  }
  return obj1;
}

/**
 * Gives the size of a string in bytes
 * @params s a string
 *
 * @returns size in bytes
 */
exports.byteCount = function byteCount(s) {
  return encodeURI(s).split(/%..|./).length - 1;
}


/**
 * Resolves a promise after specified delay
 * @params milisecondsDelay
 *         a delay in ms
 * @returns promise to be resolved after delay passes
 */
exports.promiseTimeout = function promiseTimeout(milisecondsDelay) {
  let deferred = Promise.defer();
  timers.setTimeout(() => {deferred.resolve();},milisecondsDelay);
  return deferred.promise;
}

/**
 * Collectis preferences affecting history
 * @returns relevant preferences and thier values
 */
exports.getRelevantPrefs = function getRelevantPrefs() {
  let prefList = [
    // true - tell sites my tracking preferences,
    // false - say nothing to a site
    "privacy.donottrackheader.enabled",
    // true - never remember history - start in private mode
    // false - remember history
    "browser.privatebrowsing.autostart",
    // true - see browser.urlbar.autocomplete.enabled
    // false - Nothing
    "browser.urlbar.autocomplete.enabled",
    // 0 - all cookies
    // 1 - cookies from originating
    // 2 - no cookies
    // 3 - visited cookies
    "network.cookie.cookieBehavior",
    // 0 - keep until expire
    // 1 - always ask
    // 2 - keep until close
    "network.cookie.lifetimePolicy",
    // true - clear history on shutdown
    "privacy.sanitize.sanitizeOnShutdown",
    // true - keep history
    // false - do not keep history
    "places.history.enabled",
    // true keep formfill database
    "browser.formfill.enable",
  ];

  let results = {};
  prefList.forEach(pref => {
    let value;
    switch (Services.prefs.getPrefType(pref)) {
      case Services.prefs.PREF_BOOL:
        value = Services.prefs.getBoolPref(pref);
        break;
      case Services.prefs.PREF_INT:
        value = Services.prefs.getIntPref(pref);
        break;
      case Services.prefs.PREF_STRING:
        value = Services.prefs.getCharPref(pref);
        break;
      default:
        value = "invalid_type";
    }
    results[pref] = value;
  });

  return results;
}

/**
 * Returns user agent locale
 */
exports.getUserAgentLocale = function getUserAgentLocale() {
  // if localized version returns null, use prefs.get directly
  return prefs.getLocalized("general.useragent.locale") || prefs.get("general.useragent.locale");
}

exports.getPlacesHostForURI = function getPlacesHostForURI(uri) {
  try {
    return uri.host.replace(/^www\./, "");
  }
  catch(ex) {}
  return "";
}

exports.getBaseDomain = function getBaseDomain(host) {
  try {
    return Services.eTLD.getBaseDomainFromHost(host);
  }
  catch (ex) {
    switch (ex.result) {
      case Cr.NS_ERROR_HOST_IS_IP_ADDRESS:
        return host;
        break;
    }
    return "";
  }
}

exports.getPublicSuffix = function getPublicSuffix(host) {
    try {
      return Services.eTLD.getPublicSuffixFromHost(host);
    }
    catch (ex) {
      switch (ex.result) {
        case Cr.NS_ERROR_HOST_IS_IP_ADDRESS:
          return "is-ip";
          break;
      }
      return null;
    }
}

/**
 * Computes user interests from moz_hosts table
 *
 * Order moz_hosts by frecency and walk hosts down
 * computing interests of slices of top hosts at
 * position between 1 and 10, then computing interests
 * at slices on each 10th position
 */
exports.computeInterestsFromHosts = function computeInterestsFromHosts(interestsDFR) {
  let interests = {};
  let hostsSeen = 0;
  let interestsSeen = false;
  let lastFrecency;
  let lastInterestsString;
  let interestsSlices = {};

  function saveLastInterestsSlice(alwaysSave = false) {
    if (interestsSeen && (alwaysSave || hostsSeen < 10 || (hostsSeen % 10) == 0)) {
      interestsString = JSON.stringify(interests);
      if (lastInterestsString != interestsString) {
        interestsSlices[hostsSeen + ""] = {
          interests: JSON.parse(interestsString),
          frecency: lastFrecency,
        };
        lastInterestsString = interestsString;
      }
    }
  };
  // read moz_hosts data and compute interests
  return PlacesInterestsUtils.getMozHosts(item => {
      let {host, frecency} = item;
      if (interestsDFR[host] && interestsDFR[host]["__ANY"]) {
        interestsSeen = true;
        let interest = interestsDFR[host]["__ANY"];
        interests[interest] = (interests[interest] || 0) + frecency;
      }
      hostsSeen ++;
      lastFrecency = frecency;
      saveLastInterestsSlice();
  }).then(() => {
    // return collected interests slices
    if (interestsSlices[hostsSeen + ""] == null) {
      saveLastInterestsSlice(true);
    }
    return interestsSlices;
  }, Cu.reportError);
}

function roundToNearestXMinutes(timestamp, xMinutes) {
  let coeff = 1000 * 60 * xMinutes; // 1 minute in ms = 1000ms * 60
  let date = new Date(Math.floor(timestamp / 1000));
  return new Date(Math.floor(date.getTime() / coeff) * coeff);
}

function visitMapToSortedVisitData(visitMap) {
  let visitData = [];
  for (let key in visitMap) {
    visitData.push(visitMap[key]);
  }
  return visitData.sort(propertyComparator("timestamp"));
}

function propertyComparator(property) {
  return function(a, b) {
      return b[property] - a[property];
  };
}

function _getFavicon(faviconURL) {
  let faviconPromise = Promise.defer();
  let xhr = new XMLHttpRequest();
  let unresolved = function() {
    faviconPromise.resolve("");
  }
  xhr.mozBackgroundRequest = true;
  xhr.onload = function() {
    if (this.status == 401 || this.status == 404) {
      unresolved();
    } else {
      faviconPromise.resolve(faviconURL);
    }
  };
  xhr.open("get", faviconURL, true);
  xhr.timeout = DEFAULT_TIMEOUT;
  xhr.ontimeout = unresolved;
  xhr.onerror = unresolved;
  xhr.send();
  return faviconPromise.promise;
}

function _isBookmarked(uri, title) {
  let ids = bmsvc.getBookmarkIdsForURI(uri);
  for (let id of ids) {
    if (bmsvc.getItemTitle(id) == title) {
      return true;
    }
  }
}

exports.getHistoryDetails = function getHistoryDetails(category, historyIDs, visitListComplete, pageNum, subcats) {
  let deferred = Promise.defer();
  let visitMap = {};
  let faviconPromises = [];
  PlacesInterestsUtils.getHistoryDetails(historyIDs, item => {
    let host = NetUtil.newURI(item.url).host;
    let title = item.title;
    let key = String(roundToNearestXMinutes(item.timestamp, 1).getTime()) + host + title;
    if (!visitMap[key]) {
      visitMap[key] = {"timestamp": item.timestamp,
                       "url": item.url,
                       "domain": host,
                       "title": title,
                       "count": 0,
                       "isBookmarked": false,
                       "subcat": subcats[item.timestamp]};

      let uri = ios.newURI(item.url, null, null);
      if (_isBookmarked(uri, title)) {
        visitMap[key].isBookmarked = true;
      }
      if (item.favicon) {
        let faviconPromise = _getFavicon(item.favicon);
        faviconPromises.push(faviconPromise);
        faviconPromise.then((faviconURL) => {
          visitMap[key].favicon = faviconURL;
        });
      }
    }
    visitMap[key].count++;
  }).then(() => {
    Promise.all(faviconPromises).then(() => {
      if (!storage.chartData.interestDashboardData.historyVisits) {
        storage.chartData.interestDashboardData.historyVisits = {};
      }
      if (!storage.chartData.interestDashboardData.historyVisits[category]) {
        storage.chartData.interestDashboardData.historyVisits[category] = {"visitData": []};
      }

      storage.chartData.interestDashboardData.historyVisits[category].visitData =
        storage.chartData.interestDashboardData.historyVisits[category].visitData.concat(visitMapToSortedVisitData(visitMap));
      storage.chartData.interestDashboardData.historyVisits[category].pageNum = pageNum;
      storage.chartData.interestDashboardData.historyVisits[category].pageResponseSize = Object.keys(visitMap).length
      storage.chartData.interestDashboardData.historyVisits[category].complete = visitListComplete;

      deferred.resolve();
    });
  });
  return deferred.promise;
}

exports.getFaviconForHistoryVisit = function getFaviconForHistoryVisit(domain, historyID) {
  let deferred = Promise.defer();
  PlacesInterestsUtils.getFaviconForHistoryVisit(historyID, item => {
    if (item) {
      let faviconPromise = _getFavicon(item);
      faviconPromise.then((faviconURL) => {
        domain[2] = faviconURL;
        deferred.resolve();
      });
    } else {
      domain[2] = "";
      deferred.resolve();
    }
  }, {"visitID": historyID});
  return deferred.promise;
}

exports.shouldSkip = function shouldSkip(url) {
  let urlFilterList = [
      "[0-9]+.[0-9]+.[0-9]+.[0-9]", // IP addresses
      "accounts.google.com",
      "app.*.*",
      "drive.google.com",
      "facebook.com",
      "github.com",
      "google.com/calendar",
      "google.com/maps/",
      "linkedin.com",
      "login",
      "mail.*.*",
      "sign_in",
      "signin",
      "sign up",
      "signup",
    ];

  let skipURL = false;
  for (let domain of urlFilterList) {
    let patt = new RegExp(domain, "i");
    if (patt.test(url)) {
      skipURL = true;
      break;
    }
  }
  return skipURL;
};

exports.DataProcessorHelper = {
  initChartInStorage: function(dataNameString, storageBackend) {
    let storageObj = storageBackend || storage;
    if (!storageObj.chartData) {
      storageObj.chartData = {};
    }
    if (!storageObj.chartData[dataNameString]) {
      storageObj.chartData[dataNameString] = {};
    }
  },

  iterateOverTypeNamespace: function(bucketData, storageData, dataProcessingFunction) {
    for (let type in bucketData) {
      for (let namespace in bucketData[type]) {
        if (!storageData[type]) {
          storageData[type] = {};
        }
        if (!storageData[type][namespace]) {
          storageData[type][namespace] = {};
        }
        dataProcessingFunction(bucketData[type][namespace], storageData[type][namespace], type, namespace);
      }
    }
  },
}
