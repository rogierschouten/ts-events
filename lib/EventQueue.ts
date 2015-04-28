// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../typings/index.d.ts"/>

"use strict";

/**
 * Simple synchronous event queue that needs to be drained manually.
 */
class EventQueue {

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
     * Add an element to the queue. The handler is called when one of the flush
     * methods is called.
     */
    public add(handler: () => void): void {
        this._queue.push(handler);
    }

    /**
     * Calls all handlers currently in the queue. Does not call any handlers added
     * as a result of the flush
     */
    public flushOnce(): void {
        var queue = this._queue;
        this._queue = [];
        for (var i = 0; i < queue.length; ++i) {
            queue[i]();
        }
    }

    /**
     * Flushes the QueuedEvents, calling all events currently in the queue and those
     * put into the queue as a result of the flush.
     * @param maxRounds Optional, default 10. Number of iterations after which to throw an error because
     *                  the queue keeps filling up. Set to null to disable this.
     */
    public flush(maxRounds: number = 10): void {
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
}

export = EventQueue;
