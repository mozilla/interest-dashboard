//LWCA refined
//2014-09-08 mruttley
//Refined version of LWCA algorithm/process

//How to use? Simply:
// > let lwca = new LWCAClassifier()
// > lwca.classify("http://www.bbc.com/some_very_interesting_article", "Apple reveals shiny new gadget")
// >>> ['computers', 0.75]

let verbose = false

function LWCAClassifier({domain_rules, host_rules, path_rules, words_tree, ignore_words, ignore_domains, ignore_exts, bad_domain_specific}) {
	// Main handler class
	this.domain_rules = domain_rules;
	this.host_rules = host_rules;
	this.path_rules = path_rules;
	this.words_tree = words_tree;
	this.ignore_words = ignore_words;
	this.ignore_domains = ignore_domains;
	this.ignore_exts = ignore_exts;
	this.bad_domain_specific = bad_domain_specific;

	//Initialize various processors
	if (verbose) console.log("Initializing...")

	//build vk-tree
	vk_tree = {}
	for (let top_level of Object.keys(this.words_tree)) {
		for (let sub_level of Object.keys(this.words_tree[top_level])) {
			for (let kw of this.words_tree[top_level][sub_level]) {
				vk_tree[kw] = [top_level, sub_level]
			}
		}
	}

	//build bad_domains, bad_ext, bad_chunk
	let bad_domains = {}
	let bad_exts = {}
	let bad_chunks = {}

	for (let domain_name of Object.keys(this.bad_domain_specific)){
		let domain_name_chunks = domain_name.split(".")
		bad_domains[domain_name_chunks[0]] = 1
		bad_exts[domain_name_chunks[1]] = 1
		for (let chunk of this.bad_domain_specific[domain_name]) {
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
			if (this.host_rules.hasOwnProperty(fragment)) {
				rule_mapping = this.host_rules[fragment]; break
			}
			if (this.domain_rules.hasOwnProperty(fragment)) {
				rule_mapping = this.domain_rules[fragment]; break
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
				if (this.path_rules.hasOwnProperty(full_fragment)) {
					rule_mapping = this.path_rules[full_fragment]; break
				}
			}
		}

		if (rule_mapping != false) {
			//is it top level already?
			if (this.words_tree.hasOwnProperty(rule_mapping)) {
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

			if (this.ignore_domains.hasOwnProperty(chunk)) ignore_domain += 1
			if (this.ignore_exts.hasOwnProperty(chunk)) ignore_ext += 1
			if (bad_domains.hasOwnProperty(chunk)) bad_domain += 1
			if (bad_exts.hasOwnProperty(chunk)) bad_ext += 1
			if (bad_chunks.hasOwnProperty(chunk)) bad_chunk += 1
			if (this.ignore_words.hasOwnProperty(chunk)) continue

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
}

let wordFinder = RegExp("[a-z]{3,}", "g") //tokenizes english sentences

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