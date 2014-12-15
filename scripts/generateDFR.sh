#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

### Generate DFR file from domain/host/path rules and LICA words

scriptDir=$(pwd $(dirname $0))
lica_words_file=/tmp/$$.json
$scriptDir/mapWordsTree.js $scriptDir/../refData/words.json > $lica_words_file
$scriptDir/generateDFR.js $scriptDir/../refData/rules.json $lica_words_file | $scriptDir/sortJSON.js
rm $lica_words_file
