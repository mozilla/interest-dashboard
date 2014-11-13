function processURL(url){
  //Accepts: a url string
  //Returns: a classification
  
  //extract different types of chunks
  chunks = {
    "protocol": "",
    "subdomains": [],
    "domain_name": "",
    "path": [],
    "variable_names": [],
    "variable_values": [],
  }
  
  //iterate through each letter. This avoids endless costly splits
  buffer = ""
  position = 0
  while(true){
	add_to_buffer = true
	letter = url[position]
	
	//check for http/s
    if (letter == "/"){
		if ((url[position-1] == "/") && (url[position[-2]])) {
			chunks[protocol] = buffer
			buffer = ""
			add_to_buffer = false
		}
	}
	
	//chop at ?
	if (test) {
		//code
	}
	
	if (add_to_buffer) {
		buffer += letter
	}
}
  
  chunks['protocol'] = url.split("://")[0]
  full_domain = url.split("://")[1].split("/")[0]
  
  
}
