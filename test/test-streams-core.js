"use strict";

const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");
const test = require("sdk/test");
const oldPromise = require("sdk/core/promise");
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
    let boltDeferred = oldPromise.defer();

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
        assert.equal(messages.length, 2, "messages are buffered and sent");
        assert.equal(messages[0], "MESSAGE 1", "messages have been processed by the bolt");
        assert.equal(messages[1], "MESSAGE 2", "messages have been processed by the bolt");
        boltDeferred.resolve();
      }
    });

    let stream = new Stream();
    stream.addNode(pairSpout, true);
    stream.addNode(capitalizeBolt);
    stream.addNode(assertionBolt);

    stream.push("lonelyMessage", "message 1");
    stream.push("lonelyMessage", "message 2");
    yield boltDeferred.promise;
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
        this.emitDeffered = oldPromise.defer();
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

    let assertDeferred;

    // eat is sent with an even count. total is even
    stream.push("events", ["eat", "work", "eat", "sleep"]);
    assertDeferred = oldPromise.defer();
    doAssert = function(message) {
      assert.equal(Object.keys(message).length, 1, "message items are buffered");
      assert.equal(message.eat, 2, "message items have been counted");
      assertDeferred.resolve();
    }
    yield assertDeferred.promise;

    // sleep is sent with an even count, though total is 3
    stream.push("events", ["eat", "sleep", "eat", "sleep", "eat"]);
    assertDeferred = oldPromise.defer();
    doAssert = function(message) {
      assert.equal(Object.keys(message).length, 1, "message items are buffered");
      assert.equal(message.sleep, 3, "message counts have been accumulated");
      assertDeferred.resolve();
    }
    yield assertDeferred.promise;
  }).then(done);
}

/*
 * Tests spout waiting
 * Stream = [pairSpout -> assertionBolt]
 */
exports["test spout waiting"] = function test_spout_waiting(assert, done) {
  Task.spawn(function() {
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
    let assertDeferred = oldPromise.defer();
    let numCalled = 0;
    let collectorBolt = createNode({
      identifier: "collectorBolt",
      listenType: "pairMessages",
      emitType: null,
      ingest: function(messages) {
        numCalled += 1;
        if (numCalled == 2) {
          assertDeferred.resolve();
        }
      }
    });
    let stream = new Stream();
    stream.addNode(pairSpout, true);
    stream.addNode(collectorBolt);

    for(let msgNum = 0; msgNum < 3; msgNum++) {
      stream.push("lonelyMessage", "msg_"+msgNum);
    }
    stream.push("lonelyMessage", "msg_4");
    yield assertDeferred.promise;
    assert.equal(numCalled, 2, "consumed calls in the stream don't cause messages to flow");
  }).then(done);
}

/*
 * Tests that flushing a stream makes nodes return immediately.
 */
exports["test flush"] = function test_flush(assert, done) {
  Task.spawn(function() {
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

    let assertDeferred;

    // make sure buffering until five works
    stream.push("incr", 4);
    assertDeferred = oldPromise.defer();
    doAssert = function(count) {
      assert.equal(count, 5);
      assertDeferred.resolve();
    }
    stream.push("incr", 1);
    yield assertDeferred.promise;
    assert.equal(bufferFiveSpout.results, null);

    // flushing should override the buffering behavior
    stream.push("incr", 1);
    assertDeferred = oldPromise.defer();
    doAssert = function(count) {
      assert.equal(count, 1);
      assertDeferred.resolve();
    }
    stream.flush();
    yield assertDeferred.promise;
  }).then(done);
}

/*
 * Ensures that data is serialized before being sent to workers
 */
exports["test message copy"] = function test_message_copy(assert, done) {
  // in javascript, associative arrays are passed by reference
  // this is a test that ensures that deep message copies are sent to nodes
  Task.spawn(function() {
    let splitToCharBolt = createNode({
      identifier: "splitToCharBolt",
      listenType: "testMessage",
      emitType: null,
      ingest: function(message) {
        assert.equal(typeof(message.text), "string", "input is a string");
        message.text = message.text.split('');
        this.results = message;
      }
    });
    let assertDeferred = oldPromise.defer();
    let capitalizeBolt = createNode({
      identifier: "capitalizeBolt",
      listenType: "testMessage",
      emitType: null,
      ingest: function(message) {
        assert.equal(typeof(message.text), "string", "input is still a string");
        message.text = message.text.toUpperCase();
        this.results = message;
        assertDeferred.resolve();
      }
    });

    let stream = new Stream();
    stream.addNode(splitToCharBolt, true);
    stream.addNode(capitalizeBolt, true);

    stream.push("testMessage", {text: "I'm a test message"});

    yield assertDeferred.promise;
  }).then(done);
}

test.run(exports);
