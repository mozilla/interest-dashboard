// This is the pipeline module for testing different algorithms.
// "pipeline" means a list of different algorithms that we can objectively test.

// In order to test out an algorithm, create the meta data and functions below.
// The entries in pipeline_details should be self-explanatory.
// Then, run the test_algorithms() function and it will test this out using pre-classified pages from moreover.

// Some algorithms require a "setup" stage - for things like preprocessing etc.


//const {Cc} = require("chrome")
//let scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);



// Meta-data about each algorithm.
// Add a new algorithm if needed. Make sure to add the function below as well. 
exports.pipeline_details = [
	{
		"algorithm_name": "LWCA",
		"algorithm_function": function(url, title){ return [top_level, sub_level]},
		"additional_setup_required": function(){},
		"notes": "This is the original Latent Wiki Category Allocation algorithm. It has very high coverage but low accuracy and is quite slow"
	},
	{
		"algorithm_name": "LICA",
		"algorithm_function": function(url, title){return [top_level, sub_level, confidence]},
		"notes": "This is the original LICA algorithm, only using a payload of words."
	},
	{
		"algorithm_name": "LICA+MaxChunk",
		"algorithm_function": function(url, title){ return [top_level, sub_level]},
		"notes": "This is the currently implemented algorithm that uses LICA (above) and a list of single topic sites+site paths that max generated (called maxchunk)"
	},
	{
		"algorithm_name": "LICA+MaxChunk+DFR Top Probability",
		"algorithm_function": function(url, title){
			result = exports.LICAClassifier.classify(url)
			return [result[0], result[1]] //top level, sub level
		},
		'additional_setup_required': function(){
			exports.LICAClassifier = require("LICA").LICAClassifier;
			exports.LICAClassifier.init()
		},
		"notes": "This uses an extended version of the data above, trained on all the moreover data. When there are multiple options for classification, the decision is based on the decision with the highest overall probability"
	},
	{
		"algorithm_name": "LICA+MaxChunk+DFR Averaging",
		"algorithm_function": function(url, title){ return [top_level, sub_level]},
		"notes": "This uses an extended version of the data above, trained on all the moreover data. When there are multiple options for classification, the decision is based on the decision with the highest average probability"
	},	
]







//Functionality that brings everything together

exports.test_algorithms = function(){
	//This function can test algorithms on moreover data.
	//Make sure the "moreover_testing_data.json" file is in the data directory
	//And then just run the function.
	//it will compute algorithm stats and output to the terminal
	
	//perform any additional setup stages
	for (let algorithm of exports.pipeline_details) {
		if (algorithm.hasOwnProperty("additional_setup_required")) {
			console.log(algorithm.algorithm_name + " requires some additional setup. Processing now.")
			algorithm.additional_setup_required()
		}
	}
	
	//import the moreover data
	scriptLoader.loadSubScript(data.url("moreover_testing_data.json"));
	
	//these are some counters used for stats later
	total_urls = testing_data.length
	one_percent = total_urls / 100
	
	//stats containers, on a per algorithm basis
	for (i=0;i++;i<exports.pipeline_details.length) { //basically just adding a variable to the pipeline items
		exports.pipeline_details[i].unclassified = 0  //above, so that we can save results. 
		exports.pipeline_details[i].incorrect = 0
		exports.pipeline_details[i].correct = 0
	}
	
	console.log("Classifying...")
	
	//iterate through and try to compute the results
	count = 0 // a progress counter
	for (let test of testing_data) { //for every test in the testing data
		
		for (let algorithm of exports.pipeline_details) { //for each algorithm in the pipeline
		
			classification_result = algorithm.algorithm_function(test.url, test.title) //classify the test using the algo
			if (classification_result[0] == "uncategorized") algorithm.uncategorized += 1; break
			if (classification_result != test.expected_result) algorithm.incorrect += 1; break
			if (classification_result == test.expected_result) algorithm.correct += 1; break
		
		}
		
		//now compute the progress
		count += 1
		if (count % (one_percent) == 0) {
			percentage = parseInt(count / total_urls) //output some stats if it is a multiple of 1%
			console.log("Processed " + percentage + "%, (" + count + "/" + total_urls + ")")
		}
	}
	
	//now output some stats
	console.log("Name \t Correct \t Incorrect \t Uncategorized")
	for (let algo of exports.pipeline_details) {
		console.log(algo.algorithm.name + "\t" + algo.correct + "\t" + algo.incorrect + "\t" + algo.uncategorized)
	}
	
}