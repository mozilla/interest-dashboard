//LWCA refined
//2014-09-08 mruttley
//Refined version of LWCA algorithm/process

//Three stages:
// - Pre-processing
// - Classification
// - Post-processing

//How to use? Simply:
// > var lwca = new LWCAClassifier()
// > lwca.classify("http://www.bbc.com/some_very_interesting_article", "Apple reveals shiny new gadget")
// >>> ['computers', 0.75]

const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");

var preprocessingProgressPercent = 0 //global variable to indicate how far in the pre processing the user is
var verbose = false

function LWCAClassifier(worker) {
	// Main handler class

	//Initialize various processors
	if (verbose) console.log("Initializing...")

	let cdb = new ComponentDatabase(worker); //objects that help match title components and query variables
	//it also checks if it needs to be updated etc

	//build vk-tree
	vk_tree = {}
	for (let top_level of Object.keys(words_tree)) {
		for (let sub_level of Object.keys(words_tree[top_level])) {
			for (let kw of words_tree[top_level][sub_level]) {
				vk_tree[kw] = [top_level, sub_level]
			}
		}
	}

	//build bad_domains, bad_ext, bad_chunk
	bad_domains = {}
	bad_exts = {}
	bad_chunks = {}

	for (let domain_name of Object.keys(bad_domain_specific)){
		domain_name_chunks = domain_name.split(".")
		bad_domains[domain_name_chunks[0]] = 1
		bad_exts[domain_name_chunks[1]] = 1
		for (let chunk of bad_domain_specific[domain_name]) {
			bad_chunks[chunk] = 1
		}
	}

	//New classifier
	this.classify = function(url, title) {

		if (verbose) console.log(url)
		url = url.toLowerCase()

		//check domains, hosts and paths for exact matches
		//first check domain
		domain = url.split("://")[1].split("/")[0]
		domain_chunks = domain.split('.')
		rule_mapping = false
		for (let i in domain_chunks) {
			fragment = domain_chunks.slice(i).join(".")
			if (host_rules.hasOwnProperty(fragment)) {
				rule_mapping = host_rules[fragment]; break
			}
			if (domain_rules.hasOwnProperty(fragment)) {
				rule_mapping = domain_rules[fragment]; break
			}
		}

		domain_and_path = url.split(domain)[1].split('?')[0].split('/').slice(1)

		// http://www2.palmbeachpost.com/classifieds/catpage5.html
		// /classifieds/catpage5.html
		// [, classifieds, catpage5.html]
		// [classifieds, catpage5.html]

		for (let i in domain_and_path) {
			path_fragment = domain_and_path.slice(i).join('/')
			for (let j in domain_chunks) {
				domain_fragment = domain_chunks.slice(j).join('.')
				full_fragment = domain_fragment + "/" + path_fragment
				if (path_rules.hasOwnProperty(full_fragment)) {
					rule_mapping = path_rules[full_fragment]; break
				}
			}
		}

		if (rule_mapping != false) {
			//is it top level already?
			if (words_tree.hasOwnProperty(rule_mapping)) {
				if(verbose) console.log('Used maxchunk to classify ' + url + " as " + [rule_mapping, "general"])
				return [rule_mapping, "general"]
			}else{
				if (vk_tree.hasOwnProperty(rule_mapping)) {
					vk_tree_mapping = vk_tree[rule_mapping]
					if(verbose) console.log('Used maxchunk to classify ' + url + " as " + [top_level, rule_mapping])
					return vk_tree_mapping
					//return [vk_tree_mapping[0], rule_mapping]
				}
			}
		}

		//tokenize the url
		url = url.match(wordFinder)

		if (verbose) console.log(url)

		bad_domain = 0
		bad_ext = 0
		bad_chunk = 0
		ignore_domain = 0
		ignore_ext = 0

		scores = {} //top level & sub_level counts

		for (let chunk of url) {

			if (ignore_domains.hasOwnProperty(chunk)) ignore_domain += 1
			if (ignore_exts.hasOwnProperty(chunk)) ignore_ext += 1
			if (bad_domains.hasOwnProperty(chunk)) bad_domain += 1
			if (bad_exts.hasOwnProperty(chunk)) bad_ext += 1
			if (bad_chunks.hasOwnProperty(chunk)) bad_chunk += 1
			if (ignore_words.hasOwnProperty(chunk)) continue

			if (vk_tree.hasOwnProperty(chunk)) {
				mapping = vk_tree[chunk]
				if (scores.hasOwnProperty(mapping[0]) == false) {
					scores[mapping[0]] = {}
				}
				if (scores[mapping[0]].hasOwnProperty(mapping[1]) == false) {
					scores[mapping[0]][mapping[1]] = 0
				}
				scores[mapping[0]][mapping[1]] += 1
			}
		}

		if (verbose) console.log(scores)

		if (ignore_domain + ignore_ext >= 2) return ['uncategorized', 'dummy']
		if (bad_domain + bad_chunk + bad_ext >= 3) return ['uncategorized', 'dummy'] //check that it's not a bad combination
		if (Object.keys(scores).length == 0) return ['uncategorized', 'dummy'] //or there's no score

		//convert to list of top levels
		sl = []
		sub_level_strings = {}
		for (let top_level of Object.keys(scores)) {
			sub_level_count = 0
			subcats = []
			for (let sub_level of Object.keys(scores[top_level])) {
				subcats.push(sub_level)
				sub_level_count += scores[top_level][sub_level]
			}
			sl.push([top_level, sub_level_count])
			sub_level_strings[top_level] = subcats.join("/")
		}
		sl = sl.sort(sortDescendingBySecondElement)

		//if just one item then return that
		if (sl.length == 1) {
			if (verbose) console.log([sl[0][0], sub_level_strings[sl[0][0]]])
			return [sl[0][0], sub_level_strings[sl[0][0]]]
		}

		//if the top 2 are the same, return uncategorized
		if (sl[0][1] == sl[1][1]) {
			return ['uncategorized', 'dummy']
		}else{ //else if there is a top item, return it
			if (verbose) console.log([sl[0][0], sub_level_strings[sl[0][0]]])
			return [sl[0][0], sub_level_strings[sl[0][0]]]
		}

	}

	this.init = function() {
		return Task.spawn(function*() {
			yield cdb.init();
		});
	};
}

