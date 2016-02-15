// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
/// <reference path="./lib/base-event.ts" />
__export(require('./lib/base-event'));
__export(require('./lib/sync-event'));
__export(require('./lib/queued-event'));
__export(require('./lib/async-event'));
var EventQueue_1 = require('./lib/EventQueue');
exports.EventQueue = EventQueue_1.default;
__export(require('./lib/any-event'));
var EventQueue_2 = require('./lib/EventQueue');
/**
 * The global event queue for QueuedEvents
 */
function queue() {
    return EventQueue_2.default.global();
}
exports.queue = queue;
/**
 * Convenience function, same as EventQueue.global().flushOnce().
 * Flushes the QueuedEvents, calling all events currently in the queue but not
 * any events put into the queue as a result of the flush.
 */
function flushOnce() {
    EventQueue_2.default.global().flushOnce();
}
exports.flushOnce = flushOnce;
/**
 * Convenience function, same as EventQueue.global().flush().
 * Flushes the QueuedEvents, calling all handlers currently in the queue and those
 * put into the queue as a result of the flush.
 * @param maxRounds Optional, default 10. Number of iterations after which to throw an error because
 *                  the queue keeps filling up. Set to undefined or null to disable this.
 */
function flush(maxRounds) {
    if (maxRounds === void 0) { maxRounds = 10; }
    EventQueue_2.default.global().flush(maxRounds);
}
exports.flush = flush;
//# sourceMappingURL=index.js.map