// This is the pipeline module for testing different algorithms

// There are two main aspects to this module:
// 1) A function to process everything
// 2) An object that contains the details of each algorithm

// By "pipeline" I mean a list of different algorithms that we can objectively test. 
// In order to test out an algorithm, create a function below 


// Meta-data about each algorithm. 

let pipeline_details = [
	{
		"algorithm_name": "LWCA",
		"algorithm_function": lwca,
		"notes": ""
	},
	{
		"algorithm_name": "LICA",
		"algorithm_function": lica,
		"notes": ""
	},
	{
		"algorithm_name": "LICA+MaxChunk",
		"algorithm_function": lica_maxchunk,
		"notes": ""
	},
]



//These functions are for the particular algorithms listed above

function lwca(){
	
}

function lica(){
	
}

function lica_maxchunk(){
	
}


//This function is used to process everything

function process_pipeline(){
	//find the urls (if any) that require processing
	urls_to_process = get_urls_to_process()
	//set up classification variables
	classifications = {}
	let total_to_classify = urls_to_process.length
	let progressPercent = 0
	//iterate through the URLs
	if (total_to_classify != false) {
		urls_to_process.forEach(
			function(item, index){
				classification = LICAClassify(url) //classify it
				// Possible results are:
				//  - ["uncategorized"]
				//  - ["ignore"]
				//  - ["technology & computing", "general", 0.567]
				//  - ["sports", "baseball", 0.9]
				if (classification != false) { //it will return false on an error
					if ((classification[0] != 'ignore') && (classification != 'uncategorized')) {
						classifications[url] = classification
					}
				}
				//what should the progress bar % be?
				progressPercent = parseInt((index / total_to_classify) * 100)
			}
		)
	}
}

