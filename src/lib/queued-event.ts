// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

"use strict";

import util = require("util");
import {BaseEvent, Postable, Listener} from './base-event';
import {default as EventQueue} from "./EventQueue";

/**
 * Options for the QueuedEvent constructor
 */
export interface QueuedEventOpts {
    /**
     * Condense multiple calls to post() into one.
     */
    condensed?: boolean;
    /**
     * Specific event queue to use. If not provided, the global instance is used.
     */
    queue?: EventQueue;
}

/**
 * Event that stays in a queue until you process the queue. Allows fine-grained
 * control over when events happen.
 * - Optionally condenses multiple post() calls into one.
 * - Handlers are called only for events posted after they were attached.
 * - Handlers are not called anymore when they are detached, even if a post() is in progress
 */
export class QueuedEvent<T> extends BaseEvent<T> implements Postable<T> {

    /**
     * Used internally - the exact options object given to constructor
     */
    public options: QueuedEventOpts;

    private _condensed: boolean;
    private _queue: EventQueue;
    private _queued: boolean = false;
    private _queuedListeners: Listener<T>[];
    private _queuedData: any[];

    /**
     * Constructor
     * @param opts Optional, an object with the following members:
     *             - condensed: a Boolean indicating whether to condense multiple calls to post() into one (default false)
     *             - queue: a specific event queue to use. The global EventQueue instance is used if not given.
     */
    constructor(opts?: QueuedEventOpts) {
        super();
        this.options = opts;
        var options: QueuedEventOpts = opts || {};
        if (typeof options.condensed === "boolean") {
            this._condensed = options.condensed;
        } else {
            this._condensed = false;
        }
        if (typeof options.queue === "object" && options.queue !== null) {
            this._queue = options.queue;
        }
    }

    /**
    * Send the event. Events are queued in the event queue until flushed out.
    * If the 'condensed' option was given in the constructor, multiple posts()
    * between queue flushes are condensed into one call with the data from the
    * last post() call.
    */
    public post(data: T): void;
    public post(...args: any[]): void {
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        var queue = (this._queue ? this._queue : EventQueue.global());
        if (this._condensed) {
            this._queuedData = args;
            this._queuedListeners = this._listeners;
            if (this._queued) {
                return;
            } else {
                this._queued = true;
                queue.add((): void => {
                    // immediately mark non-queued to allow new AsyncEvent to happen as result
                    // of calling handlers
                    this._queued = false;
                    // cache listeners and data because they might change while calling event handlers
                    var data = this._queuedData;
                    var listeners = this._queuedListeners;
                    for (var i = 0; i < listeners.length; ++i) {
                        var listener = listeners[i];
                        this._call(listener, data);
                    }
                });
            }
        } else { // not condensed
            var listeners = this._listeners;
            queue.add((): void => {
                for (var i = 0; i < listeners.length; ++i) {
                    var listener = listeners[i];
                    this._call(listener, args);
                }
            });
        }
    }
}

/**
 * Convenience class for events without data
 */
export class VoidQueuedEvent extends QueuedEvent<void> {

    /**
     * Send the event.
     */
    public post(): void {
        super.post(undefined);
    }
}


/**
 * Similar to "error" event on EventEmitter: throws when a post() occurs while no handlers set.
 */
export class ErrorQueuedEvent extends QueuedEvent<Error> {

    public post(data: Error): void {
        if (!this._listeners || this._listeners.length === 0) {
            throw new Error(util.format("error event posted while no listeners attached. Error: ", data));
        }
        super.post(data);
    }
}
