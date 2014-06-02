/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let categoryComputersCombined = {
                    "maxWeight": 4,
                    "name": "computers",
                    "days": {
                        "15914": {
                            "x": 1374969600000,
                            "size": 4,
                            "domainList": [1, 1, 1, 1]
                        }
                    },
                    "maxWeightDate": "15914",
                    "dayCount": 1,
                    "x": 1,
                    "y": 1,
                    "intentDist": 0,
                    "interestDist": 0
                };

let categoryComputersKeywords = {
                    "maxWeight": 4,
                    "name": "computers",
                    "days": {
                        "15914": {
                            "x": 1374969600000,
                            "size": 4,
                            "domainList": [1, 1, 1, 1]
                        },
                        "15916": {
                            "x": 1375142400000,
                            "size": 4,
                            "domainList": [1, 1, 1, 1]
                        }
                    },
                    "maxWeightDate": "15914",
                    "dayCount": 2,
                    "x": 2,
                    "y": 3,
                    "intentDist": 1,
                    "interestDist": 0
                };

let categoryAndroid = {
                    "maxWeight": 2,
                    "name": "Android",
                    "days": {
                        "15914": {
                            "x": 1374969600000,
                            "size": 2,
                            "domainList": [1, 1]
                        }
                    },
                    "maxWeightDate": "15914",
                    "dayCount": 1,
                    "x": 1,
                    "y": 1,
                    "intentDist": 0,
                    "interestDist": 0
                };

let categoryAndroidKeywords = {
                "maxWeight": 2,
                "name": "Android",
                "days": {
                    "15914": {
                        "x": 1374969600000,
                        "size": 2,
                        "domainList": [1, 1]
                    }
                },
                "maxWeightDate": "15914",
                "dayCount": 1,
                "x": 1,
                "y": 2,
                "intentDist": 1,
                "interestDist": 1.4142135623730951
            }

let categoryProgramming = {
                "maxWeight": 1,
                "name": "Programming",
                "days": {
                    "15914": {
                        "x": 1374969600000,
                        "size": 1,
                        "domainList": [1]
                    }
                },
                "maxWeightDate": "15914",
                "dayCount": 1,
                "x": 1,
                "y": 1,
                "intentDist": 2,
                "interestDist": 2.23606797749979
            }

exports.dayAnnotatedThreeChartProcessorConsumeResults = {
    "combined": {
        "58-cat": {
            "_type": "combined",
            "_namespace": "58-cat",
            "categories": { "computers": categoryComputersCombined },
            "sortedInterests": [categoryComputersCombined],
            "sortedIntents": [categoryComputersCombined],
            "xMax": 1,
            "xMin": 1,
            "yMax": 1,
            "yMin": 1
        },
        "edrules": {
            "_type": "combined",
            "_namespace": "edrules",
            "categories": { "Android": categoryAndroid },
            "sortedInterests": [categoryAndroid],
            "sortedIntents": [categoryAndroid],
            "xMax": 1,
            "xMin": 1,
            "yMax": 1,
            "yMin": 1
        }
    },
    "keywords": {
        "58-cat": {
            "_type": "keywords",
            "_namespace": "58-cat",
            "categories": {
                "computers": categoryComputersKeywords,
                "Programming": categoryProgramming,
                "Android": categoryAndroidKeywords
            },
            "sortedInterests": [categoryComputersKeywords, categoryAndroidKeywords, categoryProgramming],
            "sortedIntents": [categoryComputersKeywords, categoryAndroidKeywords, categoryProgramming],
            "xMax": 2,
            "xMin": 1,
            "yMax": 3,
            "yMin": 1
        }
    }
}

exports.dayAnnotatedThreeTimelineConsumeResults = {
    "combined": {
        "58-cat": {
            "interestList": ["computers"],
            "chartJSON": [{
                "key": "computers",
                "values": [{
                    "x": 1374969600000,
                    "size": 4,
                    "domainList": [1, 1, 1, 1],
                    "y": 0
                }]
            }]
        },
        "edrules": {
            "interestList": ["Android"],
            "chartJSON": [{
                "key": "Android",
                "values": [{
                    "x": 1374969600000,
                    "size": 2,
                    "domainList": [1, 1],
                    "y": 0
                }]
            }]
        }
    },
    "keywords": {
        "58-cat": {
            "interestList": ["computers", "Programming", "Android"],
            "chartJSON": [{
                "key": "computers",
                "values": [{
                    "x": 1374969600000,
                    "size": 4,
                    "domainList": [1, 1, 1, 1],
                    "y": 0
                }, {
                    "x": 1375142400000,
                    "size": 4,
                    "domainList": [1, 1, 1, 1],
                    "y": 0
                }]
            }, {
                "key": "Programming",
                "values": [{
                    "x": 1374969600000,
                    "size": 1,
                    "domainList": [1],
                    "y": 1
                }]
            }, {
                "key": "Android",
                "values": [{
                    "x": 1374969600000,
                    "size": 2,
                    "domainList": [1, 1],
                    "y": 2
                }]
            }]
        }
    }
};

