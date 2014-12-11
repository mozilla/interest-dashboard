
//This module contains code for the LICA algorithm
// (LICA = Latent IAB Category Allocation)

//Users can initialize a classifier (LICAClassifier) and then
//throw URLs at it. It will return classifications.

//How to use this?
// >>> var classifier = LICAClassifier()
// >>> classifier.init()
// >>> classifier.classify('http://golf.ilovegolf.com/golf?q=golf')
// ['sports', 'golf', 0.99999]

//Import modules from SDK
const {data} = require("sdk/self"); // to reference files in the /data folder
const {parseURI, computeURLChunks, sortDescendingBySecondElement} = require('Utils')
Cu.import("resource://gre/modules/Task.jsm");

//import payloads
let payload = JSON.parse(data.load("payload.json"));

//Useful debug setting(s)
var verbose = false //set this to true if you want to see some detailed output

//Main code
function LICAClassifier() {
	// Main handler class
	
	this.classify = function(url) {
		//Accepts: A URL
		//Returns: A string with the classification
		if (verbose) console.log(url)
		
		//create an NSIUrl object and extract the various components
		url = parseURI(url)
		if (verbose) console.log(url)
		if (!url) return ['uncategorized', 0] //some error or whatever
		
		//now we have to convert the url components into chunks that are recognized by DFR
		url = computeURLChunks(url)
		if (verbose) console.log(url)
		
		//and now for auto-ignore and classification
		
		//first check blacklist
		if (fromBlacklistedDomain(url)) return ['ignore', 0] //domains
		if (containsBlacklistedKeywords(url)) return ['ignore', 0] //keywords
		
		//second check domain/keyword rule whitelist
		
		let possibilities = [] //a list of results from the domain/kw approaches. We will later pick the highest or maybe average.
		
		possibilities.concat(classifyByDomain(url)) //domains
		possibilities.concat(classifyByKeywords(url)) //keywords
		
		if (verbose) console.log(possibilities)
		
		//were any classifications returned at all? if not, return uncategorized
		if (possibilities.length == 0) return ['uncategorized', 0]
		
		//sort by the confidence score, and pick the highest one
		let highest_probability = possibilities.sort(sortDescendingBySecondElement)[0]
		
		if (verbose) console.log(highest_probability)
		
		return highest_probability
	
	}
	
	this.init = function() { return Task.spawn(function*() { yield cdb.init() }) }; //TODO uncomment when saved. Komodo IDE can't handle asterisk functions
}

function formatChunks(list_of_chunks, prefix, n){
	// Calculates progressively smaller ngrams
	// and adds prefixes
	// e.g. ['one', 'two', 'three'] with prefix "/" and n = 2
	// would give:
	// ['/one,two', '/two,three', '/one', '/two', 'three']
	// Accepts: a list of strings, a string like "/" or "?" and a number, n (as in n-gram)
	// Returns: a list of strings, with the largest ngrams at the start
	
	results = []
	
	for (n;n>0;n--) { //iterate negatively starting at n: 3,2,1...
		for (let i=0;i<list_of_chunks.length-n+1;i++) { //iterate through the chunks
			let ngram = list_of_chunks.slice(i, i+n) //pick out the ngram
			ngram = prefix + ngram.join(',') //add the prefix and stick together with a comma
			results.push(ngram) //append to the list
		}
	}
	
	return results
}

function fromBlacklistedDomain(url_components) {
	//This function checks the blacklist for domains that should be ignored
	//Accepts: a url that has been through parseURI() and formatChunks()
	//Returns: true if the uri should be ignored
	
	if (payload.blacklist.hasOwnProperty(url_components['domain'])) { //if the domain exists in the blacklist
		rules = payload.blacklist['domain']
		if (rules.hasOwnProperty("__ANY")) { //if there's an __ANY flag it means just match everything
			return true
		}else{
			//else we have to check for:
			// - path keywords
			// - host keywords
			// - query keywords
			for (let url_area of ['path', 'host', 'query']) { //check each area
				for (let chunk of url_components[url_area]) { //iterate through the chunks in that area
					if (rules.hasOwnProperty(chunk)) { //if it exists (O(1) lookup I think)
						return true
					}
				}
			}
		}
	}
	
	return false //nothing matched so return false
}

function containsBlacklistedKeywords(parsedURI) {
	//Does a URL contain bad keywords? 
	//Accepts: a url that has been through parseURI() and formatChunks()
	//Returns: true if the uri should be ignored
	
	//We have to check for:
	// - path keywords
	// - host keywords
	// - query keywords
	for (let url_area of ['path', 'host', 'query']) { //check each area
		for (let chunk of url_components[url_area]) { //iterate through the chunks in that area
			if (payload.blacklist['__ANY'].hasOwnProperty(chunk)) { //if it exists (O(1) lookup I think)
				return true
			}
		}
	}
	
	return false //nothing matched so return false
}

function classifyByDomain(parsedURI) {
	//Accepts: a url that has been through parseURI() and formatChunks()
	//Returns: a series of classifications [['Sports', 0.856], ['Automotive', 0.65]] or false
	
	possible_classifications = []
	
	if (payload.domainKeywordRules.hasOwnProperty(url_components['domain'])) { //if the domain exists in the blacklist
		rules = payload.domainKeywordRules[url_components['domain']]
		
		//if there's an __ANY flag it means just match everything
		if (rules.hasOwnProperty("__ANY")) {
			possible_classifications.concat(rules['__ANY'])
		}
		
		//we also have to check for:
		// - path keywords
		// - host keywords
		// - query keywords
		for (let url_area of ['path', 'host', 'query']) { //check each area
			for (let chunk of url_components[url_area]) { //iterate through the chunks in that area
				if (rules.hasOwnProperty(chunk)) { //if it exists (O(1) lookup I think)
					possible_classifications.concat(rules[chunk])
				}
			}
		}
	}
	
	return possible_classifications
}

function classifyByKeywords(parsedURI) {
	//Accepts: a url that has been through parseURI() and formatChunks()
	//Returns: a classification ['Sports', 0.856] or false
	
	possible_classifications = []
	
	//we have to check for:
	// - path keywords
	// - host keywords
	// - query keywords
	for (let url_area of ['path', 'host', 'query']) { //check each area
		for (let chunk of url_components[url_area]) { //iterate through the chunks in that area
			if (payload.domainKeywordRules['__ANY'].hasOwnProperty(chunk)) { //if it exists (O(1) lookup I think)
				possible_classifications.concat(rules[chunk])
			}
		}
	}
	
	return possible_classifications	
}

//for the extension main.js to access
exports.LICAClassifier = LICAClassifier
