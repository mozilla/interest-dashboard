/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This worker is responsible for any extensive processing required
 * for LWCA. This includes computations for persistentTitleChunks
 * and queryVariables.
 */
function parseUri(str) {
	// parseUri 1.2.2
	// (c) Steven Levithan <stevenlevithan.com>
	// MIT License
	// http://blog.stevenlevithan.com/archives/parseuri
	var o = parseUri.options,
		m = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};

parseUri.options = {
	strictMode: false,
	key: ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"],
	q: {
		name: "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};

function processHistoryEntry({visit, timestamp, start, end, domain_titles, qv}) {
	let spaceFinder = RegExp(/.+(%20|\+|\s).+/g) //finds get variable values that have spaces in them
	if ((visit[2] >= start) && (visit[2] <= end)) {
		let url = parseUri(visit[0])
		let domain = url.host

		//scan components
		for (let var_name in url.queryKey) {
			if (spaceFinder.test(url.queryKey[var_name])) {
				//Note: the following spaghetti is why you use a decent language like python
				//with sets/defaultdicts
				if (qv.hasOwnProperty(domain) == false) {
					qv[domain] = {}
				}
				if (qv[domain].hasOwnProperty(var_name) == false) {
					qv[domain][var_name] = 0
				}
				qv[domain][var_name] += 1
			}
		}

		//sort title
		if (domain_titles.hasOwnProperty(domain) == false) {
			domain_titles[domain] = []
		}

		if (visit[1] != null) {
			domain_titles[domain].push(visit[1])
		}
	}
	if (visit[2] > timestamp) {
		timestamp = visit[2] //timestamp is now last item loaded
	}
	self.postMessage({
		"message": "visitProcessComplete",
		"qv": qv,
		"domain_titles": domain_titles,
		"timestamp": timestamp,
		"totalEntries": visit[3]
	});
}

function longestCommonNgramSuffix(s1, s2) {
	//Does what it says on the tin
	s1 = s1.split(" ")
	s2 = s2.split(" ")
	let min_len = s1.length < s2.length ? s1.length : s2.length

	let result = false
	for (let a = 1; a < min_len + 1; a++) {
		if (s1[s1.length - a] != s2[s2.length - a]) {
			result = s1.slice(s1.length - a + 1)
			break
		}
	}

	if (result == false) {
		return false
	} else if (result == []) {
		return false
	} else {
		return result.join(" ")
	}
}

function sortDescendingByElementLength(first, second) {
	//sorting function to sort a list of strings
	return second.length - first.length
}

function computePTC({domain_titles}) {
	let ptc = {};
	//now for processing
	for (let domain in domain_titles) {
		let suffixes = {}
		let titles = domain_titles[domain]
		for (let x = 0; x < titles.length; x++) {
			for (let y = x + 1; y < titles.length; y++) {
				if (titles[x] != titles[y]) {
					let lcns = longestCommonNgramSuffix(titles[x], titles[y])
					if (lcns != false) {
						if (suffixes.hasOwnProperty(lcns) == false) {
							suffixes[lcns] = 0
						}
						suffixes[lcns] += 1
					}
				}

			}
		}
		//eliminate those that only appear once
		let to_add = [];
		for (let suffix in suffixes) {
			let count = suffixes[suffix]
			if (count > 1) {
				to_add.push(suffix)
			}
		}
		//to_add must be sorted in descending order of length
		//as largest matches should be eliminated first
		to_add = to_add.sort(sortDescendingByElementLength)
		ptc[domain] = to_add
	}

	//now remove anything empty
	let to_delete = []
	for (let x in ptc) {
		if (ptc[x].length == 0) {
			to_delete.push(x)
		}
	}
	for (let x of to_delete) {
		delete ptc[x]
	}

	self.postMessage({
		"message": "computedPTC",
		"ptc": ptc
	});
}

self.onmessage = function({data}) {
	self[data.command](data.payload);
};