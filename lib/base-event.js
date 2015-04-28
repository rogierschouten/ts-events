// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/index.d.ts"/>
"use strict";
var assert = require("assert");
/**
 * Base class for events.
 * Handles attaching and detaching listeners
 */
var BaseEvent = (function () {
    function BaseEvent() {
    }
    /**
     * Attach an event handler
     * @param boundTo (Optional) The this argument of the handler
     * @param handler The function to call.
     */
    BaseEvent.prototype.attach = function (a1, a2) {
        var boundTo;
        var handler;
        var event;
        if (typeof a1 === "function") {
            handler = a1;
        }
        else if (a1 instanceof BaseEvent) {
            event = a1;
        }
        else {
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
            handler: handler,
            event: event
        });
    };
    /**
     * Detach implementation. See the overloads for description.
     */
    BaseEvent.prototype.detach = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        if (!this._listeners) {
            return;
        }
        var boundTo;
        var handler;
        var event;
        if (args.length >= 1) {
            if (typeof (args[0]) === "function") {
                handler = args[0];
            }
            else if (args[0] instanceof BaseEvent) {
                event = args[0];
            }
            else {
                boundTo = args[0];
            }
        }
        if (args.length >= 2) {
            handler = args[1];
        }
        // remove listeners AND mark them as deleted so subclasses don't send any more events to them
        this._listeners = this._listeners.filter(function (listener) {
            if ((typeof handler === "undefined" || listener.handler === handler)
                && (typeof event === "undefined" || listener.event === event)
                && (typeof boundTo === "undefined" || listener.boundTo === boundTo)) {
                listener.deleted = true;
                return false;
            }
            return true;
        });
        if (this._listeners.length === 0) {
            delete this._listeners;
        }
    };
    /**
     * Abstract post() method to be able to connect any type of event to any other directly
     * @abstract
     */
    BaseEvent.prototype.post = function (data) {
        throw new Error("abstract");
    };
    /**
     * The number of attached listeners
     */
    BaseEvent.prototype.listenerCount = function () {
        return (this._listeners ? this._listeners.length : 0);
    };
    /**
     * @returns a shallow copy of the currently attached listeners
     */
    BaseEvent.prototype._copyListeners = function () {
        if (!this._listeners) {
            return [];
        }
        else {
            return this._listeners.map(function (listener) {
                return listener;
            });
        }
    };
    /**
     * Call the given listener, if it is not marked as 'deleted'
     * @param listener The listener to call
     * @param args The arguments to the handler
     */
    BaseEvent.prototype._call = function (listener, args) {
        if (!listener.deleted) {
            if (listener.event) {
                listener.event.post.apply(listener.event, args);
            }
            else {
                listener.handler.apply((typeof listener.boundTo === "object" ? listener.boundTo : this), args);
            }
        }
    };
    return BaseEvent;
})();
exports.BaseEvent = BaseEvent;
//# sourceMappingURL=base-event.js.map