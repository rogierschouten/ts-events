// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/index.d.ts"/>
"use strict";
/**
 * Simple synchronous event queue that needs to be drained manually.
 */
var EventQueue = (function () {
    function EventQueue() {
        this._queue = [];
    }
    /**
     * The default event queue
     */
    EventQueue.global = function () {
        if (!global.tAsyncEventEventQueue) {
            global.tAsyncEventEventQueue = new EventQueue();
        }
        return global.tAsyncEventEventQueue;
    };
    /**
     * Testing purposes
     */
    EventQueue.resetGlobal = function () {
        global.tAsyncEventEventQueue = new EventQueue();
    };
    /**
     * Add an element to the queue. The handler is called when one of the flush
     * methods is called.
     */
    EventQueue.prototype.add = function (handler) {
        this._queue.push(handler);
    };
    /**
     * Calls all handlers currently in the queue. Does not call any handlers added
     * as a result of the flush
     */
    EventQueue.prototype.flushOnce = function () {
        var queue = this._queue;
        this._queue = [];
        for (var i = 0; i < queue.length; ++i) {
            queue[i]();
        }
    };
    /**
     * Flushes the QueuedEvents, calling all events currently in the queue and those
     * put into the queue as a result of the flush.
     * @param maxRounds Optional, default 10. Number of iterations after which to throw an error because
     *                  the queue keeps filling up. Set to null to disable this.
     */
    EventQueue.prototype.flushEmpty = function (maxRounds) {
        if (maxRounds === void 0) { maxRounds = 10; }
        var i = 0;
        while (this._queue.length > 0) {
            if (typeof maxRounds === "number" && i >= maxRounds) {
                this._queue = [];
                throw new Error("unable to flush the queue due to recursively added event. Clearing queue now");
            }
            this.flushOnce();
            ++i;
        }
    };
    return EventQueue;
})();
module.exports = EventQueue;
//# sourceMappingURL=EventQueue.js.map