(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    } else if (typeof define === "function" && define.amd) {
        define([], f)
    } else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        } else if (typeof global !== "undefined") {
            g = global
        } else if (typeof self !== "undefined") {
            g = self
        } else {
            g = this
        }
        g.listComponent = f()
    }
})(function() {
        var define, module, exports;
require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
var sync_event_1 = require('./sync-event');
/**
 * Simple synchronous event queue that needs to be drained manually.
 */
var EventQueue = (function () {
    function EventQueue() {
        /**
         * SyncEvent triggered after an event is added outside of a flush operation.
         * @param queue The event queue itself
         */
        this.evtFilled = new sync_event_1.SyncEvent();
        /**
         * SyncEvent triggered after the queue is flushed empty
         * @param queue The event queue itself
         */
        this.evtDrained = new sync_event_1.SyncEvent();
        /**
         * Queued elements
         */
        this._queue = [];
        /**
         * True while flush() or flushOnce() is running
         */
        this._flushing = false;
    }
    /**
     * The module-global event queue
     */
    EventQueue.global = function () {
        if (!EventQueue._instance) {
            EventQueue.resetGlobal();
        }
        return EventQueue._instance;
    };
    /**
     * Testing purposes
     */
    EventQueue.resetGlobal = function () {
        EventQueue._instance = new EventQueue();
    };
    /**
     * Returns true iff the queue is empty
     */
    EventQueue.prototype.empty = function () {
        return this._queue.length === 0;
    };
    /**
     * Add an element to the queue. The handler is called when one of the flush
     * methods is called.
     */
    EventQueue.prototype.add = function (handler) {
        this._queue.push(handler);
        if (this._queue.length === 1 && !this._flushing) {
            this.evtFilled.post(this);
        }
    };
    /**
     * Calls all handlers currently in the queue. Does not call any handlers added
     * as a result of the flush
     */
    EventQueue.prototype.flushOnce = function () {
        var empty = (this._queue.length === 0);
        var flushing = this._flushing;
        this._flushing = true;
        try {
            var queue = this._queue;
            this._queue = [];
            for (var i = 0; i < queue.length; ++i) {
                queue[i]();
            }
        }
        finally {
            this._flushing = flushing;
            if (!empty && !flushing && this._queue.length === 0) {
                this.evtDrained.post(this);
            }
        }
    };
    /**
     * Flushes the QueuedEvents, calling all events currently in the queue and those
     * put into the queue as a result of the flush.
     * @param maxRounds Optional, default 10. Number of iterations after which to throw an error because
     *                  the queue keeps filling up. Set to null to disable this.
     */
    EventQueue.prototype.flush = function (maxRounds) {
        if (maxRounds === void 0) { maxRounds = 10; }
        var empty = (this._queue.length === 0);
        var flushing = this._flushing;
        this._flushing = true;
        try {
            var i = 0;
            while (this._queue.length > 0) {
                if (typeof maxRounds === 'number' && i >= maxRounds) {
                    this._queue = [];
                    throw new Error('unable to flush the queue due to recursively added event. Clearing queue now');
                }
                this.flushOnce();
                ++i;
            }
        }
        finally {
            this._flushing = flushing;
            if (!empty && !flushing && this._queue.length === 0) {
                this.evtDrained.post(this);
            }
        }
    };
    return EventQueue;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EventQueue;
},{"./sync-event":7}],2:[function(require,module,exports){
// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
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
    function AnyEvent(opts) {
        /**
         * Underlying event implementations; one for every attach type + opts combination
         */
        this._events = [];
        if (opts && opts.monitorAttach) {
            this.evtFirstAttached = new VoidAnyEvent();
            this.evtLastDetached = new VoidAnyEvent();
        }
    }
    /**
     * same as attachSync/attachAsync/attachQueued; based on the given enum
     * @param mode determines whether to attach sync/async/queued
     */
    AnyEvent.prototype.attach = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var prevCount = (!!this.evtFirstAttached ? this.listenerCount() : 0);
        var mode = EventType.Sync;
        if (args.length > 0 && typeof args[0] === 'number') {
            mode = args.shift();
        }
        switch (mode) {
            case EventType.Sync:
                {
                    // add ourselves as default 'boundTo' argument
                    if (args.length > 0 && typeof args[0] === 'function') {
                        args.unshift(this);
                    }
                    var event_1;
                    for (var i = 0; i < this._events.length; ++i) {
                        if (this._events[i] instanceof sync_event_1.SyncEvent) {
                            event_1 = this._events[i];
                        }
                    }
                    if (!event_1) {
                        event_1 = new sync_event_1.SyncEvent();
                        this._events.push(event_1);
                    }
                    event_1.attach.apply(event_1, args);
                }
                break;
            case EventType.Async:
                {
                    var opts = void 0;
                    if (args.length > 1 && typeof args[args.length - 1] === 'object') {
                        opts = args[args.length - 1];
                    }
                    // add ourselves as default 'boundTo' argument
                    if (args.length > 0 && typeof args[0] === 'function') {
                        args.unshift(this);
                    }
                    var event_2;
                    for (var i = 0; i < this._events.length; ++i) {
                        if (this._events[i] instanceof async_event_1.AsyncEvent
                            && objects_1.shallowEquals(this._events[i].options, opts)) {
                            event_2 = this._events[i];
                        }
                    }
                    if (!event_2) {
                        event_2 = new async_event_1.AsyncEvent(opts);
                        this._events.push(event_2);
                    }
                    event_2.attach.apply(event_2, args);
                }
                break;
            case EventType.Queued:
                {
                    var opts = void 0;
                    if (args.length > 1 && typeof args[args.length - 1] === 'object') {
                        opts = args[args.length - 1];
                    }
                    // add ourselves as default 'boundTo' argument
                    if (args.length > 0 && typeof args[0] === 'function') {
                        args.unshift(this);
                    }
                    var event_3;
                    for (var i = 0; i < this._events.length; ++i) {
                        if (this._events[i] instanceof queued_event_1.QueuedEvent
                            && objects_1.shallowEquals(this._events[i].options, opts)) {
                            event_3 = this._events[i];
                        }
                    }
                    if (!event_3) {
                        event_3 = new queued_event_1.QueuedEvent(opts);
                        this._events.push(event_3);
                    }
                    event_3.attach.apply(event_3, args);
                }
                break;
            default:
                throw new Error('unknown EventType');
        }
        if (this.evtFirstAttached && prevCount === 0) {
            this.evtFirstAttached.post();
        }
    };
    /**
     * Attach event handlers as if it were a sync event. It is simply called 'attach'
     * so that this class adheres to the BaseEvent<T> signature.
     */
    AnyEvent.prototype.attachSync = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        args.unshift(EventType.Sync);
        this.attach.apply(this, args);
    };
    /**
     * Attach event handlers as if it were a a-sync event
     */
    AnyEvent.prototype.attachAsync = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        args.unshift(EventType.Async);
        this.attach.apply(this, args);
    };
    /**
     * Attach event handlers as if it were a queued event
     */
    AnyEvent.prototype.attachQueued = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        args.unshift(EventType.Queued);
        this.attach.apply(this, args);
    };
    /**
     * Detach event handlers regardless of type
     */
    AnyEvent.prototype.detach = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var prevCount = (!!this.evtLastDetached ? this.listenerCount() : 0);
        for (var i = 0; i < this._events.length; ++i) {
            this._events[i].detach.apply(this._events[i], args);
        }
        if (!!this.evtLastDetached && prevCount > 0 && this.listenerCount() === 0) {
            this.evtLastDetached.post();
        }
    };
    /**
     * Post an event to all current listeners
     */
    AnyEvent.prototype.post = function (data) {
        // make a copy of the array first to cover the case where event handlers
        // are attached during the post
        var events = [];
        for (var i = 0; i < this._events.length; ++i) {
            events.push(this._events[i]);
        }
        ;
        for (var i = 0; i < events.length; ++i) {
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
}());
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
}(AnyEvent));
exports.VoidAnyEvent = VoidAnyEvent;
/**
 * Similar to 'error' event on EventEmitter: throws when a post() occurs while no handlers set.
 */
