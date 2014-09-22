/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {Cc,Ci,Cm,Cr,Cu} = require("chrome");

Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
const {storage} = require("sdk/simple-storage");

const simplePrefs = require("sdk/simple-prefs");
const timers = require("sdk/timers");
const prefs = require("sdk/preferences/service");
const {PlacesInterestsUtils} = require("PlacesInterestsUtils");

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
    // 1 - do not track , 0 - ok do track
    "privacy.donottrackheader.value",
    // true - tell sites my tracking preferences,
    // false - say nothing to a site
    "privacy.donottrackheader.enabled",
    // true - never remember history - start in private mode
    // false - remember history
    "browser.privatebrowsing.autostart",
    // true - see browser.urlbar.autocomplete.enabled
    // false - Nothing
    "browser.urlbar.autocomplete.enabled",
    // 0 - History and Bookmarks
    // 1 - History
    // 2 - Bookmarks
    "browser.urlbar.default.behavior",
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

  // add relevant addon prefs
  results["nytimes_personalization_start"] = simplePrefs.prefs.nytimes_personalization_start;

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

exports.getHistoryDetails = function getHistoryDetails(category, historyIDs, visitListComplete, pageNum) {
  let deferred = Promise.defer();
  let visitMap = {};
  PlacesInterestsUtils.getHistoryDetails(historyIDs, item => {
    let host = NetUtil.newURI(item.url).host;
    let title = item.title;
    let key = String(roundToNearestXMinutes(item.timestamp, 1).getTime()) + host + title;
    if (!visitMap[key]) {
      visitMap[key] = {"timestamp": item.timestamp,
                       "url": item.url,
                       "domain": host,
                       "title": title,
                       "favicon": item.favicon,
                       "count": 0};
    }
    visitMap[key].count++;
  }).then(() => {
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
  return deferred.promise;
}

exports.getFaviconForHistoryVisit = function getFaviconForHistoryVisit(domain, historyID) {
  return PlacesInterestsUtils.getFaviconForHistoryVisit(historyID, item => {
    domain[2] = item;
  }, {"visitID": historyID});
}

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
