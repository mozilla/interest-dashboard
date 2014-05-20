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

exports["test push linear topology"] = function test_flush(assert, done) {
  /*
   * Tests a simple topology:
   * Stream = [Spout -> Bolt -> Bolt]
   */
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

    let resultAsserterBolt = createNode({
      identifier: "resultAsserterBolt",
      listenType: "capitalizedPairs",
      emitType: null,
      ingest: function(messages) {
        boltDeferred.resolve();
        assert.equal(messages.length, 2);
      }
    });

    let stream = new Stream();
    stream.addNode(pairSpout, true);
    stream.addNode(capitalizeBolt);
    stream.addNode(resultAsserterBolt);

    let pushPromise = stream.push("lonelyMessage", "message 1");
    stream.push("lonelyMessage", "message 2");
    yield boltDeferred.promise;
    yield pushPromise;
  }).then(done);
};

test.run(exports);
