"use strict";

const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/Promise.jsm");
//const Promise = require('sdk/core/promise');

function NotImplementedError(message) {
   this.message = message;
   this.name = "NotImplementedError";
   this.toString = function() {
      return this.name + " " + this.message;
   };
}

function Node(identifier, listenType, emitType) {
  this.identifier = identifier;
  this.listenType = listens;
  this.emitType = emits;
  this.emitDeferred = Promise.defer();
  this.results = null;
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

  consume: function _Node_consume(message, flush) {
    /*
     * Process a message. Starts an ingestion chain in the topology.
     * @param   message   message to be consumed
     * @param   flush     whether to wait until emitReady
     * @returns a promise that resolves when processing is complete
     */
    this.ingest(message);
    if (this.emitReady() || flush) {
      return this.flush();
    }
    return this.emitDeferred.promise;
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
     * Emit whatever's left and clear result store
     * @returns a resolved promise
     */
    let deferred = this.emitDeferred;
    deferred.resolve(this.results);
    this.clear();
    return deferred.promise;
  },

  clear: function _Node_clear() {
    /*
     * Clear any temporary data
     */
    this.results = null;
    this.emitDeferred = Promise.defer();
  }
}

function createNode(options) {
  function EasyNode() {
    this.results = null;
    this.emitDeferred = Promise.defer();
  }
  let properties = {};
  for (let key of Object.keys(options)) {
    properties[key] = {value: options[key]};
  }
  EasyNode.prototype = Object.create(Node.prototype, properties);
  return new EasyNode();
}

function Stream() {
  this.objects = {};
  this.listensTo = {};
  this.heads = {};
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
    let deferred = Promise.defer();
    if (!(this.heads.hasOwnProperty(messageType) && this.listensTo.hasOwnProperty(messageType))) {
      deferred.reject("cannot push a non-head message");
    }
    let handlers = this.listensTo[messageType] || [];
    return this._launch_process(handlers, message);
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
    return this._launch_process(handlers, null, true);
  },

  _launch_process: function _stream__launch_process(handlers, message, flush) {
    let deferred = Promise.defer();
    let subTasks = [];
    for (let handlerName of handlers) {
      subTasks.push(this._process(handlerName, message, flush));
    }
    Promise.all(subTasks).then(() => {
      deferred.resolve();
    },
    error => {
      Cu.reportError(error);
      deferred.reject(error);
    });
    return deferred.promise;
  },

  _process: function _stream__process(objectIdent, message, flush) {
    /*
     * Process a task, starting a chain of messages, until there is no
     * more to do to process.
     * @param   objectIdent     object identifier to send a message
     * @param   message         message to be sent. ignored when flushing
     * @param   flush           trigger nodes to flush
     */
    let worker = this.objects[objectIdent];
    let messageCopy = JSON.parse(JSON.stringify(message));
    return worker.consume(messageCopy, flush).then(newMessage => {
      let listeners = this.listensTo[worker.emitType] || [];
      let promises = [];
      for (let ident of listeners) {
        promises.push(this._process(ident, newMessage));
      }
      return Promise.all(promises);
    });
  },
}

exports.Node = Node;
exports.createNode = createNode;
exports.Stream = Stream;
