/// <reference path="../../typings/tsd.d.ts" />
import { Postable } from './base-event';
import { AsyncEventOpts } from './async-event';
import { QueuedEventOpts } from './queued-event';
export declare enum EventType {
    Sync = 0,
    Async = 1,
    Queued = 2,
}
/**
 * An event that behaves like a Sync/Async/Queued event depending on how
 * you subscribe.
 */
export declare class AnyEvent<T> implements Postable<T> {
    private _events;
    attachSync(handler: (data: T) => void): void;
    attachSync(boundTo: Object, handler: (data: T) => void): void;
    attachSync(event: Postable<T>): void;
    attachAsync(handler: (data: T) => void, opts?: AsyncEventOpts): void;
    attachAsync(boundTo: Object, handler: (data: T) => void, opts?: AsyncEventOpts): void;
    attachAsync(event: Postable<T>, opts?: AsyncEventOpts): void;
    attachQueued(handler: (data: T) => void, opts?: QueuedEventOpts): void;
    attachQueued(boundTo: Object, handler: (data: T) => void, opts?: QueuedEventOpts): void;
    attachQueued(event: Postable<T>, opts?: QueuedEventOpts): void;
    detach(handler: (data: T) => void): void;
    detach(boundTo: Object, handler: (data: T) => void): void;
    detach(boundTo: Object): void;
    detach(event: Postable<T>): void;
    detach(): void;
    /**
     * Post an event to all current listeners
     */
    post(data: T): void;
    /**
     * The number of attached listeners
     */
    listenerCount(): number;
}
/**
 * Convenience class for AnyEvents without data
 */
export declare class VoidAnyEvent extends AnyEvent<void> {
    /**
     * Send the AsyncEvent.
     */
    post(): void;
}
/**
 * Similar to "error" event on EventEmitter: throws when a post() occurs while no handlers set.
 */
export declare class ErrorAnyEvent extends AnyEvent<Error> {
    post(data: Error): void;
}
