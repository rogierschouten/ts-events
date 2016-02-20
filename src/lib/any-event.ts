// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

/// <reference path='../../typings/tsd.d.ts'/>

'use strict';

import util = require('util');

import {shallowEquals} from './objects';

import {BaseEvent, Postable, Listener} from './base-event';
import {SyncEvent} from './sync-event';
import {AsyncEvent, AsyncEventOpts} from './async-event';
import {QueuedEvent, QueuedEventOpts} from './queued-event';

export enum EventType {
    Sync,
    Async,
    Queued
};

/**
 * An event that behaves like a Sync/Async/Queued event depending on how
 * you subscribe.
 */
export class AnyEvent<T> implements Postable<T> {

    private _events: BaseEvent<T>[] = [];

    public attachSync(handler: (data: T) => void): void;
    public attachSync(boundTo: Object, handler: (data: T) => void): void;
    public attachSync(event: Postable<T>): void;
    /**
     * Attach event handlers as if it were a sync event. It is simply called 'attach'
     * so that this class adheres to the BaseEvent<T> signature.
     */
    public attachSync(...args: any[]): void {
        // add ourselves as default 'boundTo' argument
        if (args.length > 0 && typeof args[0] === 'function') {
            args.unshift(this);
        }
        var event: BaseEvent<T>;
        for (var i = 0; i < this._events.length; ++i) {
            if (this._events[i] instanceof SyncEvent) {
                event = this._events[i];
            }
        }
        if (!event) {
            event = new SyncEvent<T>();
            this._events.push(event);
        }
        event.attach.apply(event, args);
    }

    public attachAsync(handler: (data: T) => void, opts?: AsyncEventOpts): void;
    public attachAsync(boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts): void;
    public attachAsync(event: Postable<T>, opts?: AsyncEventOpts): void;
    /**
     * Attach event handlers as if it were a a-sync event
     */
    public attachAsync(...args: any[]): void {
        var opts: AsyncEventOpts;
        if (args.length > 1 && typeof args[args.length - 1] === 'object') {
            opts = args[args.length - 1];
        }
        // add ourselves as default 'boundTo' argument
        if (args.length > 0 && typeof args[0] === 'function') {
            args.unshift(this);
        }
        var event: BaseEvent<T>;
        for (var i = 0; i < this._events.length; ++i) {
            if (this._events[i] instanceof AsyncEvent
                && shallowEquals((<AsyncEvent<T>>this._events[i]).options, opts)) {
                event = this._events[i];
            }
        }
        if (!event) {
            event = new AsyncEvent<T>(opts);
            this._events.push(event);
        }
        event.attach.apply(event, args);
    }

    public attachQueued(handler: (data: T) => void, opts?: QueuedEventOpts): void;
    public attachQueued(boundTo: Object, handler: (data: T) => void, opts?: QueuedEventOpts): void;
    public attachQueued(event: Postable<T>, opts?: QueuedEventOpts): void;
    /**
     * Attach event handlers as if it were a queued event
     */
    public attachQueued(...args: any[]): void {
        var opts: QueuedEventOpts;
        if (args.length > 1 && typeof args[args.length - 1] === 'object') {
            opts = args[args.length - 1];
        }
        // add ourselves as default 'boundTo' argument
        if (args.length > 0 && typeof args[0] === 'function') {
            args.unshift(this);
        }
        var event: BaseEvent<T>;
        for (var i = 0; i < this._events.length; ++i) {
            if (this._events[i] instanceof QueuedEvent
                && shallowEquals((<QueuedEvent<T>>this._events[i]).options, opts)) {
                event = this._events[i];
            }
        }
        if (!event) {
            event = new QueuedEvent<T>(opts);
            this._events.push(event);
        }
        event.attach.apply(event, args);
    }

    public detach(handler: (data: T) => void): void;
    public detach(boundTo: Object, handler: (data: T) => void): void;
    public detach(boundTo: Object): void;
    public detach(event: Postable<T>): void;
    public detach(): void;
    /**
     * Detach event handlers regardless of type
     */
    public detach(...args: any[]): void {
        for (var i = 0; i < this._events.length; ++i) {
            this._events[i].detach.apply(this._events[i], args);
        }
    }

    /**
     * Post an event to all current listeners
     */
    public post(data: T): void {
        var i: number;
        // make a copy of the array first to cover the case where event handlers
        // are attached during the post
        var events: BaseEvent<T>[] = [];
        for (i = 0; i < this._events.length; ++i) {
            events.push(this._events[i]);
        };
        for (i = 0; i < events.length; ++i) {
            events[i].post(data);
        }
    }

    /**
     * The number of attached listeners
     */
    public listenerCount(): number {
        var result = 0;
        for (var i = 0; i < this._events.length; ++i) {
            result += this._events[i].listenerCount();
        }
        return result;
    }
}

/**
 * Convenience class for AnyEvents without data
 */
export class VoidAnyEvent extends AnyEvent<void> {

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
export class ErrorAnyEvent extends AnyEvent<Error> {

    public post(data: Error): void {
        if (this.listenerCount() === 0) {
            throw new Error(util.format('error event posted while no listeners attached. Error: ', data));
        }
        super.post(data);
    }
}
