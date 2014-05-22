"use strict";

const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Task.jsm");
const test = require("sdk/test");
const Promise = require("sdk/core/promise");
const {Stream, Node, createNode} = require("streams/core");


exports["test addNode"] = function test_addNode(assert) {
  let dummySpout = createNode({
    identifier: "dummySpout",
    listenType: "dummyInput",
    emitType: "dummyOutput",
  });
  let stream = new Stream();
  stream.addNode(dummySpout);
  assert.equal(Object.keys(stream.objects).length, 1, "addNode adds to a list");
  assert.equal(Object.keys(stream.listensTo["dummyInput"]).length, 1, "addNode populates listener list");
  assert.equal(stream.listensTo["dummyInput"][0], "dummySpout", "addNode populates dummyInput listeners");

  let dummyBolt = createNode({
    identifier: "dummyBolt",
    listenType: "dummyOutput",
    emitType: "dummierOutput",
  });
  stream.addNode(dummyBolt);
  assert.equal(Object.keys(stream.objects).length, 2, "addNode adds another object to a list");
  assert.equal(Object.keys(stream.listensTo["dummyOutput"]).length, 1, "addNode populates dummyOutput listeners");
}

/*
 * Tests a simple topology:
 * Stream = [pairSpout -> capitalizeBolt -> assertionBolt]
 */
exports["test push linear topology"] = function test_push_linear(assert, done) {
  Task.spawn(function() {
    let boltDeferred = Promise.defer();

    let pairSpout = createNode({
      identifier: "twoMsgSpout",
      listenType: "lonelyMessage",
      emitType: "pairMessages",
      ingest: function(message) {
        if (!this.results) {
          this.results = [];
        }
        this.results.push(message);
      },
      emitReady: function() {
        return this.results.length > 1;
      }
    });

    let capitalizeBolt = createNode({
      identifier: "capitalizeBolt",
      listenType: "pairMessages",
      emitType: "capitalizedPairs",
      ingest: function(messages) {
        this.results = [];
        for (let message of messages) {
          this.results.push(message.toUpperCase());
        }
      }
    });

    let assertionBolt = createNode({
      identifier: "assertionBolt",
      listenType: "capitalizedPairs",
      emitType: null,
      ingest: function(messages) {
        boltDeferred.resolve(true);
        assert.equal(messages.length, 2);
      }
    });

    let stream = new Stream();
    stream.addNode(pairSpout, true);
    stream.addNode(capitalizeBolt);
    stream.addNode(assertionBolt);

    let pushPromise = stream.push("lonelyMessage", "message 1");
    stream.push("lonelyMessage", "message 2");
    let deferredPassed = yield boltDeferred.promise;
    assert.ok(deferredPassed);
    yield pushPromise;
  }).then(done);
};

/*
 * Tests a complex topology:
 * Stream = [countingBolt  -> summingCountBolt -> \
 *                         \                       \
 *                          \-> evenAlertBolt ->    comboLoggerSpout -> assertionBolt]
 */
exports["test push complex topology"] = function test_push_complex(assert, done) {
  Task.spawn(function() {

    // takes a series of events and turn them into occurence counts
    let countingBolt = createNode({
      identifier: "countingBolt",
      listenType: "events",
      emitType: "discreteEvents",
      ingest: function(events) {
        if (!this.results) {
          this.results = {};
        }
        for (let evt of events) {
          if (!this.results[evt]) {
            this.results[evt] = 0;
          }
          this.results[evt] += 1;
        }
      }
    });

    // keeps track of the cummulative count for an event
    let summingCountBolt = createNode({
      identifier: "summingCountBolt",
      listenType: "discreteEvents",
      emitType: "loggable",
      ingest: function(eventCounts) {
        if (!this.results) {
          this.results = {type:"sum", data:{}};
        }
        for (let name in eventCounts) {
          let count = eventCounts[name];

          if (!this.results.data[name]) {
            this.results.data[name] = 0;
          }
          this.results.data[name] += count;
        }
      },
      clear: function() {
        this.emitDeffered = Promise.defer();
      }
    });

    // alerts whether the current occurence count is even
    let evenAlertBolt = createNode({
      identifier: "comboAlertBolt",
      listenType: "discreteEvents",
      emitType: "loggable",
      ingest: function(eventCounts) {
        if (!this.results) {
          this.results = {type:"even", data:[]};
        }
        for (let name in eventCounts) {
          let count = eventCounts[name];
          if (count % 2 == 0) {
            this.results.data.push(name);
          }
        }
      }
    });

    // returns the total when an even occurence count is encountered
    let evenLoggerSpout = createNode({
      identifier: "evenLoggerSpout",
      listenType: "loggable",
      emitType: "evenSums",
      ingest: function(message) {
        if (!this.results) {
          this.results = {};
        }
        if (!this.storage) {
          this.storage = {};
        }
        if (message.type == 'sum') {
          for (let name in message.data) {
            this.storage[name] = message.data[name];
          }
        }
        else if (message.type == 'even') {
          for (let name of message.data) {
            this.results[name] = this.storage[name];
          }
        }
      },
      emitReady: function() {
        return this.results != null && Object.keys(this.results).length != 0;
      }
    });

    let doAssert;
    let assertionBolt = createNode({
      identifier: "assertionBolt",
      listenType: "evenSums",
      emitType: null,
      ingest: function(message) {
        doAssert(message);
      }
    });

    let stream = new Stream();
    stream.addNode(countingBolt, true);
    stream.addNode(summingCountBolt);
    stream.addNode(evenAlertBolt);
    stream.addNode(evenLoggerSpout);
    stream.addNode(assertionBolt);

    let pushPromise;

    // eat is sent with an even count. total is even
    pushPromise = stream.push("events", ["eat", "work", "eat", "sleep"]);
    doAssert = function(message) {
      assert.equal(message.eat, 2);
    }
    yield pushPromise;

    // sleep is sent with an even count, though total is 3
    pushPromise = stream.push("events", ["eat", "sleep", "eat", "sleep", "eat"]);
    doAssert = function(message) {
      assert.equal(message.sleep, 3);
    }
    yield pushPromise;
  }).then(done);
}

/*
 * Tests flushing a stream
 */
exports["test flush"] = function test_flush(assert, done) {
    // spout that waits until a count reaches at least 5 to push
    let bufferFiveSpout = createNode({
      identifier: "bufferFiveSpout",
      listenType: "incr",
      emitType: "bufferedCount",
      ingest: function(count) {
        if (!this.results) {
          this.results = 0;
        }
        this.results += count;
      },
      emitReady: function() {
        return this.results >= 5;
      }
    });

    let doAssert;
    let assertionBolt = createNode({
      identifier: "assertionBolt",
      listenType: "bufferedCount",
      emitType: null,
      ingest: function(count) {
        doAssert(count);
      }
    });
    let stream = new Stream();
    stream.addNode(bufferFiveSpout, true);
    stream.addNode(assertionBolt);

    let pushPromise;

    // make sure buffering until five works
    stream.push("incr", 4);
    doAssert = function(count) {
      assert.equal(count, 5);
    }
    yield stream.push("incr", 1);
    assert.equal(bufferFiveSpout.results, null);

    // flushing should override the buffering behavior
    stream.push("incr", 1);
    doAssert = function(count) {
      assert.equal(count, 1);
    }
    yield stream.flush();
}

test.run(exports);
