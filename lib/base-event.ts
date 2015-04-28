// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../typings/index.d.ts"/>

"use strict";

import assert = require("assert");

export interface Listener<T> {
    deleted: boolean;
    handler: (data: T) => void;
    boundTo: Object;
}

export class BaseEvent<T> {

    private _listeners: Listener<T>[];

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
     * Attach an event handler
     * @param boundTo (Optional) The this argument of the handler
     * @param handler The function to call.
     */
    public attach(a1: any, a2?: any): void {
        var boundTo: Object;
        var handler: (data: T) => void;
        if (typeof a1 === "function") {
            handler = a1;
        } else {
            assert(typeof a1 === "object", "Expect a function or object as first argument");
            assert(typeof a2 === "function", "Expect a function as second argument");
            boundTo = a1;
            handler = a2;
        }
        if (!this._listeners) {
            this._listeners = [];
        }
        this._listeners.push({
            deleted: false,
            boundTo: boundTo,
            handler: handler
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
     * Detach all listeners
     */
    public detach(): void;
    /**
     * Detach implementation. See the overloads for description.
     */
    public detach(...args: any[]): void {
        if (!this._listeners) {
            return;
        }
        var boundTo: Object;
        var handler: (data: T) => void;
        if (args.length >= 1) {
            if (typeof (args[0]) === "function") {
                handler = args[0];
            } else {
                boundTo = args[0];
            }
        }
        if (args.length >= 2) {
            handler = args[1];
        }

        // remove listeners AND mark them as deleted so subclasses don't send any more events to them
        this._listeners = this._listeners.filter((listener: Listener<T>): boolean => {
            if ((typeof handler === "undefined" || listener.handler === handler)
                && (typeof boundTo === "undefined" || listener.boundTo === boundTo)) {
                listener.deleted = true;
                return false;
            }
            return true;
        });

        if (this._listeners.length === 0) {
            delete this._listeners;
        }
    }

    public listenerCount(): number {
        return (this._listeners ? this._listeners.length : 0);
    }

    protected _copyListeners(): Listener<T>[] {
        if (!this._listeners) {
            return [];
        } else {
            return this._listeners.map((listener: Listener<T>): Listener<T> => {
                return listener;
            });
        }
    }


}
