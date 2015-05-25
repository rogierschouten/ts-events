// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="./typings/index.d.ts"/>

"use strict";

/* tslint:disable:no-unused-expression */

import syncEvent = require("./lib/sync-event"); syncEvent;
export import SyncEvent = syncEvent.SyncEvent;
export import VoidSyncEvent = syncEvent.VoidSyncEvent;
export import ErrorSyncEvent = syncEvent.ErrorSyncEvent;

import queuedEvent = require("./lib/queued-event"); queuedEvent;
export import QueuedEvent = queuedEvent.QueuedEvent;
export import VoidQueuedEvent = queuedEvent.VoidQueuedEvent;
export import ErrorQueuedEvent = queuedEvent.ErrorQueuedEvent;

import asyncEvent = require("./lib/async-event"); asyncEvent;
export import AsyncEvent = asyncEvent.AsyncEvent;
export import VoidAsyncEvent = asyncEvent.VoidAsyncEvent;
export import ErrorAsyncEvent = asyncEvent.ErrorAsyncEvent;

export import EventQueue = require("./lib/EventQueue"); EventQueue;

import anyEvent = require("./lib/any-event"); anyEvent;
export import AnyEvent = anyEvent.AnyEvent;
export import VoidAnyEvent = anyEvent.VoidAnyEvent;
export import ErrorAnyEvent = anyEvent.ErrorAnyEvent;

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
