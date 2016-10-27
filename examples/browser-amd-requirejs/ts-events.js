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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkaXN0L2xpYi9FdmVudFF1ZXVlLmpzIiwiZGlzdC9saWIvYW55LWV2ZW50LmpzIiwiZGlzdC9saWIvYXN5bmMtZXZlbnQuanMiLCJkaXN0L2xpYi9iYXNlLWV2ZW50LmpzIiwiZGlzdC9saWIvb2JqZWN0cy5qcyIsImRpc3QvbGliL3F1ZXVlZC1ldmVudC5qcyIsImRpc3QvbGliL3N5bmMtZXZlbnQuanMiLCJkaXN0L2xpYi9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgKGMpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcbid1c2Ugc3RyaWN0JztcclxudmFyIHN5bmNfZXZlbnRfMSA9IHJlcXVpcmUoJy4vc3luYy1ldmVudCcpO1xyXG4vKipcclxuICogU2ltcGxlIHN5bmNocm9ub3VzIGV2ZW50IHF1ZXVlIHRoYXQgbmVlZHMgdG8gYmUgZHJhaW5lZCBtYW51YWxseS5cclxuICovXHJcbnZhciBFdmVudFF1ZXVlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIEV2ZW50UXVldWUoKSB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU3luY0V2ZW50IHRyaWdnZXJlZCBhZnRlciBhbiBldmVudCBpcyBhZGRlZCBvdXRzaWRlIG9mIGEgZmx1c2ggb3BlcmF0aW9uLlxyXG4gICAgICAgICAqIEBwYXJhbSBxdWV1ZSBUaGUgZXZlbnQgcXVldWUgaXRzZWxmXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5ldnRGaWxsZWQgPSBuZXcgc3luY19ldmVudF8xLlN5bmNFdmVudCgpO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFN5bmNFdmVudCB0cmlnZ2VyZWQgYWZ0ZXIgdGhlIHF1ZXVlIGlzIGZsdXNoZWQgZW1wdHlcclxuICAgICAgICAgKiBAcGFyYW0gcXVldWUgVGhlIGV2ZW50IHF1ZXVlIGl0c2VsZlxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuZXZ0RHJhaW5lZCA9IG5ldyBzeW5jX2V2ZW50XzEuU3luY0V2ZW50KCk7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUXVldWVkIGVsZW1lbnRzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5fcXVldWUgPSBbXTtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBUcnVlIHdoaWxlIGZsdXNoKCkgb3IgZmx1c2hPbmNlKCkgaXMgcnVubmluZ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuX2ZsdXNoaW5nID0gZmFsc2U7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFRoZSBtb2R1bGUtZ2xvYmFsIGV2ZW50IHF1ZXVlXHJcbiAgICAgKi9cclxuICAgIEV2ZW50UXVldWUuZ2xvYmFsID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICghRXZlbnRRdWV1ZS5faW5zdGFuY2UpIHtcclxuICAgICAgICAgICAgRXZlbnRRdWV1ZS5yZXNldEdsb2JhbCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gRXZlbnRRdWV1ZS5faW5zdGFuY2U7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBUZXN0aW5nIHB1cnBvc2VzXHJcbiAgICAgKi9cclxuICAgIEV2ZW50UXVldWUucmVzZXRHbG9iYWwgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgRXZlbnRRdWV1ZS5faW5zdGFuY2UgPSBuZXcgRXZlbnRRdWV1ZSgpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0cnVlIGlmZiB0aGUgcXVldWUgaXMgZW1wdHlcclxuICAgICAqL1xyXG4gICAgRXZlbnRRdWV1ZS5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMDtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEFkZCBhbiBlbGVtZW50IHRvIHRoZSBxdWV1ZS4gVGhlIGhhbmRsZXIgaXMgY2FsbGVkIHdoZW4gb25lIG9mIHRoZSBmbHVzaFxyXG4gICAgICogbWV0aG9kcyBpcyBjYWxsZWQuXHJcbiAgICAgKi9cclxuICAgIEV2ZW50UXVldWUucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIChoYW5kbGVyKSB7XHJcbiAgICAgICAgdGhpcy5fcXVldWUucHVzaChoYW5kbGVyKTtcclxuICAgICAgICBpZiAodGhpcy5fcXVldWUubGVuZ3RoID09PSAxICYmICF0aGlzLl9mbHVzaGluZykge1xyXG4gICAgICAgICAgICB0aGlzLmV2dEZpbGxlZC5wb3N0KHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIENhbGxzIGFsbCBoYW5kbGVycyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlLiBEb2VzIG5vdCBjYWxsIGFueSBoYW5kbGVycyBhZGRlZFxyXG4gICAgICogYXMgYSByZXN1bHQgb2YgdGhlIGZsdXNoXHJcbiAgICAgKi9cclxuICAgIEV2ZW50UXVldWUucHJvdG90eXBlLmZsdXNoT25jZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZW1wdHkgPSAodGhpcy5fcXVldWUubGVuZ3RoID09PSAwKTtcclxuICAgICAgICB2YXIgZmx1c2hpbmcgPSB0aGlzLl9mbHVzaGluZztcclxuICAgICAgICB0aGlzLl9mbHVzaGluZyA9IHRydWU7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdmFyIHF1ZXVlID0gdGhpcy5fcXVldWU7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlID0gW107XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgIHF1ZXVlW2ldKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZmluYWxseSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2ZsdXNoaW5nID0gZmx1c2hpbmc7XHJcbiAgICAgICAgICAgIGlmICghZW1wdHkgJiYgIWZsdXNoaW5nICYmIHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ldnREcmFpbmVkLnBvc3QodGhpcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBGbHVzaGVzIHRoZSBRdWV1ZWRFdmVudHMsIGNhbGxpbmcgYWxsIGV2ZW50cyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlIGFuZCB0aG9zZVxyXG4gICAgICogcHV0IGludG8gdGhlIHF1ZXVlIGFzIGEgcmVzdWx0IG9mIHRoZSBmbHVzaC5cclxuICAgICAqIEBwYXJhbSBtYXhSb3VuZHMgT3B0aW9uYWwsIGRlZmF1bHQgMTAuIE51bWJlciBvZiBpdGVyYXRpb25zIGFmdGVyIHdoaWNoIHRvIHRocm93IGFuIGVycm9yIGJlY2F1c2VcclxuICAgICAqICAgICAgICAgICAgICAgICAgdGhlIHF1ZXVlIGtlZXBzIGZpbGxpbmcgdXAuIFNldCB0byBudWxsIHRvIGRpc2FibGUgdGhpcy5cclxuICAgICAqL1xyXG4gICAgRXZlbnRRdWV1ZS5wcm90b3R5cGUuZmx1c2ggPSBmdW5jdGlvbiAobWF4Um91bmRzKSB7XHJcbiAgICAgICAgaWYgKG1heFJvdW5kcyA9PT0gdm9pZCAwKSB7IG1heFJvdW5kcyA9IDEwOyB9XHJcbiAgICAgICAgdmFyIGVtcHR5ID0gKHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCk7XHJcbiAgICAgICAgdmFyIGZsdXNoaW5nID0gdGhpcy5fZmx1c2hpbmc7XHJcbiAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSB0cnVlO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHZhciBpID0gMDtcclxuICAgICAgICAgICAgd2hpbGUgKHRoaXMuX3F1ZXVlLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbWF4Um91bmRzID09PSAnbnVtYmVyJyAmJiBpID49IG1heFJvdW5kcykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmFibGUgdG8gZmx1c2ggdGhlIHF1ZXVlIGR1ZSB0byByZWN1cnNpdmVseSBhZGRlZCBldmVudC4gQ2xlYXJpbmcgcXVldWUgbm93Jyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsdXNoT25jZSgpO1xyXG4gICAgICAgICAgICAgICAgKytpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkge1xyXG4gICAgICAgICAgICB0aGlzLl9mbHVzaGluZyA9IGZsdXNoaW5nO1xyXG4gICAgICAgICAgICBpZiAoIWVtcHR5ICYmICFmbHVzaGluZyAmJiB0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXZ0RHJhaW5lZC5wb3N0KHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHJldHVybiBFdmVudFF1ZXVlO1xyXG59KCkpO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmV4cG9ydHMuZGVmYXVsdCA9IEV2ZW50UXVldWU7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaVJYWmxiblJSZFdWMVpTNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpJanBiSWk0dUx5NHVMM055WXk5c2FXSXZSWFpsYm5SUmRXVjFaUzUwY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pUVVGQlFTd3JSRUZCSzBRN1FVRkRMMFFzWlVGQlpUdEJRVVZtTEZsQlFWa3NRMEZCUXp0QlFVVmlMREpDUVVGM1FpeGpRVUZqTEVOQlFVTXNRMEZCUVR0QlFVVjJRenM3UjBGRlJ6dEJRVU5JTzBsQlFVRTdVVUZGU1RzN08xZEJSMGM3VVVGRFNTeGpRVUZUTEVkQlFUQkNMRWxCUVVrc2MwSkJRVk1zUlVGQll5eERRVUZETzFGQlEzUkZPenM3VjBGSFJ6dFJRVU5KTEdWQlFWVXNSMEZCTUVJc1NVRkJTU3h6UWtGQlV5eEZRVUZqTEVOQlFVTTdVVUYzUW5aRk96dFhRVVZITzFGQlEwc3NWMEZCVFN4SFFVRnRRaXhGUVVGRkxFTkJRVU03VVVGRmNFTTdPMWRCUlVjN1VVRkRTeXhqUVVGVExFZEJRVmtzUzBGQlN5eERRVUZETzBsQmNVVjJReXhEUVVGRE8wbEJPVVpIT3p0UFFVVkhPMGxCUTFjc2FVSkJRVTBzUjBGQmNFSTdVVUZEU1N4RlFVRkZMRU5CUVVNc1EwRkJReXhEUVVGRExGVkJRVlVzUTBGQlF5eFRRVUZUTEVOQlFVTXNRMEZCUXl4RFFVRkRPMWxCUTNoQ0xGVkJRVlVzUTBGQlF5eFhRVUZYTEVWQlFVVXNRMEZCUXp0UlFVTTNRaXhEUVVGRE8xRkJRMFFzVFVGQlRTeERRVUZETEZWQlFWVXNRMEZCUXl4VFFVRlRMRU5CUVVNN1NVRkRhRU1zUTBGQlF6dEpRVVZFT3p0UFFVVkhPMGxCUTFjc2MwSkJRVmNzUjBGQmVrSTdVVUZEU1N4VlFVRlZMRU5CUVVNc1UwRkJVeXhIUVVGSExFbEJRVWtzVlVGQlZTeEZRVUZGTEVOQlFVTTdTVUZETlVNc1EwRkJRenRKUVZsRU96dFBRVVZITzBsQlEwa3NNRUpCUVVzc1IwRkJXanRSUVVOSkxFMUJRVTBzUTBGQlF5eEpRVUZKTEVOQlFVTXNUVUZCVFN4RFFVRkRMRTFCUVUwc1MwRkJTeXhEUVVGRExFTkJRVU03U1VGRGNFTXNRMEZCUXp0SlFVVkVPenM3VDBGSFJ6dEpRVU5KTEhkQ1FVRkhMRWRCUVZZc1ZVRkJWeXhQUVVGdFFqdFJRVU14UWl4SlFVRkpMRU5CUVVNc1RVRkJUU3hEUVVGRExFbEJRVWtzUTBGQlF5eFBRVUZQTEVOQlFVTXNRMEZCUXp0UlFVTXhRaXhGUVVGRkxFTkJRVU1zUTBGQlF5eEpRVUZKTEVOQlFVTXNUVUZCVFN4RFFVRkRMRTFCUVUwc1MwRkJTeXhEUVVGRExFbEJRVWtzUTBGQlF5eEpRVUZKTEVOQlFVTXNVMEZCVXl4RFFVRkRMRU5CUVVNc1EwRkJRenRaUVVNNVF5eEpRVUZKTEVOQlFVTXNVMEZCVXl4RFFVRkRMRWxCUVVrc1EwRkJReXhKUVVGSkxFTkJRVU1zUTBGQlF6dFJRVU01UWl4RFFVRkRPMGxCUTB3c1EwRkJRenRKUVVWRU96czdUMEZIUnp0SlFVTkpMRGhDUVVGVExFZEJRV2hDTzFGQlEwa3NTVUZCU1N4TFFVRkxMRWRCUVVjc1EwRkJReXhKUVVGSkxFTkJRVU1zVFVGQlRTeERRVUZETEUxQlFVMHNTMEZCU3l4RFFVRkRMRU5CUVVNc1EwRkJRenRSUVVOMlF5eEpRVUZKTEZGQlFWRXNSMEZCUnl4SlFVRkpMRU5CUVVNc1UwRkJVeXhEUVVGRE8xRkJRemxDTEVsQlFVa3NRMEZCUXl4VFFVRlRMRWRCUVVjc1NVRkJTU3hEUVVGRE8xRkJRM1JDTEVsQlFVa3NRMEZCUXp0WlFVTkVMRWxCUVVrc1MwRkJTeXhIUVVGSExFbEJRVWtzUTBGQlF5eE5RVUZOTEVOQlFVTTdXVUZEZUVJc1NVRkJTU3hEUVVGRExFMUJRVTBzUjBGQlJ5eEZRVUZGTEVOQlFVTTdXVUZEYWtJc1IwRkJSeXhEUVVGRExFTkJRVU1zU1VGQlNTeERRVUZETEVkQlFVY3NRMEZCUXl4RlFVRkZMRU5CUVVNc1IwRkJSeXhMUVVGTExFTkJRVU1zVFVGQlRTeEZRVUZGTEVWQlFVVXNRMEZCUXl4RlFVRkZMRU5CUVVNN1owSkJRM0JETEV0QlFVc3NRMEZCUXl4RFFVRkRMRU5CUVVNc1JVRkJSU3hEUVVGRE8xbEJRMllzUTBGQlF6dFJRVU5NTEVOQlFVTTdaMEpCUVZNc1EwRkJRenRaUVVOUUxFbEJRVWtzUTBGQlF5eFRRVUZUTEVkQlFVY3NVVUZCVVN4RFFVRkRPMWxCUXpGQ0xFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTXNTMEZCU3l4SlFVRkpMRU5CUVVNc1VVRkJVU3hKUVVGSkxFbEJRVWtzUTBGQlF5eE5RVUZOTEVOQlFVTXNUVUZCVFN4TFFVRkxMRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU03WjBKQlEyeEVMRWxCUVVrc1EwRkJReXhWUVVGVkxFTkJRVU1zU1VGQlNTeERRVUZETEVsQlFVa3NRMEZCUXl4RFFVRkRPMWxCUXk5Q0xFTkJRVU03VVVGRFRDeERRVUZETzBsQlEwd3NRMEZCUXp0SlFVVkVPenM3T3p0UFFVdEhPMGxCUTBrc01FSkJRVXNzUjBGQldpeFZRVUZoTEZOQlFYTkNPMUZCUVhSQ0xIbENRVUZ6UWl4SFFVRjBRaXhqUVVGelFqdFJRVU12UWl4SlFVRkpMRXRCUVVzc1IwRkJSeXhEUVVGRExFbEJRVWtzUTBGQlF5eE5RVUZOTEVOQlFVTXNUVUZCVFN4TFFVRkxMRU5CUVVNc1EwRkJReXhEUVVGRE8xRkJRM1pETEVsQlFVa3NVVUZCVVN4SFFVRkhMRWxCUVVrc1EwRkJReXhUUVVGVExFTkJRVU03VVVGRE9VSXNTVUZCU1N4RFFVRkRMRk5CUVZNc1IwRkJSeXhKUVVGSkxFTkJRVU03VVVGRGRFSXNTVUZCU1N4RFFVRkRPMWxCUTBRc1NVRkJTU3hEUVVGRExFZEJRVWNzUTBGQlF5eERRVUZETzFsQlExWXNUMEZCVHl4SlFVRkpMRU5CUVVNc1RVRkJUU3hEUVVGRExFMUJRVTBzUjBGQlJ5eERRVUZETEVWQlFVVXNRMEZCUXp0blFrRkROVUlzUlVGQlJTeERRVUZETEVOQlFVTXNUMEZCVHl4VFFVRlRMRXRCUVVzc1VVRkJVU3hKUVVGSkxFTkJRVU1zU1VGQlNTeFRRVUZUTEVOQlFVTXNRMEZCUXl4RFFVRkRPMjlDUVVOc1JDeEpRVUZKTEVOQlFVTXNUVUZCVFN4SFFVRkhMRVZCUVVVc1EwRkJRenR2UWtGRGFrSXNUVUZCVFN4SlFVRkpMRXRCUVVzc1EwRkJReXc0UlVGQk9FVXNRMEZCUXl4RFFVRkRPMmRDUVVOd1J5eERRVUZETzJkQ1FVTkVMRWxCUVVrc1EwRkJReXhUUVVGVExFVkJRVVVzUTBGQlF6dG5Ra0ZEYWtJc1JVRkJSU3hEUVVGRExFTkJRVU03V1VGRFVpeERRVUZETzFGQlEwd3NRMEZCUXp0blFrRkJVeXhEUVVGRE8xbEJRMUFzU1VGQlNTeERRVUZETEZOQlFWTXNSMEZCUnl4UlFVRlJMRU5CUVVNN1dVRkRNVUlzUlVGQlJTeERRVUZETEVOQlFVTXNRMEZCUXl4TFFVRkxMRWxCUVVrc1EwRkJReXhSUVVGUkxFbEJRVWtzU1VGQlNTeERRVUZETEUxQlFVMHNRMEZCUXl4TlFVRk5MRXRCUVVzc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF6dG5Ra0ZEYkVRc1NVRkJTU3hEUVVGRExGVkJRVlVzUTBGQlF5eEpRVUZKTEVOQlFVTXNTVUZCU1N4RFFVRkRMRU5CUVVNN1dVRkRMMElzUTBGQlF6dFJRVU5NTEVOQlFVTTdTVUZEVEN4RFFVRkRPMGxCUTB3c2FVSkJRVU03UVVGQlJDeERRVUZETEVGQmFFaEVMRWxCWjBoRE8wRkJSVVE3YTBKQlFXVXNWVUZCVlN4RFFVRkRJbjA9IiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG4ndXNlIHN0cmljdCc7XHJcbnZhciBfX2V4dGVuZHMgPSAodGhpcyAmJiB0aGlzLl9fZXh0ZW5kcykgfHwgZnVuY3Rpb24gKGQsIGIpIHtcclxuICAgIGZvciAodmFyIHAgaW4gYikgaWYgKGIuaGFzT3duUHJvcGVydHkocCkpIGRbcF0gPSBiW3BdO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn07XHJcbnZhciBvYmplY3RzXzEgPSByZXF1aXJlKCcuL29iamVjdHMnKTtcclxudmFyIHN5bmNfZXZlbnRfMSA9IHJlcXVpcmUoJy4vc3luYy1ldmVudCcpO1xyXG52YXIgYXN5bmNfZXZlbnRfMSA9IHJlcXVpcmUoJy4vYXN5bmMtZXZlbnQnKTtcclxudmFyIHF1ZXVlZF9ldmVudF8xID0gcmVxdWlyZSgnLi9xdWV1ZWQtZXZlbnQnKTtcclxuKGZ1bmN0aW9uIChFdmVudFR5cGUpIHtcclxuICAgIEV2ZW50VHlwZVtFdmVudFR5cGVbXCJTeW5jXCJdID0gMF0gPSBcIlN5bmNcIjtcclxuICAgIEV2ZW50VHlwZVtFdmVudFR5cGVbXCJBc3luY1wiXSA9IDFdID0gXCJBc3luY1wiO1xyXG4gICAgRXZlbnRUeXBlW0V2ZW50VHlwZVtcIlF1ZXVlZFwiXSA9IDJdID0gXCJRdWV1ZWRcIjtcclxufSkoZXhwb3J0cy5FdmVudFR5cGUgfHwgKGV4cG9ydHMuRXZlbnRUeXBlID0ge30pKTtcclxudmFyIEV2ZW50VHlwZSA9IGV4cG9ydHMuRXZlbnRUeXBlO1xyXG47XHJcbi8qKlxyXG4gKiBBbiBldmVudCB0aGF0IGJlaGF2ZXMgbGlrZSBhIFN5bmMvQXN5bmMvUXVldWVkIGV2ZW50IGRlcGVuZGluZyBvbiBob3dcclxuICogeW91IHN1YnNjcmliZS5cclxuICovXHJcbnZhciBBbnlFdmVudCA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBBbnlFdmVudChvcHRzKSB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVW5kZXJseWluZyBldmVudCBpbXBsZW1lbnRhdGlvbnM7IG9uZSBmb3IgZXZlcnkgYXR0YWNoIHR5cGUgKyBvcHRzIGNvbWJpbmF0aW9uXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5fZXZlbnRzID0gW107XHJcbiAgICAgICAgaWYgKG9wdHMgJiYgb3B0cy5tb25pdG9yQXR0YWNoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0Rmlyc3RBdHRhY2hlZCA9IG5ldyBWb2lkQW55RXZlbnQoKTtcclxuICAgICAgICAgICAgdGhpcy5ldnRMYXN0RGV0YWNoZWQgPSBuZXcgVm9pZEFueUV2ZW50KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBzYW1lIGFzIGF0dGFjaFN5bmMvYXR0YWNoQXN5bmMvYXR0YWNoUXVldWVkOyBiYXNlZCBvbiB0aGUgZ2l2ZW4gZW51bVxyXG4gICAgICogQHBhcmFtIG1vZGUgZGV0ZXJtaW5lcyB3aGV0aGVyIHRvIGF0dGFjaCBzeW5jL2FzeW5jL3F1ZXVlZFxyXG4gICAgICovXHJcbiAgICBBbnlFdmVudC5wcm90b3R5cGUuYXR0YWNoID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHByZXZDb3VudCA9ICghIXRoaXMuZXZ0Rmlyc3RBdHRhY2hlZCA/IHRoaXMubGlzdGVuZXJDb3VudCgpIDogMCk7XHJcbiAgICAgICAgdmFyIG1vZGUgPSBFdmVudFR5cGUuU3luYztcclxuICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAwICYmIHR5cGVvZiBhcmdzWzBdID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICBtb2RlID0gYXJncy5zaGlmdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzd2l0Y2ggKG1vZGUpIHtcclxuICAgICAgICAgICAgY2FzZSBFdmVudFR5cGUuU3luYzpcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBhZGQgb3Vyc2VsdmVzIGFzIGRlZmF1bHQgJ2JvdW5kVG8nIGFyZ3VtZW50XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzLnVuc2hpZnQodGhpcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBldmVudF8xO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9ldmVudHNbaV0gaW5zdGFuY2VvZiBzeW5jX2V2ZW50XzEuU3luY0V2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudF8xID0gdGhpcy5fZXZlbnRzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghZXZlbnRfMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudF8xID0gbmV3IHN5bmNfZXZlbnRfMS5TeW5jRXZlbnQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzLnB1c2goZXZlbnRfMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50XzEuYXR0YWNoLmFwcGx5KGV2ZW50XzEsIGFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLkFzeW5jOlxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBvcHRzID0gdm9pZCAwO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDEgJiYgdHlwZW9mIGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0cyA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIG91cnNlbHZlcyBhcyBkZWZhdWx0ICdib3VuZFRvJyBhcmd1bWVudFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDAgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXJncy51bnNoaWZ0KHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB2YXIgZXZlbnRfMjtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fZXZlbnRzW2ldIGluc3RhbmNlb2YgYXN5bmNfZXZlbnRfMS5Bc3luY0V2ZW50XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAmJiBvYmplY3RzXzEuc2hhbGxvd0VxdWFscyh0aGlzLl9ldmVudHNbaV0ub3B0aW9ucywgb3B0cykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50XzIgPSB0aGlzLl9ldmVudHNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFldmVudF8yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50XzIgPSBuZXcgYXN5bmNfZXZlbnRfMS5Bc3luY0V2ZW50KG9wdHMpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHMucHVzaChldmVudF8yKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRfMi5hdHRhY2guYXBwbHkoZXZlbnRfMiwgYXJncyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBFdmVudFR5cGUuUXVldWVkOlxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBvcHRzID0gdm9pZCAwO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDEgJiYgdHlwZW9mIGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0cyA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIG91cnNlbHZlcyBhcyBkZWZhdWx0ICdib3VuZFRvJyBhcmd1bWVudFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDAgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXJncy51bnNoaWZ0KHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB2YXIgZXZlbnRfMztcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fZXZlbnRzW2ldIGluc3RhbmNlb2YgcXVldWVkX2V2ZW50XzEuUXVldWVkRXZlbnRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICYmIG9iamVjdHNfMS5zaGFsbG93RXF1YWxzKHRoaXMuX2V2ZW50c1tpXS5vcHRpb25zLCBvcHRzKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRfMyA9IHRoaXMuX2V2ZW50c1tpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWV2ZW50XzMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRfMyA9IG5ldyBxdWV1ZWRfZXZlbnRfMS5RdWV1ZWRFdmVudChvcHRzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzLnB1c2goZXZlbnRfMyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50XzMuYXR0YWNoLmFwcGx5KGV2ZW50XzMsIGFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vua25vd24gRXZlbnRUeXBlJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmV2dEZpcnN0QXR0YWNoZWQgJiYgcHJldkNvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0Rmlyc3RBdHRhY2hlZC5wb3N0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGV2ZW50IGhhbmRsZXJzIGFzIGlmIGl0IHdlcmUgYSBzeW5jIGV2ZW50LiBJdCBpcyBzaW1wbHkgY2FsbGVkICdhdHRhY2gnXHJcbiAgICAgKiBzbyB0aGF0IHRoaXMgY2xhc3MgYWRoZXJlcyB0byB0aGUgQmFzZUV2ZW50PFQ+IHNpZ25hdHVyZS5cclxuICAgICAqL1xyXG4gICAgQW55RXZlbnQucHJvdG90eXBlLmF0dGFjaFN5bmMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGFyZ3MgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgYXJndW1lbnRzLmxlbmd0aDsgX2krKykge1xyXG4gICAgICAgICAgICBhcmdzW19pIC0gMF0gPSBhcmd1bWVudHNbX2ldO1xyXG4gICAgICAgIH1cclxuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLlN5bmMpO1xyXG4gICAgICAgIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGV2ZW50IGhhbmRsZXJzIGFzIGlmIGl0IHdlcmUgYSBhLXN5bmMgZXZlbnRcclxuICAgICAqL1xyXG4gICAgQW55RXZlbnQucHJvdG90eXBlLmF0dGFjaEFzeW5jID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYXJncy51bnNoaWZ0KEV2ZW50VHlwZS5Bc3luYyk7XHJcbiAgICAgICAgdGhpcy5hdHRhY2guYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggZXZlbnQgaGFuZGxlcnMgYXMgaWYgaXQgd2VyZSBhIHF1ZXVlZCBldmVudFxyXG4gICAgICovXHJcbiAgICBBbnlFdmVudC5wcm90b3R5cGUuYXR0YWNoUXVldWVkID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYXJncy51bnNoaWZ0KEV2ZW50VHlwZS5RdWV1ZWQpO1xyXG4gICAgICAgIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogRGV0YWNoIGV2ZW50IGhhbmRsZXJzIHJlZ2FyZGxlc3Mgb2YgdHlwZVxyXG4gICAgICovXHJcbiAgICBBbnlFdmVudC5wcm90b3R5cGUuZGV0YWNoID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHByZXZDb3VudCA9ICghIXRoaXMuZXZ0TGFzdERldGFjaGVkID8gdGhpcy5saXN0ZW5lckNvdW50KCkgOiAwKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB0aGlzLl9ldmVudHNbaV0uZGV0YWNoLmFwcGx5KHRoaXMuX2V2ZW50c1tpXSwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghIXRoaXMuZXZ0TGFzdERldGFjaGVkICYmIHByZXZDb3VudCA+IDAgJiYgdGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy5ldnRMYXN0RGV0YWNoZWQucG9zdCgpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFBvc3QgYW4gZXZlbnQgdG8gYWxsIGN1cnJlbnQgbGlzdGVuZXJzXHJcbiAgICAgKi9cclxuICAgIEFueUV2ZW50LnByb3RvdHlwZS5wb3N0ID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYXJyYXkgZmlyc3QgdG8gY292ZXIgdGhlIGNhc2Ugd2hlcmUgZXZlbnQgaGFuZGxlcnNcclxuICAgICAgICAvLyBhcmUgYXR0YWNoZWQgZHVyaW5nIHRoZSBwb3N0XHJcbiAgICAgICAgdmFyIGV2ZW50cyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGV2ZW50cy5wdXNoKHRoaXMuX2V2ZW50c1tpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIDtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBldmVudHNbaV0ucG9zdChkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGF0dGFjaGVkIGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBBbnlFdmVudC5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gMDtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICByZXN1bHQgKz0gdGhpcy5fZXZlbnRzW2ldLmxpc3RlbmVyQ291bnQoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcbiAgICByZXR1cm4gQW55RXZlbnQ7XHJcbn0oKSk7XHJcbmV4cG9ydHMuQW55RXZlbnQgPSBBbnlFdmVudDtcclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBBbnlFdmVudHMgd2l0aG91dCBkYXRhXHJcbiAqL1xyXG52YXIgVm9pZEFueUV2ZW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhWb2lkQW55RXZlbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBWb2lkQW55RXZlbnQoKSB7XHJcbiAgICAgICAgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuXHJcbiAgICAgKi9cclxuICAgIFZvaWRBbnlFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBfc3VwZXIucHJvdG90eXBlLnBvc3QuY2FsbCh0aGlzLCB1bmRlZmluZWQpO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBWb2lkQW55RXZlbnQ7XHJcbn0oQW55RXZlbnQpKTtcclxuZXhwb3J0cy5Wb2lkQW55RXZlbnQgPSBWb2lkQW55RXZlbnQ7XHJcbi8qKlxyXG4gKiBTaW1pbGFyIHRvICdlcnJvcicgZXZlbnQgb24gRXZlbnRFbWl0dGVyOiB0aHJvd3Mgd2hlbiBhIHBvc3QoKSBvY2N1cnMgd2hpbGUgbm8gaGFuZGxlcnMgc2V0LlxyXG4gKi9cclxudmFyIEVycm9yQW55RXZlbnQgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKEVycm9yQW55RXZlbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBFcnJvckFueUV2ZW50KCkge1xyXG4gICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG4gICAgRXJyb3JBbnlFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImVycm9yIGV2ZW50IHBvc3RlZCB3aGlsZSBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuIEVycm9yOiBcIiArIGRhdGEubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIF9zdXBlci5wcm90b3R5cGUucG9zdC5jYWxsKHRoaXMsIGRhdGEpO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBFcnJvckFueUV2ZW50O1xyXG59KEFueUV2ZW50KSk7XHJcbmV4cG9ydHMuRXJyb3JBbnlFdmVudCA9IEVycm9yQW55RXZlbnQ7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaVlXNTVMV1YyWlc1MExtcHpJaXdpYzI5MWNtTmxVbTl2ZENJNklpSXNJbk52ZFhKalpYTWlPbHNpTGk0dkxpNHZjM0pqTDJ4cFlpOWhibmt0WlhabGJuUXVkSE1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJa0ZCUVVFc0swUkJRU3RFTzBGQlF5OUVMR1ZCUVdVN1FVRkZaaXhaUVVGWkxFTkJRVU03T3pzN096dEJRVVZpTEhkQ1FVRTBRaXhYUVVGWExFTkJRVU1zUTBGQlFUdEJRVWQ0UXl3eVFrRkJkMElzWTBGQll5eERRVUZETEVOQlFVRTdRVUZEZGtNc05FSkJRWGxETEdWQlFXVXNRMEZCUXl4RFFVRkJPMEZCUTNwRUxEWkNRVUV5UXl4blFrRkJaMElzUTBGQlF5eERRVUZCTzBGQlJUVkVMRmRCUVZrc1UwRkJVenRKUVVOcVFpeDVRMEZCU1N4RFFVRkJPMGxCUTBvc01rTkJRVXNzUTBGQlFUdEpRVU5NTERaRFFVRk5MRU5CUVVFN1FVRkRWaXhEUVVGRExFVkJTbGNzYVVKQlFWTXNTMEZCVkN4cFFrRkJVeXhSUVVsd1FqdEJRVXBFTEVsQlFWa3NVMEZCVXl4SFFVRlVMR2xDUVVsWUxFTkJRVUU3UVVGQlFTeERRVUZETzBGQlUwWTdPenRIUVVkSE8wRkJRMGc3U1VGclFra3NhMEpCUVZrc1NVRkJiVUk3VVVGTUwwSTdPMWRCUlVjN1VVRkRTeXhaUVVGUExFZEJRVzFDTEVWQlFVVXNRMEZCUXp0UlFVZHFReXhGUVVGRkxFTkJRVU1zUTBGQlF5eEpRVUZKTEVsQlFVa3NTVUZCU1N4RFFVRkRMR0ZCUVdFc1EwRkJReXhEUVVGRExFTkJRVU03V1VGRE4wSXNTVUZCU1N4RFFVRkRMR2RDUVVGblFpeEhRVUZITEVsQlFVa3NXVUZCV1N4RlFVRkZMRU5CUVVNN1dVRkRNME1zU1VGQlNTeERRVUZETEdWQlFXVXNSMEZCUnl4SlFVRkpMRmxCUVZrc1JVRkJSU3hEUVVGRE8xRkJRemxETEVOQlFVTTdTVUZEVEN4RFFVRkRPMGxCVVVRN096dFBRVWRITzBsQlEwa3NlVUpCUVUwc1IwRkJZanRSUVVGakxHTkJRV003WVVGQlpDeFhRVUZqTEVOQlFXUXNjMEpCUVdNc1EwRkJaQ3hKUVVGak8xbEJRV1FzTmtKQlFXTTdPMUZCUTNoQ0xFbEJRVTBzVTBGQlV5eEhRVUZITEVOQlFVTXNRMEZCUXl4RFFVRkRMRWxCUVVrc1EwRkJReXhuUWtGQlowSXNSMEZCUnl4SlFVRkpMRU5CUVVNc1lVRkJZU3hGUVVGRkxFZEJRVWNzUTBGQlF5eERRVUZETEVOQlFVTTdVVUZEZGtVc1NVRkJTU3hKUVVGSkxFZEJRVWNzVTBGQlV5eERRVUZETEVsQlFVa3NRMEZCUXp0UlFVTXhRaXhGUVVGRkxFTkJRVU1zUTBGQlF5eEpRVUZKTEVOQlFVTXNUVUZCVFN4SFFVRkhMRU5CUVVNc1NVRkJTU3hQUVVGUExFbEJRVWtzUTBGQlF5eERRVUZETEVOQlFVTXNTMEZCU3l4UlFVRlJMRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRMnBFTEVsQlFVa3NSMEZCUnl4SlFVRkpMRU5CUVVNc1MwRkJTeXhGUVVGbExFTkJRVU03VVVGRGNrTXNRMEZCUXp0UlFVTkVMRTFCUVUwc1EwRkJReXhEUVVGRExFbEJRVWtzUTBGQlF5eERRVUZETEVOQlFVTTdXVUZEV0N4TFFVRkxMRk5CUVZNc1EwRkJReXhKUVVGSk8yZENRVUZGTEVOQlFVTTdiMEpCUTJ4Q0xEaERRVUU0UXp0dlFrRkRPVU1zUlVGQlJTeERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRTFCUVUwc1IwRkJSeXhEUVVGRExFbEJRVWtzVDBGQlR5eEpRVUZKTEVOQlFVTXNRMEZCUXl4RFFVRkRMRXRCUVVzc1ZVRkJWU3hEUVVGRExFTkJRVU1zUTBGQlF6dDNRa0ZEYmtRc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF5eEpRVUZKTEVOQlFVTXNRMEZCUXp0dlFrRkRka0lzUTBGQlF6dHZRa0ZEUkN4SlFVRkpMRTlCUVcxQ0xFTkJRVU03YjBKQlEzaENMRWRCUVVjc1EwRkJReXhEUVVGRExFbEJRVWtzUTBGQlF5eEhRVUZITEVOQlFVTXNSVUZCUlN4RFFVRkRMRWRCUVVjc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF5eE5RVUZOTEVWQlFVVXNSVUZCUlN4RFFVRkRMRVZCUVVVc1EwRkJRenQzUWtGRE0wTXNSVUZCUlN4RFFVRkRMRU5CUVVNc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF5eERRVUZETEVOQlFVTXNXVUZCV1N4elFrRkJVeXhEUVVGRExFTkJRVU1zUTBGQlF6czBRa0ZEZGtNc1QwRkJTeXhIUVVGSExFbEJRVWtzUTBGQlF5eFBRVUZQTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN2QwSkJRelZDTEVOQlFVTTdiMEpCUTB3c1EwRkJRenR2UWtGRFJDeEZRVUZGTEVOQlFVTXNRMEZCUXl4RFFVRkRMRTlCUVVzc1EwRkJReXhEUVVGRExFTkJRVU03ZDBKQlExUXNUMEZCU3l4SFFVRkhMRWxCUVVrc2MwSkJRVk1zUlVGQlN5eERRVUZETzNkQ1FVTXpRaXhKUVVGSkxFTkJRVU1zVDBGQlR5eERRVUZETEVsQlFVa3NRMEZCUXl4UFFVRkxMRU5CUVVNc1EwRkJRenR2UWtGRE4wSXNRMEZCUXp0dlFrRkRSQ3hQUVVGTExFTkJRVU1zVFVGQlRTeERRVUZETEV0QlFVc3NRMEZCUXl4UFFVRkxMRVZCUVVVc1NVRkJTU3hEUVVGRExFTkJRVU03WjBKQlEzQkRMRU5CUVVNN1owSkJRVU1zUzBGQlN5eERRVUZETzFsQlExSXNTMEZCU3l4VFFVRlRMRU5CUVVNc1MwRkJTenRuUWtGQlJTeERRVUZETzI5Q1FVTnVRaXhKUVVGSkxFbEJRVWtzVTBGQlowSXNRMEZCUXp0dlFrRkRla0lzUlVGQlJTeERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRTFCUVUwc1IwRkJSeXhEUVVGRExFbEJRVWtzVDBGQlR5eEpRVUZKTEVOQlFVTXNTVUZCU1N4RFFVRkRMRTFCUVUwc1IwRkJSeXhEUVVGRExFTkJRVU1zUzBGQlN5eFJRVUZSTEVOQlFVTXNRMEZCUXl4RFFVRkRPM2RDUVVNdlJDeEpRVUZKTEVkQlFVY3NTVUZCU1N4RFFVRkRMRWxCUVVrc1EwRkJReXhOUVVGTkxFZEJRVWNzUTBGQlF5eERRVUZETEVOQlFVTTdiMEpCUTJwRExFTkJRVU03YjBKQlEwUXNPRU5CUVRoRE8yOUNRVU01UXl4RlFVRkZMRU5CUVVNc1EwRkJReXhKUVVGSkxFTkJRVU1zVFVGQlRTeEhRVUZITEVOQlFVTXNTVUZCU1N4UFFVRlBMRWxCUVVrc1EwRkJReXhEUVVGRExFTkJRVU1zUzBGQlN5eFZRVUZWTEVOQlFVTXNRMEZCUXl4RFFVRkRPM2RDUVVOdVJDeEpRVUZKTEVOQlFVTXNUMEZCVHl4RFFVRkRMRWxCUVVrc1EwRkJReXhEUVVGRE8yOUNRVU4yUWl4RFFVRkRPMjlDUVVORUxFbEJRVWtzVDBGQmJVSXNRMEZCUXp0dlFrRkRlRUlzUjBGQlJ5eERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRWRCUVVjc1EwRkJReXhGUVVGRkxFTkJRVU1zUjBGQlJ5eEpRVUZKTEVOQlFVTXNUMEZCVHl4RFFVRkRMRTFCUVUwc1JVRkJSU3hGUVVGRkxFTkJRVU1zUlVGQlJTeERRVUZETzNkQ1FVTXpReXhGUVVGRkxFTkJRVU1zUTBGQlF5eEpRVUZKTEVOQlFVTXNUMEZCVHl4RFFVRkRMRU5CUVVNc1EwRkJReXhaUVVGWkxIZENRVUZWT3l0Q1FVTnNReXgxUWtGQllTeERRVUZwUWl4SlFVRkpMRU5CUVVNc1QwRkJUeXhEUVVGRExFTkJRVU1zUTBGQlJTeERRVUZETEU5QlFVOHNSVUZCUlN4SlFVRkpMRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU03TkVKQlEyNUZMRTlCUVVzc1IwRkJSeXhKUVVGSkxFTkJRVU1zVDBGQlR5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPM2RDUVVNMVFpeERRVUZETzI5Q1FVTk1MRU5CUVVNN2IwSkJRMFFzUlVGQlJTeERRVUZETEVOQlFVTXNRMEZCUXl4UFFVRkxMRU5CUVVNc1EwRkJReXhEUVVGRE8zZENRVU5VTEU5QlFVc3NSMEZCUnl4SlFVRkpMSGRDUVVGVkxFTkJRVWtzU1VGQlNTeERRVUZETEVOQlFVTTdkMEpCUTJoRExFbEJRVWtzUTBGQlF5eFBRVUZQTEVOQlFVTXNTVUZCU1N4RFFVRkRMRTlCUVVzc1EwRkJReXhEUVVGRE8yOUNRVU0zUWl4RFFVRkRPMjlDUVVORUxFOUJRVXNzUTBGQlF5eE5RVUZOTEVOQlFVTXNTMEZCU3l4RFFVRkRMRTlCUVVzc1JVRkJSU3hKUVVGSkxFTkJRVU1zUTBGQlF6dG5Ra0ZEY0VNc1EwRkJRenRuUWtGQlF5eExRVUZMTEVOQlFVTTdXVUZEVWl4TFFVRkxMRk5CUVZNc1EwRkJReXhOUVVGTk8yZENRVUZGTEVOQlFVTTdiMEpCUTNCQ0xFbEJRVWtzU1VGQlNTeFRRVUZwUWl4RFFVRkRPMjlDUVVNeFFpeEZRVUZGTEVOQlFVTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1RVRkJUU3hIUVVGSExFTkJRVU1zU1VGQlNTeFBRVUZQTEVsQlFVa3NRMEZCUXl4SlFVRkpMRU5CUVVNc1RVRkJUU3hIUVVGSExFTkJRVU1zUTBGQlF5eExRVUZMTEZGQlFWRXNRMEZCUXl4RFFVRkRMRU5CUVVNN2QwSkJReTlFTEVsQlFVa3NSMEZCUnl4SlFVRkpMRU5CUVVNc1NVRkJTU3hEUVVGRExFMUJRVTBzUjBGQlJ5eERRVUZETEVOQlFVTXNRMEZCUXp0dlFrRkRha01zUTBGQlF6dHZRa0ZEUkN3NFEwRkJPRU03YjBKQlF6bERMRVZCUVVVc1EwRkJReXhEUVVGRExFbEJRVWtzUTBGQlF5eE5RVUZOTEVkQlFVY3NRMEZCUXl4SlFVRkpMRTlCUVU4c1NVRkJTU3hEUVVGRExFTkJRVU1zUTBGQlF5eExRVUZMTEZWQlFWVXNRMEZCUXl4RFFVRkRMRU5CUVVNN2QwSkJRMjVFTEVsQlFVa3NRMEZCUXl4UFFVRlBMRU5CUVVNc1NVRkJTU3hEUVVGRExFTkJRVU03YjBKQlEzWkNMRU5CUVVNN2IwSkJRMFFzU1VGQlNTeFBRVUZ0UWl4RFFVRkRPMjlDUVVONFFpeEhRVUZITEVOQlFVTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1IwRkJSeXhEUVVGRExFVkJRVVVzUTBGQlF5eEhRVUZITEVsQlFVa3NRMEZCUXl4UFFVRlBMRU5CUVVNc1RVRkJUU3hGUVVGRkxFVkJRVVVzUTBGQlF5eEZRVUZGTEVOQlFVTTdkMEpCUXpORExFVkJRVVVzUTBGQlF5eERRVUZETEVsQlFVa3NRMEZCUXl4UFFVRlBMRU5CUVVNc1EwRkJReXhEUVVGRExGbEJRVmtzTUVKQlFWYzdLMEpCUTI1RExIVkNRVUZoTEVOQlFXdENMRWxCUVVrc1EwRkJReXhQUVVGUExFTkJRVU1zUTBGQlF5eERRVUZGTEVOQlFVTXNUMEZCVHl4RlFVRkZMRWxCUVVrc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF6czBRa0ZEY0VVc1QwRkJTeXhIUVVGSExFbEJRVWtzUTBGQlF5eFBRVUZQTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN2QwSkJRelZDTEVOQlFVTTdiMEpCUTB3c1EwRkJRenR2UWtGRFJDeEZRVUZGTEVOQlFVTXNRMEZCUXl4RFFVRkRMRTlCUVVzc1EwRkJReXhEUVVGRExFTkJRVU03ZDBKQlExUXNUMEZCU3l4SFFVRkhMRWxCUVVrc01FSkJRVmNzUTBGQlNTeEpRVUZKTEVOQlFVTXNRMEZCUXp0M1FrRkRha01zU1VGQlNTeERRVUZETEU5QlFVOHNRMEZCUXl4SlFVRkpMRU5CUVVNc1QwRkJTeXhEUVVGRExFTkJRVU03YjBKQlF6ZENMRU5CUVVNN2IwSkJRMFFzVDBGQlN5eERRVUZETEUxQlFVMHNRMEZCUXl4TFFVRkxMRU5CUVVNc1QwRkJTeXhGUVVGRkxFbEJRVWtzUTBGQlF5eERRVUZETzJkQ1FVTndReXhEUVVGRE8yZENRVUZETEV0QlFVc3NRMEZCUXp0WlFVTlNPMmRDUVVOSkxFMUJRVTBzU1VGQlNTeExRVUZMTEVOQlFVTXNiVUpCUVcxQ0xFTkJRVU1zUTBGQlF6dFJRVU0zUXl4RFFVRkRPMUZCUTBRc1JVRkJSU3hEUVVGRExFTkJRVU1zU1VGQlNTeERRVUZETEdkQ1FVRm5RaXhKUVVGSkxGTkJRVk1zUzBGQlN5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPMWxCUXpORExFbEJRVWtzUTBGQlF5eG5Ra0ZCWjBJc1EwRkJReXhKUVVGSkxFVkJRVVVzUTBGQlF6dFJRVU5xUXl4RFFVRkRPMGxCUTB3c1EwRkJRenRKUVV0RU96czdUMEZIUnp0SlFVTkpMRFpDUVVGVkxFZEJRV3BDTzFGQlFXdENMR05CUVdNN1lVRkJaQ3hYUVVGakxFTkJRV1FzYzBKQlFXTXNRMEZCWkN4SlFVRmpPMWxCUVdRc05rSkJRV003TzFGQlF6VkNMRWxCUVVrc1EwRkJReXhQUVVGUExFTkJRVU1zVTBGQlV5eERRVUZETEVsQlFVa3NRMEZCUXl4RFFVRkRPMUZCUXpkQ0xFbEJRVWtzUTBGQlF5eE5RVUZOTEVOQlFVTXNTMEZCU3l4RFFVRkRMRWxCUVVrc1JVRkJSU3hKUVVGSkxFTkJRVU1zUTBGQlF6dEpRVU5zUXl4RFFVRkRPMGxCUzBRN08wOUJSVWM3U1VGRFNTdzRRa0ZCVnl4SFFVRnNRanRSUVVGdFFpeGpRVUZqTzJGQlFXUXNWMEZCWXl4RFFVRmtMSE5DUVVGakxFTkJRV1FzU1VGQll6dFpRVUZrTERaQ1FVRmpPenRSUVVNM1FpeEpRVUZKTEVOQlFVTXNUMEZCVHl4RFFVRkRMRk5CUVZNc1EwRkJReXhMUVVGTExFTkJRVU1zUTBGQlF6dFJRVU01UWl4SlFVRkpMRU5CUVVNc1RVRkJUU3hEUVVGRExFdEJRVXNzUTBGQlF5eEpRVUZKTEVWQlFVVXNTVUZCU1N4RFFVRkRMRU5CUVVNN1NVRkRiRU1zUTBGQlF6dEpRVXRFT3p0UFFVVkhPMGxCUTBrc0swSkJRVmtzUjBGQmJrSTdVVUZCYjBJc1kwRkJZenRoUVVGa0xGZEJRV01zUTBGQlpDeHpRa0ZCWXl4RFFVRmtMRWxCUVdNN1dVRkJaQ3cyUWtGQll6czdVVUZET1VJc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF5eFRRVUZUTEVOQlFVTXNUVUZCVFN4RFFVRkRMRU5CUVVNN1VVRkRMMElzU1VGQlNTeERRVUZETEUxQlFVMHNRMEZCUXl4TFFVRkxMRU5CUVVNc1NVRkJTU3hGUVVGRkxFbEJRVWtzUTBGQlF5eERRVUZETzBsQlEyeERMRU5CUVVNN1NVRlBSRHM3VDBGRlJ6dEpRVU5KTEhsQ1FVRk5MRWRCUVdJN1VVRkJZeXhqUVVGak8yRkJRV1FzVjBGQll5eERRVUZrTEhOQ1FVRmpMRU5CUVdRc1NVRkJZenRaUVVGa0xEWkNRVUZqT3p0UlFVTjRRaXhKUVVGTkxGTkJRVk1zUjBGQlJ5eERRVUZETEVOQlFVTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1pVRkJaU3hIUVVGSExFbEJRVWtzUTBGQlF5eGhRVUZoTEVWQlFVVXNSMEZCUnl4RFFVRkRMRU5CUVVNc1EwRkJRenRSUVVOMFJTeEhRVUZITEVOQlFVTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1IwRkJSeXhEUVVGRExFVkJRVVVzUTBGQlF5eEhRVUZITEVsQlFVa3NRMEZCUXl4UFFVRlBMRU5CUVVNc1RVRkJUU3hGUVVGRkxFVkJRVVVzUTBGQlF5eEZRVUZGTEVOQlFVTTdXVUZETTBNc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4TlFVRk5MRU5CUVVNc1MwRkJTeXhEUVVGRExFbEJRVWtzUTBGQlF5eFBRVUZQTEVOQlFVTXNRMEZCUXl4RFFVRkRMRVZCUVVVc1NVRkJTU3hEUVVGRExFTkJRVU03VVVGRGVFUXNRMEZCUXp0UlFVTkVMRVZCUVVVc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF5eEpRVUZKTEVOQlFVTXNaVUZCWlN4SlFVRkpMRk5CUVZNc1IwRkJSeXhEUVVGRExFbEJRVWtzU1VGQlNTeERRVUZETEdGQlFXRXNSVUZCUlN4TFFVRkxMRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU03V1VGRGVFVXNTVUZCU1N4RFFVRkRMR1ZCUVdVc1EwRkJReXhKUVVGSkxFVkJRVVVzUTBGQlF6dFJRVU5vUXl4RFFVRkRPMGxCUTB3c1EwRkJRenRKUVVWRU96dFBRVVZITzBsQlEwa3NkVUpCUVVrc1IwRkJXQ3hWUVVGWkxFbEJRVTg3VVVGRFppeDNSVUZCZDBVN1VVRkRlRVVzSzBKQlFTdENPMUZCUXk5Q0xFbEJRVTBzVFVGQlRTeEhRVUZ0UWl4RlFVRkZMRU5CUVVNN1VVRkRiRU1zUjBGQlJ5eERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRWRCUVVjc1EwRkJReXhGUVVGRkxFTkJRVU1zUjBGQlJ5eEpRVUZKTEVOQlFVTXNUMEZCVHl4RFFVRkRMRTFCUVUwc1JVRkJSU3hGUVVGRkxFTkJRVU1zUlVGQlJTeERRVUZETzFsQlF6TkRMRTFCUVUwc1EwRkJReXhKUVVGSkxFTkJRVU1zU1VGQlNTeERRVUZETEU5QlFVOHNRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xRkJRMnBETEVOQlFVTTdVVUZCUVN4RFFVRkRPMUZCUTBZc1IwRkJSeXhEUVVGRExFTkJRVU1zU1VGQlNTeERRVUZETEVkQlFVY3NRMEZCUXl4RlFVRkZMRU5CUVVNc1IwRkJSeXhOUVVGTkxFTkJRVU1zVFVGQlRTeEZRVUZGTEVWQlFVVXNRMEZCUXl4RlFVRkZMRU5CUVVNN1dVRkRja01zVFVGQlRTeERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRMRWxCUVVrc1EwRkJReXhKUVVGSkxFTkJRVU1zUTBGQlF6dFJRVU42UWl4RFFVRkRPMGxCUTB3c1EwRkJRenRKUVVWRU96dFBRVVZITzBsQlEwa3NaME5CUVdFc1IwRkJjRUk3VVVGRFNTeEpRVUZKTEUxQlFVMHNSMEZCUnl4RFFVRkRMRU5CUVVNN1VVRkRaaXhIUVVGSExFTkJRVU1zUTBGQlF5eEpRVUZKTEVOQlFVTXNSMEZCUnl4RFFVRkRMRVZCUVVVc1EwRkJReXhIUVVGSExFbEJRVWtzUTBGQlF5eFBRVUZQTEVOQlFVTXNUVUZCVFN4RlFVRkZMRVZCUVVVc1EwRkJReXhGUVVGRkxFTkJRVU03V1VGRE0wTXNUVUZCVFN4SlFVRkpMRWxCUVVrc1EwRkJReXhQUVVGUExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNZVUZCWVN4RlFVRkZMRU5CUVVNN1VVRkRPVU1zUTBGQlF6dFJRVU5FTEUxQlFVMHNRMEZCUXl4TlFVRk5MRU5CUVVNN1NVRkRiRUlzUTBGQlF6dEpRVU5NTEdWQlFVTTdRVUZCUkN4RFFVRkRMRUZCTlV4RUxFbEJORXhETzBGQk5VeFpMR2RDUVVGUkxGZEJORXh3UWl4RFFVRkJPMEZCUlVRN08wZEJSVWM3UVVGRFNEdEpRVUZyUXl4blEwRkJZenRKUVVGb1JEdFJRVUZyUXl3NFFrRkJZenRKUVZGb1JDeERRVUZETzBsQlRrYzdPMDlCUlVjN1NVRkRTU3d5UWtGQlNTeEhRVUZZTzFGQlEwa3NaMEpCUVVzc1EwRkJReXhKUVVGSkxGbEJRVU1zVTBGQlV5eERRVUZETEVOQlFVTTdTVUZETVVJc1EwRkJRenRKUVVOTUxHMUNRVUZETzBGQlFVUXNRMEZCUXl4QlFWSkVMRU5CUVd0RExGRkJRVkVzUjBGUmVrTTdRVUZTV1N4dlFrRkJXU3hsUVZGNFFpeERRVUZCTzBGQlJVUTdPMGRCUlVjN1FVRkRTRHRKUVVGdFF5eHBRMEZCWlR0SlFVRnNSRHRSUVVGdFF5dzRRa0ZCWlR0SlFWRnNSQ3hEUVVGRE8wbEJUbFVzTkVKQlFVa3NSMEZCV0N4VlFVRlpMRWxCUVZjN1VVRkRia0lzUlVGQlJTeERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMR0ZCUVdFc1JVRkJSU3hMUVVGTExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdXVUZETjBJc1RVRkJUU3hKUVVGSkxFdEJRVXNzUTBGQlF5dzBSRUZCTUVRc1NVRkJTU3hEUVVGRExFOUJRVk1zUTBGQlF5eERRVUZETzFGQlF6bEdMRU5CUVVNN1VVRkRSQ3huUWtGQlN5eERRVUZETEVsQlFVa3NXVUZCUXl4SlFVRkpMRU5CUVVNc1EwRkJRenRKUVVOeVFpeERRVUZETzBsQlEwd3NiMEpCUVVNN1FVRkJSQ3hEUVVGRExFRkJVa1FzUTBGQmJVTXNVVUZCVVN4SFFWRXhRenRCUVZKWkxIRkNRVUZoTEdkQ1FWRjZRaXhEUVVGQkluMD0iLCIvLyBDb3B5cmlnaHQgKGMpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcbid1c2Ugc3RyaWN0JztcclxudmFyIF9fZXh0ZW5kcyA9ICh0aGlzICYmIHRoaXMuX19leHRlbmRzKSB8fCBmdW5jdGlvbiAoZCwgYikge1xyXG4gICAgZm9yICh2YXIgcCBpbiBiKSBpZiAoYi5oYXNPd25Qcm9wZXJ0eShwKSkgZFtwXSA9IGJbcF07XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufTtcclxudmFyIGJhc2VfZXZlbnRfMSA9IHJlcXVpcmUoJy4vYmFzZS1ldmVudCcpO1xyXG4vKipcclxuICogQS1zeW5jaHJvbm91cyBldmVudC4gSGFuZGxlcnMgYXJlIGNhbGxlZCBpbiB0aGUgbmV4dCBOb2RlLkpTIGN5Y2xlLlxyXG4gKiAtIE9wdGlvbmFsbHkgY29uZGVuc2VzIG11bHRpcGxlIHBvc3QoKSBjYWxscyBpbnRvIG9uZSAodGhlIGxhc3QgcG9zdCgpIGdldHMgdGhyb3VnaClcclxuICogLSBIYW5kbGVycyBhcmUgY2FsbGVkIG9ubHkgZm9yIGV2ZW50cyBwb3N0ZWQgYWZ0ZXIgdGhleSB3ZXJlIGF0dGFjaGVkLlxyXG4gKiAtIEhhbmRsZXJzIGFyZSBub3QgY2FsbGVkIGFueW1vcmUgd2hlbiB0aGV5IGFyZSBkZXRhY2hlZCwgZXZlbiBpZiBhIHBvc3QoKSBpcyBpbiBwcm9ncmVzc1xyXG4gKi9cclxudmFyIEFzeW5jRXZlbnQgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKEFzeW5jRXZlbnQsIF9zdXBlcik7XHJcbiAgICAvKipcclxuICAgICAqIENvbnN0cnVjdG9yXHJcbiAgICAgKiBAcGFyYW0gb3B0cyBPcHRpb25hbC4gVmFyaW91cyBzZXR0aW5nczpcclxuICAgICAqICAgICAgICAgICAgIC0gY29uZGVuc2VkOiBhIEJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRvIGNvbmRlbnNlIG11bHRpcGxlIHBvc3QoKSBjYWxscyB3aXRoaW4gdGhlIHNhbWUgY3ljbGUuXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIEFzeW5jRXZlbnQob3B0cykge1xyXG4gICAgICAgIF9zdXBlci5jYWxsKHRoaXMpO1xyXG4gICAgICAgIHRoaXMuX3F1ZXVlZCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdHM7XHJcbiAgICAgICAgdmFyIG9wdGlvbnMgPSBvcHRzIHx8IHt9O1xyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5jb25kZW5zZWQgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgICAgICB0aGlzLl9jb25kZW5zZWQgPSBvcHRpb25zLmNvbmRlbnNlZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVGhlIGRlZmF1bHQgc2NoZWR1bGVyIHVzZXMgc2V0SW1tZWRpYXRlKCkgb3Igc2V0VGltZW91dCguLi4sIDApIGlmIHNldEltbWVkaWF0ZSBpcyBub3QgYXZhaWxhYmxlLlxyXG4gICAgICovXHJcbiAgICBBc3luY0V2ZW50LmRlZmF1bHRTY2hlZHVsZXIgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAgKi9cclxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgLy8gYnJvd3NlcnMgZG9uJ3QgYWx3YXlzIHN1cHBvcnQgc2V0SW1tZWRpYXRlKClcclxuICAgICAgICAgICAgc2V0VGltZW91dChjYWxsYmFjaywgMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBub2RlLmpzXHJcbiAgICAgICAgICAgIHNldEltbWVkaWF0ZShjYWxsYmFjayk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQnkgZGVmYXVsdCwgQXN5bmNFdmVudCB1c2VzIHNldEltbWVkaWF0ZSgpIHRvIHNjaGVkdWxlIGV2ZW50IGhhbmRsZXIgaW52b2NhdGlvbi5cclxuICAgICAqIFlvdSBjYW4gY2hhbmdlIHRoaXMgZm9yIGUuZy4gc2V0VGltZW91dCguLi4sIDApIGJ5IGNhbGxpbmcgdGhpcyBzdGF0aWMgbWV0aG9kIG9uY2UuXHJcbiAgICAgKiBAcGFyYW0gc2NoZWR1bGVyIEEgZnVuY3Rpb24gdGhhdCB0YWtlcyBhIGNhbGxiYWNrIGFuZCBleGVjdXRlcyBpdCBpbiB0aGUgbmV4dCBOb2RlLkpTIGN5Y2xlLlxyXG4gICAgICovXHJcbiAgICBBc3luY0V2ZW50LnNldFNjaGVkdWxlciA9IGZ1bmN0aW9uIChzY2hlZHVsZXIpIHtcclxuICAgICAgICBBc3luY0V2ZW50Ll9zY2hlZHVsZXIgPSBzY2hlZHVsZXI7XHJcbiAgICB9O1xyXG4gICAgQXN5bmNFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLl9jb25kZW5zZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkRGF0YSA9IGFyZ3M7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZExpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3F1ZXVlZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIEFzeW5jRXZlbnQuX3NjaGVkdWxlcihmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaW1tZWRpYXRlbHkgbWFyayBub24tcXVldWVkIHRvIGFsbG93IG5ldyBBc3luY0V2ZW50IHRvIGhhcHBlbiBhcyByZXN1bHRcclxuICAgICAgICAgICAgICAgICAgICAvLyBvZiBjYWxsaW5nIGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuX3F1ZXVlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhY2hlIGxpc3RlbmVycyBhbmQgZGF0YSBiZWNhdXNlIHRoZXkgbWlnaHQgY2hhbmdlIHdoaWxlIGNhbGxpbmcgZXZlbnQgaGFuZGxlcnNcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IF90aGlzLl9xdWV1ZWREYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBsaXN0ZW5lcnMgPSBfdGhpcy5fcXVldWVkTGlzdGVuZXJzO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX2NhbGwobGlzdGVuZXIsIGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgICAgICBBc3luY0V2ZW50Ll9zY2hlZHVsZXIoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLy8gaW5oZXJpdGVkXHJcbiAgICBBc3luY0V2ZW50LnByb3RvdHlwZS5fY2FsbCA9IGZ1bmN0aW9uIChsaXN0ZW5lciwgYXJncykge1xyXG4gICAgICAgIC8vIHBlcmZvcm1hbmNlIG9wdGltaXphdGlvbjogZG9uJ3QgdXNlIGNvbnNlY3V0aXZlIG5vZGVqcyBjeWNsZXNcclxuICAgICAgICAvLyBmb3IgYXN5bmNldmVudHMgYXR0YWNoZWQgdG8gYXN5bmNldmVudHNcclxuICAgICAgICBpZiAobGlzdGVuZXIuZXZlbnQgJiYgbGlzdGVuZXIuZXZlbnQgaW5zdGFuY2VvZiBBc3luY0V2ZW50KSB7XHJcbiAgICAgICAgICAgIGxpc3RlbmVyLmV2ZW50Ll9wb3N0RGlyZWN0KGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5fY2FsbC5jYWxsKHRoaXMsIGxpc3RlbmVyLCBhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBQZXJmb3JtYW5jZSBvcHRpbWl6YXRpb246IGlmIHRoaXMgYXN5bmMgc2lnbmFsIGlzIGF0dGFjaGVkIHRvIGFub3RoZXJcclxuICAgICAqIGFzeW5jIHNpZ25hbCwgd2UncmUgYWxyZWFkeSBhIHRoZSBuZXh0IGN5Y2xlIGFuZCB3ZSBjYW4gY2FsbCBsaXN0ZW5lcnNcclxuICAgICAqIGRpcmVjdGx5XHJcbiAgICAgKi9cclxuICAgIEFzeW5jRXZlbnQucHJvdG90eXBlLl9wb3N0RGlyZWN0ID0gZnVuY3Rpb24gKGFyZ3MpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gY29weSBhIHJlZmVyZW5jZSB0byB0aGUgYXJyYXkgYmVjYXVzZSB0aGlzLl9saXN0ZW5lcnMgbWlnaHQgYmUgcmVwbGFjZWQgZHVyaW5nXHJcbiAgICAgICAgLy8gdGhlIGhhbmRsZXIgY2FsbHNcclxuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogVGhlIGN1cnJlbnQgc2NoZWR1bGVyXHJcbiAgICAgKi9cclxuICAgIEFzeW5jRXZlbnQuX3NjaGVkdWxlciA9IEFzeW5jRXZlbnQuZGVmYXVsdFNjaGVkdWxlcjtcclxuICAgIHJldHVybiBBc3luY0V2ZW50O1xyXG59KGJhc2VfZXZlbnRfMS5CYXNlRXZlbnQpKTtcclxuZXhwb3J0cy5Bc3luY0V2ZW50ID0gQXN5bmNFdmVudDtcclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBBc3luY0V2ZW50cyB3aXRob3V0IGRhdGFcclxuICovXHJcbnZhciBWb2lkQXN5bmNFdmVudCA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XHJcbiAgICBfX2V4dGVuZHMoVm9pZEFzeW5jRXZlbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBWb2lkQXN5bmNFdmVudCgpIHtcclxuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgQXN5bmNFdmVudC5cclxuICAgICAqL1xyXG4gICAgVm9pZEFzeW5jRXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5wb3N0LmNhbGwodGhpcywgdW5kZWZpbmVkKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gVm9pZEFzeW5jRXZlbnQ7XHJcbn0oQXN5bmNFdmVudCkpO1xyXG5leHBvcnRzLlZvaWRBc3luY0V2ZW50ID0gVm9pZEFzeW5jRXZlbnQ7XHJcbi8qKlxyXG4gKiBTaW1pbGFyIHRvICdlcnJvcicgZXZlbnQgb24gRXZlbnRFbWl0dGVyOiB0aHJvd3Mgd2hlbiBhIHBvc3QoKSBvY2N1cnMgd2hpbGUgbm8gaGFuZGxlcnMgc2V0LlxyXG4gKi9cclxudmFyIEVycm9yQXN5bmNFdmVudCA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XHJcbiAgICBfX2V4dGVuZHMoRXJyb3JBc3luY0V2ZW50LCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gRXJyb3JBc3luY0V2ZW50KCkge1xyXG4gICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG4gICAgRXJyb3JBc3luY0V2ZW50LnByb3RvdHlwZS5wb3N0ID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICBpZiAodGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6IFwiICsgZGF0YS5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5wb3N0LmNhbGwodGhpcywgZGF0YSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEVycm9yQXN5bmNFdmVudDtcclxufShBc3luY0V2ZW50KSk7XHJcbmV4cG9ydHMuRXJyb3JBc3luY0V2ZW50ID0gRXJyb3JBc3luY0V2ZW50O1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0ptYVd4bElqb2lZWE41Ym1NdFpYWmxiblF1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sY3lJNld5SXVMaTh1TGk5emNtTXZiR2xpTDJGemVXNWpMV1YyWlc1MExuUnpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSkJRVUZCTEN0RVFVRXJSRHRCUVVNdlJDeGxRVUZsTzBGQlJXWXNXVUZCV1N4RFFVRkRPenM3T3pzN1FVRkZZaXd5UWtGQk5FTXNZMEZCWXl4RFFVRkRMRU5CUVVFN1FVRmhNMFE3T3pzN08wZEJTMGM3UVVGRFNEdEpRVUZ0UXl3NFFrRkJXVHRKUVhkRE0wTTdPenM3VDBGSlJ6dEpRVU5JTEc5Q1FVRlpMRWxCUVhGQ08xRkJRemRDTEdsQ1FVRlBMRU5CUVVNN1VVRjBRMG9zV1VGQlR5eEhRVUZaTEV0QlFVc3NRMEZCUXp0UlFYVkROMElzU1VGQlNTeERRVUZETEU5QlFVOHNSMEZCUnl4SlFVRkpMRU5CUVVNN1VVRkRjRUlzU1VGQlNTeFBRVUZQTEVkQlFXMUNMRWxCUVVrc1NVRkJTU3hGUVVGRkxFTkJRVU03VVVGRGVrTXNSVUZCUlN4RFFVRkRMRU5CUVVNc1QwRkJUeXhQUVVGUExFTkJRVU1zVTBGQlV5eExRVUZMTEZOQlFWTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1dVRkRla01zU1VGQlNTeERRVUZETEZWQlFWVXNSMEZCUnl4UFFVRlBMRU5CUVVNc1UwRkJVeXhEUVVGRE8xRkJRM2hETEVOQlFVTTdVVUZCUXl4SlFVRkpMRU5CUVVNc1EwRkJRenRaUVVOS0xFbEJRVWtzUTBGQlF5eFZRVUZWTEVkQlFVY3NTMEZCU3l4RFFVRkRPMUZCUXpWQ0xFTkJRVU03U1VGRFRDeERRVUZETzBsQk1VTkVPenRQUVVWSE8wbEJRMWNzTWtKQlFXZENMRWRCUVRsQ0xGVkJRU3RDTEZGQlFXOUNPMUZCUXk5RExESkNRVUV5UWp0UlFVTXpRaXhGUVVGRkxFTkJRVU1zUTBGQlF5eFBRVUZQTEUxQlFVMHNTMEZCU3l4WFFVRlhMRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRMmhETEN0RFFVRXJRenRaUVVNdlF5eFZRVUZWTEVOQlFVTXNVVUZCVVN4RlFVRkZMRU5CUVVNc1EwRkJReXhEUVVGRE8xRkJRelZDTEVOQlFVTTdVVUZCUXl4SlFVRkpMRU5CUVVNc1EwRkJRenRaUVVOS0xGVkJRVlU3V1VGRFZpeFpRVUZaTEVOQlFVTXNVVUZCVVN4RFFVRkRMRU5CUVVNN1VVRkRNMElzUTBGQlF6dEpRVU5NTEVOQlFVTTdTVUZQUkRzN096dFBRVWxITzBsQlExY3NkVUpCUVZrc1IwRkJNVUlzVlVGQk1rSXNVMEZCZVVNN1VVRkRhRVVzVlVGQlZTeERRVUZETEZWQlFWVXNSMEZCUnl4VFFVRlRMRU5CUVVNN1NVRkRkRU1zUTBGQlF6dEpRWE5DVFN4NVFrRkJTU3hIUVVGWU8xRkJRVUVzYVVKQmFVTkRPMUZCYWtOWExHTkJRV003WVVGQlpDeFhRVUZqTEVOQlFXUXNjMEpCUVdNc1EwRkJaQ3hKUVVGak8xbEJRV1FzTmtKQlFXTTdPMUZCUTNSQ0xFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRlZCUVZVc1NVRkJTU3hKUVVGSkxFTkJRVU1zVlVGQlZTeERRVUZETEUxQlFVMHNTMEZCU3l4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRMjVFTEUxQlFVMHNRMEZCUXp0UlFVTllMRU5CUVVNN1VVRkRSQ3hGUVVGRkxFTkJRVU1zUTBGQlF5eEpRVUZKTEVOQlFVTXNWVUZCVlN4RFFVRkRMRU5CUVVNc1EwRkJRenRaUVVOc1FpeEpRVUZKTEVOQlFVTXNWMEZCVnl4SFFVRkhMRWxCUVVrc1EwRkJRenRaUVVONFFpeEpRVUZKTEVOQlFVTXNaMEpCUVdkQ0xFZEJRVWNzU1VGQlNTeERRVUZETEZWQlFWVXNRMEZCUXp0WlFVTjRReXhGUVVGRkxFTkJRVU1zUTBGQlF5eEpRVUZKTEVOQlFVTXNUMEZCVHl4RFFVRkRMRU5CUVVNc1EwRkJRenRuUWtGRFppeE5RVUZOTEVOQlFVTTdXVUZEV0N4RFFVRkRPMWxCUVVNc1NVRkJTU3hEUVVGRExFTkJRVU03WjBKQlEwb3NTVUZCU1N4RFFVRkRMRTlCUVU4c1IwRkJSeXhKUVVGSkxFTkJRVU03WjBKQlEzQkNMRlZCUVZVc1EwRkJReXhWUVVGVkxFTkJRVU03YjBKQlEyeENMREJGUVVFd1JUdHZRa0ZETVVVc2MwSkJRWE5DTzI5Q1FVTjBRaXhMUVVGSkxFTkJRVU1zVDBGQlR5eEhRVUZITEV0QlFVc3NRMEZCUXp0dlFrRkRja0lzYTBaQlFXdEdPMjlDUVVOc1JpeEpRVUZKTEVsQlFVa3NSMEZCUnl4TFFVRkpMRU5CUVVNc1YwRkJWeXhEUVVGRE8yOUNRVU0xUWl4SlFVRkpMRk5CUVZNc1IwRkJSeXhMUVVGSkxFTkJRVU1zWjBKQlFXZENMRU5CUVVNN2IwSkJRM1JETEVkQlFVY3NRMEZCUXl4RFFVRkRMRWxCUVVrc1EwRkJReXhIUVVGSExFTkJRVU1zUlVGQlJTeERRVUZETEVkQlFVY3NVMEZCVXl4RFFVRkRMRTFCUVUwc1JVRkJSU3hGUVVGRkxFTkJRVU1zUlVGQlJTeERRVUZETzNkQ1FVTjRReXhKUVVGSkxGRkJRVkVzUjBGQlJ5eFRRVUZUTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN2QwSkJRelZDTEV0QlFVa3NRMEZCUXl4TFFVRkxMRU5CUVVNc1VVRkJVU3hGUVVGRkxFbEJRVWtzUTBGQlF5eERRVUZETzI5Q1FVTXZRaXhEUVVGRE8yZENRVU5NTEVOQlFVTXNRMEZCUXl4RFFVRkRPMWxCUTFBc1EwRkJRenRSUVVOTUxFTkJRVU03VVVGQlF5eEpRVUZKTEVOQlFVTXNRMEZCUXp0WlFVTktMRWxCUVVrc1UwRkJVeXhIUVVGSExFbEJRVWtzUTBGQlF5eFZRVUZWTEVOQlFVTTdXVUZEYUVNc1ZVRkJWU3hEUVVGRExGVkJRVlVzUTBGQlF6dG5Ra0ZEYkVJc1IwRkJSeXhEUVVGRExFTkJRVU1zU1VGQlNTeERRVUZETEVkQlFVY3NRMEZCUXl4RlFVRkZMRU5CUVVNc1IwRkJSeXhUUVVGVExFTkJRVU1zVFVGQlRTeEZRVUZGTEVWQlFVVXNRMEZCUXl4RlFVRkZMRU5CUVVNN2IwSkJRM2hETEVsQlFVa3NVVUZCVVN4SFFVRkhMRk5CUVZNc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF6dHZRa0ZETlVJc1MwRkJTU3hEUVVGRExFdEJRVXNzUTBGQlF5eFJRVUZSTEVWQlFVVXNTVUZCU1N4RFFVRkRMRU5CUVVNN1owSkJReTlDTEVOQlFVTTdXVUZEVEN4RFFVRkRMRU5CUVVNc1EwRkJRenRSUVVOUUxFTkJRVU03U1VGRFRDeERRVUZETzBsQlJVUXNXVUZCV1R0SlFVTkdMREJDUVVGTExFZEJRV1lzVlVGQlowSXNVVUZCY1VJc1JVRkJSU3hKUVVGWE8xRkJRemxETEdkRlFVRm5SVHRSUVVOb1JTd3dRMEZCTUVNN1VVRkRNVU1zUlVGQlJTeERRVUZETEVOQlFVTXNVVUZCVVN4RFFVRkRMRXRCUVVzc1NVRkJTU3hSUVVGUkxFTkJRVU1zUzBGQlN5eFpRVUZaTEZWQlFWVXNRMEZCUXl4RFFVRkRMRU5CUVVNN1dVRkRla01zVVVGQlVTeERRVUZETEV0QlFVMHNRMEZCUXl4WFFVRlhMRU5CUVVNc1NVRkJTU3hEUVVGRExFTkJRVU03VVVGRGRFUXNRMEZCUXp0UlFVRkRMRWxCUVVrc1EwRkJReXhEUVVGRE8xbEJRMG9zWjBKQlFVc3NRMEZCUXl4TFFVRkxMRmxCUVVNc1VVRkJVU3hGUVVGRkxFbEJRVWtzUTBGQlF5eERRVUZETzFGQlEyaERMRU5CUVVNN1NVRkRUQ3hEUVVGRE8wbEJSVVE3T3pzN1QwRkpSenRKUVVOUExHZERRVUZYTEVkQlFYSkNMRlZCUVhOQ0xFbEJRVmM3VVVGRE4wSXNSVUZCUlN4RFFVRkRMRU5CUVVNc1EwRkJReXhKUVVGSkxFTkJRVU1zVlVGQlZTeEpRVUZKTEVsQlFVa3NRMEZCUXl4VlFVRlZMRU5CUVVNc1RVRkJUU3hMUVVGTExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdXVUZEYmtRc1RVRkJUU3hEUVVGRE8xRkJRMWdzUTBGQlF6dFJRVU5FTEdsR1FVRnBSanRSUVVOcVJpeHZRa0ZCYjBJN1VVRkRjRUlzU1VGQlNTeFRRVUZUTEVkQlFVY3NTVUZCU1N4RFFVRkRMRlZCUVZVc1EwRkJRenRSUVVOb1F5eEhRVUZITEVOQlFVTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1IwRkJSeXhEUVVGRExFVkJRVVVzUTBGQlF5eEhRVUZITEZOQlFWTXNRMEZCUXl4TlFVRk5MRVZCUVVVc1JVRkJSU3hEUVVGRExFVkJRVVVzUTBGQlF6dFpRVU40UXl4SlFVRkpMRkZCUVZFc1IwRkJSeXhUUVVGVExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdXVUZETlVJc1NVRkJTU3hEUVVGRExFdEJRVXNzUTBGQlF5eFJRVUZSTEVWQlFVVXNTVUZCU1N4RFFVRkRMRU5CUVVNN1VVRkRMMElzUTBGQlF6dEpRVU5NTEVOQlFVTTdTVUZvUjBRN08wOUJSVWM3U1VGRFdTeHhRa0ZCVlN4SFFVRnRReXhWUVVGVkxFTkJRVU1zWjBKQlFXZENMRU5CUVVNN1NVRTRSalZHTEdsQ1FVRkRPMEZCUVVRc1EwRkJReXhCUVROSVJDeERRVUZ0UXl4elFrRkJVeXhIUVRKSU0wTTdRVUV6U0Zrc2EwSkJRVlVzWVVFeVNIUkNMRU5CUVVFN1FVRkZSRHM3UjBGRlJ6dEJRVU5JTzBsQlFXOURMR3REUVVGblFqdEpRVUZ3UkR0UlFVRnZReXc0UWtGQlowSTdTVUZSY0VRc1EwRkJRenRKUVU1SE96dFBRVVZITzBsQlEwa3NOa0pCUVVrc1IwRkJXRHRSUVVOSkxHZENRVUZMTEVOQlFVTXNTVUZCU1N4WlFVRkRMRk5CUVZNc1EwRkJReXhEUVVGRE8wbEJRekZDTEVOQlFVTTdTVUZEVEN4eFFrRkJRenRCUVVGRUxFTkJRVU1zUVVGU1JDeERRVUZ2UXl4VlFVRlZMRWRCVVRkRE8wRkJVbGtzYzBKQlFXTXNhVUpCVVRGQ0xFTkJRVUU3UVVGRlJEczdSMEZGUnp0QlFVTklPMGxCUVhGRExHMURRVUZwUWp0SlFVRjBSRHRSUVVGeFF5dzRRa0ZCYVVJN1NVRlJkRVFzUTBGQlF6dEpRVTVWTERoQ1FVRkpMRWRCUVZnc1ZVRkJXU3hKUVVGWE8xRkJRMjVDTEVWQlFVVXNRMEZCUXl4RFFVRkRMRWxCUVVrc1EwRkJReXhoUVVGaExFVkJRVVVzUzBGQlN5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPMWxCUXpkQ0xFMUJRVTBzU1VGQlNTeExRVUZMTEVOQlFVTXNORVJCUVRCRUxFbEJRVWtzUTBGQlF5eFBRVUZUTEVOQlFVTXNRMEZCUXp0UlFVTTVSaXhEUVVGRE8xRkJRMFFzWjBKQlFVc3NRMEZCUXl4SlFVRkpMRmxCUVVNc1NVRkJTU3hEUVVGRExFTkJRVU03U1VGRGNrSXNRMEZCUXp0SlFVTk1MSE5DUVVGRE8wRkJRVVFzUTBGQlF5eEJRVkpFTEVOQlFYRkRMRlZCUVZVc1IwRlJPVU03UVVGU1dTeDFRa0ZCWlN4clFrRlJNMElzUTBGQlFTSjkiLCIvLyBDb3B5cmlnaHQgKGMpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcbid1c2Ugc3RyaWN0JztcclxuLyoqXHJcbiAqIEJhc2UgY2xhc3MgZm9yIGV2ZW50cy5cclxuICogSGFuZGxlcyBhdHRhY2hpbmcgYW5kIGRldGFjaGluZyBsaXN0ZW5lcnNcclxuICovXHJcbnZhciBCYXNlRXZlbnQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gQmFzZUV2ZW50KCkge1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlclxyXG4gICAgICogQHBhcmFtIGJvdW5kVG8gKE9wdGlvbmFsKSBUaGUgdGhpcyBhcmd1bWVudCBvZiB0aGUgaGFuZGxlclxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuXHJcbiAgICAgKi9cclxuICAgIEJhc2VFdmVudC5wcm90b3R5cGUuYXR0YWNoID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGJvdW5kVG87XHJcbiAgICAgICAgdmFyIGhhbmRsZXI7XHJcbiAgICAgICAgdmFyIGV2ZW50O1xyXG4gICAgICAgIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0ucG9zdCA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBldmVudCA9IGFyZ3NbMF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gIT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdCBhIGZ1bmN0aW9uIG9yIG9iamVjdCBhcyBmaXJzdCBhcmd1bWVudCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIDtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmdzWzFdICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdCBhIGZ1bmN0aW9uIGFzIHNlY29uZCBhcmd1bWVudCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJvdW5kVG8gPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICBoYW5kbGVyID0gYXJnc1sxXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gW107XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYXJyYXkgc28gZXZlbnRzIHRoYXQgYXJlIHVuZGVyd2F5IGhhdmUgYSBzdGFibGUgbG9jYWwgY29weVxyXG4gICAgICAgICAgICAvLyBvZiB0aGUgbGlzdGVuZXJzIGFycmF5IGF0IHRoZSB0aW1lIG9mIHBvc3QoKVxyXG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMubWFwKGZ1bmN0aW9uIChsaXN0ZW5lcikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGxpc3RlbmVyO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fbGlzdGVuZXJzLnB1c2goe1xyXG4gICAgICAgICAgICBkZWxldGVkOiBmYWxzZSxcclxuICAgICAgICAgICAgYm91bmRUbzogYm91bmRUbyxcclxuICAgICAgICAgICAgaGFuZGxlcjogaGFuZGxlcixcclxuICAgICAgICAgICAgZXZlbnQ6IGV2ZW50XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggaW1wbGVtZW50YXRpb24uIFNlZSB0aGUgb3ZlcmxvYWRzIGZvciBkZXNjcmlwdGlvbi5cclxuICAgICAqL1xyXG4gICAgQmFzZUV2ZW50LnByb3RvdHlwZS5kZXRhY2ggPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGFyZ3MgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgYXJndW1lbnRzLmxlbmd0aDsgX2krKykge1xyXG4gICAgICAgICAgICBhcmdzW19pIC0gMF0gPSBhcmd1bWVudHNbX2ldO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGJvdW5kVG87XHJcbiAgICAgICAgdmFyIGhhbmRsZXI7XHJcbiAgICAgICAgdmFyIGV2ZW50O1xyXG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA+PSAxKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgKGFyZ3NbMF0pID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXS5wb3N0ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBldmVudCA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBib3VuZFRvID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoYXJncy5sZW5ndGggPj0gMikge1xyXG4gICAgICAgICAgICBoYW5kbGVyID0gYXJnc1sxXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVycyBBTkQgbWFyayB0aGVtIGFzIGRlbGV0ZWQgc28gc3ViY2xhc3NlcyBkb24ndCBzZW5kIGFueSBtb3JlIGV2ZW50cyB0byB0aGVtXHJcbiAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzLmZpbHRlcihmdW5jdGlvbiAobGlzdGVuZXIpIHtcclxuICAgICAgICAgICAgaWYgKCh0eXBlb2YgaGFuZGxlciA9PT0gJ3VuZGVmaW5lZCcgfHwgbGlzdGVuZXIuaGFuZGxlciA9PT0gaGFuZGxlcilcclxuICAgICAgICAgICAgICAgICYmICh0eXBlb2YgZXZlbnQgPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmV2ZW50ID09PSBldmVudClcclxuICAgICAgICAgICAgICAgICYmICh0eXBlb2YgYm91bmRUbyA9PT0gJ3VuZGVmaW5lZCcgfHwgbGlzdGVuZXIuYm91bmRUbyA9PT0gYm91bmRUbykpIHtcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVyLmRlbGV0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmICh0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQWJzdHJhY3QgcG9zdCgpIG1ldGhvZCB0byBiZSBhYmxlIHRvIGNvbm5lY3QgYW55IHR5cGUgb2YgZXZlbnQgdG8gYW55IG90aGVyIGRpcmVjdGx5XHJcbiAgICAgKiBAYWJzdHJhY3RcclxuICAgICAqL1xyXG4gICAgQmFzZUV2ZW50LnByb3RvdHlwZS5wb3N0ID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2Fic3RyYWN0Jyk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGF0dGFjaGVkIGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBCYXNlRXZlbnQucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9saXN0ZW5lcnMgPyB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoIDogMCk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsIHRoZSBnaXZlbiBsaXN0ZW5lciwgaWYgaXQgaXMgbm90IG1hcmtlZCBhcyAnZGVsZXRlZCdcclxuICAgICAqIEBwYXJhbSBsaXN0ZW5lciBUaGUgbGlzdGVuZXIgdG8gY2FsbFxyXG4gICAgICogQHBhcmFtIGFyZ3MgVGhlIGFyZ3VtZW50cyB0byB0aGUgaGFuZGxlclxyXG4gICAgICovXHJcbiAgICBCYXNlRXZlbnQucHJvdG90eXBlLl9jYWxsID0gZnVuY3Rpb24gKGxpc3RlbmVyLCBhcmdzKSB7XHJcbiAgICAgICAgaWYgKCFsaXN0ZW5lci5kZWxldGVkKSB7XHJcbiAgICAgICAgICAgIGlmIChsaXN0ZW5lci5ldmVudCkge1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuZXZlbnQucG9zdC5hcHBseShsaXN0ZW5lci5ldmVudCwgYXJncyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5oYW5kbGVyLmFwcGx5KCh0eXBlb2YgbGlzdGVuZXIuYm91bmRUbyA9PT0gJ29iamVjdCcgPyBsaXN0ZW5lci5ib3VuZFRvIDogdGhpcyksIGFyZ3MpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHJldHVybiBCYXNlRXZlbnQ7XHJcbn0oKSk7XHJcbmV4cG9ydHMuQmFzZUV2ZW50ID0gQmFzZUV2ZW50O1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0ptYVd4bElqb2lZbUZ6WlMxbGRtVnVkQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6SWpwYklpNHVMeTR1TDNOeVl5OXNhV0l2WW1GelpTMWxkbVZ1ZEM1MGN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaVFVRkJRU3dyUkVGQkswUTdRVUZETDBRc1pVRkJaVHRCUVVWbUxGbEJRVmtzUTBGQlF6dEJRVFJDWWpzN08wZEJSMGM3UVVGRFNEdEpRVUZCTzBsQk1FcEJMRU5CUVVNN1NVRnFTVWM3T3pzN1QwRkpSenRKUVVOSkxEQkNRVUZOTEVkQlFXSTdVVUZCWXl4alFVRmpPMkZCUVdRc1YwRkJZeXhEUVVGa0xITkNRVUZqTEVOQlFXUXNTVUZCWXp0WlFVRmtMRFpDUVVGak96dFJRVU40UWl4SlFVRkpMRTlCUVdVc1EwRkJRenRSUVVOd1FpeEpRVUZKTEU5QlFUQkNMRU5CUVVNN1VVRkRMMElzU1VGQlNTeExRVUZyUWl4RFFVRkRPMUZCUTNaQ0xFVkJRVVVzUTBGQlF5eERRVUZETEU5QlFVOHNTVUZCU1N4RFFVRkRMRU5CUVVNc1EwRkJReXhMUVVGTExGVkJRVlVzUTBGQlF5eERRVUZETEVOQlFVTTdXVUZEYUVNc1QwRkJUeXhIUVVGSExFbEJRVWtzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXp0UlFVTjBRaXhEUVVGRE8xRkJRVU1zU1VGQlNTeERRVUZETEVWQlFVVXNRMEZCUXl4RFFVRkRMRWxCUVVrc1EwRkJReXhOUVVGTkxFdEJRVXNzUTBGQlF5eEpRVUZKTEU5QlFVOHNTVUZCU1N4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRExFbEJRVWtzUzBGQlN5eFZRVUZWTEVOQlFVTXNRMEZCUXl4RFFVRkRPMWxCUTJwRkxFdEJRVXNzUjBGQlJ5eEpRVUZKTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1VVRkRjRUlzUTBGQlF6dFJRVUZETEVsQlFVa3NRMEZCUXl4RFFVRkRPMWxCUTBvc1JVRkJSU3hEUVVGRExFTkJRVU1zVDBGQlR5eEpRVUZKTEVOQlFVTXNRMEZCUXl4RFFVRkRMRXRCUVVzc1VVRkJVU3hEUVVGRExFTkJRVU1zUTBGQlF6dG5Ra0ZET1VJc1RVRkJUU3hKUVVGSkxFdEJRVXNzUTBGQlF5d3JRMEZCSzBNc1EwRkJReXhEUVVGRE8xbEJRM0pGTEVOQlFVTTdXVUZCUVN4RFFVRkRPMWxCUTBZc1JVRkJSU3hEUVVGRExFTkJRVU1zVDBGQlR5eEpRVUZKTEVOQlFVTXNRMEZCUXl4RFFVRkRMRXRCUVVzc1ZVRkJWU3hEUVVGRExFTkJRVU1zUTBGQlF6dG5Ra0ZEYUVNc1RVRkJUU3hKUVVGSkxFdEJRVXNzUTBGQlF5eHpRMEZCYzBNc1EwRkJReXhEUVVGRE8xbEJRelZFTEVOQlFVTTdXVUZEUkN4UFFVRlBMRWRCUVVjc1NVRkJTU3hEUVVGRExFTkJRVU1zUTBGQlF5eERRVUZETzFsQlEyeENMRTlCUVU4c1IwRkJSeXhKUVVGSkxFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdVVUZEZEVJc1EwRkJRenRSUVVORUxFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRlZCUVZVc1EwRkJReXhEUVVGRExFTkJRVU03V1VGRGJrSXNTVUZCU1N4RFFVRkRMRlZCUVZVc1IwRkJSeXhGUVVGRkxFTkJRVU03VVVGRGVrSXNRMEZCUXp0UlFVRkRMRWxCUVVrc1EwRkJReXhEUVVGRE8xbEJRMG9zWjBaQlFXZEdPMWxCUTJoR0xDdERRVUVyUXp0WlFVTXZReXhKUVVGSkxFTkJRVU1zVlVGQlZTeEhRVUZITEVsQlFVa3NRMEZCUXl4VlFVRlZMRU5CUVVNc1IwRkJSeXhEUVVGRExGVkJRVU1zVVVGQmNVSTdaMEpCUTNoRUxFMUJRVTBzUTBGQlF5eFJRVUZSTEVOQlFVTTdXVUZEY0VJc1EwRkJReXhEUVVGRExFTkJRVU03VVVGRFVDeERRVUZETzFGQlEwUXNTVUZCU1N4RFFVRkRMRlZCUVZVc1EwRkJReXhKUVVGSkxFTkJRVU03V1VGRGFrSXNUMEZCVHl4RlFVRkZMRXRCUVVzN1dVRkRaQ3hQUVVGUExFVkJRVVVzVDBGQlR6dFpRVU5vUWl4UFFVRlBMRVZCUVVVc1QwRkJUenRaUVVOb1FpeExRVUZMTEVWQlFVVXNTMEZCU3p0VFFVTm1MRU5CUVVNc1EwRkJRenRKUVVOUUxFTkJRVU03U1VGelFrUTdPMDlCUlVjN1NVRkRTU3d3UWtGQlRTeEhRVUZpTzFGQlFXTXNZMEZCWXp0aFFVRmtMRmRCUVdNc1EwRkJaQ3h6UWtGQll5eERRVUZrTEVsQlFXTTdXVUZCWkN3MlFrRkJZenM3VVVGRGVFSXNSVUZCUlN4RFFVRkRMRU5CUVVNc1EwRkJReXhKUVVGSkxFTkJRVU1zVlVGQlZTeEpRVUZKTEVsQlFVa3NRMEZCUXl4VlFVRlZMRU5CUVVNc1RVRkJUU3hMUVVGTExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdXVUZEYmtRc1RVRkJUU3hEUVVGRE8xRkJRMWdzUTBGQlF6dFJRVU5FTEVsQlFVa3NUMEZCWlN4RFFVRkRPMUZCUTNCQ0xFbEJRVWtzVDBGQk1FSXNRMEZCUXp0UlFVTXZRaXhKUVVGSkxFdEJRV3RDTEVOQlFVTTdVVUZEZGtJc1JVRkJSU3hEUVVGRExFTkJRVU1zU1VGQlNTeERRVUZETEUxQlFVMHNTVUZCU1N4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRMjVDTEVWQlFVVXNRMEZCUXl4RFFVRkRMRTlCUVU4c1EwRkJReXhKUVVGSkxFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNTMEZCU3l4VlFVRlZMRU5CUVVNc1EwRkJReXhEUVVGRE8yZENRVU5zUXl4UFFVRlBMRWRCUVVjc1NVRkJTU3hEUVVGRExFTkJRVU1zUTBGQlF5eERRVUZETzFsQlEzUkNMRU5CUVVNN1dVRkJReXhKUVVGSkxFTkJRVU1zUlVGQlJTeERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRTFCUVUwc1MwRkJTeXhEUVVGRExFbEJRVWtzVDBGQlR5eEpRVUZKTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNc1NVRkJTU3hMUVVGTExGVkJRVlVzUTBGQlF5eERRVUZETEVOQlFVTTdaMEpCUTJwRkxFdEJRVXNzUjBGQlJ5eEpRVUZKTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1dVRkRjRUlzUTBGQlF6dFpRVUZETEVsQlFVa3NRMEZCUXl4RFFVRkRPMmRDUVVOS0xFOUJRVThzUjBGQlJ5eEpRVUZKTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1dVRkRkRUlzUTBGQlF6dFJRVU5NTEVOQlFVTTdVVUZEUkN4RlFVRkZMRU5CUVVNc1EwRkJReXhKUVVGSkxFTkJRVU1zVFVGQlRTeEpRVUZKTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1dVRkRia0lzVDBGQlR5eEhRVUZITEVsQlFVa3NRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJRenRSUVVOMFFpeERRVUZETzFGQlJVUXNOa1pCUVRaR08xRkJRemRHTEVsQlFVa3NRMEZCUXl4VlFVRlZMRWRCUVVjc1NVRkJTU3hEUVVGRExGVkJRVlVzUTBGQlF5eE5RVUZOTEVOQlFVTXNWVUZCUXl4UlFVRnhRanRaUVVNelJDeEZRVUZGTEVOQlFVTXNRMEZCUXl4RFFVRkRMRTlCUVU4c1QwRkJUeXhMUVVGTExGZEJRVmNzU1VGQlNTeFJRVUZSTEVOQlFVTXNUMEZCVHl4TFFVRkxMRTlCUVU4c1EwRkJRenR0UWtGRE4wUXNRMEZCUXl4UFFVRlBMRXRCUVVzc1MwRkJTeXhYUVVGWExFbEJRVWtzVVVGQlVTeERRVUZETEV0QlFVc3NTMEZCU3l4TFFVRkxMRU5CUVVNN2JVSkJRekZFTEVOQlFVTXNUMEZCVHl4UFFVRlBMRXRCUVVzc1YwRkJWeXhKUVVGSkxGRkJRVkVzUTBGQlF5eFBRVUZQTEV0QlFVc3NUMEZCVHl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8yZENRVU4wUlN4UlFVRlJMRU5CUVVNc1QwRkJUeXhIUVVGSExFbEJRVWtzUTBGQlF6dG5Ra0ZEZUVJc1RVRkJUU3hEUVVGRExFdEJRVXNzUTBGQlF6dFpRVU5xUWl4RFFVRkRPMWxCUTBRc1RVRkJUU3hEUVVGRExFbEJRVWtzUTBGQlF6dFJRVU5vUWl4RFFVRkRMRU5CUVVNc1EwRkJRenRSUVVWSUxFVkJRVVVzUTBGQlF5eERRVUZETEVsQlFVa3NRMEZCUXl4VlFVRlZMRU5CUVVNc1RVRkJUU3hMUVVGTExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdXVUZETDBJc1QwRkJUeXhKUVVGSkxFTkJRVU1zVlVGQlZTeERRVUZETzFGQlF6TkNMRU5CUVVNN1NVRkRUQ3hEUVVGRE8wbEJSVVE3T3p0UFFVZEhPMGxCUTBrc2QwSkJRVWtzUjBGQldDeFZRVUZaTEVsQlFVODdVVUZEWml4TlFVRk5MRWxCUVVrc1MwRkJTeXhEUVVGRExGVkJRVlVzUTBGQlF5eERRVUZETzBsQlEyaERMRU5CUVVNN1NVRkZSRHM3VDBGRlJ6dEpRVU5KTEdsRFFVRmhMRWRCUVhCQ08xRkJRMGtzVFVGQlRTeERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRlZCUVZVc1IwRkJSeXhKUVVGSkxFTkJRVU1zVlVGQlZTeERRVUZETEUxQlFVMHNSMEZCUnl4RFFVRkRMRU5CUVVNc1EwRkJRenRKUVVNeFJDeERRVUZETzBsQlJVUTdPenM3VDBGSlJ6dEpRVU5QTEhsQ1FVRkxMRWRCUVdZc1ZVRkJaMElzVVVGQmNVSXNSVUZCUlN4SlFVRlhPMUZCUXpsRExFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTXNVVUZCVVN4RFFVRkRMRTlCUVU4c1EwRkJReXhEUVVGRExFTkJRVU03V1VGRGNFSXNSVUZCUlN4RFFVRkRMRU5CUVVNc1VVRkJVU3hEUVVGRExFdEJRVXNzUTBGQlF5eERRVUZETEVOQlFVTTdaMEpCUTJwQ0xGRkJRVkVzUTBGQlF5eExRVUZMTEVOQlFVTXNTVUZCU1N4RFFVRkRMRXRCUVVzc1EwRkJReXhSUVVGUkxFTkJRVU1zUzBGQlN5eEZRVUZGTEVsQlFVa3NRMEZCUXl4RFFVRkRPMWxCUTNCRUxFTkJRVU03V1VGQlF5eEpRVUZKTEVOQlFVTXNRMEZCUXp0blFrRkRTaXhSUVVGUkxFTkJRVU1zVDBGQlR5eERRVUZETEV0QlFVc3NRMEZCUXl4RFFVRkRMRTlCUVU4c1VVRkJVU3hEUVVGRExFOUJRVThzUzBGQlN5eFJRVUZSTEVkQlFVY3NVVUZCVVN4RFFVRkRMRTlCUVU4c1IwRkJSeXhKUVVGSkxFTkJRVU1zUlVGQlJTeEpRVUZKTEVOQlFVTXNRMEZCUXp0WlFVTnVSeXhEUVVGRE8xRkJRMHdzUTBGQlF6dEpRVU5NTEVOQlFVTTdTVUZGVEN4blFrRkJRenRCUVVGRUxFTkJRVU1zUVVFeFNrUXNTVUV3U2tNN1FVRXhTbGtzYVVKQlFWTXNXVUV3U25KQ0xFTkJRVUVpZlE9PSIsIi8vIENvcHlyaWdodCAoYykgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuJ3VzZSBzdHJpY3QnO1xyXG5mdW5jdGlvbiBzaGFsbG93RXF1YWxzKGEsIGIpIHtcclxuICAgIGlmIChhID09PSBiKSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIGEgIT09IHR5cGVvZiBiKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgc3dpdGNoICh0eXBlb2YgYSkge1xyXG4gICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxyXG4gICAgICAgIGNhc2UgJ251bWJlcic6XHJcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcclxuICAgICAgICBjYXNlICdmdW5jdGlvbic6XHJcbiAgICAgICAgY2FzZSAnc3ltYm9sJzpcclxuICAgICAgICBjYXNlICd1bmRlZmluZWQnOlxyXG4gICAgICAgICAgICAvLyBhbHJlYWR5IGRpZCA9PT0gY29tcGFyZVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY2FzZSAnb2JqZWN0JzpcclxuICAgICAgICAgICAgaWYgKGEgPT09IG51bGwgfHwgYiA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBhbHJlYWR5IGNvbXBhcmVkID09PVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGEpIHx8IEFycmF5LmlzQXJyYXkoYikpIHtcclxuICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShhKSB8fCAhQXJyYXkuaXNBcnJheShiKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIG5hbWU7XHJcbiAgICAgICAgICAgIHZhciBuYW1lc0EgPSBbXTtcclxuICAgICAgICAgICAgdmFyIG5hbWVzQiA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gYSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGEuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lc0EucHVzaChuYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gYikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGIuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lc0IucHVzaChuYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBuYW1lc0Euc29ydCgpO1xyXG4gICAgICAgICAgICBuYW1lc0Iuc29ydCgpO1xyXG4gICAgICAgICAgICBpZiAobmFtZXNBLmpvaW4oJywnKSAhPT0gbmFtZXNCLmpvaW4oJywnKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBuYW1lc0EubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgIGlmIChhW25hbWVzQVtpXV0gIT09IGJbbmFtZXNBW2ldXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbn1cclxuZXhwb3J0cy5zaGFsbG93RXF1YWxzID0gc2hhbGxvd0VxdWFscztcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pYjJKcVpXTjBjeTVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6SWpwYklpNHVMeTR1TDNOeVl5OXNhV0l2YjJKcVpXTjBjeTUwY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pUVVGQlFTd3JSRUZCSzBRN1FVRkRMMFFzWlVGQlpUdEJRVVZtTEZsQlFWa3NRMEZCUXp0QlFVVmlMSFZDUVVFNFFpeERRVUZOTEVWQlFVVXNRMEZCVFR0SlFVTjRReXhGUVVGRkxFTkJRVU1zUTBGQlF5eERRVUZETEV0QlFVc3NRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJRenRSUVVOV0xFMUJRVTBzUTBGQlF5eEpRVUZKTEVOQlFVTTdTVUZEYUVJc1EwRkJRenRKUVVORUxFVkJRVVVzUTBGQlF5eERRVUZETEU5QlFVOHNRMEZCUXl4TFFVRkxMRTlCUVU4c1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF6dFJRVU40UWl4TlFVRk5MRU5CUVVNc1MwRkJTeXhEUVVGRE8wbEJRMnBDTEVOQlFVTTdTVUZEUkN4TlFVRk5MRU5CUVVNc1EwRkJReXhQUVVGUExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdVVUZEWml4TFFVRkxMRk5CUVZNc1EwRkJRenRSUVVObUxFdEJRVXNzVVVGQlVTeERRVUZETzFGQlEyUXNTMEZCU3l4UlFVRlJMRU5CUVVNN1VVRkRaQ3hMUVVGTExGVkJRVlVzUTBGQlF6dFJRVU5vUWl4TFFVRkxMRkZCUVZFc1EwRkJRenRSUVVOa0xFdEJRVXNzVjBGQlZ6dFpRVU5hTERCQ1FVRXdRanRaUVVNeFFpeE5RVUZOTEVOQlFVTXNTMEZCU3l4RFFVRkRPMUZCUTJwQ0xFdEJRVXNzVVVGQlVUdFpRVU5VTEVWQlFVVXNRMEZCUXl4RFFVRkRMRU5CUVVNc1MwRkJTeXhKUVVGSkxFbEJRVWtzUTBGQlF5eExRVUZMTEVsQlFVa3NRMEZCUXl4RFFVRkRMRU5CUVVNN1owSkJRek5DTEUxQlFVMHNRMEZCUXl4TFFVRkxMRU5CUVVNc1EwRkJReXgxUWtGQmRVSTdXVUZEZWtNc1EwRkJRenRaUVVORUxFVkJRVVVzUTBGQlF5eERRVUZETEV0QlFVc3NRMEZCUXl4UFFVRlBMRU5CUVVNc1EwRkJReXhEUVVGRExFbEJRVWtzUzBGQlN5eERRVUZETEU5QlFVOHNRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU03WjBKQlEzWkRMRVZCUVVVc1EwRkJReXhEUVVGRExFTkJRVU1zUzBGQlN5eERRVUZETEU5QlFVOHNRMEZCUXl4RFFVRkRMRU5CUVVNc1NVRkJTU3hEUVVGRExFdEJRVXNzUTBGQlF5eFBRVUZQTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8yOUNRVU42UXl4TlFVRk5MRU5CUVVNc1MwRkJTeXhEUVVGRE8yZENRVU5xUWl4RFFVRkRPMmRDUVVORUxFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4TlFVRk5MRXRCUVVzc1EwRkJReXhEUVVGRExFMUJRVTBzUTBGQlF5eERRVUZETEVOQlFVTTdiMEpCUTNoQ0xFMUJRVTBzUTBGQlF5eExRVUZMTEVOQlFVTTdaMEpCUTJwQ0xFTkJRVU03WjBKQlEwUXNSMEZCUnl4RFFVRkRMRU5CUVVNc1NVRkJTU3hEUVVGRExFZEJRVWNzUTBGQlF5eEZRVUZGTEVOQlFVTXNSMEZCUnl4RFFVRkRMRU5CUVVNc1RVRkJUU3hGUVVGRkxFVkJRVVVzUTBGQlF5eEZRVUZGTEVOQlFVTTdiMEpCUTJoRExFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNc1MwRkJTeXhEUVVGRExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPM2RDUVVOb1FpeE5RVUZOTEVOQlFVTXNTMEZCU3l4RFFVRkRPMjlDUVVOcVFpeERRVUZETzJkQ1FVTk1MRU5CUVVNN1owSkJRMFFzVFVGQlRTeERRVUZETEVsQlFVa3NRMEZCUXp0WlFVTm9RaXhEUVVGRE8xbEJRMFFzU1VGQlNTeEpRVUZaTEVOQlFVTTdXVUZEYWtJc1NVRkJTU3hOUVVGTkxFZEJRV0VzUlVGQlJTeERRVUZETzFsQlF6RkNMRWxCUVVrc1RVRkJUU3hIUVVGaExFVkJRVVVzUTBGQlF6dFpRVU14UWl4SFFVRkhMRU5CUVVNc1EwRkJReXhKUVVGSkxFbEJRVWtzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXp0blFrRkRZaXhGUVVGRkxFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNZMEZCWXl4RFFVRkRMRWxCUVVrc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF6dHZRa0ZEZWtJc1RVRkJUU3hEUVVGRExFbEJRVWtzUTBGQlF5eEpRVUZKTEVOQlFVTXNRMEZCUXp0blFrRkRkRUlzUTBGQlF6dFpRVU5NTEVOQlFVTTdXVUZEUkN4SFFVRkhMRU5CUVVNc1EwRkJReXhKUVVGSkxFbEJRVWtzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXp0blFrRkRZaXhGUVVGRkxFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNZMEZCWXl4RFFVRkRMRWxCUVVrc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF6dHZRa0ZEZWtJc1RVRkJUU3hEUVVGRExFbEJRVWtzUTBGQlF5eEpRVUZKTEVOQlFVTXNRMEZCUXp0blFrRkRkRUlzUTBGQlF6dFpRVU5NTEVOQlFVTTdXVUZEUkN4TlFVRk5MRU5CUVVNc1NVRkJTU3hGUVVGRkxFTkJRVU03V1VGRFpDeE5RVUZOTEVOQlFVTXNTVUZCU1N4RlFVRkZMRU5CUVVNN1dVRkRaQ3hGUVVGRkxFTkJRVU1zUTBGQlF5eE5RVUZOTEVOQlFVTXNTVUZCU1N4RFFVRkRMRWRCUVVjc1EwRkJReXhMUVVGTExFMUJRVTBzUTBGQlF5eEpRVUZKTEVOQlFVTXNSMEZCUnl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8yZENRVU40UXl4TlFVRk5MRU5CUVVNc1MwRkJTeXhEUVVGRE8xbEJRMnBDTEVOQlFVTTdXVUZEUkN4SFFVRkhMRU5CUVVNc1EwRkJReXhEUVVGRExFZEJRVWNzUTBGQlF5eEZRVUZGTEVOQlFVTXNSMEZCUnl4TlFVRk5MRU5CUVVNc1RVRkJUU3hGUVVGRkxFVkJRVVVzUTBGQlF5eEZRVUZGTEVOQlFVTTdaMEpCUTJwRExFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4TlFVRk5MRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU1zUzBGQlN5eERRVUZETEVOQlFVTXNUVUZCVFN4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF5eERRVUZETzI5Q1FVTm9ReXhOUVVGTkxFTkJRVU1zUzBGQlN5eERRVUZETzJkQ1FVTnFRaXhEUVVGRE8xbEJRMHdzUTBGQlF6dFpRVU5FTEUxQlFVMHNRMEZCUXl4SlFVRkpMRU5CUVVNN1VVRkRhRUk3V1VGRFNTeE5RVUZOTEVOQlFVTXNTMEZCU3l4RFFVRkRPMGxCUTNKQ0xFTkJRVU03UVVGRFRDeERRVUZETzBGQk4wUmxMSEZDUVVGaExHZENRVFpFTlVJc1EwRkJRU0o5IiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG4ndXNlIHN0cmljdCc7XHJcbnZhciBfX2V4dGVuZHMgPSAodGhpcyAmJiB0aGlzLl9fZXh0ZW5kcykgfHwgZnVuY3Rpb24gKGQsIGIpIHtcclxuICAgIGZvciAodmFyIHAgaW4gYikgaWYgKGIuaGFzT3duUHJvcGVydHkocCkpIGRbcF0gPSBiW3BdO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn07XHJcbnZhciBiYXNlX2V2ZW50XzEgPSByZXF1aXJlKCcuL2Jhc2UtZXZlbnQnKTtcclxudmFyIEV2ZW50UXVldWVfMSA9IHJlcXVpcmUoJy4vRXZlbnRRdWV1ZScpO1xyXG4vKipcclxuICogRXZlbnQgdGhhdCBzdGF5cyBpbiBhIHF1ZXVlIHVudGlsIHlvdSBwcm9jZXNzIHRoZSBxdWV1ZS4gQWxsb3dzIGZpbmUtZ3JhaW5lZFxyXG4gKiBjb250cm9sIG92ZXIgd2hlbiBldmVudHMgaGFwcGVuLlxyXG4gKiAtIE9wdGlvbmFsbHkgY29uZGVuc2VzIG11bHRpcGxlIHBvc3QoKSBjYWxscyBpbnRvIG9uZS5cclxuICogLSBIYW5kbGVycyBhcmUgY2FsbGVkIG9ubHkgZm9yIGV2ZW50cyBwb3N0ZWQgYWZ0ZXIgdGhleSB3ZXJlIGF0dGFjaGVkLlxyXG4gKiAtIEhhbmRsZXJzIGFyZSBub3QgY2FsbGVkIGFueW1vcmUgd2hlbiB0aGV5IGFyZSBkZXRhY2hlZCwgZXZlbiBpZiBhIHBvc3QoKSBpcyBpbiBwcm9ncmVzc1xyXG4gKi9cclxudmFyIFF1ZXVlZEV2ZW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhRdWV1ZWRFdmVudCwgX3N1cGVyKTtcclxuICAgIC8qKlxyXG4gICAgICogQ29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSBvcHRzIE9wdGlvbmFsLCBhbiBvYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nIG1lbWJlcnM6XHJcbiAgICAgKiAgICAgICAgICAgICAtIGNvbmRlbnNlZDogYSBCb29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0byBjb25kZW5zZSBtdWx0aXBsZSBjYWxscyB0byBwb3N0KCkgaW50byBvbmUgKGRlZmF1bHQgZmFsc2UpXHJcbiAgICAgKiAgICAgICAgICAgICAtIHF1ZXVlOiBhIHNwZWNpZmljIGV2ZW50IHF1ZXVlIHRvIHVzZS4gVGhlIGdsb2JhbCBFdmVudFF1ZXVlIGluc3RhbmNlIGlzIHVzZWQgaWYgbm90IGdpdmVuLlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBRdWV1ZWRFdmVudChvcHRzKSB7XHJcbiAgICAgICAgX3N1cGVyLmNhbGwodGhpcyk7XHJcbiAgICAgICAgdGhpcy5fcXVldWVkID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0cztcclxuICAgICAgICB2YXIgb3B0aW9ucyA9IG9wdHMgfHwge307XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmNvbmRlbnNlZCA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IG9wdGlvbnMuY29uZGVuc2VkO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fY29uZGVuc2VkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5xdWV1ZSA9PT0gJ29iamVjdCcgJiYgb3B0aW9ucy5xdWV1ZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZSA9IG9wdGlvbnMucXVldWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgUXVldWVkRXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcXVldWUgPSAodGhpcy5fcXVldWUgPyB0aGlzLl9xdWV1ZSA6IEV2ZW50UXVldWVfMS5kZWZhdWx0Lmdsb2JhbCgpKTtcclxuICAgICAgICBpZiAodGhpcy5fY29uZGVuc2VkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZERhdGEgPSBhcmdzO1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGltbWVkaWF0ZWx5IG1hcmsgbm9uLXF1ZXVlZCB0byBhbGxvdyBuZXcgQXN5bmNFdmVudCB0byBoYXBwZW4gYXMgcmVzdWx0XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gb2YgY2FsbGluZyBoYW5kbGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLl9xdWV1ZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAvLyBjYWNoZSBsaXN0ZW5lcnMgYW5kIGRhdGEgYmVjYXVzZSB0aGV5IG1pZ2h0IGNoYW5nZSB3aGlsZSBjYWxsaW5nIGV2ZW50IGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBfdGhpcy5fcXVldWVkRGF0YTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gX3RoaXMuX3F1ZXVlZExpc3RlbmVycztcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9jYWxsKGxpc3RlbmVyLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLl9jYWxsKGxpc3RlbmVyLCBhcmdzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHJldHVybiBRdWV1ZWRFdmVudDtcclxufShiYXNlX2V2ZW50XzEuQmFzZUV2ZW50KSk7XHJcbmV4cG9ydHMuUXVldWVkRXZlbnQgPSBRdWV1ZWRFdmVudDtcclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBldmVudHMgd2l0aG91dCBkYXRhXHJcbiAqL1xyXG52YXIgVm9pZFF1ZXVlZEV2ZW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhWb2lkUXVldWVkRXZlbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBWb2lkUXVldWVkRXZlbnQoKSB7XHJcbiAgICAgICAgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIGV2ZW50LlxyXG4gICAgICovXHJcbiAgICBWb2lkUXVldWVkRXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5wb3N0LmNhbGwodGhpcywgdW5kZWZpbmVkKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gVm9pZFF1ZXVlZEV2ZW50O1xyXG59KFF1ZXVlZEV2ZW50KSk7XHJcbmV4cG9ydHMuVm9pZFF1ZXVlZEV2ZW50ID0gVm9pZFF1ZXVlZEV2ZW50O1xyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbnZhciBFcnJvclF1ZXVlZEV2ZW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhFcnJvclF1ZXVlZEV2ZW50LCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gRXJyb3JRdWV1ZWRFdmVudCgpIHtcclxuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuICAgIEVycm9yUXVldWVkRXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6IFwiICsgZGF0YS5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5wb3N0LmNhbGwodGhpcywgZGF0YSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEVycm9yUXVldWVkRXZlbnQ7XHJcbn0oUXVldWVkRXZlbnQpKTtcclxuZXhwb3J0cy5FcnJvclF1ZXVlZEV2ZW50ID0gRXJyb3JRdWV1ZWRFdmVudDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pY1hWbGRXVmtMV1YyWlc1MExtcHpJaXdpYzI5MWNtTmxVbTl2ZENJNklpSXNJbk52ZFhKalpYTWlPbHNpTGk0dkxpNHZjM0pqTDJ4cFlpOXhkV1YxWldRdFpYWmxiblF1ZEhNaVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWtGQlFVRXNLMFJCUVN0RU8wRkJReTlFTEdWQlFXVTdRVUZGWml4WlFVRlpMRU5CUVVNN096czdPenRCUVVWaUxESkNRVUUwUXl4alFVRmpMRU5CUVVNc1EwRkJRVHRCUVVNelJDd3lRa0ZCYjBNc1kwRkJZeXhEUVVGRExFTkJRVUU3UVVGblFtNUVPenM3T3pzN1IwRk5SenRCUVVOSU8wbEJRVzlETEN0Q1FVRlpPMGxCWVRWRE96czdPenRQUVV0SE8wbEJRMGdzY1VKQlFWa3NTVUZCYzBJN1VVRkRPVUlzYVVKQlFVOHNRMEZCUXp0UlFWaEtMRmxCUVU4c1IwRkJXU3hMUVVGTExFTkJRVU03VVVGWk4wSXNTVUZCU1N4RFFVRkRMRTlCUVU4c1IwRkJSeXhKUVVGSkxFTkJRVU03VVVGRGNFSXNTVUZCU1N4UFFVRlBMRWRCUVc5Q0xFbEJRVWtzU1VGQlNTeEZRVUZGTEVOQlFVTTdVVUZETVVNc1JVRkJSU3hEUVVGRExFTkJRVU1zVDBGQlR5eFBRVUZQTEVOQlFVTXNVMEZCVXl4TFFVRkxMRk5CUVZNc1EwRkJReXhEUVVGRExFTkJRVU03V1VGRGVrTXNTVUZCU1N4RFFVRkRMRlZCUVZVc1IwRkJSeXhQUVVGUExFTkJRVU1zVTBGQlV5eERRVUZETzFGQlEzaERMRU5CUVVNN1VVRkJReXhKUVVGSkxFTkJRVU1zUTBGQlF6dFpRVU5LTEVsQlFVa3NRMEZCUXl4VlFVRlZMRWRCUVVjc1MwRkJTeXhEUVVGRE8xRkJRelZDTEVOQlFVTTdVVUZEUkN4RlFVRkZMRU5CUVVNc1EwRkJReXhQUVVGUExFOUJRVThzUTBGQlF5eExRVUZMTEV0QlFVc3NVVUZCVVN4SlFVRkpMRTlCUVU4c1EwRkJReXhMUVVGTExFdEJRVXNzU1VGQlNTeERRVUZETEVOQlFVTXNRMEZCUXp0WlFVTTVSQ3hKUVVGSkxFTkJRVU1zVFVGQlRTeEhRVUZITEU5QlFVOHNRMEZCUXl4TFFVRkxMRU5CUVVNN1VVRkRhRU1zUTBGQlF6dEpRVU5NTEVOQlFVTTdTVUZUVFN3d1FrRkJTU3hIUVVGWU8xRkJRVUVzYVVKQmEwTkRPMUZCYkVOWExHTkJRV003WVVGQlpDeFhRVUZqTEVOQlFXUXNjMEpCUVdNc1EwRkJaQ3hKUVVGak8xbEJRV1FzTmtKQlFXTTdPMUZCUTNSQ0xFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRlZCUVZVc1NVRkJTU3hKUVVGSkxFTkJRVU1zVlVGQlZTeERRVUZETEUxQlFVMHNTMEZCU3l4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRMjVFTEUxQlFVMHNRMEZCUXp0UlFVTllMRU5CUVVNN1VVRkRSQ3hKUVVGSkxFdEJRVXNzUjBGQlJ5eERRVUZETEVsQlFVa3NRMEZCUXl4TlFVRk5MRWRCUVVjc1NVRkJTU3hEUVVGRExFMUJRVTBzUjBGQlJ5eHZRa0ZCVlN4RFFVRkRMRTFCUVUwc1JVRkJSU3hEUVVGRExFTkJRVU03VVVGRE9VUXNSVUZCUlN4RFFVRkRMRU5CUVVNc1NVRkJTU3hEUVVGRExGVkJRVlVzUTBGQlF5eERRVUZETEVOQlFVTTdXVUZEYkVJc1NVRkJTU3hEUVVGRExGZEJRVmNzUjBGQlJ5eEpRVUZKTEVOQlFVTTdXVUZEZUVJc1NVRkJTU3hEUVVGRExHZENRVUZuUWl4SFFVRkhMRWxCUVVrc1EwRkJReXhWUVVGVkxFTkJRVU03V1VGRGVFTXNSVUZCUlN4RFFVRkRMRU5CUVVNc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF5eERRVUZETEVOQlFVTTdaMEpCUTJZc1RVRkJUU3hEUVVGRE8xbEJRMWdzUTBGQlF6dFpRVUZETEVsQlFVa3NRMEZCUXl4RFFVRkRPMmRDUVVOS0xFbEJRVWtzUTBGQlF5eFBRVUZQTEVkQlFVY3NTVUZCU1N4RFFVRkRPMmRDUVVOd1FpeExRVUZMTEVOQlFVTXNSMEZCUnl4RFFVRkRPMjlDUVVOT0xEQkZRVUV3UlR0dlFrRkRNVVVzYzBKQlFYTkNPMjlDUVVOMFFpeExRVUZKTEVOQlFVTXNUMEZCVHl4SFFVRkhMRXRCUVVzc1EwRkJRenR2UWtGRGNrSXNhMFpCUVd0R08yOUNRVU5zUml4SlFVRkpMRWxCUVVrc1IwRkJSeXhMUVVGSkxFTkJRVU1zVjBGQlZ5eERRVUZETzI5Q1FVTTFRaXhKUVVGSkxGTkJRVk1zUjBGQlJ5eExRVUZKTEVOQlFVTXNaMEpCUVdkQ0xFTkJRVU03YjBKQlEzUkRMRWRCUVVjc1EwRkJReXhEUVVGRExFbEJRVWtzUTBGQlF5eEhRVUZITEVOQlFVTXNSVUZCUlN4RFFVRkRMRWRCUVVjc1UwRkJVeXhEUVVGRExFMUJRVTBzUlVGQlJTeEZRVUZGTEVOQlFVTXNSVUZCUlN4RFFVRkRPM2RDUVVONFF5eEpRVUZKTEZGQlFWRXNSMEZCUnl4VFFVRlRMRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU03ZDBKQlF6VkNMRXRCUVVrc1EwRkJReXhMUVVGTExFTkJRVU1zVVVGQlVTeEZRVUZGTEVsQlFVa3NRMEZCUXl4RFFVRkRPMjlDUVVNdlFpeERRVUZETzJkQ1FVTk1MRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRMUFzUTBGQlF6dFJRVU5NTEVOQlFVTTdVVUZCUXl4SlFVRkpMRU5CUVVNc1EwRkJRenRaUVVOS0xFbEJRVWtzVTBGQlV5eEhRVUZITEVsQlFVa3NRMEZCUXl4VlFVRlZMRU5CUVVNN1dVRkRhRU1zUzBGQlN5eERRVUZETEVkQlFVY3NRMEZCUXp0blFrRkRUaXhIUVVGSExFTkJRVU1zUTBGQlF5eEpRVUZKTEVOQlFVTXNSMEZCUnl4RFFVRkRMRVZCUVVVc1EwRkJReXhIUVVGSExGTkJRVk1zUTBGQlF5eE5RVUZOTEVWQlFVVXNSVUZCUlN4RFFVRkRMRVZCUVVVc1EwRkJRenR2UWtGRGVFTXNTVUZCU1N4UlFVRlJMRWRCUVVjc1UwRkJVeXhEUVVGRExFTkJRVU1zUTBGQlF5eERRVUZETzI5Q1FVTTFRaXhMUVVGSkxFTkJRVU1zUzBGQlN5eERRVUZETEZGQlFWRXNSVUZCUlN4SlFVRkpMRU5CUVVNc1EwRkJRenRuUWtGREwwSXNRMEZCUXp0WlFVTk1MRU5CUVVNc1EwRkJReXhEUVVGRE8xRkJRMUFzUTBGQlF6dEpRVU5NTEVOQlFVTTdTVUZEVEN4clFrRkJRenRCUVVGRUxFTkJRVU1zUVVFelJVUXNRMEZCYjBNc2MwSkJRVk1zUjBFeVJUVkRPMEZCTTBWWkxHMUNRVUZYTEdOQk1rVjJRaXhEUVVGQk8wRkJSVVE3TzBkQlJVYzdRVUZEU0R0SlFVRnhReXh0UTBGQmFVSTdTVUZCZEVRN1VVRkJjVU1zT0VKQlFXbENPMGxCVVhSRUxFTkJRVU03U1VGT1J6czdUMEZGUnp0SlFVTkpMRGhDUVVGSkxFZEJRVmc3VVVGRFNTeG5Ra0ZCU3l4RFFVRkRMRWxCUVVrc1dVRkJReXhUUVVGVExFTkJRVU1zUTBGQlF6dEpRVU14UWl4RFFVRkRPMGxCUTB3c2MwSkJRVU03UVVGQlJDeERRVUZETEVGQlVrUXNRMEZCY1VNc1YwRkJWeXhIUVZFdlF6dEJRVkpaTEhWQ1FVRmxMR3RDUVZFelFpeERRVUZCTzBGQlIwUTdPMGRCUlVjN1FVRkRTRHRKUVVGelF5eHZRMEZCYTBJN1NVRkJlRVE3VVVGQmMwTXNPRUpCUVd0Q08wbEJVWGhFTEVOQlFVTTdTVUZPVlN3clFrRkJTU3hIUVVGWUxGVkJRVmtzU1VGQlZ6dFJRVU51UWl4RlFVRkZMRU5CUVVNc1EwRkJReXhEUVVGRExFbEJRVWtzUTBGQlF5eFZRVUZWTEVsQlFVa3NTVUZCU1N4RFFVRkRMRlZCUVZVc1EwRkJReXhOUVVGTkxFdEJRVXNzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXp0WlFVTnVSQ3hOUVVGTkxFbEJRVWtzUzBGQlN5eERRVUZETERSRVFVRXdSQ3hKUVVGSkxFTkJRVU1zVDBGQlV5eERRVUZETEVOQlFVTTdVVUZET1VZc1EwRkJRenRSUVVORUxHZENRVUZMTEVOQlFVTXNTVUZCU1N4WlFVRkRMRWxCUVVrc1EwRkJReXhEUVVGRE8wbEJRM0pDTEVOQlFVTTdTVUZEVEN4MVFrRkJRenRCUVVGRUxFTkJRVU1zUVVGU1JDeERRVUZ6UXl4WFFVRlhMRWRCVVdoRU8wRkJVbGtzZDBKQlFXZENMRzFDUVZFMVFpeERRVUZCSW4wPSIsIi8vIENvcHlyaWdodCAoYykgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuJ3VzZSBzdHJpY3QnO1xyXG52YXIgX19leHRlbmRzID0gKHRoaXMgJiYgdGhpcy5fX2V4dGVuZHMpIHx8IGZ1bmN0aW9uIChkLCBiKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIGIpIGlmIChiLmhhc093blByb3BlcnR5KHApKSBkW3BdID0gYltwXTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59O1xyXG52YXIgYmFzZV9ldmVudF8xID0gcmVxdWlyZSgnLi9iYXNlLWV2ZW50Jyk7XHJcbi8qKlxyXG4gKiBUaGlzIGlzIGEgdHJ1ZSBFdmVudEVtaXR0ZXIgcmVwbGFjZW1lbnQ6IHRoZSBoYW5kbGVycyBhcmUgY2FsbGVkIHN5bmNocm9ub3VzbHkgd2hlblxyXG4gKiB5b3UgcG9zdCB0aGUgZXZlbnQuXHJcbiAqIC0gQWxsb3dzIGJldHRlciBlcnJvciBoYW5kbGluZyBieSBhZ2dyZWdhdGluZyBhbnkgZXJyb3JzIHRocm93biBieSBoYW5kbGVycy5cclxuICogLSBQcmV2ZW50cyBsaXZlbG9jayBieSB0aHJvd2luZyBhbiBlcnJvciB3aGVuIHJlY3Vyc2lvbiBkZXB0aCBpcyBhYm92ZSBhIG1heGltdW0uXHJcbiAqIC0gSGFuZGxlcnMgYXJlIGNhbGxlZCBvbmx5IGZvciBldmVudHMgcG9zdGVkIGFmdGVyIHRoZXkgd2VyZSBhdHRhY2hlZC5cclxuICogLSBIYW5kbGVycyBhcmUgbm90IGNhbGxlZCBhbnltb3JlIHdoZW4gdGhleSBhcmUgZGV0YWNoZWQsIGV2ZW4gaWYgYSBwb3N0KCkgaXMgaW4gcHJvZ3Jlc3NcclxuICovXHJcbnZhciBTeW5jRXZlbnQgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKFN5bmNFdmVudCwgX3N1cGVyKTtcclxuICAgIGZ1bmN0aW9uIFN5bmNFdmVudCgpIHtcclxuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZWN1cnNpdmUgcG9zdCgpIGludm9jYXRpb25zXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5fcmVjdXJzaW9uID0gMDtcclxuICAgIH1cclxuICAgIFN5bmNFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9yZWN1cnNpb24rKztcclxuICAgICAgICBpZiAoU3luY0V2ZW50Lk1BWF9SRUNVUlNJT05fREVQVEggPiAwICYmXHJcbiAgICAgICAgICAgIHRoaXMuX3JlY3Vyc2lvbiA+IFN5bmNFdmVudC5NQVhfUkVDVVJTSU9OX0RFUFRIKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZXZlbnQgZmlyZWQgcmVjdXJzaXZlbHknKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gY29weSBhIHJlZmVyZW5jZSB0byB0aGUgYXJyYXkgYmVjYXVzZSB0aGlzLl9saXN0ZW5lcnMgbWlnaHQgYmUgcmVwbGFjZWQgZHVyaW5nXHJcbiAgICAgICAgLy8gdGhlIGhhbmRsZXIgY2FsbHNcclxuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3JlY3Vyc2lvbi0tO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogTWF4aW11bSBudW1iZXIgb2YgdGltZXMgdGhhdCBhbiBldmVudCBoYW5kbGVyIG1heSBjYXVzZSB0aGUgc2FtZSBldmVudFxyXG4gICAgICogcmVjdXJzaXZlbHkuXHJcbiAgICAgKi9cclxuICAgIFN5bmNFdmVudC5NQVhfUkVDVVJTSU9OX0RFUFRIID0gMTA7XHJcbiAgICByZXR1cm4gU3luY0V2ZW50O1xyXG59KGJhc2VfZXZlbnRfMS5CYXNlRXZlbnQpKTtcclxuZXhwb3J0cy5TeW5jRXZlbnQgPSBTeW5jRXZlbnQ7XHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgZXZlbnRzIHdpdGhvdXQgZGF0YVxyXG4gKi9cclxudmFyIFZvaWRTeW5jRXZlbnQgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKFZvaWRTeW5jRXZlbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBWb2lkU3luY0V2ZW50KCkge1xyXG4gICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBldmVudC5cclxuICAgICAqL1xyXG4gICAgVm9pZFN5bmNFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBfc3VwZXIucHJvdG90eXBlLnBvc3QuY2FsbCh0aGlzLCB1bmRlZmluZWQpO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBWb2lkU3luY0V2ZW50O1xyXG59KFN5bmNFdmVudCkpO1xyXG5leHBvcnRzLlZvaWRTeW5jRXZlbnQgPSBWb2lkU3luY0V2ZW50O1xyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbnZhciBFcnJvclN5bmNFdmVudCA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XHJcbiAgICBfX2V4dGVuZHMoRXJyb3JTeW5jRXZlbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBFcnJvclN5bmNFdmVudCgpIHtcclxuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuICAgIEVycm9yU3luY0V2ZW50LnByb3RvdHlwZS5wb3N0ID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICBpZiAodGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6IFwiICsgZGF0YS5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5wb3N0LmNhbGwodGhpcywgZGF0YSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEVycm9yU3luY0V2ZW50O1xyXG59KFN5bmNFdmVudCkpO1xyXG5leHBvcnRzLkVycm9yU3luY0V2ZW50ID0gRXJyb3JTeW5jRXZlbnQ7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaWMzbHVZeTFsZG1WdWRDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpJanBiSWk0dUx5NHVMM055WXk5c2FXSXZjM2x1WXkxbGRtVnVkQzUwY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pUVVGQlFTd3JSRUZCSzBRN1FVRkRMMFFzWlVGQlpUdEJRVVZtTEZsQlFWa3NRMEZCUXpzN096czdPMEZCUldJc01rSkJRV3RETEdOQlFXTXNRMEZCUXl4RFFVRkJPMEZCUldwRU96czdPenM3TzBkQlQwYzdRVUZEU0R0SlFVRnJReXcyUWtGQldUdEpRVUU1UXp0UlFVRnJReXc0UWtGQldUdFJRVkV4UXpzN1YwRkZSenRSUVVOTExHVkJRVlVzUjBGQlZ5eERRVUZETEVOQlFVTTdTVUV3UW01RExFTkJRVU03U1VGc1FsVXNkMEpCUVVrc1IwRkJXRHRSUVVGWkxHTkJRV003WVVGQlpDeFhRVUZqTEVOQlFXUXNjMEpCUVdNc1EwRkJaQ3hKUVVGak8xbEJRV1FzTmtKQlFXTTdPMUZCUTNSQ0xFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMRlZCUVZVc1NVRkJTU3hKUVVGSkxFTkJRVU1zVlVGQlZTeERRVUZETEUxQlFVMHNTMEZCU3l4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRMjVFTEUxQlFVMHNRMEZCUXp0UlFVTllMRU5CUVVNN1VVRkRSQ3hKUVVGSkxFTkJRVU1zVlVGQlZTeEZRVUZGTEVOQlFVTTdVVUZEYkVJc1JVRkJSU3hEUVVGRExFTkJRVU1zVTBGQlV5eERRVUZETEcxQ1FVRnRRaXhIUVVGSExFTkJRVU03V1VGRGFrTXNTVUZCU1N4RFFVRkRMRlZCUVZVc1IwRkJSeXhUUVVGVExFTkJRVU1zYlVKQlFXMUNMRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRMnhFTEUxQlFVMHNTVUZCU1N4TFFVRkxMRU5CUVVNc2VVSkJRWGxDTEVOQlFVTXNRMEZCUXp0UlFVTXZReXhEUVVGRE8xRkJRMFFzYVVaQlFXbEdPMUZCUTJwR0xHOUNRVUZ2UWp0UlFVTndRaXhKUVVGSkxGTkJRVk1zUjBGQlJ5eEpRVUZKTEVOQlFVTXNWVUZCVlN4RFFVRkRPMUZCUTJoRExFZEJRVWNzUTBGQlF5eERRVUZETEVsQlFVa3NRMEZCUXl4SFFVRkhMRU5CUVVNc1JVRkJSU3hEUVVGRExFZEJRVWNzVTBGQlV5eERRVUZETEUxQlFVMHNSVUZCUlN4RlFVRkZMRU5CUVVNc1JVRkJSU3hEUVVGRE8xbEJRM2hETEVsQlFVa3NVVUZCVVN4SFFVRkhMRk5CUVZNc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF6dFpRVU0xUWl4SlFVRkpMRU5CUVVNc1MwRkJTeXhEUVVGRExGRkJRVkVzUlVGQlJTeEpRVUZKTEVOQlFVTXNRMEZCUXp0UlFVTXZRaXhEUVVGRE8xRkJRMFFzU1VGQlNTeERRVUZETEZWQlFWVXNSVUZCUlN4RFFVRkRPMGxCUTNSQ0xFTkJRVU03U1VGc1EwUTdPenRQUVVkSE8wbEJRMWNzTmtKQlFXMUNMRWRCUVZjc1JVRkJSU3hEUVVGRE8wbEJLMEp1UkN4blFrRkJRenRCUVVGRUxFTkJRVU1zUVVGeVEwUXNRMEZCYTBNc2MwSkJRVk1zUjBGeFF6RkRPMEZCY2tOWkxHbENRVUZUTEZsQmNVTnlRaXhEUVVGQk8wRkJSVVE3TzBkQlJVYzdRVUZEU0R0SlFVRnRReXhwUTBGQlpUdEpRVUZzUkR0UlFVRnRReXc0UWtGQlpUdEpRVkZzUkN4RFFVRkRPMGxCVGtjN08wOUJSVWM3U1VGRFNTdzBRa0ZCU1N4SFFVRllPMUZCUTBrc1owSkJRVXNzUTBGQlF5eEpRVUZKTEZsQlFVTXNVMEZCVXl4RFFVRkRMRU5CUVVNN1NVRkRNVUlzUTBGQlF6dEpRVU5NTEc5Q1FVRkRPMEZCUVVRc1EwRkJReXhCUVZKRUxFTkJRVzFETEZOQlFWTXNSMEZSTTBNN1FVRlNXU3h4UWtGQllTeG5Ra0ZSZWtJc1EwRkJRVHRCUVVWRU96dEhRVVZITzBGQlEwZzdTVUZCYjBNc2EwTkJRV2RDTzBsQlFYQkVPMUZCUVc5RExEaENRVUZuUWp0SlFWRndSQ3hEUVVGRE8wbEJUbFVzTmtKQlFVa3NSMEZCV0N4VlFVRlpMRWxCUVZjN1VVRkRia0lzUlVGQlJTeERRVUZETEVOQlFVTXNTVUZCU1N4RFFVRkRMR0ZCUVdFc1JVRkJSU3hMUVVGTExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdXVUZETjBJc1RVRkJUU3hKUVVGSkxFdEJRVXNzUTBGQlF5dzBSRUZCTUVRc1NVRkJTU3hEUVVGRExFOUJRVk1zUTBGQlF5eERRVUZETzFGQlF6bEdMRU5CUVVNN1VVRkRSQ3huUWtGQlN5eERRVUZETEVsQlFVa3NXVUZCUXl4SlFVRkpMRU5CUVVNc1EwRkJRenRKUVVOeVFpeERRVUZETzBsQlEwd3NjVUpCUVVNN1FVRkJSQ3hEUVVGRExFRkJVa1FzUTBGQmIwTXNVMEZCVXl4SFFWRTFRenRCUVZKWkxITkNRVUZqTEdsQ1FWRXhRaXhEUVVGQkluMD0iLCIvLyBDb3B5cmlnaHQgKGMpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcbid1c2Ugc3RyaWN0JztcclxuZnVuY3Rpb24gX19leHBvcnQobSkge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAoIWV4cG9ydHMuaGFzT3duUHJvcGVydHkocCkpIGV4cG9ydHNbcF0gPSBtW3BdO1xyXG59XHJcbl9fZXhwb3J0KHJlcXVpcmUoJy4vYmFzZS1ldmVudCcpKTtcclxuX19leHBvcnQocmVxdWlyZSgnLi9zeW5jLWV2ZW50JykpO1xyXG5fX2V4cG9ydChyZXF1aXJlKCcuL3F1ZXVlZC1ldmVudCcpKTtcclxuX19leHBvcnQocmVxdWlyZSgnLi9hc3luYy1ldmVudCcpKTtcclxuX19leHBvcnQocmVxdWlyZSgnLi9hbnktZXZlbnQnKSk7XHJcbnZhciBFdmVudFF1ZXVlXzEgPSByZXF1aXJlKCcuL0V2ZW50UXVldWUnKTtcclxudmFyIEV2ZW50UXVldWVfMiA9IHJlcXVpcmUoJy4vRXZlbnRRdWV1ZScpO1xyXG5leHBvcnRzLkV2ZW50UXVldWUgPSBFdmVudFF1ZXVlXzIuZGVmYXVsdDtcclxuLyoqXHJcbiAqIFRoZSBnbG9iYWwgZXZlbnQgcXVldWUgZm9yIFF1ZXVlZEV2ZW50c1xyXG4gKi9cclxuZnVuY3Rpb24gcXVldWUoKSB7XHJcbiAgICByZXR1cm4gRXZlbnRRdWV1ZV8xLmRlZmF1bHQuZ2xvYmFsKCk7XHJcbn1cclxuZXhwb3J0cy5xdWV1ZSA9IHF1ZXVlO1xyXG4vKipcclxuICogQ29udmVuaWVuY2UgZnVuY3Rpb24sIHNhbWUgYXMgRXZlbnRRdWV1ZS5nbG9iYWwoKS5mbHVzaE9uY2UoKS5cclxuICogRmx1c2hlcyB0aGUgUXVldWVkRXZlbnRzLCBjYWxsaW5nIGFsbCBldmVudHMgY3VycmVudGx5IGluIHRoZSBxdWV1ZSBidXQgbm90XHJcbiAqIGFueSBldmVudHMgcHV0IGludG8gdGhlIHF1ZXVlIGFzIGEgcmVzdWx0IG9mIHRoZSBmbHVzaC5cclxuICovXHJcbmZ1bmN0aW9uIGZsdXNoT25jZSgpIHtcclxuICAgIEV2ZW50UXVldWVfMS5kZWZhdWx0Lmdsb2JhbCgpLmZsdXNoT25jZSgpO1xyXG59XHJcbmV4cG9ydHMuZmx1c2hPbmNlID0gZmx1c2hPbmNlO1xyXG4vKipcclxuICogQ29udmVuaWVuY2UgZnVuY3Rpb24sIHNhbWUgYXMgRXZlbnRRdWV1ZS5nbG9iYWwoKS5mbHVzaCgpLlxyXG4gKiBGbHVzaGVzIHRoZSBRdWV1ZWRFdmVudHMsIGNhbGxpbmcgYWxsIGhhbmRsZXJzIGN1cnJlbnRseSBpbiB0aGUgcXVldWUgYW5kIHRob3NlXHJcbiAqIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXHJcbiAqIEBwYXJhbSBtYXhSb3VuZHMgT3B0aW9uYWwsIGRlZmF1bHQgMTAuIE51bWJlciBvZiBpdGVyYXRpb25zIGFmdGVyIHdoaWNoIHRvIHRocm93IGFuIGVycm9yIGJlY2F1c2VcclxuICogICAgICAgICAgICAgICAgICB0aGUgcXVldWUga2VlcHMgZmlsbGluZyB1cC4gU2V0IHRvIHVuZGVmaW5lZCBvciBudWxsIHRvIGRpc2FibGUgdGhpcy5cclxuICovXHJcbmZ1bmN0aW9uIGZsdXNoKG1heFJvdW5kcykge1xyXG4gICAgaWYgKG1heFJvdW5kcyA9PT0gdm9pZCAwKSB7IG1heFJvdW5kcyA9IDEwOyB9XHJcbiAgICBFdmVudFF1ZXVlXzEuZGVmYXVsdC5nbG9iYWwoKS5mbHVzaChtYXhSb3VuZHMpO1xyXG59XHJcbmV4cG9ydHMuZmx1c2ggPSBmbHVzaDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pYVc1a1pYZ3Vhbk1pTENKemIzVnlZMlZTYjI5MElqb2lJaXdpYzI5MWNtTmxjeUk2V3lJdUxpOHVMaTl6Y21NdmJHbGlMMmx1WkdWNExuUnpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSkJRVUZCTEN0RVFVRXJSRHRCUVVNdlJDeGxRVUZsTzBGQlJXWXNXVUZCV1N4RFFVRkRPenM3TzBGQlJXSXNhVUpCUVdNc1kwRkJZeXhEUVVGRExFVkJRVUU3UVVGRE4wSXNhVUpCUVdNc1kwRkJZeXhEUVVGRExFVkJRVUU3UVVGRE4wSXNhVUpCUVdNc1owSkJRV2RDTEVOQlFVTXNSVUZCUVR0QlFVTXZRaXhwUWtGQll5eGxRVUZsTEVOQlFVTXNSVUZCUVR0QlFVTTVRaXhwUWtGQll5eGhRVUZoTEVOQlFVTXNSVUZCUVR0QlFVVTFRaXd5UWtGQmIwTXNZMEZCWXl4RFFVRkRMRU5CUVVFN1FVRkRia1FzTWtKQlFXOURMR05CUVdNc1EwRkJRenRCUVVFelF5d3dRMEZCTWtNN1FVRkZia1E3TzBkQlJVYzdRVUZEU0R0SlFVTkpMRTFCUVUwc1EwRkJReXh2UWtGQlZTeERRVUZETEUxQlFVMHNSVUZCUlN4RFFVRkRPMEZCUXk5Q0xFTkJRVU03UVVGR1pTeGhRVUZMTEZGQlJYQkNMRU5CUVVFN1FVRkZSRHM3T3p0SFFVbEhPMEZCUTBnN1NVRkRTU3h2UWtGQlZTeERRVUZETEUxQlFVMHNSVUZCUlN4RFFVRkRMRk5CUVZNc1JVRkJSU3hEUVVGRE8wRkJRM0JETEVOQlFVTTdRVUZHWlN4cFFrRkJVeXhaUVVWNFFpeERRVUZCTzBGQlJVUTdPenM3T3p0SFFVMUhPMEZCUTBnc1pVRkJjMElzVTBGQmMwSTdTVUZCZEVJc2VVSkJRWE5DTEVkQlFYUkNMR05CUVhOQ08wbEJRM2hETEc5Q1FVRlZMRU5CUVVNc1RVRkJUU3hGUVVGRkxFTkJRVU1zUzBGQlN5eERRVUZETEZOQlFWTXNRMEZCUXl4RFFVRkRPMEZCUTNwRExFTkJRVU03UVVGR1pTeGhRVUZMTEZGQlJYQkNMRU5CUVVFaWZRPT0iXX0=
return require('ts-events');
});