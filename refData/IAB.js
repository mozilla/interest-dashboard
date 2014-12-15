/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Taxonomy = {
	"fashion": {
		"body art": true,
		"clothing": true,
		"jewelry": true,
		"beauty": true,
		},
	"cell phones": {
		},
	"family & parenting": {
			"pregnancy": true,
			"parenting": true,
		},
	"food & drink": {
			"cheese": true,
			"baking": true,
			"cocktails": true,
			"dining out": true,
			"tea": true,
			"vegetarian": true,
			"cooking": true,
			"cider": true,
			"barbecues & grilling": true,
			"vegan": true,
			"healthy eating": true,
			"beer": true,
			"coffee": true,
			"pasta": true,
			"fruit": true,
			"wine": true,
	},
	"society": {
			"sociology": true,
			"gay life": true,
			"anthropology": true,
			"marriage": true,
			"dating": true,
			"social networking": true,
		},
	"personal finance": {
			"retirement planning": true,
			"investing": true,
			"banking": true,
			"credit, debt & loans": true,
			"stocks": true,
			"insurance": true,
			"tax": true,
		},
	"home": {
			"appliances": true,
			"garden": true,
			"interior design": true,
		},
	"politics": {
			"government": true,
		},
	"education": {
			'university': true,
			"languages": true,
			"academia": true,
			"homeschooling": true,
		},
	"agriculture": {
		},
	"drugs": {
		'cannabis': true,
		},
	"hobbies & interests": {
			"dance": true,
			"woodworking": true,
			"birdwatching": true,
			"board games": true,
			"coins": true,
			"arts & crafts": true,
			"antiques": true,
			"writing": true,
			"stamps": true,
			"gambling": true,
			"sci-fi": true,
			"photography": true,
			"smoking": true,
			"pottery": true,
			"scouting": true,
			"genealogy": true,
			"horse racing": true,
			"needlework": true,
			"metalworking": true,
		},
	"travel": {
			"cruise vacations": true,
			"adventure travel": true,
			"budget travel": true,
			"hotels": true,
			"air travel": true,
			"trains": true,
		},
	"sports": {
		"american football": true,
		"skating": true,
		"walking": true,
		"tennis": true,
		"golf": true,
		"skateboarding": true,
		"wrestling": true,
		"gymnastics": true,
		"athletics": true,
		"volleyball": true,
		"skiing": true,
		"bodybuilding": true,
		"basketball": true,
		"yoga": true,
		"fencing": true,
		"boxing": true,
		"olympics": true,
		"hockey": true,
		"soccer": true,
		"martial arts": true,
		"cricket": true,
		"cheerleading": true,
		"jogging": true,
		"surfing": true,
		"baseball": true,
		"darts": true,
		"cycling": true,
		"archery": true,
		"climbing": true,
		"rugby": true,
		"sailing": true,
		"racing": true,
		'rowing': true,
		"kayaking": true,
		"bowling": true,
		"snowboarding": true,
		"diving": true,
		"hunting": true,
		"fishing": true,
		"swimming": true,
	},
	"religion": {
		"judaism": true,
		"wicca": true,
		"christianity": true,
		"buddhism": true,
		"shinto": true,
		"hinduism": true,
		"islam": true,
	},
	"pets": {
		"aquariums": true,
		"cats": true,
		"reptiles": true,
		"dogs": true,
		"birds": true,
	},
	"technology & computing": {
		'unix': true,
		"freeware": true,
		"graphics": true,
		"software": true,
		"hardware": true,
		"gaming": true,
		"windows": true,
		"programming": true,
		"database": true,
		"apple": true,
	},
	"careers": {
	},
	"business": {
		"logistics": true,
		"commerce": true,
		"mining": true,
		"non proft": true,
		"publishing": true,
		"biotech": true,
		"marketing": true,
		"energy": true,
		"human resources": true,
		"metals": true,
		"forestry": true,
		"construction": true,
		"advertising": true,
		"shipping": true,
		"manufacturing": true,
		"ecommerce": true,
		"biomedical": true,
	},
	"automotive": {
		'car brands': true,
		"pickup trucks": true,
		'motorcycles': true,
		"convertibles": true,
		"minivans": true,
		"sedans": true,
		"wagons": true,
		"hatchbacks": true,
		"coupe": true,
	},
	"philosophy": {
		},
	"arts & entertainment": {
		"television": true,
		"literature": true,
		"humor": true,
		'theatre': true,
		"opera": true,
		"poetry": true,
		"film": true,
		"anime": true,
		"comics": true,
		"animation": true,
		"design": true,
		"music": true,
		'radio': true,
    "video games": true,
    "celebrities": true,
	},
	"adult": {
	},
	"folklore": {
		'paranormal phenomena': true,
		'astrology': true,
	},
	"weather": {
	},
	"law": {
		"crime": true,
		"immigration": true,
	},
	"science": {
		"mechanics": true,
		"botany": true,
		'biology': true,
		"chemistry": true,
		"geology": true,
		"virology": true,
		"palaeontology": true,
		"mathematics": true,
		"astronomy": true,
		"physics": true,
		"geography": true,
		"economics": true,
	},
	"health & fitness": {
		"deafness": true,
		"bowel incontinence": true,
		"epilepsy": true,
		"dental care": true,
		"dieting": true,
		"alternative medicine": true,
		"dermatology": true,
		"autism": true,
		"psychology & psychiatry": true,
		"asthma": true,
		"vitamins": true,
		"cold & flu": true,
		"cancer": true,
		"orthopedic": true,
		"exercise": true,
		"nutrition": true,
		"pediatrics": true,
		"chronic pain": true,
		"anatomy": true,
		"aids hiv": true,
		"diabetes": true,
		"stress": true,
		"thyroid": true,
		"depression": true,
		"sex": true,
		"cardiac": true,
	},
	"architecture": {
	},
	"real estate": {
		'mortgages': true,
	},
	"military": {
		'terrorism': true,
	},
	"history": {
		"archaeology": true,
	},
};

exports.Taxonomy = Taxonomy;
exports.RevMap = (function() {
  var revMap = {};
  Object.keys(Taxonomy).forEach(function(key) {
    revMap[key] = [key];
    Object.keys(Taxonomy[key]).forEach(function(subKey) {
      revMap[subKey] = [key, key + "/" + subKey];
    });
  });
  return revMap;
})();