// Pre-processors

function spotDefinites(url, title) {
	//function to spot a definite classification
	//e.g. "real estate" is definitely real estate

	let definites = {
		"real estate": "real estate", //TODO: moarr
	}

	for (let definiteMatch in definites) {
		if (title.indexOf(definiteMatch) != -1) {
			return [definites[definiteMatch], 'general']
		}
	}

	return false //false if nothing found
}

function ComponentDatabase(worker, create_objects = true) {
	//creates a database of known query variables and persistent title components

	//initialization
	this._worker = worker;
	this._worker.addEventListener("message", this, false);
	this._worker.addEventListener("error", this, false);

	this.queryVariables = {}
	this.persistentTitleChunks = {}
	this.meta = {
		'timestamp': 0
	}

	this.init = function() {
		return Task.spawn(function*() {
			//////// temporarily decoupled

			////////
			//if (verbose) console.log("Began the init function in Cdb")
			//let ts =
			//	yield this.find_start_and_end();
			//if (ts['start'] == 0) {
			//	//nothing ever made before
			//	if (verbose) console.log('Nothing found in local directory, so scanning the whole history')
			//	this.scan(ts['start'], ts['end']);
			//} else {
			//	//something made before, so load it
			//	if (verbose) console.log('Found cdb in local directory, importing')
			//	yield this.load_component_database();
			//
			//	//fill in the rest
			//	this.scan(ts['start'], ts['end']);
			//	if (verbose) console.log('loaded existing cdb from disc')
			//}
		}.bind(this));
	};

	this.find_start_and_end = function() {
		return Task.spawn(function*() {
			//where to start and end the scanning (if any)

			//mostly a copy of get_history
			let options = historyService.getNewQueryOptions(); //make a blank query
			options.sortingMode = Ci.nsINavHistoryQueryOptions.SORT_BY_DATE_DESCENDING;
			let query = historyService.getNewQuery();
			let result = historyService.executeQuery(query, options);
			let cont = result.root;
			cont.containerOpen = true;
			let latest_timestamp = cont.getChild(0).time; //this is the last url that the user visited, which is the 'end'
			cont.containerOpen = false;


			let lm = yield this.load_meta(); //find last url visited's id
			if (lm == false) {
				if (verbose) console.log('Could not find any meta information. Everything needs to be scanned. Please create a component database first')
				return {
					'start': 0,
					'end': latest_timestamp
				}
			} else {
				if (verbose) console.log('Found meta information on disc (ts: ' + this.meta['timestamp'] + ")")
				return {
					'start': this.meta['timestamp'],
					'end': latest_timestamp
				} //start and ending timestamps of whatever needs to be updated
			}
		}.bind(this));
	};

	this._handleVisitProcessComplete = function(msgData) {
		this._qv = msgData.qv;
		for (let domain in msgData.domain_titles) {
			//sort title
			if (this._domain_titles.hasOwnProperty(domain) == false) {
				this._domain_titles[domain] = []
			}
			this._totalTitles += msgData.domain_titles[domain].length;
			this._domain_titles[domain] = this._domain_titles[domain].concat(msgData.domain_titles[domain]);
		}

		this.meta['timestamp'] = msgData.timestamp;
		this._processNextHistoryEvent();
		if (this._historyProgressCallback) {
			this._historyProgressCallback("historyProgress", this._history_total, msgData.totalEntries);
		}
	};

	this._handleAnalyzedTitle = function(msgData) {
		if (this._titleProgressCallback) {
			this._titleProgressCallback("titleProgress", msgData.domainCount, this._totalTitles);
		}
	}

	this._handleComputedPTC = function(msgData) {
		let ptc = msgData.ptc;

		if (this._start != 0) {
			//merge the new stuff with the old stuff
			//first query variables
			for (let domain in this._qv) {
				if (this.queryVariables.hasOwnProperty(domain) == false) {
					this.queryVariables[domain] = {}
				}
				for (let v in this._qv[domain]) {
					if (this.queryVariables[domain].hasOwnProperty(v) == false) {
						this.queryVariables[domain][v] = 1
					}
				}
			}

			//then title components
			for (let domain in ptc) {
				if (this.persistentTitleChunks.hasOwnProperty(domain) == false) {
					this.persistentTitleChunks[domain] = {}
				}
				for (let v of ptc[domain]) {
					if (this.persistentTitleChunks[domain].hasOwnProperty(v) == false) {
						this.persistentTitleChunks[domain][v] = 1
					}
				}
			}
			if (verbose) console.log('loaded existing cdb from disc')
		} else {
			this.queryVariables = this._qv;
			this.persistentTitleChunks = ptc;
		}
		this._callback();
		this.save() //now save everything
	};

	this.handleEvent = function(aEvent) {
		let eventType = aEvent.type;
		if (eventType == "message") {
			let msgData = aEvent.data;
			switch (msgData.message) {
				case "visitProcessComplete":
					this._handleVisitProcessComplete(msgData);
					break;
				case "computedPTC":
					this._handleComputedPTC(msgData);
					break;
				case "titleAnalyzed":
					this._handleAnalyzedTitle(msgData);
					break;
			}
		} else if (eventType == "error") {
			//TODO:handle error
			console.log(aEvent.message);
		}
	};

	this._processNextHistoryEvent = function() {
		try {
			let nextVisit = this._history.next();
			this._history_total += 1;

			this._worker.postMessage({
				command: "processHistoryEntry",
				payload: {
					"visit": nextVisit,
					"timestamp": this.meta['timestamp'],
					"qv": this._qv
				}
			});
		} catch (ex if ex instanceof StopIteration) {
			if (verbose) console.log("Total history items loaded: " + this._history_total);
			if (verbose) console.log("Finding common suffixes in " + Object.keys(this._domain_titles).length + " domains ");

			this._worker.postMessage({
				command: "computePTC",
				payload: {
					"domain_titles": this._domain_titles,
				}
			});
		}
	};

	this.scan = function(start, end) {
		this._history = getHistory(start, end);
		this._history_total = 0;
		this._start = start;
		this._end = end;
		this._qv = {}; //query variables
		this._ptc = {}; //persistent title components
		this._domain_titles = {};
		this._totalTitles = 0;
		this._processNextHistoryEvent(start, end);
	}

	this.load_meta = function() {
		return Task.spawn(function*() {
			if (verbose) console.log("load_meta function called")
				//load meta
			let decoder = new TextDecoder();

			/////////DEBUGGING
			let meta_location = OS.Path.join(OS.Constants.Path.profileDir, "meta.json");
			console.log("Meta should be stored at: " + meta_location)

			let meta_exists =
				yield OS.File.exists(meta_location);
			if (meta_exists) {
				console.log("Meta file exists");
			} else {
				console.log("Meta does not exist");
				return false;
			}
			///////////////////

			try {
				let array =
					yield OS.File.read(meta_location);
				if (verbose) console.log('onSuccess for meta loading called')
				let info = decoder.decode(array);
				let data = JSON.parse(info)
				if (verbose) console.log('meta data found was: ' + JSON.stringify(data))
				this.meta = data
				return true //loads meta information into an object with timestamp and id
			} catch (ex) {
				if (verbose) console.log("Meta was not found")
				return false //file doesn't exist
			}
		}.bind(this));
	};

	this.load_component_database = function() {
		return Task.spawn(function*() {
			//loads the component database if it exists, else returns false
			let decoder = new TextDecoder();
			try {
				let array =
					yield OS.File.read(OS.Path.join(OS.Constants.Path.profileDir, "cdb.json"));
				let info = decoder.decode(array);
				info = JSON.parse(info)
				this.queryVariables = info['queryVariables']
				this.persistentTitleChunks = info['persistentTitleChunks']
				return true
			} catch (ex) {
				return false //file doesn't exist
			}
		}.bind(this));
	};

	this.save = function() {
		return Task.spawn(function*() {
			//assumes that both cdb and meta have been created
			let encoder = new TextEncoder();
			let meta_enc = encoder.encode(JSON.stringify(this.meta));
			let cdb_enc = encoder.encode(JSON.stringify({
				'queryVariables': this.queryVariables,
				'persistentTitleChunks': this.persistentTitleChunks
			}));
			//save meta
			yield OS.File.writeAtomic(OS.Path.join(OS.Constants.Path.profileDir, "meta.json"), meta_enc, {
				tmpPath: OS.Path.join(OS.Constants.Path.profileDir, "meta.json.tmp")
			});
			//save component database
			yield OS.File.writeAtomic(OS.Path.join(OS.Constants.Path.profileDir, "cdb.json"), cdb_enc, {
				tmpPath: OS.Path.join(OS.Constants.Path.profileDir, "cdb.json.tmp")
			});
		}.bind(this));
	};
}

