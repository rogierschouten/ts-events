// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../typings/index.d.ts"/>

"use strict";

import util = require("util");

import baseEvent = require("./base-event");
import BaseEvent = baseEvent.BaseEvent;
import Listener = baseEvent.Listener;

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
export class AsyncEvent<T> extends BaseEvent<T> {

    private _condensed: boolean;

    private _queued: boolean = false;
    private _queuedListeners: Listener<T>[];
    private _queuedData: any[];

    /**
     * The default scheduler uses setImmediate() or setTimeout(..., 0) if setImmediate is not available.
     */
    public static defaultScheduler(callback: () => void): void {
        /* istanbul ignore else  */
        if (setImmediate) {
            setImmediate(callback);
        } else {
            setTimeout(callback, 0);
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
    constructor(opts?: AsyncEventOpts) {
        super();
        var options: AsyncEventOpts = opts || {};
        if (typeof options.condensed === "boolean") {
            this._condensed = options.condensed;
        } else {
            this._condensed = false;
        }
    }

    /**
     * Send the AsyncEvent. Handlers are called in the next Node.JS cycle.
     */
    public post(data: T): void;
    public post(...args: any[]): void {
        if (this._condensed) {
            this._queuedData = args;
            this._queuedListeners = this._copyListeners();
            if (this._queued) {
                return;
            } else {
                this._queued = true;
                AsyncEvent._scheduler((): void => {
                    // immediately mark non-queued to allow new AsyncEvent to happen as result
                    // of calling handlers
                    this._queued = false;
                    // cache listeners and data because they might change while calling event handlers
                    var listeners = this._queuedListeners;
                    var data = this._queuedData;
                    for (var i = 0; i < listeners.length; ++i) {
                        var listener = listeners[i];
                        if (!listener.deleted) {
                            listener.handler.apply((typeof listener.boundTo === "object" ? listener.boundTo : this), data);
                        }
                    }
                });
            }
        } else { // not condensed
            var listeners = this._copyListeners();
            AsyncEvent._scheduler((): void => {
                for (var i = 0; i < listeners.length; ++i) {
                    var listener = listeners[i];
                    if (!listener.deleted) {
                        listener.handler.apply((typeof listener.boundTo === "object" ? listener.boundTo : this), args);
                    }
                }
            });
        }
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
 * Similar to "error" event on EventEmitter: throws when a post() occurs while no handlers set.
 */
export class ErrorAsyncEvent extends AsyncEvent<Error> {

    public post(data: Error): void {
        if (this.listenerCount() === 0) {
            throw new Error(util.format("error event posted while no listeners attached. Error: ", data));
        }
        super.post(data);
    }
}