exports.dayAnnotatedThreeWeightIntensityConsumeResults = {
    "combined": {
        "58-cat": {
            "xMin": 1,
            "yMin": 1,
            "xMax": 1,
            "yMax": 1,
            "chartJSON": [{
                "key": "key",
                "values": [{
                    "x": 1,
                    "y": 1
                }]
            }],
            "pointToInterestsMap": {
                "11": ["computers"]
            }
        },
        "edrules": {
            "xMin": 1,
            "yMin": 1,
            "xMax": 1,
            "yMax": 1,
            "chartJSON": [{
                "key": "key",
                "values": [{
                    "x": 1,
                    "y": 1
                }]
            }],
            "pointToInterestsMap": {
                "11": ["Android"]
            }
        }
    },
    "keywords": {
        "58-cat": {
            "xMin": 1,
            "yMin": 1,
            "xMax": 2,
            "yMax": 3,
            "chartJSON": [{
                "key": "key",
                "values": [{
                    "x": 2,
                    "y": 3
                }, {
                    "x": 1,
                    "y": 1
                }, {
                    "x": 1,
                    "y": 2
                }]
            }],
            "pointToInterestsMap": {
                "11": ["Programming"],
                "12": ["Android"],
                "23": ["computers"]
            }
        }
    }
};

exports.dayAnnotatedThreeIntentInterestConsumeResults = {
    "combined": {
        "58-cat": {
            "sortedInterests": [{
                "chartJSON": [{
                    "label": "0",
                    "value": 1
                }, {
                    "label": "1",
                    "value": 1
                }, {
                    "label": "2",
                    "value": 1
                }, {
                    "label": "3",
                    "value": 1
                }],
                "title": "computers"
            }],
            "sortedIntents": [{
                "chartJSON": [{
                    "label": "0",
                    "value": 1
                }, {
                    "label": "1",
                    "value": 1
                }, {
                    "label": "2",
                    "value": 1
                }, {
                    "label": "3",
                    "value": 1
                }],
                "title": "computers (7/27/2013)"
            }]
        },
        "edrules": {
            "sortedInterests": [{
                "chartJSON": [{
                    "label": "0",
                    "value": 1
                }, {
                    "label": "1",
                    "value": 1
                }],
                "title": "Android"
            }],
            "sortedIntents": [{
                "chartJSON": [{
                    "label": "0",
                    "value": 1
                }, {
                    "label": "1",
                    "value": 1
                }],
                "title": "Android (7/27/2013)"
            }]
        }
    },
    "keywords": {
        "58-cat": {
            "sortedInterests": [{
                "chartJSON": [{
                    "label": "0",
                    "value": 2
                }, {
                    "label": "1",
                    "value": 2
                }, {
                    "label": "2",
                    "value": 2
                }, {
                    "label": "3",
                    "value": 2
                }],
                "title": "computers"
            }, {
                "chartJSON": [{
                    "label": "0",
                    "value": 1
                }, {
                    "label": "1",
                    "value": 1
                }],
                "title": "Android"
            }, {
                "chartJSON": [{
                    "label": "0",
                    "value": 1
                }],
                "title": "Programming"
            }],
            "sortedIntents": [{
                "chartJSON": [{
                    "label": "0",
                    "value": 1
                }, {
                    "label": "1",
                    "value": 1
                }, {
                    "label": "2",
                    "value": 1
                }, {
                    "label": "3",
                    "value": 1
                }],
                "title": "computers (7/27/2013)"
            }, {
                "chartJSON": [{
                    "label": "0",
                    "value": 1
                }, {
                    "label": "1",
                    "value": 1
                }],
                "title": "Android (7/27/2013)"
            }, {
                "chartJSON": [{
                    "label": "0",
                    "value": 1
                }],
                "title": "Programming (7/27/2013)"
            }]
        }
    }
};