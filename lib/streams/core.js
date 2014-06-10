"use strict";

const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/Promise.jsm");
const {promiseTimeout} = require("Utils");

function NotImplementedError(message) {
   this.message = message;
   this.name = "NotImplementedError";
   this.toString = function() {
      return this.name + " " + this.message;
   };
}

function Node(identifier, listenType, emitType) {
  this.identifier = identifier;
  this.listenType = listenType;
  this.emitType = emitType;
  this.results = null;
  this.initted = false;
  this.seenEmits = {};
}

Node.prototype = {
  /*
   * A Node consumes data and returns a promise when it is done processing.
   *
   * Bolts and Spouts are implemented using the Node object.
   *
   * A Bolt is defined as a Node that returns a result as soon as a message is
   * ingested.
   *
   * A Spout is defined as a Node that returns a result eventually, when
   * a certain condition is met and emitReady is true.
   *
   * When implementing a Spout, create a condition by overriding emitReady.
   * When implementing a Bolt, leave emitReady as-is.
   */

  _isDuplicate: function _Node__isDuplicate(meta) {
    /*
     * Determine if this node has seen a message before.
     *
     * This may happen because streams, as currently implemented, will call
     * the same node multiple times if the node just upstream is a Spout and if
     * multiple consume calls have accumulated before the Spout emitted.
     *
     * A better way to fix this is either to:
     * 1. Make the stream smarter about this
     * 2. Change the way a consume/push is handled
     */
    if(meta && meta.previous) {
      let key = meta.previous.identifier + meta.previous.emitNum;
      if (this.seenEmits[key]) {
        return true;
      }
      else {
        this.seenEmits[key] = true;
      }
    }
    return false;
  },

  consume: function _Node_consume(payload, flush) {
    /*
     * Process a message. Starts an ingestion chain in the topology.
     * @param   payload   {meta, message} bundle to be consumed
     * @param   flush     whether to wait until emitReady
     * @returns a promise that resolves when processing is complete
     */
    if (!this.initted) {
      this.init();
      this.initted = true;
    }

    let {meta, message} = payload;

    let isDuplicate = this._isDuplicate(meta);
    let output = null;

    if (!isDuplicate) {
      if (message) {
        this.ingest(message);
        this._callIngestCallbackMaybe();
      }
      if (this.emitReady() || flush) {
        this.emitCount += 1;
        let results = this.flush();
        meta = {
          previous: {
            identifier: this.identifier,
            emitNum: this.emitCount,
          }
        }
        output = {meta: meta, message: results};
        this._callEmitCallbackMaybe();
        this.clear();
      }
    }

    return output;
  },

  ingest: function _Node_ingest(message) {
    /*
     * Takes a message to be processed
     */
    throw new NotImplementedError("ingest implementation not found");
  },

  emitReady: function _Node_emitReady() {
    /*
     * Returns when output should be flushed
     * @returns boolean
     */
    return true;
  },

  flush: function _Node_flush() {
    /*
     * Emit a message. The emit "buffer" will be cleared after this is called.
     * @returns the data to be flushed
     */
    let results = this.results;
    return results;
  },

  clear: function _Node_clear() {
    /*
     * Clear any temporary data
     */
    this.results = null;
  },

  init: function _Node_init() {
    /*
     * Runs when consume is called for the first time.
     */
    this.results = null;
    this.initted = false;
    this.emitCount = 0;
    this.seenEmits = {};
  },

  setEmitCallback: function _Node_setEmitCallback(callback) {
    /*
     * Set an optional hook that gets called when an emit is about to finish
     */
    if (!this._emitCallback) {
      this._emitCallback = [];
    }
    if (callback) {
      this._emitCallback.push(callback);
    }
  },

  _callEmitCallbackMaybe: function _Node__callEmitCallbackMaybe() {
    if (this._emitCallback && this._emitCallback.length) {
      for (let callback of this._emitCallback) {
        callback(this);
      }
    }
  },

  setIngestCallback: function _Node_setIngestCallback(callback) {
    /*
     * Set an optional hook that gets called when an ingest is about to finish
     */
    if (!this._ingestCallback) {
      this._ingestCallback = [];
    }
    if (callback) {
      this._ingestCallback.push(callback);
    }
  },

  _callIngestCallbackMaybe: function _Node__callIngestCallbackMaybe() {
    if (this._ingestCallback && this._ingestCallback.length) {
      for (let callback of this._ingestCallback) {
        callback(this);
      }
    }
  },

}

