// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

'use strict';

import {shallowEquals} from './objects';

import {BaseEvent, Postable, Listener} from './base-event';
import {SyncEvent} from './sync-event';
import {AsyncEvent, AsyncEventOpts} from './async-event';
import {QueuedEvent, QueuedEventOpts} from './queued-event';

export enum EventType {
    Sync,
    Async,
    Queued
}

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

    /**
     * Legacy method
     * same as attachSync/attachAsync/attachQueued; based on the given enum
     * @param mode determines whether to attach sync/async/queued
     */
    public attach(handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public attach(boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public attach(event: Postable<T>, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public attach(mode: EventType, handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public attach(mode: EventType, boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public attach(mode: EventType, event: Postable<T>, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public attach(...args: any[]): () => void {
        let mode = EventType.Sync;
        if (args.length > 0 && typeof args[0] === 'number') {
            mode = args.shift() as EventType;
        }
        let boundTo: Object = this; // add ourselves as default 'boundTo' argument
        let handler: (data: T) => void;
        let opts: AsyncEventOpts | QueuedEventOpts;
        let postable: Postable<T>;
        if (typeof args[0] === 'function' || (args[0] && typeof args[0] === 'object' && typeof args[0].post === 'function')) {
            if (typeof args[0] === 'function') {
                handler = args[0];
            } else {
                postable = args[0];
            }
            opts = args[1];
        } else {
            boundTo = args[0];
            handler = args[1];
            opts = args[2];
        }
        return this._attach(mode, boundTo, handler, postable, opts, false);
    }

    /**
     * Legacy method
     * same as onceSync/onceAsync/onceQueued; based on the given enum
     * @param mode determines whether to once sync/async/queued
     */
    public once(handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public once(boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public once(event: Postable<T>, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public once(mode: EventType, handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public once(mode: EventType, boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public once(mode: EventType, event: Postable<T>, opts?: AsyncEventOpts | QueuedEventOpts): () => void;
    public once(...args: any[]): () => void {
        let mode = EventType.Sync;
        if (args.length > 0 && typeof args[0] === 'number') {
            mode = args.shift() as EventType;
        }
        let boundTo: Object = this; // add ourselves as default 'boundTo' argument
        let handler: (data: T) => void;
        let opts: AsyncEventOpts | QueuedEventOpts;
        let postable: Postable<T>;
        if (typeof args[0] === 'function' || (args[0] && typeof args[0] === 'object' && typeof args[0].post === 'function')) {
            if (typeof args[0] === 'function') {
                handler = args[0];
            } else {
                postable = args[0];
            }
            opts = args[1];
        } else {
            boundTo = args[0];
            handler = args[1];
            opts = args[2];
        }
        return this._attach(mode, boundTo, handler, postable, opts, true);
    }

    private _attach(
        mode: EventType,
        boundTo: Object | undefined,
        handler: (data: T) => void | undefined,
        postable: Postable<T> | undefined,
        opts: AsyncEventOpts | QueuedEventOpts | undefined,
        once: boolean
    ): () => void {
        const prevCount = (!!this.evtFirstAttached ? this.listenerCount() : 0);
        let event: BaseEvent<T>;
        switch (mode) {
            case EventType.Sync: {
                for (const evt of this._events) {
                    if (evt instanceof SyncEvent) {
                        event = evt;
                    }
                }
                if (!event) {
                    event = new SyncEvent<T>();
                    this._events.push(event);
                }
            } break;
            case EventType.Async: {
                for (const evt of this._events) {
                    if (evt instanceof AsyncEvent && shallowEquals((<AsyncEvent<T>>evt).options, opts)) {
                        event = evt;
                    }
                }
                if (!event) {
                    event = new AsyncEvent<T>(opts);
                    this._events.push(event);
                }
            } break;
            case EventType.Queued: {
                for (const evt of this._events) {
                    if (evt instanceof QueuedEvent && shallowEquals((<QueuedEvent<T>>evt).options, opts)) {
                        event = evt;
                    }
                }
                if (!event) {
                    event = new QueuedEvent<T>(opts);
                    this._events.push(event);
                }
            } break;
            default:
                throw new Error('unknown EventType');
        }
        let detacher: () => void;
        if (once) {
            if (postable) {
                detacher = event.once(postable);
            } else {
                detacher = event.once(boundTo, handler);
            }
        } else {
            if (postable) {
                detacher = event.attach(postable);
            } else {
                detacher = event.attach(boundTo, handler);
            }
        }
        if (this.evtFirstAttached && prevCount === 0) {
            this.evtFirstAttached.post();
        }
        return (): void => {
            const prevCount = (!!this.evtLastDetached ? this.listenerCount() : 0);
            detacher();
            if (!!this.evtLastDetached && prevCount > 0 && this.listenerCount() === 0) {
                this.evtLastDetached.post();
            }
        };
    }

    public attachSync(handler: (data: T) => void): () => void;
    public attachSync(boundTo: Object, handler: (data: T) => void): () => void;
    public attachSync(event: Postable<T>): () => void;
    public attachSync(...args: any[]): () => void {
        args.unshift(EventType.Sync);
        return this.attach.apply(this, args);
    }

    public onceSync(handler: (data: T) => void): () => void;
    public onceSync(boundTo: Object, handler: (data: T) => void): () => void;
    public onceSync(event: Postable<T>): () => void;
    public onceSync(...args: any[]): () => void {
        args.unshift(EventType.Sync);
        return this.once.apply(this, args);
    }

    public attachAsync(handler: (data: T) => void, opts?: AsyncEventOpts): () => void;
    public attachAsync(boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts): () => void;
    public attachAsync(event: Postable<T>, opts?: AsyncEventOpts): () => void;
    public attachAsync(...args: any[]): () => void {
        args.unshift(EventType.Async);
        return this.attach.apply(this, args);
    }

    public onceAsync(handler: (data: T) => void, opts?: AsyncEventOpts): () => void;
    public onceAsync(boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts): () => void;
    public onceAsync(event: Postable<T>, opts?: AsyncEventOpts): () => void;
    public onceAsync(...args: any[]): () => void {
        args.unshift(EventType.Async);
        return this.once.apply(this, args);
    }

    public attachQueued(handler: (data: T) => void, opts?: QueuedEventOpts): () => void;
    public attachQueued(boundTo: Object, handler: (data: T) => void, opts?: QueuedEventOpts): () => void;
    public attachQueued(event: Postable<T>, opts?: QueuedEventOpts): () => void;
    public attachQueued(...args: any[]): () => void {
        args.unshift(EventType.Queued);
        return this.attach.apply(this, args);
    }

    public onceQueued(handler: (data: T) => void, opts?: QueuedEventOpts): () => void;
    public onceQueued(boundTo: Object, handler: (data: T) => void, opts?: QueuedEventOpts): () => void;
    public onceQueued(event: Postable<T>, opts?: QueuedEventOpts): () => void;
    public onceQueued(...args: any[]): () => void {
        args.unshift(EventType.Queued);
        return this.once.apply(this, args);
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
        }
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
            throw new Error(`error event posted while no listeners attached. Error: ${data.message}`);
        }
        super.post(data);
    }
}
