/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { getBaseDomain } = require('./utils/tld');

function parseURI(uri){
	//Accepts: a URI string
	//Returns: different parts of the URI
	
	//extract different types of chunks
	chunks = {
		"protocol": "",
		"subdomains": [],
		"domain_name": "",
		"path": [],
		"filename": "",
		"variables": {},
		"shebang": ""
	}

	//this could be made more efficient with a letter-by-letter while loop
	chunks['protocol'] = uri.split("://")[0]
	chunks['domain_name'] = getBaseDomain(uri)
	chunks['subdomains'] = uri.split(chunks['domain_name'])[0].split(chunks['protocol'])[1].split(".")
	
	path_and_rest = uri.split(chunks['domain_name'])[1].split("?")
	path_items = path_and_rest[0].split("/")
	chunks['path'] = path_items.slice(0,-1)
	chunks['filename'] = path_items.slice(-1)
	
	if (path_and_rest.length > 1) {
		variables = path_and_rest[1].split("&")
		for (let vq of variables) {
			vq = vq.split("=")
			variables[vq[0]] = ""
			if (vq.length > 1) {
				variables[vq[0]] = vq[1]
			}
		}
	}
	
	return chunks
}
