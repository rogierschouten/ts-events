// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="./typings/index.d.ts"/>
"use strict";
var syncEvent = require("./lib/sync-event");
syncEvent;
exports.SyncEvent = syncEvent.SyncEvent;
exports.VoidSyncEvent = syncEvent.VoidSyncEvent;
exports.ErrorSyncEvent = syncEvent.ErrorSyncEvent;
var queuedEvent = require("./lib/queued-event");
queuedEvent;
exports.QueuedEvent = queuedEvent.QueuedEvent;
exports.VoidQueuedEvent = queuedEvent.VoidQueuedEvent;
exports.ErrorQueuedEvent = queuedEvent.ErrorQueuedEvent;
var asyncEvent = require("./lib/async-event");
exports.AsyncEvent;
exports.AsyncEvent = asyncEvent.AsyncEvent;
exports.VoidAsyncEvent = asyncEvent.VoidAsyncEvent;
exports.ErrorAsyncEvent = asyncEvent.ErrorAsyncEvent;
exports.EventQueue = require("./lib/EventQueue");
exports.EventQueue;
/**
 * Convenience function, same as EventQueue.global().flushOnce().
 * Flushes the QueuedEvents, calling all events currently in the queue but not
 * any events put into the queue as a result of the flush.
 */
function flushOnce() {
    exports.EventQueue.global().flushOnce();
}
exports.flushOnce = flushOnce;
/**
 * Convenience function, same as EventQueue.global().flushEmpty().
 * Flushes the QueuedEvents, calling all handlers currently in the queue and those
 * put into the queue as a result of the flush.
 * @param maxRounds Optional, default 10. Number of iterations after which to throw an error because
 *                  the queue keeps filling up. Set to undefined or null to disable this.
 */
function flushEmpty(maxRounds) {
    if (maxRounds === void 0) { maxRounds = 10; }
    exports.EventQueue.global().flushEmpty(maxRounds);
}
exports.flushEmpty = flushEmpty;
//# sourceMappingURL=index.js.map