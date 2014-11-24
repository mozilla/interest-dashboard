//This contains useful auxiliary functions/consts/variables

// Explanation:
// Import the whole module like:
//
// let Utils = require('Utils')
// Utils.parseURI('http://www.google.com')
//
// Specific parts of this module can be imported like:
//
// let {parseURI} = require('Utils')
// parseURI('http://www.reddit.com/')
//
// This is similar to "import module" vs "from module import function" in python :)


//Some imports
const {Cc,Ci} = require("chrome") //imports various components and interfaces useful later on
let nsIIOService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService) //can convert strings to URIs
let eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService); //can extract domain names

exports = {
	//Tokenization
	wordFinder: RegExp("[a-z]{3,}", "g"), //tokenizes english sentences

	// Parsing URLs/URIs
	parseURI: function(sURL){
		//Accepts: a string of a url
		//Returns: useful parts of the URL
		
		try {
			
			//first parse the string into a mozilla URI
			let myURI = nsIIOService.newURI(sURL, null, null);
			
			//now we have to convert it into a mozilla URL
			let myURL = myURI.QueryInterface(Ci.nsIURL);
			
			//extract the domain
			let domain_name = eTLDService.getBaseDomain(myURI); // this includes the TLD
			
			//grab the host by chopping off the domain name
			let host = myURL.host.slice(0, -domain_name.length-1)
			
			//split up the query into key,value pairs
			let query = {}
			for(let pair of myURL.query.split("&")){ //split by pair
				pair = pair.split("=") //split into variable and query
				if (pair.length == 2) { //make sure there are enough elements
					query[pair[0]] = pair[1] //add to the object
				}else{
					query[pair[0]] = "" //sometimes there's no variable value
				}
			}
			
			//create an object with the useful parts
			useful_parts = {
				'scheme': myURL.scheme,
				'domain': domain_name,
				'host': host,
				'path': myURL.filePath,
				'query': query,
				'fragment': myURL.ref,
			}
			
			return useful_parts //return just the useful bits
			
		}
		catch(e) {
			return false //there are lots of possible exceptions with malformed urls 
		}
	},

	computeURLChunks: function(parsed_uri){
		// This takes a parsed URI and computes DFR style chunks, e.g.
		// http://www.domain.com/thing/other?q=search
		// which (using parseURI) was turned into:
		//	{
		//		'scheme': 'http',
		//		'domain': 'domain.com',
		//		'host': 'www',
		//		'path': '/thing/other',
		//		'query': {
		//			'q': 'search'
		//		}
		//	}
		// will produce:
		//	{
		//		'scheme': 'http',
		//		'domain': 'domain.com',
		//		'host': ['.www'],
		//		'path': ['/thing,other', '/thing', '/other'], <-- note bigrams computed as well
		//		'query': ['?search']
		//	}
		//
		
		parsed_uri['host'] = formatChunks(parsed_uri['host'].split('.'), '.', 2)
		
		parsed_uri['path'] = formatChunks(parsed_uri['path'].split('/'), '/', 2)
		
		parsed_uri['query'] = formatChunks(Object.keys(parsed_uri['query']).map(function(x){return parsed_uri['query'][x]}), '?', 2)
		
		return parsed_uri
	},

	//Sorting
	sortDescendingBySecondElement: function(first, second) {
		//Sorts an array descending by the second element of each sub array
		//Usage: my_array.sort(sortDescendingBySecondElement)
		
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
	},

	sortDescendingByElementLength: function(first, second) {
		//Sorts an array descending by the length of each element
		//Usage: my_array.sort(sortDescendingByElementLength)
		
		return second.length - first.length
	}

}
