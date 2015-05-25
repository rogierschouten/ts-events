// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/index.d.ts"/>
"use strict";
var syncEvent = require("./sync-event");
var SyncEvent = syncEvent.SyncEvent;
/**
 * Simple synchronous event queue that needs to be drained manually.
 */
var EventQueue = (function () {
    function EventQueue() {
        /**
         * SyncEvent triggered after an event is added outside of a flush operation.
         * @param queue The event queue itself
         */
        this.evtFilled = new SyncEvent();
        /**
         * SyncEvent triggered after the queue is flushed empty
         * @param queue The event queue itself
         */
        this.evtDrained = new SyncEvent();
        /**
         * Queued elements
         */
        this._queue = [];
        /**
         * True while flush() or flushOnce() is running
         */
        this._flushing = false;
    }
    /**
     * The module-global event queue
     */
    EventQueue.global = function () {
        if (!EventQueue._instance) {
            EventQueue.resetGlobal();
        }
        return EventQueue._instance;
    };
    /**
     * Testing purposes
     */
    EventQueue.resetGlobal = function () {
        EventQueue._instance = new EventQueue();
    };
    /**
     * Returns true iff the queue is empty
     */
    EventQueue.prototype.empty = function () {
        return this._queue.length === 0;
    };
    /**
     * Add an element to the queue. The handler is called when one of the flush
     * methods is called.
     */
    EventQueue.prototype.add = function (handler) {
        this._queue.push(handler);
        if (this._queue.length === 1 && !this._flushing) {
            this.evtFilled.post(this);
        }
    };
    /**
     * Calls all handlers currently in the queue. Does not call any handlers added
     * as a result of the flush
     */
    EventQueue.prototype.flushOnce = function () {
        var empty = (this._queue.length === 0);
        var flushing = this._flushing;
        this._flushing = true;
        try {
            var queue = this._queue;
            this._queue = [];
            for (var i = 0; i < queue.length; ++i) {
                queue[i]();
            }
        }
        finally {
            this._flushing = flushing;
            if (!empty && !flushing && this._queue.length === 0) {
                this.evtDrained.post(this);
            }
        }
    };
    /**
     * Flushes the QueuedEvents, calling all events currently in the queue and those
     * put into the queue as a result of the flush.
     * @param maxRounds Optional, default 10. Number of iterations after which to throw an error because
     *                  the queue keeps filling up. Set to null to disable this.
     */
    EventQueue.prototype.flush = function (maxRounds) {
        if (maxRounds === void 0) { maxRounds = 10; }
        var empty = (this._queue.length === 0);
        var flushing = this._flushing;
        this._flushing = true;
        try {
            var i = 0;
            while (this._queue.length > 0) {
                if (typeof maxRounds === "number" && i >= maxRounds) {
                    this._queue = [];
                    throw new Error("unable to flush the queue due to recursively added event. Clearing queue now");
                }
                this.flushOnce();
                ++i;
            }
        }
        finally {
            this._flushing = flushing;
            if (!empty && !flushing && this._queue.length === 0) {
                this.evtDrained.post(this);
            }
        }
    };
    return EventQueue;
})();
module.exports = EventQueue;
//# sourceMappingURL=EventQueue.js.map