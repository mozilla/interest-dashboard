//Code for LICA+MaxChunk

//Latent IAB Category Allocation
//MaxChunk uses single topic site/path chunk matches

//Import modules from SDK
const {Cc, Ci, Cu, ChromeWorker} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");
let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);

//Useful settings
var preprocessingProgressPercent = 0 //global variable to indicate how far in the pre processing the user is
var verbose = false //set this to true if you want to see some detailed output

//Useful constants
var wordFinder = RegExp("[a-z]{3,}", "g") //tokenizes english sentences

//Main code
function LICAClassifier(worker) {
	// Main handler class
	
	this.classify = function(url) {
		//Accepts: A URL
		//Returns: A string with the classification
		
		if (verbose) console.log(url)
		
		//create an NSIUrl object and extract the various components
		
		//first check blacklist
		
		//second check domainRules
	
	this.init = function() {
		return Task.spawn(function*() {
			yield cdb.init();
		});
	};
}

//Some auxiliary functions
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

//for the extension main.js to access
exports.LICAClassifier = LICAClassifier



