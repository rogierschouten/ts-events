// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

'use strict';

import {SyncEvent} from './sync-event';

/**
 * Simple synchronous event queue that needs to be drained manually.
 */
class EventQueue {

    /**
     * SyncEvent triggered after an event is added outside of a flush operation.
     * @param queue The event queue itself
     */
    public evtFilled: SyncEvent<EventQueue> = new SyncEvent<EventQueue>();
    /**
     * SyncEvent triggered after the queue is flushed empty
     * @param queue The event queue itself
     */
    public evtDrained: SyncEvent<EventQueue> = new SyncEvent<EventQueue>();

    /**
     * The module-global event queue
     */
    private static _instance: EventQueue;

    /**
     * The module-global event queue
     */
    public static global(): EventQueue {
        if (!EventQueue._instance) {
            EventQueue.resetGlobal();
        }
        return EventQueue._instance;
    }

    /**
     * Testing purposes
     */
    public static resetGlobal(): void {
        EventQueue._instance = new EventQueue();
    }

    /**
     * Queued elements
     */
    private _queue: (() => void)[] = [];

    /**
     * True while flush() or flushOnce() is running
     */
    private _flushing: boolean = false;

    /**
     * Returns true iff the queue is empty
     */
    public empty(): boolean {
        return this._queue.length === 0;
    }

    /**
     * Add an element to the queue. The handler is called when one of the flush
     * methods is called.
     */
    public add(handler: () => void): void {
        this._queue.push(handler);
        if (this._queue.length === 1 && !this._flushing) {
            this.evtFilled.post(this);
        }
    }

    /**
     * Calls all handlers currently in the queue. Does not call any handlers added
     * as a result of the flush
     */
    public flushOnce(): void {
        var empty = (this._queue.length === 0);
        var flushing = this._flushing;
        this._flushing = true;
        try {
            var queue = this._queue;
            this._queue = [];
            for (var i = 0; i < queue.length; ++i) {
                queue[i]();
            }
        } finally {
            this._flushing = flushing;
            if (!empty && !flushing && this._queue.length === 0) {
                this.evtDrained.post(this);
            }
        }
    }

    /**
     * Flushes the QueuedEvents, calling all events currently in the queue and those
     * put into the queue as a result of the flush.
     * @param maxRounds Optional, default 10. Number of iterations after which to throw an error because
     *                  the queue keeps filling up. Set to null to disable this.
     */
    public flush(maxRounds: number = 10): void {
        var empty = (this._queue.length === 0);
        var flushing = this._flushing;
        this._flushing = true;
        try {
            var i = 0;
            while (this._queue.length > 0) {
                if (typeof maxRounds === 'number' && i >= maxRounds) {
                    this._queue = [];
                    throw new Error('unable to flush the queue due to recursively added event. Clearing queue now');
                }
                this.flushOnce();
                ++i;
            }
        } finally {
            this._flushing = flushing;
            if (!empty && !flushing && this._queue.length === 0) {
                this.evtDrained.post(this);
            }
        }
    }
}

export default EventQueue;
