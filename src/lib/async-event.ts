// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

'use strict';

import {BaseEvent, Postable, Listener} from './base-event';
import {VoidSyncEvent} from './sync-event';

/**
 * Options for the AsyncEvent constructor
 */
export interface AsyncEventOpts {
    /**
     * Condense multiple calls to post() into one while the previous one
     * has not been handled yet.
     */
    condensed?: boolean;
}

/**
 * A-synchronous event. Handlers are called in the next Node.JS cycle.
 * - Optionally condenses multiple post() calls into one (the last post() gets through)
 * - Handlers are called only for events posted after they were attached.
 * - Handlers are not called anymore when they are detached, even if a post() is in progress
 */
export class AsyncEvent<T> extends BaseEvent<T> implements Postable<T> {
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
    public options: AsyncEventOpts;

    private _condensed: boolean;
    private _queued: boolean = false;
    private _queuedListeners: Listener<T>[];
    private _queuedData: any[];

    /**
     * The default scheduler uses setImmediate() or setTimeout(..., 0) if setImmediate is not available.
     */
    public static defaultScheduler(callback: () => void): void {
        /* istanbul ignore else  */
        if (typeof window !== 'undefined') {
            // browsers don't always support setImmediate()
            setTimeout(callback, 0);
        } else {
            // node.js
            setImmediate(callback);
        }
    }

    /**
     * The current scheduler
     */
    private static _scheduler: (callback: () => void) => void = AsyncEvent.defaultScheduler;

    /**
     * By default, AsyncEvent uses setImmediate() to schedule event handler invocation.
     * You can change this for e.g. setTimeout(..., 0) by calling this static method once.
     * @param scheduler A function that takes a callback and executes it in the next Node.JS cycle.
     */
    public static setScheduler(scheduler: (callback: () => void) => void): void {
        AsyncEvent._scheduler = scheduler;
    }

    /**
     * Constructor
     * @param opts Optional. Various settings:
     *             - condensed: a Boolean indicating whether to condense multiple post() calls within the same cycle.
     */
    constructor(opts: AsyncEventOpts = {}) {
        super();
        this.options = opts;
        if (typeof opts.condensed === 'boolean') {
            this._condensed = opts.condensed;
        } else {
            this._condensed = false;
        }
    }

    /**
     * Send the AsyncEvent. Handlers are called in the next Node.JS cycle.
     */
    public post(data: T): void;
    public post(...args: any[]): void {
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        if (this._condensed) {
            this._queuedData = args;
            this._queuedListeners = this._listeners;
            if (this._queued) {
                return;
            } else {
                this._queued = true;
                AsyncEvent._scheduler((): void => {
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
            AsyncEvent._scheduler((): void => {
                for (let i = 0; i < listeners.length; ++i) {
                    const listener = listeners[i];
                    this._call(listener, args);
                }
            });
        }
    }

    // inherited
    protected _call(listener: Listener<T>, args: any[]): void {
        // performance optimization: don't use consecutive nodejs cycles
        // for asyncevents attached to asyncevents
        if (listener.event && listener.event instanceof AsyncEvent) {
            (<AsyncEvent<T>>listener.event)._postDirect(args);
        } else {
            super._call(listener, args);
        }
    }

    /**
     * Performance optimization: if this async signal is attached to another
     * async signal, we're already a the next cycle and we can call listeners
     * directly
     */
    protected _postDirect(args: any[]): void {
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        // copy a reference to the array because this._listeners might be replaced during
        // the handler calls
        const listeners = this._listeners;
        for (let i = 0; i < listeners.length; ++i) {
            const listener = listeners[i];
            this._call(listener, args);
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
 * Convenience class for AsyncEvents without data
 */
export class VoidAsyncEvent extends AsyncEvent<void> {

    /**
     * Send the AsyncEvent.
     */
    public post(): void {
        super.post(undefined);
    }
}

/**
 * Similar to 'error' event on EventEmitter: throws when a post() occurs while no handlers set.
 */
export class ErrorAsyncEvent extends AsyncEvent<Error> {

    public post(data: Error): void {
        if (this.listenerCount() === 0) {
            throw new Error(`error event posted while no listeners attached. Error: ${data.message}`);
        }
        super.post(data);
    }
}
