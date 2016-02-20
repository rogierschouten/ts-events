// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

/// <reference path='../../typings/tsd.d.ts'/>

'use strict';

import assert = require('assert');
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

export interface AnyEventOpts {
    /**
     * Create evtFirstAttached and evtLastDetached so you can monitor when someone is subscribed
     */
    monitorAttach?: boolean;
}

/**
 * An event that behaves like a Sync/Async/Queued event depending on how
 * you subscribe.
 */
export class AnyEvent<T> implements Postable<T> {

    /**
     * Triggered whenever someone attaches and nobody was attached.
     * Note: you must call the constructor with monitorAttach set to true to create this event!
     */
    public evtFirstAttached: VoidAnyEvent;
    /**
     * Triggered whenever someone detaches and nobody is attached anymore
     * Note: you must call the constructor with monitorAttach set to true to create this event!
     */
    public evtLastDetached: VoidAnyEvent;

    /**
     * Underlying event implementations; one for every attach type + opts combination
     */
    private _events: BaseEvent<T>[] = [];

    constructor(opts?: AnyEventOpts) {
        if (opts && opts.monitorAttach) {
            this.evtFirstAttached = new VoidAnyEvent();
            this.evtLastDetached = new VoidAnyEvent();
        }
    }

    public attach(handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): void;
    public attach(boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): void;
    public attach(event: Postable<T>, opts?: AsyncEventOpts | QueuedEventOpts): void;
    public attach(mode: EventType, handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): void;
    public attach(mode: EventType, boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): void;
    public attach(mode: EventType, event: Postable<T>, opts?: AsyncEventOpts | QueuedEventOpts): void;
    /**
     * same as attachSync/attachAsync/attachQueued; based on the given enum
     * @param mode determines whether to attach sync/async/queued
     */
    public attach(...args: any[]): void {
        const prevCount = (!!this.evtFirstAttached ? this.listenerCount() : 0);
        let mode = EventType.Sync;
        if (args.length > 0 && typeof args[0] === 'number') {
            mode = args.shift() as EventType;
        }
        switch (mode) {
            case EventType.Sync: {
                // add ourselves as default 'boundTo' argument
                if (args.length > 0 && typeof args[0] === 'function') {
                    args.unshift(this);
                }
                let event: BaseEvent<T>;
                for (let i = 0; i < this._events.length; ++i) {
                    if (this._events[i] instanceof SyncEvent) {
                        event = this._events[i];
                    }
                }
                if (!event) {
                    event = new SyncEvent<T>();
                    this._events.push(event);
                }
                event.attach.apply(event, args);
            } break;
            case EventType.Async: {
                let opts: AsyncEventOpts;
                if (args.length > 1 && typeof args[args.length - 1] === 'object') {
                    opts = args[args.length - 1];
                }
                // add ourselves as default 'boundTo' argument
                if (args.length > 0 && typeof args[0] === 'function') {
                    args.unshift(this);
                }
                let event: BaseEvent<T>;
                for (let i = 0; i < this._events.length; ++i) {
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
            } break;
            case EventType.Queued: {
                let opts: QueuedEventOpts;
                if (args.length > 1 && typeof args[args.length - 1] === 'object') {
                    opts = args[args.length - 1];
                }
                // add ourselves as default 'boundTo' argument
                if (args.length > 0 && typeof args[0] === 'function') {
                    args.unshift(this);
                }
                let event: BaseEvent<T>;
                for (let i = 0; i < this._events.length; ++i) {
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
            } break;
            default:
                assert(false, 'unknown EventType');
        }
        if (this.evtFirstAttached && prevCount === 0) {
            console.log('posting');
            this.evtFirstAttached.post();
        }
    }

    public attachSync(handler: (data: T) => void): void;
    public attachSync(boundTo: Object, handler: (data: T) => void): void;
    public attachSync(event: Postable<T>): void;
    /**
     * Attach event handlers as if it were a sync event. It is simply called 'attach'
     * so that this class adheres to the BaseEvent<T> signature.
     */
    public attachSync(...args: any[]): void {
        args.unshift(EventType.Sync);
        this.attach.apply(this, args);
    }

    public attachAsync(handler: (data: T) => void, opts?: AsyncEventOpts): void;
    public attachAsync(boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts): void;
    public attachAsync(event: Postable<T>, opts?: AsyncEventOpts): void;
    /**
     * Attach event handlers as if it were a a-sync event
     */
    public attachAsync(...args: any[]): void {
        args.unshift(EventType.Async);
        this.attach.apply(this, args);
    }

    public attachQueued(handler: (data: T) => void, opts?: QueuedEventOpts): void;
    public attachQueued(boundTo: Object, handler: (data: T) => void, opts?: QueuedEventOpts): void;
    public attachQueued(event: Postable<T>, opts?: QueuedEventOpts): void;
    /**
     * Attach event handlers as if it were a queued event
     */
    public attachQueued(...args: any[]): void {
        args.unshift(EventType.Queued);
        this.attach.apply(this, args);
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
        const prevCount = (!!this.evtLastDetached ? this.listenerCount() : 0);
        for (let i = 0; i < this._events.length; ++i) {
            this._events[i].detach.apply(this._events[i], args);
        }
        if (!!this.evtLastDetached && prevCount > 0 && this.listenerCount() === 0) {
            this.evtLastDetached.post();
        }
    }

    /**
     * Post an event to all current listeners
     */
    public post(data: T): void {
        // make a copy of the array first to cover the case where event handlers
        // are attached during the post
        const events: BaseEvent<T>[] = [];
        for (let i = 0; i < this._events.length; ++i) {
            events.push(this._events[i]);
        };
        for (let i = 0; i < events.length; ++i) {
            events[i].post(data);
        }
    }

    /**
     * The number of attached listeners
     */
    public listenerCount(): number {
        let result = 0;
        for (let i = 0; i < this._events.length; ++i) {
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
