// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

'use strict';

/// <reference path='./lib/base-event.ts' />

export * from './lib/base-event';
export * from './lib/sync-event';
export * from './lib/queued-event';
export * from './lib/async-event';
export * from './lib/any-event';

import {default as EventQueue} from './lib/EventQueue';
export {default as EventQueue} from './lib/EventQueue';

/**
 * The global event queue for QueuedEvents
 */
export function queue(): EventQueue {
    return EventQueue.global();
}

/**
 * Convenience function, same as EventQueue.global().flushOnce().
 * Flushes the QueuedEvents, calling all events currently in the queue but not
 * any events put into the queue as a result of the flush.
 */
export function flushOnce(): void {
    EventQueue.global().flushOnce();
}

/**
 * Convenience function, same as EventQueue.global().flush().
 * Flushes the QueuedEvents, calling all handlers currently in the queue and those
 * put into the queue as a result of the flush.
 * @param maxRounds Optional, default 10. Number of iterations after which to throw an error because
 *                  the queue keeps filling up. Set to undefined or null to disable this.
 */
export function flush(maxRounds: number = 10): void {
    EventQueue.global().flush(maxRounds);
}
