

function getDomain(url){
	//accepts a url
	//returns the domain name + TLD
	return domain
}

function parseURI(url){
	//Accepts: a url string
	//Returns: different parts of the URI
	
	//extract different types of chunks
	chunks = {
		"protocol": "",
		"subdomains": [],
		"domain_name": "",
		"path": [],
		"filename": "",
		"variable_names": [],
		"variable_values": [],
	}

	//this could be made more efficient with a letter-by-letter while loop
	chunks['protocol'] = url.split("://")[0]
	chunks['domain_name'] = get_domain(url)
	chunks['subdomains'] = url.split(chunks['domain_name'])[0].split(chunks['protocol'])[1].split(".")
	
	path_and_rest = url.split(chunks['domain_name'])[1].split("?")
	path_items = path_and_rest[0].split("/")
	chunks['path'] = path_items.slice(0,-1)
	chunks['filename'] = path_items.slice(-1)
	
	if (path_and_rest.length > 1) {
		variables = path_and_rest[1].split("&")
		for (let vq of variables) {
			vq = vq.split("=")
			variable_names.append(vq[0])
			if (vq.length > 1) {
				variable_values.append(vq[1])
			}
		}
	}
	
	return chunks
}
