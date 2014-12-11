//Main functionality file for interactivity with the dashboard
//Some functionality is only available as a worker, so that is
//contained within data/js/dashboard_worker_functionality.js

function process(){
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