function removePersistentTitleChunks(url, title, cdb) {
	//Removes common title endings such as " - Google Search" using the component database

	let domain = getDomain(url)
	if (cdb.hasOwnProperty(domain)) {
		for (let suffix of cdb[domain]) {
			if (title.toLowerCase().endsWith(suffix.toLowerCase())) {
				//chop suffix from end
				title = title.slice(0, title.length - suffix.length)
				break
			}
		}
	}

	return title
}

function removeDomainNames(url, title) {
	//tries to remove the domain name (or aspects of it) from the title
	//if this reduces the title to nothing, then just leave them in
	url = parseUri(url)
	url = url.host.split(".")
	title = title.toLowerCase().match(wordFinder)

	let new_title = []
	let removed = []

	for (let token of title) {
		if (url.indexOf(token) == -1) {
			new_title.push(token)
		}
	}

	if (new_title.length == 0) {
		return title.join(" ")
	} else {
		return new_title.join(" ")
	}
}

// Classification

function cosineSimilarity(text, category_keywords, category_magnitude) {
	//calculates the cosine similarity between the two arguments
	//expects text to be an array of strings
	//expects category_keywords to be an object of string: int
	//returns a float

	//create vector
	let vector = {} //object of word: [text count, category count]
	for (let word of text) {
		if (vector.hasOwnProperty(word) == false) {
			if (category_keywords.hasOwnProperty(word) == false) {
				vector[word] = [1, 0]
			} else {
				vector[word] = [1, category_keywords[word]]
			}
		} else {
			vector[word][0] += 1
		}
	}

	//calculate dot product

	let dot_product = 0
	let text_vector_magnitude = 0

	for (let word in vector) {
		dot_product += (vector[word][0] * vector[word][1])
		text_vector_magnitude += Math.pow(vector[word][0], 2)
	}

	let denominator = Math.sqrt(text_vector_magnitude) * category_magnitude

	if (denominator != 0) {
		return dot_product / denominator
	}

	return 0
}

