// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
/// <reference path="../../typings/tsd.d.ts"/>
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var util = require("util");
var objects_1 = require('./objects');
var sync_event_1 = require('./sync-event');
var async_event_1 = require('./async-event');
var queued_event_1 = require('./queued-event');
(function (EventType) {
    EventType[EventType["Sync"] = 0] = "Sync";
    EventType[EventType["Async"] = 1] = "Async";
    EventType[EventType["Queued"] = 2] = "Queued";
})(exports.EventType || (exports.EventType = {}));
var EventType = exports.EventType;
;
/**
 * An event that behaves like a Sync/Async/Queued event depending on how
 * you subscribe.
 */
var AnyEvent = (function () {
    function AnyEvent() {
        this._events = [];
    }
    /**
     * Attach event handlers as if it were a sync event. It is simply called "attach"
     * so that this class adheres to the BaseEvent<T> signature.
     */
    AnyEvent.prototype.attachSync = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        // add ourselves as default 'boundTo' argument
        if (args.length > 0 && typeof args[0] === "function") {
            args.unshift(this);
        }
        var event;
        for (var i = 0; i < this._events.length; ++i) {
            if (this._events[i] instanceof sync_event_1.SyncEvent) {
                event = this._events[i];
            }
        }
        if (!event) {
            event = new sync_event_1.SyncEvent();
            this._events.push(event);
        }
        event.attach.apply(event, args);
    };
    /**
     * Attach event handlers as if it were a a-sync event
     */
    AnyEvent.prototype.attachAsync = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var opts;
        if (args.length > 1 && typeof args[args.length - 1] === "object") {
            opts = args[args.length - 1];
        }
        // add ourselves as default 'boundTo' argument
        if (args.length > 0 && typeof args[0] === "function") {
            args.unshift(this);
        }
        var event;
        for (var i = 0; i < this._events.length; ++i) {
            if (this._events[i] instanceof async_event_1.AsyncEvent
                && objects_1.shallowEquals(this._events[i].options, opts)) {
                event = this._events[i];
            }
        }
        if (!event) {
            event = new async_event_1.AsyncEvent(opts);
            this._events.push(event);
        }
        event.attach.apply(event, args);
    };
    /**
     * Attach event handlers as if it were a queued event
     */
    AnyEvent.prototype.attachQueued = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var opts;
        if (args.length > 1 && typeof args[args.length - 1] === "object") {
            opts = args[args.length - 1];
        }
        // add ourselves as default 'boundTo' argument
        if (args.length > 0 && typeof args[0] === "function") {
            args.unshift(this);
        }
        var event;
        for (var i = 0; i < this._events.length; ++i) {
            if (this._events[i] instanceof queued_event_1.QueuedEvent
                && objects_1.shallowEquals(this._events[i].options, opts)) {
                event = this._events[i];
            }
        }
        if (!event) {
            event = new queued_event_1.QueuedEvent(opts);
            this._events.push(event);
        }
        event.attach.apply(event, args);
    };
    /**
     * Detach event handlers regardless of type
     */
    AnyEvent.prototype.detach = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        for (var i = 0; i < this._events.length; ++i) {
            this._events[i].detach.apply(this._events[i], args);
        }
    };
    /**
     * Post an event to all current listeners
     */
    AnyEvent.prototype.post = function (data) {
        var i;
        // make a copy of the array first to cover the case where event handlers
        // are attached during the post
        var events = [];
        for (i = 0; i < this._events.length; ++i) {
            events.push(this._events[i]);
        }
        ;
        for (i = 0; i < events.length; ++i) {
            events[i].post(data);
        }
    };
    /**
     * The number of attached listeners
     */
    AnyEvent.prototype.listenerCount = function () {
        var result = 0;
        for (var i = 0; i < this._events.length; ++i) {
            result += this._events[i].listenerCount();
        }
        return result;
    };
    return AnyEvent;
})();
exports.AnyEvent = AnyEvent;
/**
 * Convenience class for AnyEvents without data
 */
var VoidAnyEvent = (function (_super) {
    __extends(VoidAnyEvent, _super);
    function VoidAnyEvent() {
        _super.apply(this, arguments);
    }
    /**
     * Send the AsyncEvent.
     */
    VoidAnyEvent.prototype.post = function () {
        _super.prototype.post.call(this, undefined);
    };
    return VoidAnyEvent;
})(AnyEvent);
exports.VoidAnyEvent = VoidAnyEvent;
/**
 * Similar to "error" event on EventEmitter: throws when a post() occurs while no handlers set.
 */
var ErrorAnyEvent = (function (_super) {
    __extends(ErrorAnyEvent, _super);
    function ErrorAnyEvent() {
        _super.apply(this, arguments);
    }
    ErrorAnyEvent.prototype.post = function (data) {
        if (this.listenerCount() === 0) {
            throw new Error(util.format("error event posted while no listeners attached. Error: ", data));
        }
        _super.prototype.post.call(this, data);
    };
    return ErrorAnyEvent;
})(AnyEvent);
exports.ErrorAnyEvent = ErrorAnyEvent;
//# sourceMappingURL=any-event.js.map