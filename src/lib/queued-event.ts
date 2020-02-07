// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

'use strict';

import {BaseEvent, Postable, Listener} from './base-event';
import {default as EventQueue} from './EventQueue';
import {VoidSyncEvent} from './sync-event';

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
     * Sent when someone attaches or detaches
     */
    public get evtListenersChanged(): VoidSyncEvent {
        if (!this._listenersChanged) {
            // need to delay-load to avoid stack overflow in constructor
            this._listenersChanged = new VoidSyncEvent();
        }
        return this._listenersChanged;
    }

    /**
     * Event for listening to listener count
     */
    private _listenersChanged?: VoidSyncEvent;

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
    constructor(opts: QueuedEventOpts = {}) {
        super();
        this.options = opts;
        if (typeof opts.condensed === 'boolean') {
            this._condensed = opts.condensed;
        } else {
            this._condensed = false;
        }
        if (typeof opts.queue === 'object' && opts.queue !== null) {
            this._queue = opts.queue;
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
        const queue = (this._queue ? this._queue : EventQueue.global());
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
                    const data = this._queuedData;
                    const listeners = this._queuedListeners;
                    for (let i = 0; i < listeners.length; ++i) {
                        const listener = listeners[i];
                        this._call(listener, data);
                    }
                });
            }
        } else { // not condensed
            const listeners = this._listeners;
            queue.add((): void => {
                for (let i = 0; i < listeners.length; ++i) {
                    const listener = listeners[i];
                    this._call(listener, args);
                }
            });
        }
    }

    /** @inheritdoc */
    protected _attach(a: ((data: T) => void) | Object | Postable<T>, b: ((data: T) => void) | undefined, once: boolean): () => void {
        const count = this._listeners?.length ?? 0;
        const result = super._attach(a, b, once);
        if (this.evtListenersChanged && count !== (this._listeners?.length ?? 0)) {
            this.evtListenersChanged.post();
        }
        return result;
    }

    /** @inheritdoc */
    protected _detach(...args: any[]): void {
        const count = this._listeners?.length ?? 0;
        const result = super._detach(...args);
        if (this.evtListenersChanged && count !== (this._listeners?.length ?? 0)) {
            this.evtListenersChanged.post();
        }
        return result;
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
 * Similar to 'error' event on EventEmitter: throws when a post() occurs while no handlers set.
 */
export class ErrorQueuedEvent extends QueuedEvent<Error> {

    public post(data: Error): void {
        if (!this._listeners || this._listeners.length === 0) {
            throw new Error(`error event posted while no listeners attached. Error: ${data.message}`);
        }
        super.post(data);
    }
}
