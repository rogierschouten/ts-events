// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC

'use strict';

import {BaseEvent, Postable} from './base-event';

/**
 * This is a true EventEmitter replacement: the handlers are called synchronously when
 * you post the event.
 * - Allows better error handling by aggregating any errors thrown by handlers.
 * - Prevents livelock by throwing an error when recursion depth is above a maximum.
 * - Handlers are called only for events posted after they were attached.
 * - Handlers are not called anymore when they are detached, even if a post() is in progress
 */
export class SyncEvent<T> extends BaseEvent<T> implements Postable<T> {
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
     * Maximum number of times that an event handler may cause the same event
     * recursively.
     */
    public static MAX_RECURSION_DEPTH?: number | null = 10;

    /**
     * Recursive post() invocations
     */
    private _recursion: number = 0;

    /**
     * Send the event. Handlers are called immediately and synchronously.
     * If an error is thrown by a handler, the remaining handlers are still called.
     * Afterward, an AggregateError is thrown with the original error(s) in its 'causes' property.
     */
    public post(data: T): void;
    public post(...args: any[]): void {
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        this._recursion++;
        if (
            typeof SyncEvent.MAX_RECURSION_DEPTH === 'number'
            && Number.isInteger(SyncEvent.MAX_RECURSION_DEPTH)
            && SyncEvent.MAX_RECURSION_DEPTH > 0
            && this._recursion > SyncEvent.MAX_RECURSION_DEPTH
        ) {
            throw new Error('event fired recursively');
        }
        // copy a reference to the array because this._listeners might be replaced during
        // the handler calls
        const listeners = this._listeners;
        for (let i = 0; i < listeners.length; ++i) {
            const listener = listeners[i];
            this._call(listener, args);
        }
        this._recursion--;
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
export class VoidSyncEvent extends SyncEvent<void> {

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
export class ErrorSyncEvent extends SyncEvent<Error> {

    public post(data: Error): void {
        if (this.listenerCount() === 0) {
            throw new Error(`error event posted while no listeners attached. Error: ${data.message}`);
        }
        super.post(data);
    }
}
