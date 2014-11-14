/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

const {testUtils} = require("./data/licaWorker.js");
const {Cc, Ci, Cu, ChromeWorker} = require("chrome");

let test_uris_and_attributes = [
	{
		"reason": "A very rich URL with path and several variables",
		"url": "http://www.amazon.co.uk/Augmenting-Dirichlet-Allocation-Threshold-Ontologies/dp/1502959488/ref=sr_1_1?ie=UTF8&qid=1415840085&sr=8-1&keywords=latent+dirichlet+allocation",
		"chunks": {
			"protocol": "http",
			"subdomains": ['www'],
			"domain_name": "amazon.co.uk",
			"path": ["Augmenting-Dirichlet-Allocation-Threshold-Ontologies", "dp", "1502959488"],
			"filename": "ref=sr_1_1",
			"variables": {
				"ie": "UTF8",
				"qid": "1415840085",
				"sr": "8-1",
				"keywords": "latent+dirichlet+allocation",
			},
			"shebang": ""
		}
	},
	{
		"reason": "A secure url with a very long path",
		"url": "https://www.facebook.com/search/str/bob/users-named/93693583250/students/14696440021/employees/present/males/me/friends/intersect",
		"chunks": {
			"protocol": "https",
			"subdomains": ['www'],
			"domain_name": "facebook.com",
			"path": ["search", "str", "bob", "users-named", "93693583250", "students", "14696440021", "employees", "present", "males", "me", "friends"],
			"filename": "intersect",
			"variables": {},
			"shebang": "",
		}
	},
	{
		"reason": "A url with a shebang",
		"url": "http://www.facebook.com/example.profile#!/pages/Another-Page/123456789012345",
		"chunks": {
			"protocol": "http",
			"subdomains": ['www'],
			"domain_name": "facebook.com",
			"path": [],
			"filename": "example.profile",
			"variables": {},
			"shebang": "/pages/Another-Page/123456789012345"
		}
	}
]


exports["test URI parsing and chunking functionality"] = function (assert) {
	for (let test of test_uris_and_attributes) {
		assert.equal(parseURI(test['url']), test['chunks'], test['reason']);
	}
};

require('sdk/test').run(exports);