// Post processing

function augmentRepeatWords(results) {
	//Adds 1 to the score of any result containing a repeated word

	wordCounts = {}
	for (i = 0; i < results.length; i++) {
		tokens = results[i][0].toLowerCase().match(wordFinder)
		for (let token of tokens) {
			if (wordCounts.hasOwnProperty(token) == false) {
				wordCounts[token] = 0
			}
			wordCounts[token] += 1
		}
	}

	//now go through again and find the repeats
	for (i = 0; i < results.length; i++) {
		tokens = results[i][0].toLowerCase().match(wordFinder)
		for (let token of tokens) {
			if (wordCounts[token] > 1) { //must be a repeat
				results[i][1] += 1
			}
		}
	}

	return results
}

function augmentQueries(url, results, queryDatabase) {
	//Tries to spot any search queries in the url
	//Doubles the score of anything that contains a search query word

	if (verbose) console.log("URL: " + url)

	let queries = [] //a list of strings
	url = parseUri(url) //

	if (queryDatabase.hasOwnProperty(url.host)) { //if the domain is in the db
		if (verbose) console.log("Domain: " + url.host + " is in the database")
		if (verbose) console.log("There are " + Object.keys(url.queryKey).length + " keys in the url")
		for (let variable in url.queryKey) { //iterate through url get variables
			if (queryDatabase[url.host].hasOwnProperty(variable)) { //if in the db
				query = unescape(url.queryKey[variable]) //append to list
				queries.concat(query.match(wordFinder))
			}
		}
	}

	//now find any result that contains a query word
	if (queries.length > 0) {
		for (let result in results) {
			if (verbose) console.log("Iterating through results")
			for (let word of queries) {
				if (results[result][0].indexOf(word) != -1) {
					results[result][1] *= 2 //double the score
				}
			}
		}
	}


	return results
}

