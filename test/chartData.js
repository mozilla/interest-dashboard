/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let categoryComputing = {
                    "visitCount": 5,
                    "maxWeight": 3,
                    "name": "technology & computing",
                    "days": {
                        "16361": {
                            "x": 1413590400000,
                            "size": 3,
                            "domainList": {
                                "mozilla.org": 1,
                                "support.mozilla.org": 1,
                                "developer.mozilla.org": 1
                            }
                        },
                        "16358": {
                            "x": 1413331200000,
                            "size": 2,
                            "domainList": {
                                "dxr.mozilla.org": 1,
                                "phonebook.mozilla.org": 1
                            }
                        }
                    },
                    "visitIDs": [1413304843845030, 1413304847283524, 1413556086723392, 1413556346835269, 1413556429978843],
                    "subcats": {
                        "1413556086723392": "general",
                        "1413304843845030": "general",
                        "1413304847283524": "general"
                    },
                    "maxWeightDate": "16361",
                    "dayCount": 2,
                    "x": 2,
                    "y": 2,
                    "intentDist": 1,
                    "interestDist": 0,
                    "rank": 1
                }

let categoryComputingNoRank = JSON.parse(JSON.stringify(categoryComputing)); // Make copy of categoryComputing
delete categoryComputingNoRank['rank'];

exports.dayAnnotatedThreeChartProcessorConsumeResults = {
    "rules": {
        "dfr_rules": {
            "_type": "rules",
            "_namespace": "dfr_rules",
            "maxDay": "16361",
            "minDay": "16358",
            "categories": {
                "technology & computing": categoryComputing,
                "health & fitness": {
                    "visitCount": 1,
                    "maxWeight": 1,
                    "name": "health & fitness",
                    "days": {
                        "16361": {
                            "x": 1413590400000,
                            "size": 1,
                            "domainList": {
                                "md-health.com": 1
                            }
                        }
                    },
                    "visitIDs": [1413565015381142],
                    "subcats": {
                        "1413565015381142": "general"
                    },
                    "maxWeightDate": "16361",
                    "dayCount": 1,
                    "x": 1,
                    "y": 1,
                    "intentDist": 1,
                    "interestDist": 1.4142135623730951,
                    "rank": 2
                }
            },
            "capturedRankings": {},
            "sortedInterests": [categoryComputingNoRank, {
                "visitCount": 1,
                "maxWeight": 1,
                "name": "health & fitness",
                "days": {
                    "16361": {
                        "x": 1413590400000,
                        "size": 1,
                        "domainList": {
                            "md-health.com": 1
                        }
                    }
                },
                "visitIDs": [1413565015381142],
                "subcats": {
                    "1413565015381142": "general"
                },
                "maxWeightDate": "16361",
                "dayCount": 1,
                "x": 1,
                "y": 1,
                "intentDist": 1,
                "interestDist": 1.4142135623730951
            }],
            "sortedIntents": [categoryComputingNoRank, {
                "visitCount": 1,
                "maxWeight": 1,
                "name": "health & fitness",
                "days": {
                    "16361": {
                        "x": 1413590400000,
                        "size": 1,
                        "domainList": {
                            "md-health.com": 1
                        }
                    }
                },
                "visitIDs": [1413565015381142],
                "subcats": {
                    "1413565015381142": "general"
                },
                "maxWeightDate": "16361",
                "dayCount": 1,
                "x": 1,
                "y": 1,
                "intentDist": 1,
                "interestDist": 1.4142135623730951
            }],
            "xMax": 2,
            "xMin": 1,
            "yMax": 2,
            "yMin": 1
        }
    }
}