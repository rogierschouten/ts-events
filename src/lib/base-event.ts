// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

'use strict';

export interface Postable<T> {
    post(data: T): void;
}

/**
 * Internal interface between BaseEvent and its subclasses
 */
export interface Listener<T> {
    /**
     * Indicates that the listener was detached
     */
    deleted: boolean;
    /**
     * The handler
     */
    handler?: (data: T) => void;
    /**
     * The this pointer for the handler
     */
    boundTo?: Object;
    /**
     * Instead of a handler, an attached event
     */
    event?: Postable<T>;
    /**
     * Remove after first call?
     */
    once: boolean;
}

/**
 * Base class for events.
 * Handles attaching and detaching listeners
 */
export class BaseEvent<T> implements Postable<T> {

    /**
     * Attached listeners. NOTE: do not modify.
     * Instead, replace with a new array with possibly the same elements. This ensures
     * that any references to the array by events that are underway remain the same.
     */
    protected _listeners: Listener<T>[];

    /**
     * Attach an event handler
     * @param handler The function to call. The this argument of the function will be this object.
     */
    public attach(handler: (data: T) => void): void;
    /**
     * Attach an event handler
     * @param boundTo The this argument of the handler
     * @param handler The function to call.
     */
    public attach(boundTo: Object, handler: (data: T) => void): void;
    /**
     * Attach an event directly
     * @param event The event to be posted
     */
    public attach(event: Postable<T>): void;
    /**
     * Attach implementation
     */
    public attach(a: ((data: T) => void) | Object | Postable<T>, b?: (data: T) => void): void {
        this._attach(a, b, false);
    }

    /**
     * Attach an event handler which automatically gets removed after the first call
     * @param handler The function to call. The this argument of the function will be this object.
     */
    public once(handler: (data: T) => void): void;
    /**
     * Attach an event handler which automatically gets removed after the first call
     * @param boundTo The this argument of the handler
     * @param handler The function to call.
     */
    public once(boundTo: Object, handler: (data: T) => void): void;
    /**
     * Attach an event directly and de-attach after the first call
     * @param event The event to be posted
     */
    public once(event: Postable<T>): void;
    /**
     * Attach implementation
     */
    public once(a: ((data: T) => void) | Object | Postable<T>, b?: (data: T) => void): void {
        this._attach(a, b, true);
    }

    /**
     * Attach / once implementation
     * @param a
     * @param b
     * @param once
     */
    private _attach(a: ((data: T) => void) | Object | Postable<T>, b: ((data: T) => void) | undefined, once: boolean): void {
        let boundTo: Object;
        let handler: (data: T) => void;
        let event: Postable<T>;
        if (typeof a === 'function') {
            handler = a;
        } else if (!b && typeof (a as Postable<T>).post === 'function') {
            event = a as Postable<T>;
        } else {
            if (typeof a !== 'object') {
                throw new Error('Expect a function or object as first argument');
            };
            if (typeof b !== 'function') {
                throw new Error('Expect a function as second argument');
            }
            boundTo = a;
            handler = b;
        }
        if (!this._listeners) {
            this._listeners = [];
        } else {
            // make a copy of the array so events that are underway have a stable local copy
            // of the listeners array at the time of post()
            this._listeners = this._listeners.slice();
        }
        this._listeners.push({
            deleted: false,
            boundTo,
            handler,
            event,
            once
        });
    }

    /**
     * Detach all listeners with the given handler function
     */
    public detach(handler: (data: T) => void): void;
    /**
     * Detach all listeners with the given handler function and boundTo object.
     */
    public detach(boundTo: Object, handler: (data: T) => void): void;
    /**
     * Detach all listeners that were attached with the given boundTo object.
     */
    public detach(boundTo: Object): void;
    /**
     * Detach the given event.
     */
    public detach(event: Postable<T>): void;
    /**
     * Detach all listeners
     */
    public detach(): void;
    /**
     * Detach implementation. See the overloads for description.
     */
    public detach(...args: any[]): void {
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        let boundTo: Object;
        let handler: (data: T) => void;
        let event: Postable<T>;
        if (args.length >= 1) {
            if (typeof (args[0]) === 'function') {
                handler = args[0];
            } else if (args.length === 1 && typeof args[0].post === 'function') {
                event = args[0];
            } else {
                boundTo = args[0];
            }
        }
        if (args.length >= 2) {
            handler = args[1];
        }

        // remove listeners AND mark them as deleted so subclasses don't send any more events to them
        this._listeners = this._listeners.filter((listener: Listener<T>): boolean => {
            if ((typeof handler === 'undefined' || listener.handler === handler)
                && (typeof event === 'undefined' || listener.event === event)
                && (typeof boundTo === 'undefined' || listener.boundTo === boundTo)) {
                listener.deleted = true;
                return false;
            }
            return true;
        });

        if (this._listeners.length === 0) {
            delete this._listeners;
        }
    }

    /**
     * Abstract post() method to be able to connect any type of event to any other directly
     * @abstract
     */
    public post(data: T): void {
        throw new Error('abstract');
    }

    /**
     * The number of attached listeners
     */
    public listenerCount(): number {
        return (this._listeners ? this._listeners.length : 0);
    }

    /**
     * Call the given listener, if it is not marked as 'deleted'
     * @param listener The listener to call
     * @param args The arguments to the handler
     */
    protected _call(listener: Listener<T>, args: any[]): void {
        if (!listener.deleted) {
            if (listener.once) {
                // remove listeners AND mark as deleted so subclasses don't send any more events to them
                listener.deleted = true;
                this._listeners = this._listeners.filter((l: Listener<T>): boolean => l !== listener);
                if (this._listeners.length === 0) {
                    delete this._listeners;
                }
            }
            if (listener.event) {
                listener.event.post.apply(listener.event, args);
            } else {
                listener.handler.apply((typeof listener.boundTo === 'object' ? listener.boundTo : this), args);
            }
        }
    }

}