function createNode(options, locals) {
  function EasyNode() {
    this.results = null;
    this.emitCount = 0;
    this.initted = false;
    this.seenEmits = {};

    for (let key in locals) {
      this[key] = locals[key];
    }
  }
  let properties = {};
  for (let key in options) {
    properties[key] = {value: options[key]};
  }
  EasyNode.prototype = Object.create(Node.prototype, properties);
  return new EasyNode();
}

function Stream() {
  this.objects = {};
  this.listensTo = {};
  this.heads = {};
  this.jobQueue = [];
  this._workPromise = null;
  this._work();
}

Stream.prototype = {

  addNode: function _stream_addNode(obj, isHead) {
    if (!this.listensTo[obj.listenType]) {
      this.listensTo[obj.listenType] = [];
    }
    this.listensTo[obj.listenType].push(obj.identifier);

    this.objects[obj.identifier] = obj;

    if (isHead) {
      this.heads[obj.listenType] = true;
    }
  },

  push: function _stream_push(messageType, message) {
    /*
     * Push a message down the stream, from the top
     * @returns a promise that gets resolved when all downstream tasks are done
     */
    if (!(this.heads.hasOwnProperty(messageType) && this.listensTo.hasOwnProperty(messageType))) {
      deferred.reject("cannot push a non-head message");
    }
    let handlers = this.listensTo[messageType] || [];
    //return this._launch_process(handlers, message);
    return this._enqueue(handlers, message);
  },

  flush: function _stream_flush() {
    /*
     * Push a message down the stream, from the top
     * @returns a promise that gets resolved when all downstream tasks are done
     */
    let handlers = [];
    for (let messageType in this.heads) {
      let msgHandlers = this.listensTo[messageType];
      for (let handlerName of msgHandlers) {
        handlers.push(handlerName);
      }
    }
    //return this._launch_process(handlers, null, true);
    return this._enqueue(handlers, null, true);
  },

  _enqueue: function _stream__enqueue(handlers, message, flush) {
    /*
     * Adds a job to be processed later
     * @param handlers  an array of worker names to send the initial message
     * @param message   initial message to send to the network
     * @param flush     whether to send a flush message or not
     */
    for (let handlerName of handlers) {
      let job = [handlerName, {meta: null, message: message}, flush];
      this.jobQueue.push(job);
    }
  },

  _work: function _stream__work() {
    /*
     * Background task that makes sure that jobs are processed
     */
    if (!this._workPromise) {
      this._workPromise = Task.spawn(function _stream__work_task() {
        try {
          while (true) {
            if (this.jobQueue.length) {
              let job = this.jobQueue.shift();
              yield this._process(job[0], job[1], job[2]);
            }
            yield promiseTimeout(100);
          }
        } catch(ex) {
          console.error(ex);
        }
      }.bind(this));
    }
  },

  _process: function _stream__process(objectIdent, payload, flush) {
    /*
     * Process a task, starting a chain of messages, until there is no
     * more to do to process.
     * @param   objectIdent     object identifier to send a message
     * @param   payload         {meta, message} bundle to be sent. ignored when flushing
     * @param   flush           trigger nodes to flush
     */
    return Task.spawn(function() {
      let worker = this.objects[objectIdent];
      let payloadCopy = JSON.parse(JSON.stringify(payload));
      let newPayload = yield worker.consume(payloadCopy, flush);

      if (newPayload) {
        let listeners = this.listensTo[worker.emitType] || [];
        let promises = [];
        if (!newPayload.terminate) {
          for (let ident of listeners) {
            promises.push(this._process(ident, newPayload));
          }
        }
        yield Promise.all(promises);
      }
    }.bind(this));
  },
}

exports.Node = Node;
exports.createNode = createNode;
exports.Stream = Stream;