// Auxiliary functions, matchers, options etc

const {data} = require("sdk/self"); //not quite sure why this is necessary
let {TextEncoder, TextDecoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {}); //for file IO
let historyService = Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService);
let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
scriptLoader.loadSubScript(data.url("words.js"));
scriptLoader.loadSubScript(data.url("rules.js"));

function getDomain(url) {
	//returns the (sub)domain of a url
	//subdomains are treated as different entities to top level urls
	if (url.indexOf("://") != -1) {
		url = url.split("://")[1]
		if (url.indexOf("/") != -1) {
			url = url.split("/")[0]
		}
		if (url.indexOf("?") != -1) {
			url = url.split("?")[0]
		}
	} else {
		return false
	}
	return url
}

function getHistory(start, end) {
	//Generator that yields the most recent history urls one by one
	//Returned in the form [url, title, timestamp]

	//make a blank query
	let options = historyService.getNewQueryOptions();
	options.sortingMode = Ci.nsINavHistoryQueryOptions.SORT_BY_DATE_DESCENDING;
	let query = historyService.getNewQuery();
	query.beginTime = start;
	query.endTime = end;
	let result = historyService.executeQuery(query, options);

	//open up the results
	let cont = result.root;
	cont.containerOpen = true;

	//yield whatever there is
	for (let i = 0; i < cont.childCount; i++) {
		let node = cont.getChild(i);
		yield [node.uri, node.title, node.time, cont.childCount];
	}

	//close the results container
	cont.containerOpen = false;
}

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

String.prototype.endsWith = function(suffix) {
	//http://stackoverflow.com/a/2548133/849354
	return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

var wordFinder = RegExp("[a-z]{3,}", "g") //tokenizes english sentences
var spaceFinder = RegExp(/.+(%20|\+|\s).+/g) //finds get variable values that have spaces in them
	//bizarrely, if spaceFinder is declared in the way wordFinder is (two args), it returns an error. Oh JS...

function sortDescendingBySecondElement(first, second) {
	//function to be used in sort(some_function)
	//does what it says on the tin
	first = first[1]
	second = second[1]
	if (first == second) {
		return 0
	} else {
		if (first > second) {
			return false
		} else {
			return true
		}
	}
}

function sortDescendingByElementLength(first, second) {
	//sorting function to sort a list of strings
	return second.length - first.length
}

function loadClassifications() {
	//returns an id to iab mapping
	//loads meta information into an object with timestamp and id
	let decoder = new TextDecoder();
	let promise = OS.File.read(OS.Path.join(OS.Constants.Path.profileDir, "meta.json"));
	promise = promise.then(
		function onSuccess(array) {
			let info = decoder.decode(array);
			info = JSON.parse(info)

			//now expand it
			//create an id-to-text version of the mapping
			id_to_text = {}
			for (let iab in info['mapping']) {
				id = info['mapping'][iab]
				id_to_text[id] = iab
			}

			//need id to text version of iab
			for (let visitid in info['classifications']) {
				mapping_id = info['classifications'][visitid]
				info['classifications'][visitid] = id_to_text[mapping_id]
			}

			return info['classifications']

		},
		function onFailure() {
			return false //file doesn't exist
		}
	);

}

//for the extension main.js to access
exports.LWCAClassifier = LWCAClassifier
exports.ComponentDatabase = ComponentDatabase