var ErrorAnyEvent = (function (_super) {
    __extends(ErrorAnyEvent, _super);
    function ErrorAnyEvent() {
        _super.apply(this, arguments);
    }
    ErrorAnyEvent.prototype.post = function (data) {
        if (this.listenerCount() === 0) {
            throw new Error("error event posted while no listeners attached. Error: " + data.message);
        }
        _super.prototype.post.call(this, data);
    };
    return ErrorAnyEvent;
}(AnyEvent));
exports.ErrorAnyEvent = ErrorAnyEvent;
},{"./async-event":3,"./objects":5,"./queued-event":6,"./sync-event":7}],3:[function(require,module,exports){
// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var base_event_1 = require('./base-event');
/**
 * A-synchronous event. Handlers are called in the next Node.JS cycle.
 * - Optionally condenses multiple post() calls into one (the last post() gets through)
 * - Handlers are called only for events posted after they were attached.
 * - Handlers are not called anymore when they are detached, even if a post() is in progress
 */
var AsyncEvent = (function (_super) {
    __extends(AsyncEvent, _super);
    /**
     * Constructor
     * @param opts Optional. Various settings:
     *             - condensed: a Boolean indicating whether to condense multiple post() calls within the same cycle.
     */
    function AsyncEvent(opts) {
        _super.call(this);
        this._queued = false;
        this.options = opts;
        var options = opts || {};
        if (typeof options.condensed === 'boolean') {
            this._condensed = options.condensed;
        }
        else {
            this._condensed = false;
        }
    }
    /**
     * The default scheduler uses setImmediate() or setTimeout(..., 0) if setImmediate is not available.
     */
    AsyncEvent.defaultScheduler = function (callback) {
        /* istanbul ignore else  */
        if (typeof window !== 'undefined') {
            // browsers don't always support setImmediate()
            setTimeout(callback, 0);
        }
        else {
            // node.js
            setImmediate(callback);
        }
    };
    /**
     * By default, AsyncEvent uses setImmediate() to schedule event handler invocation.
     * You can change this for e.g. setTimeout(..., 0) by calling this static method once.
     * @param scheduler A function that takes a callback and executes it in the next Node.JS cycle.
     */
    AsyncEvent.setScheduler = function (scheduler) {
        AsyncEvent._scheduler = scheduler;
    };
    AsyncEvent.prototype.post = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        if (this._condensed) {
            this._queuedData = args;
            this._queuedListeners = this._listeners;
            if (this._queued) {
                return;
            }
            else {
                this._queued = true;
                AsyncEvent._scheduler(function () {
                    // immediately mark non-queued to allow new AsyncEvent to happen as result
                    // of calling handlers
                    _this._queued = false;
                    // cache listeners and data because they might change while calling event handlers
                    var data = _this._queuedData;
                    var listeners = _this._queuedListeners;
                    for (var i = 0; i < listeners.length; ++i) {
                        var listener = listeners[i];
                        _this._call(listener, data);
                    }
                });
            }
        }
        else {
            var listeners = this._listeners;
            AsyncEvent._scheduler(function () {
                for (var i = 0; i < listeners.length; ++i) {
                    var listener = listeners[i];
                    _this._call(listener, args);
                }
            });
        }
    };
    // inherited
    AsyncEvent.prototype._call = function (listener, args) {
        // performance optimization: don't use consecutive nodejs cycles
        // for asyncevents attached to asyncevents
        if (listener.event && listener.event instanceof AsyncEvent) {
            listener.event._postDirect(args);
        }
        else {
            _super.prototype._call.call(this, listener, args);
        }
    };
    /**
     * Performance optimization: if this async signal is attached to another
     * async signal, we're already a the next cycle and we can call listeners
     * directly
     */
    AsyncEvent.prototype._postDirect = function (args) {
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        // copy a reference to the array because this._listeners might be replaced during
        // the handler calls
        var listeners = this._listeners;
        for (var i = 0; i < listeners.length; ++i) {
            var listener = listeners[i];
            this._call(listener, args);
        }
    };
    /**
     * The current scheduler
     */
    AsyncEvent._scheduler = AsyncEvent.defaultScheduler;
    return AsyncEvent;
}(base_event_1.BaseEvent));
exports.AsyncEvent = AsyncEvent;
/**
 * Convenience class for AsyncEvents without data
 */
var VoidAsyncEvent = (function (_super) {
    __extends(VoidAsyncEvent, _super);
    function VoidAsyncEvent() {
        _super.apply(this, arguments);
    }
    /**
     * Send the AsyncEvent.
     */
    VoidAsyncEvent.prototype.post = function () {
        _super.prototype.post.call(this, undefined);
    };
    return VoidAsyncEvent;
}(AsyncEvent));
exports.VoidAsyncEvent = VoidAsyncEvent;
/**
 * Similar to 'error' event on EventEmitter: throws when a post() occurs while no handlers set.
 */
var ErrorAsyncEvent = (function (_super) {
    __extends(ErrorAsyncEvent, _super);
    function ErrorAsyncEvent() {
        _super.apply(this, arguments);
    }
    ErrorAsyncEvent.prototype.post = function (data) {
        if (this.listenerCount() === 0) {
            throw new Error("error event posted while no listeners attached. Error: " + data.message);
        }
        _super.prototype.post.call(this, data);
    };
    return ErrorAsyncEvent;
}(AsyncEvent));
exports.ErrorAsyncEvent = ErrorAsyncEvent;
},{"./base-event":4}],4:[function(require,module,exports){
// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
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
    BaseEvent.prototype.attach = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var boundTo;
        var handler;
        var event;
        if (typeof args[0] === 'function') {
            handler = args[0];
        }
        else if (args.length === 1 && typeof args[0].post === 'function') {
            event = args[0];
        }
        else {
            if (typeof args[0] !== 'object') {
                throw new Error('Expect a function or object as first argument');
            }
            ;
            if (typeof args[1] !== 'function') {
                throw new Error('Expect a function as second argument');
            }
            boundTo = args[0];
            handler = args[1];
        }
        if (!this._listeners) {
            this._listeners = [];
        }
        else {
            // make a copy of the array so events that are underway have a stable local copy
            // of the listeners array at the time of post()
            this._listeners = this._listeners.map(function (listener) {
                return listener;
            });
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
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        var boundTo;
        var handler;
        var event;
        if (args.length >= 1) {
            if (typeof (args[0]) === 'function') {
                handler = args[0];
            }
            else if (args.length === 1 && typeof args[0].post === 'function') {
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
    };
    /**
     * Abstract post() method to be able to connect any type of event to any other directly
     * @abstract
     */
    BaseEvent.prototype.post = function (data) {
        throw new Error('abstract');
    };
    /**
     * The number of attached listeners
     */
    BaseEvent.prototype.listenerCount = function () {
        return (this._listeners ? this._listeners.length : 0);
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
                listener.handler.apply((typeof listener.boundTo === 'object' ? listener.boundTo : this), args);
            }
        }
    };
    return BaseEvent;
}());
exports.BaseEvent = BaseEvent;
},{}],5:[function(require,module,exports){
// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
function shallowEquals(a, b) {
    if (a === b) {
        return true;
    }
    if (typeof a !== typeof b) {
        return false;
    }
    switch (typeof a) {
        case 'boolean':
        case 'number':
        case 'string':
        case 'function':
        case 'symbol':
        case 'undefined':
            // already did === compare
            return false;
        case 'object':
            if (a === null || b === null) {
                return false; // already compared ===
            }
            if (Array.isArray(a) || Array.isArray(b)) {
                if (!Array.isArray(a) || !Array.isArray(b)) {
                    return false;
                }
                if (a.length !== b.length) {
                    return false;
                }
                for (var i = 0; i < a.length; ++i) {
                    if (a[i] !== b[i]) {
                        return false;
                    }
                }
                return true;
            }
            var name;
            var namesA = [];
            var namesB = [];
            for (name in a) {
                if (a.hasOwnProperty(name)) {
                    namesA.push(name);
                }
            }
            for (name in b) {
                if (b.hasOwnProperty(name)) {
                    namesB.push(name);
                }
            }
            namesA.sort();
            namesB.sort();
            if (namesA.join(',') !== namesB.join(',')) {
                return false;
            }
            for (i = 0; i < namesA.length; ++i) {
                if (a[namesA[i]] !== b[namesA[i]]) {
                    return false;
                }
            }
            return true;
        default:
            return false;
    }
}
exports.shallowEquals = shallowEquals;
},{}],6:[function(require,module,exports){
// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var base_event_1 = require('./base-event');
var EventQueue_1 = require('./EventQueue');
/**
 * Event that stays in a queue until you process the queue. Allows fine-grained
 * control over when events happen.
 * - Optionally condenses multiple post() calls into one.
 * - Handlers are called only for events posted after they were attached.
 * - Handlers are not called anymore when they are detached, even if a post() is in progress
 */
var QueuedEvent = (function (_super) {
    __extends(QueuedEvent, _super);
    /**
     * Constructor
     * @param opts Optional, an object with the following members:
     *             - condensed: a Boolean indicating whether to condense multiple calls to post() into one (default false)
     *             - queue: a specific event queue to use. The global EventQueue instance is used if not given.
     */
    function QueuedEvent(opts) {
        _super.call(this);
        this._queued = false;
        this.options = opts;
        var options = opts || {};
        if (typeof options.condensed === 'boolean') {
            this._condensed = options.condensed;
        }
        else {
            this._condensed = false;
        }
        if (typeof options.queue === 'object' && options.queue !== null) {
            this._queue = options.queue;
        }
    }
    QueuedEvent.prototype.post = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        var queue = (this._queue ? this._queue : EventQueue_1.default.global());
        if (this._condensed) {
            this._queuedData = args;
            this._queuedListeners = this._listeners;
            if (this._queued) {
                return;
            }
            else {
                this._queued = true;
                queue.add(function () {
                    // immediately mark non-queued to allow new AsyncEvent to happen as result
                    // of calling handlers
                    _this._queued = false;
                    // cache listeners and data because they might change while calling event handlers
                    var data = _this._queuedData;
                    var listeners = _this._queuedListeners;
                    for (var i = 0; i < listeners.length; ++i) {
                        var listener = listeners[i];
                        _this._call(listener, data);
                    }
                });
            }
        }
        else {
            var listeners = this._listeners;
            queue.add(function () {
                for (var i = 0; i < listeners.length; ++i) {
                    var listener = listeners[i];
                    _this._call(listener, args);
                }
            });
        }
    };
    return QueuedEvent;
}(base_event_1.BaseEvent));
exports.QueuedEvent = QueuedEvent;
/**
 * Convenience class for events without data
 */
var VoidQueuedEvent = (function (_super) {
    __extends(VoidQueuedEvent, _super);
    function VoidQueuedEvent() {
        _super.apply(this, arguments);
    }
    /**
     * Send the event.
     */
    VoidQueuedEvent.prototype.post = function () {
        _super.prototype.post.call(this, undefined);
    };
    return VoidQueuedEvent;
}(QueuedEvent));
exports.VoidQueuedEvent = VoidQueuedEvent;
/**
 * Similar to 'error' event on EventEmitter: throws when a post() occurs while no handlers set.
 */
var ErrorQueuedEvent = (function (_super) {
    __extends(ErrorQueuedEvent, _super);
    function ErrorQueuedEvent() {
        _super.apply(this, arguments);
    }
    ErrorQueuedEvent.prototype.post = function (data) {
        if (!this._listeners || this._listeners.length === 0) {
            throw new Error("error event posted while no listeners attached. Error: " + data.message);
        }
        _super.prototype.post.call(this, data);
    };
    return ErrorQueuedEvent;
}(QueuedEvent));
exports.ErrorQueuedEvent = ErrorQueuedEvent;
},{"./EventQueue":1,"./base-event":4}],7:[function(require,module,exports){
// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var base_event_1 = require('./base-event');
/**
 * This is a true EventEmitter replacement: the handlers are called synchronously when
 * you post the event.
 * - Allows better error handling by aggregating any errors thrown by handlers.
 * - Prevents livelock by throwing an error when recursion depth is above a maximum.
 * - Handlers are called only for events posted after they were attached.
 * - Handlers are not called anymore when they are detached, even if a post() is in progress
 */
var SyncEvent = (function (_super) {
    __extends(SyncEvent, _super);
    function SyncEvent() {
        _super.apply(this, arguments);
        /**
         * Recursive post() invocations
         */
        this._recursion = 0;
    }
    SyncEvent.prototype.post = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        this._recursion++;
        if (SyncEvent.MAX_RECURSION_DEPTH > 0 &&
            this._recursion > SyncEvent.MAX_RECURSION_DEPTH) {
            throw new Error('event fired recursively');
        }
        // copy a reference to the array because this._listeners might be replaced during
        // the handler calls
        var listeners = this._listeners;
        for (var i = 0; i < listeners.length; ++i) {
            var listener = listeners[i];
            this._call(listener, args);
        }
        this._recursion--;
    };
    /**
     * Maximum number of times that an event handler may cause the same event
     * recursively.
     */
    SyncEvent.MAX_RECURSION_DEPTH = 10;
    return SyncEvent;
}(base_event_1.BaseEvent));
exports.SyncEvent = SyncEvent;
/**
 * Convenience class for events without data
 */
var VoidSyncEvent = (function (_super) {
    __extends(VoidSyncEvent, _super);
    function VoidSyncEvent() {
        _super.apply(this, arguments);
    }
    /**
     * Send the event.
     */
    VoidSyncEvent.prototype.post = function () {
        _super.prototype.post.call(this, undefined);
    };
    return VoidSyncEvent;
}(SyncEvent));
exports.VoidSyncEvent = VoidSyncEvent;
/**
 * Similar to 'error' event on EventEmitter: throws when a post() occurs while no handlers set.
 */
var ErrorSyncEvent = (function (_super) {
    __extends(ErrorSyncEvent, _super);
    function ErrorSyncEvent() {
        _super.apply(this, arguments);
    }
    ErrorSyncEvent.prototype.post = function (data) {
        if (this.listenerCount() === 0) {
            throw new Error("error event posted while no listeners attached. Error: " + data.message);
        }
        _super.prototype.post.call(this, data);
    };
    return ErrorSyncEvent;
}(SyncEvent));
exports.ErrorSyncEvent = ErrorSyncEvent;
},{"./base-event":4}],"ts-events":[function(require,module,exports){
// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
__export(require('./base-event'));
__export(require('./sync-event'));
__export(require('./queued-event'));
__export(require('./async-event'));
__export(require('./any-event'));
var EventQueue_1 = require('./EventQueue');
var EventQueue_2 = require('./EventQueue');
exports.EventQueue = EventQueue_2.default;
/**
 * The global event queue for QueuedEvents
 */
function queue() {
    return EventQueue_1.default.global();
}
exports.queue = queue;
/**
 * Convenience function, same as EventQueue.global().flushOnce().
 * Flushes the QueuedEvents, calling all events currently in the queue but not
 * any events put into the queue as a result of the flush.
 */
function flushOnce() {
    EventQueue_1.default.global().flushOnce();
}
exports.flushOnce = flushOnce;
/**
 * Convenience function, same as EventQueue.global().flush().
 * Flushes the QueuedEvents, calling all handlers currently in the queue and those
 * put into the queue as a result of the flush.
 * @param maxRounds Optional, default 10. Number of iterations after which to throw an error because
 *                  the queue keeps filling up. Set to undefined or null to disable this.
 */
function flush(maxRounds) {
    if (maxRounds === void 0) { maxRounds = 10; }
    EventQueue_1.default.global().flush(maxRounds);
}
exports.flush = flush;
},{"./EventQueue":1,"./any-event":2,"./async-event":3,"./base-event":4,"./queued-event":6,"./sync-event":7}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmNcXGxpYlxcRXZlbnRRdWV1ZS50cyIsInNyY1xcbGliXFxhbnktZXZlbnQudHMiLCJzcmNcXGxpYlxcYXN5bmMtZXZlbnQudHMiLCJzcmNcXGxpYlxcYmFzZS1ldmVudC50cyIsInNyY1xcbGliXFxvYmplY3RzLnRzIiwic3JjXFxsaWJcXHF1ZXVlZC1ldmVudC50cyIsInNyY1xcbGliXFxzeW5jLWV2ZW50LnRzIiwic3JjXFxsaWJcXGluZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsK0RBQStEO0FBQy9ELGVBQWU7QUFFZixZQUFZLENBQUM7QUFFYiwyQkFBd0IsY0FBYyxDQUFDLENBQUE7QUFFdkM7O0dBRUc7QUFDSDtJQUFBO1FBRUk7OztXQUdHO1FBQ0ksY0FBUyxHQUEwQixJQUFJLHNCQUFTLEVBQWMsQ0FBQztRQUN0RTs7O1dBR0c7UUFDSSxlQUFVLEdBQTBCLElBQUksc0JBQVMsRUFBYyxDQUFDO1FBd0J2RTs7V0FFRztRQUNLLFdBQU0sR0FBbUIsRUFBRSxDQUFDO1FBRXBDOztXQUVHO1FBQ0ssY0FBUyxHQUFZLEtBQUssQ0FBQztJQXFFdkMsQ0FBQztJQTlGRzs7T0FFRztJQUNXLGlCQUFNLEdBQXBCO1FBQ0ksRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN4QixVQUFVLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDN0IsQ0FBQztRQUNELE1BQU0sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDO0lBQ2hDLENBQUM7SUFFRDs7T0FFRztJQUNXLHNCQUFXLEdBQXpCO1FBQ0ksVUFBVSxDQUFDLFNBQVMsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFZRDs7T0FFRztJQUNJLDBCQUFLLEdBQVo7UUFDSSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FB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QkFBYyxhQUFhLENBQUMsRUFBQTtBQUU1QiwyQkFBb0MsY0FBYyxDQUFDLENBQUE7QUFDbkQsMkJBQW9DLGNBQWMsQ0FBQztBQUEzQywwQ0FBMkM7QUFFbkQ7O0dBRUc7QUFDSDtJQUNJLE1BQU0sQ0FBQyxvQkFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQy9CLENBQUM7QUFGZSxhQUFLLFFBRXBCLENBQUE7QUFFRDs7OztHQUlHO0FBQ0g7SUFDSSxvQkFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ3BDLENBQUM7QUFGZSxpQkFBUyxZQUV4QixDQUFBO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsZUFBc0IsU0FBc0I7SUFBdEIseUJBQXNCLEdBQXRCLGNBQXNCO0lBQ3hDLG9CQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3pDLENBQUM7QUFGZSxhQUFLLFFBRXBCLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtTeW5jRXZlbnR9IGZyb20gJy4vc3luYy1ldmVudCc7XHJcblxyXG4vKipcclxuICogU2ltcGxlIHN5bmNocm9ub3VzIGV2ZW50IHF1ZXVlIHRoYXQgbmVlZHMgdG8gYmUgZHJhaW5lZCBtYW51YWxseS5cclxuICovXHJcbmNsYXNzIEV2ZW50UXVldWUge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU3luY0V2ZW50IHRyaWdnZXJlZCBhZnRlciBhbiBldmVudCBpcyBhZGRlZCBvdXRzaWRlIG9mIGEgZmx1c2ggb3BlcmF0aW9uLlxyXG4gICAgICogQHBhcmFtIHF1ZXVlIFRoZSBldmVudCBxdWV1ZSBpdHNlbGZcclxuICAgICAqL1xyXG4gICAgcHVibGljIGV2dEZpbGxlZDogU3luY0V2ZW50PEV2ZW50UXVldWU+ID0gbmV3IFN5bmNFdmVudDxFdmVudFF1ZXVlPigpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBTeW5jRXZlbnQgdHJpZ2dlcmVkIGFmdGVyIHRoZSBxdWV1ZSBpcyBmbHVzaGVkIGVtcHR5XHJcbiAgICAgKiBAcGFyYW0gcXVldWUgVGhlIGV2ZW50IHF1ZXVlIGl0c2VsZlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZXZ0RHJhaW5lZDogU3luY0V2ZW50PEV2ZW50UXVldWU+ID0gbmV3IFN5bmNFdmVudDxFdmVudFF1ZXVlPigpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIG1vZHVsZS1nbG9iYWwgZXZlbnQgcXVldWVcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgX2luc3RhbmNlOiBFdmVudFF1ZXVlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIG1vZHVsZS1nbG9iYWwgZXZlbnQgcXVldWVcclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBnbG9iYWwoKTogRXZlbnRRdWV1ZSB7XHJcbiAgICAgICAgaWYgKCFFdmVudFF1ZXVlLl9pbnN0YW5jZSkge1xyXG4gICAgICAgICAgICBFdmVudFF1ZXVlLnJlc2V0R2xvYmFsKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBFdmVudFF1ZXVlLl9pbnN0YW5jZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRlc3RpbmcgcHVycG9zZXNcclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyByZXNldEdsb2JhbCgpOiB2b2lkIHtcclxuICAgICAgICBFdmVudFF1ZXVlLl9pbnN0YW5jZSA9IG5ldyBFdmVudFF1ZXVlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBRdWV1ZWQgZWxlbWVudHNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfcXVldWU6ICgoKSA9PiB2b2lkKVtdID0gW107XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUcnVlIHdoaWxlIGZsdXNoKCkgb3IgZmx1c2hPbmNlKCkgaXMgcnVubmluZ1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9mbHVzaGluZzogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0cnVlIGlmZiB0aGUgcXVldWUgaXMgZW1wdHlcclxuICAgICAqL1xyXG4gICAgcHVibGljIGVtcHR5KCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGQgYW4gZWxlbWVudCB0byB0aGUgcXVldWUuIFRoZSBoYW5kbGVyIGlzIGNhbGxlZCB3aGVuIG9uZSBvZiB0aGUgZmx1c2hcclxuICAgICAqIG1ldGhvZHMgaXMgY2FsbGVkLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYWRkKGhhbmRsZXI6ICgpID0+IHZvaWQpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLl9xdWV1ZS5wdXNoKGhhbmRsZXIpO1xyXG4gICAgICAgIGlmICh0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDEgJiYgIXRoaXMuX2ZsdXNoaW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0RmlsbGVkLnBvc3QodGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsbHMgYWxsIGhhbmRsZXJzIGN1cnJlbnRseSBpbiB0aGUgcXVldWUuIERvZXMgbm90IGNhbGwgYW55IGhhbmRsZXJzIGFkZGVkXHJcbiAgICAgKiBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2hcclxuICAgICAqL1xyXG4gICAgcHVibGljIGZsdXNoT25jZSgpOiB2b2lkIHtcclxuICAgICAgICB2YXIgZW1wdHkgPSAodGhpcy5fcXVldWUubGVuZ3RoID09PSAwKTtcclxuICAgICAgICB2YXIgZmx1c2hpbmcgPSB0aGlzLl9mbHVzaGluZztcclxuICAgICAgICB0aGlzLl9mbHVzaGluZyA9IHRydWU7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdmFyIHF1ZXVlID0gdGhpcy5fcXVldWU7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlID0gW107XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgIHF1ZXVlW2ldKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICB0aGlzLl9mbHVzaGluZyA9IGZsdXNoaW5nO1xyXG4gICAgICAgICAgICBpZiAoIWVtcHR5ICYmICFmbHVzaGluZyAmJiB0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXZ0RHJhaW5lZC5wb3N0KHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmx1c2hlcyB0aGUgUXVldWVkRXZlbnRzLCBjYWxsaW5nIGFsbCBldmVudHMgY3VycmVudGx5IGluIHRoZSBxdWV1ZSBhbmQgdGhvc2VcclxuICAgICAqIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXHJcbiAgICAgKiBAcGFyYW0gbWF4Um91bmRzIE9wdGlvbmFsLCBkZWZhdWx0IDEwLiBOdW1iZXIgb2YgaXRlcmF0aW9ucyBhZnRlciB3aGljaCB0byB0aHJvdyBhbiBlcnJvciBiZWNhdXNlXHJcbiAgICAgKiAgICAgICAgICAgICAgICAgIHRoZSBxdWV1ZSBrZWVwcyBmaWxsaW5nIHVwLiBTZXQgdG8gbnVsbCB0byBkaXNhYmxlIHRoaXMuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBmbHVzaChtYXhSb3VuZHM6IG51bWJlciA9IDEwKTogdm9pZCB7XHJcbiAgICAgICAgdmFyIGVtcHR5ID0gKHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCk7XHJcbiAgICAgICAgdmFyIGZsdXNoaW5nID0gdGhpcy5fZmx1c2hpbmc7XHJcbiAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSB0cnVlO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHZhciBpID0gMDtcclxuICAgICAgICAgICAgd2hpbGUgKHRoaXMuX3F1ZXVlLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbWF4Um91bmRzID09PSAnbnVtYmVyJyAmJiBpID49IG1heFJvdW5kcykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmFibGUgdG8gZmx1c2ggdGhlIHF1ZXVlIGR1ZSB0byByZWN1cnNpdmVseSBhZGRlZCBldmVudC4gQ2xlYXJpbmcgcXVldWUgbm93Jyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsdXNoT25jZSgpO1xyXG4gICAgICAgICAgICAgICAgKytpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSBmbHVzaGluZztcclxuICAgICAgICAgICAgaWYgKCFlbXB0eSAmJiAhZmx1c2hpbmcgJiYgdGhpcy5fcXVldWUubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmV2dERyYWluZWQucG9zdCh0aGlzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgRXZlbnRRdWV1ZTtcclxuIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtzaGFsbG93RXF1YWxzfSBmcm9tICcuL29iamVjdHMnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlLCBMaXN0ZW5lcn0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuaW1wb3J0IHtTeW5jRXZlbnR9IGZyb20gJy4vc3luYy1ldmVudCc7XHJcbmltcG9ydCB7QXN5bmNFdmVudCwgQXN5bmNFdmVudE9wdHN9IGZyb20gJy4vYXN5bmMtZXZlbnQnO1xyXG5pbXBvcnQge1F1ZXVlZEV2ZW50LCBRdWV1ZWRFdmVudE9wdHN9IGZyb20gJy4vcXVldWVkLWV2ZW50JztcclxuXHJcbmV4cG9ydCBlbnVtIEV2ZW50VHlwZSB7XHJcbiAgICBTeW5jLFxyXG4gICAgQXN5bmMsXHJcbiAgICBRdWV1ZWRcclxufTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQW55RXZlbnRPcHRzIHtcclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIGV2dEZpcnN0QXR0YWNoZWQgYW5kIGV2dExhc3REZXRhY2hlZCBzbyB5b3UgY2FuIG1vbml0b3Igd2hlbiBzb21lb25lIGlzIHN1YnNjcmliZWRcclxuICAgICAqL1xyXG4gICAgbW9uaXRvckF0dGFjaD86IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBbiBldmVudCB0aGF0IGJlaGF2ZXMgbGlrZSBhIFN5bmMvQXN5bmMvUXVldWVkIGV2ZW50IGRlcGVuZGluZyBvbiBob3dcclxuICogeW91IHN1YnNjcmliZS5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBBbnlFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRyaWdnZXJlZCB3aGVuZXZlciBzb21lb25lIGF0dGFjaGVzIGFuZCBub2JvZHkgd2FzIGF0dGFjaGVkLlxyXG4gICAgICogTm90ZTogeW91IG11c3QgY2FsbCB0aGUgY29uc3RydWN0b3Igd2l0aCBtb25pdG9yQXR0YWNoIHNldCB0byB0cnVlIHRvIGNyZWF0ZSB0aGlzIGV2ZW50IVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZXZ0Rmlyc3RBdHRhY2hlZDogVm9pZEFueUV2ZW50O1xyXG4gICAgLyoqXHJcbiAgICAgKiBUcmlnZ2VyZWQgd2hlbmV2ZXIgc29tZW9uZSBkZXRhY2hlcyBhbmQgbm9ib2R5IGlzIGF0dGFjaGVkIGFueW1vcmVcclxuICAgICAqIE5vdGU6IHlvdSBtdXN0IGNhbGwgdGhlIGNvbnN0cnVjdG9yIHdpdGggbW9uaXRvckF0dGFjaCBzZXQgdG8gdHJ1ZSB0byBjcmVhdGUgdGhpcyBldmVudCFcclxuICAgICAqL1xyXG4gICAgcHVibGljIGV2dExhc3REZXRhY2hlZDogVm9pZEFueUV2ZW50O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVW5kZXJseWluZyBldmVudCBpbXBsZW1lbnRhdGlvbnM7IG9uZSBmb3IgZXZlcnkgYXR0YWNoIHR5cGUgKyBvcHRzIGNvbWJpbmF0aW9uXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2V2ZW50czogQmFzZUV2ZW50PFQ+W10gPSBbXTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRzPzogQW55RXZlbnRPcHRzKSB7XHJcbiAgICAgICAgaWYgKG9wdHMgJiYgb3B0cy5tb25pdG9yQXR0YWNoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0Rmlyc3RBdHRhY2hlZCA9IG5ldyBWb2lkQW55RXZlbnQoKTtcclxuICAgICAgICAgICAgdGhpcy5ldnRMYXN0RGV0YWNoZWQgPSBuZXcgVm9pZEFueUV2ZW50KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhdHRhY2goaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoKGV2ZW50OiBQb3N0YWJsZTxUPiwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2gobW9kZTogRXZlbnRUeXBlLCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2gobW9kZTogRXZlbnRUeXBlLCBib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaChtb2RlOiBFdmVudFR5cGUsIGV2ZW50OiBQb3N0YWJsZTxUPiwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogc2FtZSBhcyBhdHRhY2hTeW5jL2F0dGFjaEFzeW5jL2F0dGFjaFF1ZXVlZDsgYmFzZWQgb24gdGhlIGdpdmVuIGVudW1cclxuICAgICAqIEBwYXJhbSBtb2RlIGRldGVybWluZXMgd2hldGhlciB0byBhdHRhY2ggc3luYy9hc3luYy9xdWV1ZWRcclxuICAgICAqL1xyXG4gICAgcHVibGljIGF0dGFjaCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHByZXZDb3VudCA9ICghIXRoaXMuZXZ0Rmlyc3RBdHRhY2hlZCA/IHRoaXMubGlzdGVuZXJDb3VudCgpIDogMCk7XHJcbiAgICAgICAgbGV0IG1vZGUgPSBFdmVudFR5cGUuU3luYztcclxuICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAwICYmIHR5cGVvZiBhcmdzWzBdID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICBtb2RlID0gYXJncy5zaGlmdCgpIGFzIEV2ZW50VHlwZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3dpdGNoIChtb2RlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLlN5bmM6IHtcclxuICAgICAgICAgICAgICAgIC8vIGFkZCBvdXJzZWx2ZXMgYXMgZGVmYXVsdCAnYm91bmRUbycgYXJndW1lbnRcclxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDAgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgICAgICBhcmdzLnVuc2hpZnQodGhpcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBsZXQgZXZlbnQ6IEJhc2VFdmVudDxUPjtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2V2ZW50c1tpXSBpbnN0YW5jZW9mIFN5bmNFdmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9IHRoaXMuX2V2ZW50c1tpXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoIWV2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBuZXcgU3luY0V2ZW50PFQ+KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzLnB1c2goZXZlbnQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZXZlbnQuYXR0YWNoLmFwcGx5KGV2ZW50LCBhcmdzKTtcclxuICAgICAgICAgICAgfSBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBFdmVudFR5cGUuQXN5bmM6IHtcclxuICAgICAgICAgICAgICAgIGxldCBvcHRzOiBBc3luY0V2ZW50T3B0cztcclxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDEgJiYgdHlwZW9mIGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICBvcHRzID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgLy8gYWRkIG91cnNlbHZlcyBhcyBkZWZhdWx0ICdib3VuZFRvJyBhcmd1bWVudFxyXG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGxldCBldmVudDogQmFzZUV2ZW50PFQ+O1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fZXZlbnRzW2ldIGluc3RhbmNlb2YgQXN5bmNFdmVudFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAmJiBzaGFsbG93RXF1YWxzKCg8QXN5bmNFdmVudDxUPj50aGlzLl9ldmVudHNbaV0pLm9wdGlvbnMsIG9wdHMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gdGhpcy5fZXZlbnRzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICghZXZlbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBldmVudCA9IG5ldyBBc3luY0V2ZW50PFQ+KG9wdHMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50cy5wdXNoKGV2ZW50KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGV2ZW50LmF0dGFjaC5hcHBseShldmVudCwgYXJncyk7XHJcbiAgICAgICAgICAgIH0gYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLlF1ZXVlZDoge1xyXG4gICAgICAgICAgICAgICAgbGV0IG9wdHM6IFF1ZXVlZEV2ZW50T3B0cztcclxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDEgJiYgdHlwZW9mIGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICBvcHRzID0gYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgLy8gYWRkIG91cnNlbHZlcyBhcyBkZWZhdWx0ICdib3VuZFRvJyBhcmd1bWVudFxyXG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGxldCBldmVudDogQmFzZUV2ZW50PFQ+O1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fZXZlbnRzW2ldIGluc3RhbmNlb2YgUXVldWVkRXZlbnRcclxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgc2hhbGxvd0VxdWFscygoPFF1ZXVlZEV2ZW50PFQ+PnRoaXMuX2V2ZW50c1tpXSkub3B0aW9ucywgb3B0cykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSB0aGlzLl9ldmVudHNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKCFldmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gbmV3IFF1ZXVlZEV2ZW50PFQ+KG9wdHMpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50cy5wdXNoKGV2ZW50KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGV2ZW50LmF0dGFjaC5hcHBseShldmVudCwgYXJncyk7XHJcbiAgICAgICAgICAgIH0gYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vua25vd24gRXZlbnRUeXBlJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmV2dEZpcnN0QXR0YWNoZWQgJiYgcHJldkNvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0Rmlyc3RBdHRhY2hlZC5wb3N0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhdHRhY2hTeW5jKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2hTeW5jKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaFN5bmMoZXZlbnQ6IFBvc3RhYmxlPFQ+KTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGV2ZW50IGhhbmRsZXJzIGFzIGlmIGl0IHdlcmUgYSBzeW5jIGV2ZW50LiBJdCBpcyBzaW1wbHkgY2FsbGVkICdhdHRhY2gnXHJcbiAgICAgKiBzbyB0aGF0IHRoaXMgY2xhc3MgYWRoZXJlcyB0byB0aGUgQmFzZUV2ZW50PFQ+IHNpZ25hdHVyZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGF0dGFjaFN5bmMoLi4uYXJnczogYW55W10pOiB2b2lkIHtcclxuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLlN5bmMpO1xyXG4gICAgICAgIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhdHRhY2hBc3luYyhoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzKTogdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2hBc3luYyhib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMpOiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaEFzeW5jKGV2ZW50OiBQb3N0YWJsZTxUPiwgb3B0cz86IEFzeW5jRXZlbnRPcHRzKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGV2ZW50IGhhbmRsZXJzIGFzIGlmIGl0IHdlcmUgYSBhLXN5bmMgZXZlbnRcclxuICAgICAqL1xyXG4gICAgcHVibGljIGF0dGFjaEFzeW5jKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgYXJncy51bnNoaWZ0KEV2ZW50VHlwZS5Bc3luYyk7XHJcbiAgICAgICAgdGhpcy5hdHRhY2guYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGF0dGFjaFF1ZXVlZChoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IFF1ZXVlZEV2ZW50T3B0cyk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoUXVldWVkKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaFF1ZXVlZChldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggZXZlbnQgaGFuZGxlcnMgYXMgaWYgaXQgd2VyZSBhIHF1ZXVlZCBldmVudFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoUXVldWVkKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgYXJncy51bnNoaWZ0KEV2ZW50VHlwZS5RdWV1ZWQpO1xyXG4gICAgICAgIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBkZXRhY2goaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgcHVibGljIGRldGFjaChib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogdm9pZDtcclxuICAgIHB1YmxpYyBkZXRhY2goYm91bmRUbzogT2JqZWN0KTogdm9pZDtcclxuICAgIHB1YmxpYyBkZXRhY2goZXZlbnQ6IFBvc3RhYmxlPFQ+KTogdm9pZDtcclxuICAgIHB1YmxpYyBkZXRhY2goKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogRGV0YWNoIGV2ZW50IGhhbmRsZXJzIHJlZ2FyZGxlc3Mgb2YgdHlwZVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgcHJldkNvdW50ID0gKCEhdGhpcy5ldnRMYXN0RGV0YWNoZWQgPyB0aGlzLmxpc3RlbmVyQ291bnQoKSA6IDApO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50c1tpXS5kZXRhY2guYXBwbHkodGhpcy5fZXZlbnRzW2ldLCBhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCEhdGhpcy5ldnRMYXN0RGV0YWNoZWQgJiYgcHJldkNvdW50ID4gMCAmJiB0aGlzLmxpc3RlbmVyQ291bnQoKSA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLmV2dExhc3REZXRhY2hlZC5wb3N0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUG9zdCBhbiBldmVudCB0byBhbGwgY3VycmVudCBsaXN0ZW5lcnNcclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoZGF0YTogVCk6IHZvaWQge1xyXG4gICAgICAgIC8vIG1ha2UgYSBjb3B5IG9mIHRoZSBhcnJheSBmaXJzdCB0byBjb3ZlciB0aGUgY2FzZSB3aGVyZSBldmVudCBoYW5kbGVyc1xyXG4gICAgICAgIC8vIGFyZSBhdHRhY2hlZCBkdXJpbmcgdGhlIHBvc3RcclxuICAgICAgICBjb25zdCBldmVudHM6IEJhc2VFdmVudDxUPltdID0gW107XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgZXZlbnRzLnB1c2godGhpcy5fZXZlbnRzW2ldKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGV2ZW50c1tpXS5wb3N0KGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBudW1iZXIgb2YgYXR0YWNoZWQgbGlzdGVuZXJzXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBsaXN0ZW5lckNvdW50KCk6IG51bWJlciB7XHJcbiAgICAgICAgbGV0IHJlc3VsdCA9IDA7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgcmVzdWx0ICs9IHRoaXMuX2V2ZW50c1tpXS5saXN0ZW5lckNvdW50KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgQW55RXZlbnRzIHdpdGhvdXQgZGF0YVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZvaWRBbnlFdmVudCBleHRlbmRzIEFueUV2ZW50PHZvaWQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KCk6IHZvaWQge1xyXG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFNpbWlsYXIgdG8gJ2Vycm9yJyBldmVudCBvbiBFdmVudEVtaXR0ZXI6IHRocm93cyB3aGVuIGEgcG9zdCgpIG9jY3VycyB3aGlsZSBubyBoYW5kbGVycyBzZXQuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXJyb3JBbnlFdmVudCBleHRlbmRzIEFueUV2ZW50PEVycm9yPiB7XHJcblxyXG4gICAgcHVibGljIHBvc3QoZGF0YTogRXJyb3IpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBlcnJvciBldmVudCBwb3N0ZWQgd2hpbGUgbm8gbGlzdGVuZXJzIGF0dGFjaGVkLiBFcnJvcjogJHtkYXRhLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN1cGVyLnBvc3QoZGF0YSk7XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlLCBMaXN0ZW5lcn0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuXHJcbi8qKlxyXG4gKiBPcHRpb25zIGZvciB0aGUgQXN5bmNFdmVudCBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBBc3luY0V2ZW50T3B0cyB7XHJcbiAgICAvKipcclxuICAgICAqIENvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZSB3aGlsZSB0aGUgcHJldmlvdXMgb25lXHJcbiAgICAgKiBoYXMgbm90IGJlZW4gaGFuZGxlZCB5ZXQuXHJcbiAgICAgKi9cclxuICAgIGNvbmRlbnNlZD86IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBLXN5bmNocm9ub3VzIGV2ZW50LiBIYW5kbGVycyBhcmUgY2FsbGVkIGluIHRoZSBuZXh0IE5vZGUuSlMgY3ljbGUuXHJcbiAqIC0gT3B0aW9uYWxseSBjb25kZW5zZXMgbXVsdGlwbGUgcG9zdCgpIGNhbGxzIGludG8gb25lICh0aGUgbGFzdCBwb3N0KCkgZ2V0cyB0aHJvdWdoKVxyXG4gKiAtIEhhbmRsZXJzIGFyZSBjYWxsZWQgb25seSBmb3IgZXZlbnRzIHBvc3RlZCBhZnRlciB0aGV5IHdlcmUgYXR0YWNoZWQuXHJcbiAqIC0gSGFuZGxlcnMgYXJlIG5vdCBjYWxsZWQgYW55bW9yZSB3aGVuIHRoZXkgYXJlIGRldGFjaGVkLCBldmVuIGlmIGEgcG9zdCgpIGlzIGluIHByb2dyZXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQXN5bmNFdmVudDxUPiBleHRlbmRzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFVzZWQgaW50ZXJuYWxseSAtIHRoZSBleGFjdCBvcHRpb25zIG9iamVjdCBnaXZlbiB0byBjb25zdHJ1Y3RvclxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb3B0aW9uczogQXN5bmNFdmVudE9wdHM7XHJcblxyXG4gICAgcHJpdmF0ZSBfY29uZGVuc2VkOiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkOiBib29sZWFuID0gZmFsc2U7XHJcbiAgICBwcml2YXRlIF9xdWV1ZWRMaXN0ZW5lcnM6IExpc3RlbmVyPFQ+W107XHJcbiAgICBwcml2YXRlIF9xdWV1ZWREYXRhOiBhbnlbXTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBkZWZhdWx0IHNjaGVkdWxlciB1c2VzIHNldEltbWVkaWF0ZSgpIG9yIHNldFRpbWVvdXQoLi4uLCAwKSBpZiBzZXRJbW1lZGlhdGUgaXMgbm90IGF2YWlsYWJsZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0U2NoZWR1bGVyKGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgICovXHJcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIC8vIGJyb3dzZXJzIGRvbid0IGFsd2F5cyBzdXBwb3J0IHNldEltbWVkaWF0ZSgpXHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIG5vZGUuanNcclxuICAgICAgICAgICAgc2V0SW1tZWRpYXRlKGNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgY3VycmVudCBzY2hlZHVsZXJcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgX3NjaGVkdWxlcjogKGNhbGxiYWNrOiAoKSA9PiB2b2lkKSA9PiB2b2lkID0gQXN5bmNFdmVudC5kZWZhdWx0U2NoZWR1bGVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQnkgZGVmYXVsdCwgQXN5bmNFdmVudCB1c2VzIHNldEltbWVkaWF0ZSgpIHRvIHNjaGVkdWxlIGV2ZW50IGhhbmRsZXIgaW52b2NhdGlvbi5cclxuICAgICAqIFlvdSBjYW4gY2hhbmdlIHRoaXMgZm9yIGUuZy4gc2V0VGltZW91dCguLi4sIDApIGJ5IGNhbGxpbmcgdGhpcyBzdGF0aWMgbWV0aG9kIG9uY2UuXHJcbiAgICAgKiBAcGFyYW0gc2NoZWR1bGVyIEEgZnVuY3Rpb24gdGhhdCB0YWtlcyBhIGNhbGxiYWNrIGFuZCBleGVjdXRlcyBpdCBpbiB0aGUgbmV4dCBOb2RlLkpTIGN5Y2xlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIHNldFNjaGVkdWxlcihzY2hlZHVsZXI6IChjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4gdm9pZCk6IHZvaWQge1xyXG4gICAgICAgIEFzeW5jRXZlbnQuX3NjaGVkdWxlciA9IHNjaGVkdWxlcjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENvbnN0cnVjdG9yXHJcbiAgICAgKiBAcGFyYW0gb3B0cyBPcHRpb25hbC4gVmFyaW91cyBzZXR0aW5nczpcclxuICAgICAqICAgICAgICAgICAgIC0gY29uZGVuc2VkOiBhIEJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRvIGNvbmRlbnNlIG11bHRpcGxlIHBvc3QoKSBjYWxscyB3aXRoaW4gdGhlIHNhbWUgY3ljbGUuXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG9wdHM/OiBBc3luY0V2ZW50T3B0cykge1xyXG4gICAgICAgIHN1cGVyKCk7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0cztcclxuICAgICAgICB2YXIgb3B0aW9uczogQXN5bmNFdmVudE9wdHMgPSBvcHRzIHx8IHt9O1xyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5jb25kZW5zZWQgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgICAgICB0aGlzLl9jb25kZW5zZWQgPSBvcHRpb25zLmNvbmRlbnNlZDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9jb25kZW5zZWQgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBBc3luY0V2ZW50LiBIYW5kbGVycyBhcmUgY2FsbGVkIGluIHRoZSBuZXh0IE5vZGUuSlMgY3ljbGUuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IFQpOiB2b2lkO1xyXG4gICAgcHVibGljIHBvc3QoLi4uYXJnczogYW55W10pOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuX2NvbmRlbnNlZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWREYXRhID0gYXJncztcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkTGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgQXN5bmNFdmVudC5fc2NoZWR1bGVyKCgpOiB2b2lkID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBpbW1lZGlhdGVseSBtYXJrIG5vbi1xdWV1ZWQgdG8gYWxsb3cgbmV3IEFzeW5jRXZlbnQgdG8gaGFwcGVuIGFzIHJlc3VsdFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIG9mIGNhbGxpbmcgaGFuZGxlcnNcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAvLyBjYWNoZSBsaXN0ZW5lcnMgYW5kIGRhdGEgYmVjYXVzZSB0aGV5IG1pZ2h0IGNoYW5nZSB3aGlsZSBjYWxsaW5nIGV2ZW50IGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSB0aGlzLl9xdWV1ZWREYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnM7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7IC8vIG5vdCBjb25kZW5zZWRcclxuICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgQXN5bmNFdmVudC5fc2NoZWR1bGVyKCgpOiB2b2lkID0+IHtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gaW5oZXJpdGVkXHJcbiAgICBwcm90ZWN0ZWQgX2NhbGwobGlzdGVuZXI6IExpc3RlbmVyPFQ+LCBhcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIC8vIHBlcmZvcm1hbmNlIG9wdGltaXphdGlvbjogZG9uJ3QgdXNlIGNvbnNlY3V0aXZlIG5vZGVqcyBjeWNsZXNcclxuICAgICAgICAvLyBmb3IgYXN5bmNldmVudHMgYXR0YWNoZWQgdG8gYXN5bmNldmVudHNcclxuICAgICAgICBpZiAobGlzdGVuZXIuZXZlbnQgJiYgbGlzdGVuZXIuZXZlbnQgaW5zdGFuY2VvZiBBc3luY0V2ZW50KSB7XHJcbiAgICAgICAgICAgICg8QXN5bmNFdmVudDxUPj5saXN0ZW5lci5ldmVudCkuX3Bvc3REaXJlY3QoYXJncyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgc3VwZXIuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFBlcmZvcm1hbmNlIG9wdGltaXphdGlvbjogaWYgdGhpcyBhc3luYyBzaWduYWwgaXMgYXR0YWNoZWQgdG8gYW5vdGhlclxyXG4gICAgICogYXN5bmMgc2lnbmFsLCB3ZSdyZSBhbHJlYWR5IGEgdGhlIG5leHQgY3ljbGUgYW5kIHdlIGNhbiBjYWxsIGxpc3RlbmVyc1xyXG4gICAgICogZGlyZWN0bHlcclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIF9wb3N0RGlyZWN0KGFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGNvcHkgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGJlY2F1c2UgdGhpcy5fbGlzdGVuZXJzIG1pZ2h0IGJlIHJlcGxhY2VkIGR1cmluZ1xyXG4gICAgICAgIC8vIHRoZSBoYW5kbGVyIGNhbGxzXHJcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBBc3luY0V2ZW50cyB3aXRob3V0IGRhdGFcclxuICovXHJcbmV4cG9ydCBjbGFzcyBWb2lkQXN5bmNFdmVudCBleHRlbmRzIEFzeW5jRXZlbnQ8dm9pZD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgQXN5bmNFdmVudC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoKTogdm9pZCB7XHJcbiAgICAgICAgc3VwZXIucG9zdCh1bmRlZmluZWQpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBFcnJvckFzeW5jRXZlbnQgZXh0ZW5kcyBBc3luY0V2ZW50PEVycm9yPiB7XHJcblxyXG4gICAgcHVibGljIHBvc3QoZGF0YTogRXJyb3IpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBlcnJvciBldmVudCBwb3N0ZWQgd2hpbGUgbm8gbGlzdGVuZXJzIGF0dGFjaGVkLiBFcnJvcjogJHtkYXRhLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN1cGVyLnBvc3QoZGF0YSk7XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQb3N0YWJsZTxUPiB7XHJcbiAgICBwb3N0KGRhdGE6IFQpOiB2b2lkO1xyXG59XHJcblxyXG4vKipcclxuICogSW50ZXJuYWwgaW50ZXJmYWNlIGJldHdlZW4gQmFzZUV2ZW50IGFuZCBpdHMgc3ViY2xhc3Nlc1xyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBMaXN0ZW5lcjxUPiB7XHJcbiAgICAvKipcclxuICAgICAqIEluZGljYXRlcyB0aGF0IHRoZSBsaXN0ZW5lciB3YXMgZGV0YWNoZWRcclxuICAgICAqL1xyXG4gICAgZGVsZXRlZDogYm9vbGVhbjtcclxuICAgIC8qKlxyXG4gICAgICogVGhlIGhhbmRsZXJcclxuICAgICAqL1xyXG4gICAgaGFuZGxlcj86IChkYXRhOiBUKSA9PiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgdGhpcyBwb2ludGVyIGZvciB0aGUgaGFuZGxlclxyXG4gICAgICovXHJcbiAgICBib3VuZFRvPzogT2JqZWN0O1xyXG4gICAgLyoqXHJcbiAgICAgKiBJbnN0ZWFkIG9mIGEgaGFuZGxlciwgYW4gYXR0YWNoZWQgZXZlbnRcclxuICAgICAqL1xyXG4gICAgZXZlbnQ/OiBQb3N0YWJsZTxUPjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEJhc2UgY2xhc3MgZm9yIGV2ZW50cy5cclxuICogSGFuZGxlcyBhdHRhY2hpbmcgYW5kIGRldGFjaGluZyBsaXN0ZW5lcnNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBCYXNlRXZlbnQ8VD4gaW1wbGVtZW50cyBQb3N0YWJsZTxUPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2hlZCBsaXN0ZW5lcnMuIE5PVEU6IGRvIG5vdCBtb2RpZnkuXHJcbiAgICAgKiBJbnN0ZWFkLCByZXBsYWNlIHdpdGggYSBuZXcgYXJyYXkgd2l0aCBwb3NzaWJseSB0aGUgc2FtZSBlbGVtZW50cy4gVGhpcyBlbnN1cmVzXHJcbiAgICAgKiB0aGF0IGFueSByZWZlcmVuY2VzIHRvIHRoZSBhcnJheSBieSBldmVudHMgdGhhdCBhcmUgdW5kZXJ3YXkgcmVtYWluIHRoZSBzYW1lLlxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgX2xpc3RlbmVyczogTGlzdGVuZXI8VD5bXTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBhbiBldmVudCBoYW5kbGVyXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gdG8gY2FsbC4gVGhlIHRoaXMgYXJndW1lbnQgb2YgdGhlIGZ1bmN0aW9uIHdpbGwgYmUgdGhpcyBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhdHRhY2goaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlclxyXG4gICAgICogQHBhcmFtIGJvdW5kVG8gVGhlIHRoaXMgYXJndW1lbnQgb2YgdGhlIGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBjYWxsLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgZGlyZWN0bHlcclxuICAgICAqIEBwYXJhbSBldmVudCBUaGUgZXZlbnQgdG8gYmUgcG9zdGVkXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhdHRhY2goZXZlbnQ6IFBvc3RhYmxlPFQ+KTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBib3VuZFRvIChPcHRpb25hbCkgVGhlIHRoaXMgYXJndW1lbnQgb2YgdGhlIGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBjYWxsLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgdmFyIGJvdW5kVG86IE9iamVjdDtcclxuICAgICAgICB2YXIgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQ7XHJcbiAgICAgICAgdmFyIGV2ZW50OiBQb3N0YWJsZTxUPjtcclxuICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF07XHJcbiAgICAgICAgfSBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXS5wb3N0ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGV2ZW50ID0gYXJnc1swXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gIT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdCBhIGZ1bmN0aW9uIG9yIG9iamVjdCBhcyBmaXJzdCBhcmd1bWVudCcpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMV0gIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0IGEgZnVuY3Rpb24gYXMgc2Vjb25kIGFyZ3VtZW50Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYm91bmRUbyA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzFdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycykge1xyXG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lcnMgPSBbXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYXJyYXkgc28gZXZlbnRzIHRoYXQgYXJlIHVuZGVyd2F5IGhhdmUgYSBzdGFibGUgbG9jYWwgY29weVxyXG4gICAgICAgICAgICAvLyBvZiB0aGUgbGlzdGVuZXJzIGFycmF5IGF0IHRoZSB0aW1lIG9mIHBvc3QoKVxyXG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMubWFwKChsaXN0ZW5lcjogTGlzdGVuZXI8VD4pOiBMaXN0ZW5lcjxUPiA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbGlzdGVuZXI7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9saXN0ZW5lcnMucHVzaCh7XHJcbiAgICAgICAgICAgIGRlbGV0ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICBib3VuZFRvOiBib3VuZFRvLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyLFxyXG4gICAgICAgICAgICBldmVudDogZXZlbnRcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBhbGwgbGlzdGVuZXJzIHdpdGggdGhlIGdpdmVuIGhhbmRsZXIgZnVuY3Rpb25cclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaChoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBhbGwgbGlzdGVuZXJzIHdpdGggdGhlIGdpdmVuIGhhbmRsZXIgZnVuY3Rpb24gYW5kIGJvdW5kVG8gb2JqZWN0LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggYWxsIGxpc3RlbmVycyB0aGF0IHdlcmUgYXR0YWNoZWQgd2l0aCB0aGUgZ2l2ZW4gYm91bmRUbyBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBkZXRhY2goYm91bmRUbzogT2JqZWN0KTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogRGV0YWNoIHRoZSBnaXZlbiBldmVudC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaChldmVudDogUG9zdGFibGU8VD4pOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggYWxsIGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKCk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBpbXBsZW1lbnRhdGlvbi4gU2VlIHRoZSBvdmVybG9hZHMgZm9yIGRlc2NyaXB0aW9uLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBib3VuZFRvOiBPYmplY3Q7XHJcbiAgICAgICAgdmFyIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkO1xyXG4gICAgICAgIHZhciBldmVudDogUG9zdGFibGU8VD47XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID49IDEpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiAoYXJnc1swXSkgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdLnBvc3QgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGV2ZW50ID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGJvdW5kVG8gPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA+PSAyKSB7XHJcbiAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzFdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVycyBBTkQgbWFyayB0aGVtIGFzIGRlbGV0ZWQgc28gc3ViY2xhc3NlcyBkb24ndCBzZW5kIGFueSBtb3JlIGV2ZW50cyB0byB0aGVtXHJcbiAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzLmZpbHRlcigobGlzdGVuZXI6IExpc3RlbmVyPFQ+KTogYm9vbGVhbiA9PiB7XHJcbiAgICAgICAgICAgIGlmICgodHlwZW9mIGhhbmRsZXIgPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmhhbmRsZXIgPT09IGhhbmRsZXIpXHJcbiAgICAgICAgICAgICAgICAmJiAodHlwZW9mIGV2ZW50ID09PSAndW5kZWZpbmVkJyB8fCBsaXN0ZW5lci5ldmVudCA9PT0gZXZlbnQpXHJcbiAgICAgICAgICAgICAgICAmJiAodHlwZW9mIGJvdW5kVG8gPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmJvdW5kVG8gPT09IGJvdW5kVG8pKSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5kZWxldGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBYnN0cmFjdCBwb3N0KCkgbWV0aG9kIHRvIGJlIGFibGUgdG8gY29ubmVjdCBhbnkgdHlwZSBvZiBldmVudCB0byBhbnkgb3RoZXIgZGlyZWN0bHlcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcG9zdChkYXRhOiBUKTogdm9pZCB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhYnN0cmFjdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIG51bWJlciBvZiBhdHRhY2hlZCBsaXN0ZW5lcnNcclxuICAgICAqL1xyXG4gICAgcHVibGljIGxpc3RlbmVyQ291bnQoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2xpc3RlbmVycyA/IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggOiAwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGwgdGhlIGdpdmVuIGxpc3RlbmVyLCBpZiBpdCBpcyBub3QgbWFya2VkIGFzICdkZWxldGVkJ1xyXG4gICAgICogQHBhcmFtIGxpc3RlbmVyIFRoZSBsaXN0ZW5lciB0byBjYWxsXHJcbiAgICAgKiBAcGFyYW0gYXJncyBUaGUgYXJndW1lbnRzIHRvIHRoZSBoYW5kbGVyXHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBfY2FsbChsaXN0ZW5lcjogTGlzdGVuZXI8VD4sIGFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCFsaXN0ZW5lci5kZWxldGVkKSB7XHJcbiAgICAgICAgICAgIGlmIChsaXN0ZW5lci5ldmVudCkge1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuZXZlbnQucG9zdC5hcHBseShsaXN0ZW5lci5ldmVudCwgYXJncyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5oYW5kbGVyLmFwcGx5KCh0eXBlb2YgbGlzdGVuZXIuYm91bmRUbyA9PT0gJ29iamVjdCcgPyBsaXN0ZW5lci5ib3VuZFRvIDogdGhpcyksIGFyZ3MpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxufVxyXG4iLCIvLyBDb3B5cmlnaHQgKGMpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcblxyXG4ndXNlIHN0cmljdCc7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2hhbGxvd0VxdWFscyhhOiBhbnksIGI6IGFueSk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKGEgPT09IGIpIHtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIGlmICh0eXBlb2YgYSAhPT0gdHlwZW9mIGIpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBzd2l0Y2ggKHR5cGVvZiBhKSB7XHJcbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XHJcbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcclxuICAgICAgICBjYXNlICdzdHJpbmcnOlxyXG4gICAgICAgIGNhc2UgJ2Z1bmN0aW9uJzpcclxuICAgICAgICBjYXNlICdzeW1ib2wnOlxyXG4gICAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6XHJcbiAgICAgICAgICAgIC8vIGFscmVhZHkgZGlkID09PSBjb21wYXJlXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjYXNlICdvYmplY3QnOlxyXG4gICAgICAgICAgICBpZiAoYSA9PT0gbnVsbCB8fCBiID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7IC8vIGFscmVhZHkgY29tcGFyZWQgPT09XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYSkgfHwgQXJyYXkuaXNBcnJheShiKSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGEpIHx8ICFBcnJheS5pc0FycmF5KGIpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgbmFtZTogc3RyaW5nO1xyXG4gICAgICAgICAgICB2YXIgbmFtZXNBOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICB2YXIgbmFtZXNCOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gYSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGEuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lc0EucHVzaChuYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gYikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGIuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lc0IucHVzaChuYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBuYW1lc0Euc29ydCgpO1xyXG4gICAgICAgICAgICBuYW1lc0Iuc29ydCgpO1xyXG4gICAgICAgICAgICBpZiAobmFtZXNBLmpvaW4oJywnKSAhPT0gbmFtZXNCLmpvaW4oJywnKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBuYW1lc0EubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgIGlmIChhW25hbWVzQVtpXV0gIT09IGJbbmFtZXNBW2ldXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlLCBMaXN0ZW5lcn0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuaW1wb3J0IHtkZWZhdWx0IGFzIEV2ZW50UXVldWV9IGZyb20gJy4vRXZlbnRRdWV1ZSc7XHJcblxyXG4vKipcclxuICogT3B0aW9ucyBmb3IgdGhlIFF1ZXVlZEV2ZW50IGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFF1ZXVlZEV2ZW50T3B0cyB7XHJcbiAgICAvKipcclxuICAgICAqIENvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZS5cclxuICAgICAqL1xyXG4gICAgY29uZGVuc2VkPzogYm9vbGVhbjtcclxuICAgIC8qKlxyXG4gICAgICogU3BlY2lmaWMgZXZlbnQgcXVldWUgdG8gdXNlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSBnbG9iYWwgaW5zdGFuY2UgaXMgdXNlZC5cclxuICAgICAqL1xyXG4gICAgcXVldWU/OiBFdmVudFF1ZXVlO1xyXG59XHJcblxyXG4vKipcclxuICogRXZlbnQgdGhhdCBzdGF5cyBpbiBhIHF1ZXVlIHVudGlsIHlvdSBwcm9jZXNzIHRoZSBxdWV1ZS4gQWxsb3dzIGZpbmUtZ3JhaW5lZFxyXG4gKiBjb250cm9sIG92ZXIgd2hlbiBldmVudHMgaGFwcGVuLlxyXG4gKiAtIE9wdGlvbmFsbHkgY29uZGVuc2VzIG11bHRpcGxlIHBvc3QoKSBjYWxscyBpbnRvIG9uZS5cclxuICogLSBIYW5kbGVycyBhcmUgY2FsbGVkIG9ubHkgZm9yIGV2ZW50cyBwb3N0ZWQgYWZ0ZXIgdGhleSB3ZXJlIGF0dGFjaGVkLlxyXG4gKiAtIEhhbmRsZXJzIGFyZSBub3QgY2FsbGVkIGFueW1vcmUgd2hlbiB0aGV5IGFyZSBkZXRhY2hlZCwgZXZlbiBpZiBhIHBvc3QoKSBpcyBpbiBwcm9ncmVzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFF1ZXVlZEV2ZW50PFQ+IGV4dGVuZHMgQmFzZUV2ZW50PFQ+IGltcGxlbWVudHMgUG9zdGFibGU8VD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXNlZCBpbnRlcm5hbGx5IC0gdGhlIGV4YWN0IG9wdGlvbnMgb2JqZWN0IGdpdmVuIHRvIGNvbnN0cnVjdG9yXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBvcHRpb25zOiBRdWV1ZWRFdmVudE9wdHM7XHJcblxyXG4gICAgcHJpdmF0ZSBfY29uZGVuc2VkOiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWU6IEV2ZW50UXVldWU7XHJcbiAgICBwcml2YXRlIF9xdWV1ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuICAgIHByaXZhdGUgX3F1ZXVlZExpc3RlbmVyczogTGlzdGVuZXI8VD5bXTtcclxuICAgIHByaXZhdGUgX3F1ZXVlZERhdGE6IGFueVtdO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSBvcHRzIE9wdGlvbmFsLCBhbiBvYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nIG1lbWJlcnM6XHJcbiAgICAgKiAgICAgICAgICAgICAtIGNvbmRlbnNlZDogYSBCb29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0byBjb25kZW5zZSBtdWx0aXBsZSBjYWxscyB0byBwb3N0KCkgaW50byBvbmUgKGRlZmF1bHQgZmFsc2UpXHJcbiAgICAgKiAgICAgICAgICAgICAtIHF1ZXVlOiBhIHNwZWNpZmljIGV2ZW50IHF1ZXVlIHRvIHVzZS4gVGhlIGdsb2JhbCBFdmVudFF1ZXVlIGluc3RhbmNlIGlzIHVzZWQgaWYgbm90IGdpdmVuLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRzPzogUXVldWVkRXZlbnRPcHRzKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRzO1xyXG4gICAgICAgIHZhciBvcHRpb25zOiBRdWV1ZWRFdmVudE9wdHMgPSBvcHRzIHx8IHt9O1xyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5jb25kZW5zZWQgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgICAgICB0aGlzLl9jb25kZW5zZWQgPSBvcHRpb25zLmNvbmRlbnNlZDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9jb25kZW5zZWQgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnF1ZXVlID09PSAnb2JqZWN0JyAmJiBvcHRpb25zLnF1ZXVlICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlID0gb3B0aW9ucy5xdWV1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIFNlbmQgdGhlIGV2ZW50LiBFdmVudHMgYXJlIHF1ZXVlZCBpbiB0aGUgZXZlbnQgcXVldWUgdW50aWwgZmx1c2hlZCBvdXQuXHJcbiAgICAqIElmIHRoZSAnY29uZGVuc2VkJyBvcHRpb24gd2FzIGdpdmVuIGluIHRoZSBjb25zdHJ1Y3RvciwgbXVsdGlwbGUgcG9zdHMoKVxyXG4gICAgKiBiZXR3ZWVuIHF1ZXVlIGZsdXNoZXMgYXJlIGNvbmRlbnNlZCBpbnRvIG9uZSBjYWxsIHdpdGggdGhlIGRhdGEgZnJvbSB0aGVcclxuICAgICogbGFzdCBwb3N0KCkgY2FsbC5cclxuICAgICovXHJcbiAgICBwdWJsaWMgcG9zdChkYXRhOiBUKTogdm9pZDtcclxuICAgIHB1YmxpYyBwb3N0KC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBxdWV1ZSA9ICh0aGlzLl9xdWV1ZSA/IHRoaXMuX3F1ZXVlIDogRXZlbnRRdWV1ZS5nbG9iYWwoKSk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2NvbmRlbnNlZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWREYXRhID0gYXJncztcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkTGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgcXVldWUuYWRkKCgpOiB2b2lkID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBpbW1lZGlhdGVseSBtYXJrIG5vbi1xdWV1ZWQgdG8gYWxsb3cgbmV3IEFzeW5jRXZlbnQgdG8gaGFwcGVuIGFzIHJlc3VsdFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIG9mIGNhbGxpbmcgaGFuZGxlcnNcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAvLyBjYWNoZSBsaXN0ZW5lcnMgYW5kIGRhdGEgYmVjYXVzZSB0aGV5IG1pZ2h0IGNoYW5nZSB3aGlsZSBjYWxsaW5nIGV2ZW50IGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSB0aGlzLl9xdWV1ZWREYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnM7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7IC8vIG5vdCBjb25kZW5zZWRcclxuICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgcXVldWUuYWRkKCgpOiB2b2lkID0+IHtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgZXZlbnRzIHdpdGhvdXQgZGF0YVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZvaWRRdWV1ZWRFdmVudCBleHRlbmRzIFF1ZXVlZEV2ZW50PHZvaWQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIGV2ZW50LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcG9zdCgpOiB2b2lkIHtcclxuICAgICAgICBzdXBlci5wb3N0KHVuZGVmaW5lZCk7XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBFcnJvclF1ZXVlZEV2ZW50IGV4dGVuZHMgUXVldWVkRXZlbnQ8RXJyb3I+IHtcclxuXHJcbiAgICBwdWJsaWMgcG9zdChkYXRhOiBFcnJvcik6IHZvaWQge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBlcnJvciBldmVudCBwb3N0ZWQgd2hpbGUgbm8gbGlzdGVuZXJzIGF0dGFjaGVkLiBFcnJvcjogJHtkYXRhLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN1cGVyLnBvc3QoZGF0YSk7XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlfSBmcm9tICcuL2Jhc2UtZXZlbnQnO1xyXG5cclxuLyoqXHJcbiAqIFRoaXMgaXMgYSB0cnVlIEV2ZW50RW1pdHRlciByZXBsYWNlbWVudDogdGhlIGhhbmRsZXJzIGFyZSBjYWxsZWQgc3luY2hyb25vdXNseSB3aGVuXHJcbiAqIHlvdSBwb3N0IHRoZSBldmVudC5cclxuICogLSBBbGxvd3MgYmV0dGVyIGVycm9yIGhhbmRsaW5nIGJ5IGFnZ3JlZ2F0aW5nIGFueSBlcnJvcnMgdGhyb3duIGJ5IGhhbmRsZXJzLlxyXG4gKiAtIFByZXZlbnRzIGxpdmVsb2NrIGJ5IHRocm93aW5nIGFuIGVycm9yIHdoZW4gcmVjdXJzaW9uIGRlcHRoIGlzIGFib3ZlIGEgbWF4aW11bS5cclxuICogLSBIYW5kbGVycyBhcmUgY2FsbGVkIG9ubHkgZm9yIGV2ZW50cyBwb3N0ZWQgYWZ0ZXIgdGhleSB3ZXJlIGF0dGFjaGVkLlxyXG4gKiAtIEhhbmRsZXJzIGFyZSBub3QgY2FsbGVkIGFueW1vcmUgd2hlbiB0aGV5IGFyZSBkZXRhY2hlZCwgZXZlbiBpZiBhIHBvc3QoKSBpcyBpbiBwcm9ncmVzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFN5bmNFdmVudDxUPiBleHRlbmRzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIE1heGltdW0gbnVtYmVyIG9mIHRpbWVzIHRoYXQgYW4gZXZlbnQgaGFuZGxlciBtYXkgY2F1c2UgdGhlIHNhbWUgZXZlbnRcclxuICAgICAqIHJlY3Vyc2l2ZWx5LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIE1BWF9SRUNVUlNJT05fREVQVEg6IG51bWJlciA9IDEwO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVjdXJzaXZlIHBvc3QoKSBpbnZvY2F0aW9uc1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9yZWN1cnNpb246IG51bWJlciA9IDA7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBldmVudC4gSGFuZGxlcnMgYXJlIGNhbGxlZCBpbW1lZGlhdGVseSBhbmQgc3luY2hyb25vdXNseS5cclxuICAgICAqIElmIGFuIGVycm9yIGlzIHRocm93biBieSBhIGhhbmRsZXIsIHRoZSByZW1haW5pbmcgaGFuZGxlcnMgYXJlIHN0aWxsIGNhbGxlZC5cclxuICAgICAqIEFmdGVyd2FyZCwgYW4gQWdncmVnYXRlRXJyb3IgaXMgdGhyb3duIHdpdGggdGhlIG9yaWdpbmFsIGVycm9yKHMpIGluIGl0cyAnY2F1c2VzJyBwcm9wZXJ0eS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoZGF0YTogVCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgcG9zdCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9yZWN1cnNpb24rKztcclxuICAgICAgICBpZiAoU3luY0V2ZW50Lk1BWF9SRUNVUlNJT05fREVQVEggPiAwICYmXHJcbiAgICAgICAgICAgIHRoaXMuX3JlY3Vyc2lvbiA+IFN5bmNFdmVudC5NQVhfUkVDVVJTSU9OX0RFUFRIKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZXZlbnQgZmlyZWQgcmVjdXJzaXZlbHknKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gY29weSBhIHJlZmVyZW5jZSB0byB0aGUgYXJyYXkgYmVjYXVzZSB0aGlzLl9saXN0ZW5lcnMgbWlnaHQgYmUgcmVwbGFjZWQgZHVyaW5nXHJcbiAgICAgICAgLy8gdGhlIGhhbmRsZXIgY2FsbHNcclxuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3JlY3Vyc2lvbi0tO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ29udmVuaWVuY2UgY2xhc3MgZm9yIGV2ZW50cyB3aXRob3V0IGRhdGFcclxuICovXHJcbmV4cG9ydCBjbGFzcyBWb2lkU3luY0V2ZW50IGV4dGVuZHMgU3luY0V2ZW50PHZvaWQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIGV2ZW50LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcG9zdCgpOiB2b2lkIHtcclxuICAgICAgICBzdXBlci5wb3N0KHVuZGVmaW5lZCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTaW1pbGFyIHRvICdlcnJvcicgZXZlbnQgb24gRXZlbnRFbWl0dGVyOiB0aHJvd3Mgd2hlbiBhIHBvc3QoKSBvY2N1cnMgd2hpbGUgbm8gaGFuZGxlcnMgc2V0LlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEVycm9yU3luY0V2ZW50IGV4dGVuZHMgU3luY0V2ZW50PEVycm9yPiB7XHJcblxyXG4gICAgcHVibGljIHBvc3QoZGF0YTogRXJyb3IpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBlcnJvciBldmVudCBwb3N0ZWQgd2hpbGUgbm8gbGlzdGVuZXJzIGF0dGFjaGVkLiBFcnJvcjogJHtkYXRhLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN1cGVyLnBvc3QoZGF0YSk7XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuZXhwb3J0ICogZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuZXhwb3J0ICogZnJvbSAnLi9zeW5jLWV2ZW50JztcclxuZXhwb3J0ICogZnJvbSAnLi9xdWV1ZWQtZXZlbnQnO1xyXG5leHBvcnQgKiBmcm9tICcuL2FzeW5jLWV2ZW50JztcclxuZXhwb3J0ICogZnJvbSAnLi9hbnktZXZlbnQnO1xyXG5cclxuaW1wb3J0IHtkZWZhdWx0IGFzIEV2ZW50UXVldWV9IGZyb20gJy4vRXZlbnRRdWV1ZSc7XHJcbmV4cG9ydCB7ZGVmYXVsdCBhcyBFdmVudFF1ZXVlfSBmcm9tICcuL0V2ZW50UXVldWUnO1xyXG5cclxuLyoqXHJcbiAqIFRoZSBnbG9iYWwgZXZlbnQgcXVldWUgZm9yIFF1ZXVlZEV2ZW50c1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHF1ZXVlKCk6IEV2ZW50UXVldWUge1xyXG4gICAgcmV0dXJuIEV2ZW50UXVldWUuZ2xvYmFsKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBmdW5jdGlvbiwgc2FtZSBhcyBFdmVudFF1ZXVlLmdsb2JhbCgpLmZsdXNoT25jZSgpLlxyXG4gKiBGbHVzaGVzIHRoZSBRdWV1ZWRFdmVudHMsIGNhbGxpbmcgYWxsIGV2ZW50cyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlIGJ1dCBub3RcclxuICogYW55IGV2ZW50cyBwdXQgaW50byB0aGUgcXVldWUgYXMgYSByZXN1bHQgb2YgdGhlIGZsdXNoLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGZsdXNoT25jZSgpOiB2b2lkIHtcclxuICAgIEV2ZW50UXVldWUuZ2xvYmFsKCkuZmx1c2hPbmNlKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBmdW5jdGlvbiwgc2FtZSBhcyBFdmVudFF1ZXVlLmdsb2JhbCgpLmZsdXNoKCkuXHJcbiAqIEZsdXNoZXMgdGhlIFF1ZXVlZEV2ZW50cywgY2FsbGluZyBhbGwgaGFuZGxlcnMgY3VycmVudGx5IGluIHRoZSBxdWV1ZSBhbmQgdGhvc2VcclxuICogcHV0IGludG8gdGhlIHF1ZXVlIGFzIGEgcmVzdWx0IG9mIHRoZSBmbHVzaC5cclxuICogQHBhcmFtIG1heFJvdW5kcyBPcHRpb25hbCwgZGVmYXVsdCAxMC4gTnVtYmVyIG9mIGl0ZXJhdGlvbnMgYWZ0ZXIgd2hpY2ggdG8gdGhyb3cgYW4gZXJyb3IgYmVjYXVzZVxyXG4gKiAgICAgICAgICAgICAgICAgIHRoZSBxdWV1ZSBrZWVwcyBmaWxsaW5nIHVwLiBTZXQgdG8gdW5kZWZpbmVkIG9yIG51bGwgdG8gZGlzYWJsZSB0aGlzLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGZsdXNoKG1heFJvdW5kczogbnVtYmVyID0gMTApOiB2b2lkIHtcclxuICAgIEV2ZW50UXVldWUuZ2xvYmFsKCkuZmx1c2gobWF4Um91bmRzKTtcclxufVxyXG4iXX0=
return require('ts-events');
});