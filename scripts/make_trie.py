import json
import re
import numpy as np
from pandas import DataFrame, Series

nonalphabet = re.compile("[^a-z]")

with open('words.txt', 'r') as f:
    lines = f.readlines()

trigrams = {}
for line in lines:
    trigram = line.strip().lower()[0:3]
    if len(trigram) >= 3 and not nonalphabet.search(trigram):
        if trigram == "aaa":
            print "line: {0} trigram: {1}".format(line, trigram)
        trigrams.setdefault(trigram, 0)
        trigrams[trigram] += 1

trigram_series = Series(trigrams.values(), index=trigrams.keys())
trigram_series.sort(inplace=True, ascending=True)
print trigram_series
print "quartiles:\n{0}".format(trigram_series.quantile([.25, .50, .75, .99]).to_string())

print "median is: {0}".format(trigram_series.median())
unique_trigrams = []
for trigram, count in trigrams.iteritems():
    if count > trigram_series.quantile(.50):
        unique_trigrams.append(trigram)
    unique_trigrams.append(trigram)

print "saving trigrams"
with open("trigrams.json", "w") as f:
    json.dump(unique_trigrams, f)
print "saved {0} trigrams".format(len(unique_trigrams))

trie = {}
for trigram in unique_trigrams:
    current_dict = trie
    for index, letter in enumerate(trigram):
        value = {}
        if index+1 == len(trigram):
            value = 0
        current_dict = current_dict.setdefault(letter, value)
    current_dict = current_dict.setdefault(0, 0)

print "saving trie"
with open("trie.json", "w") as f:
    json.dump(trie, f)
