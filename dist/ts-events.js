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
})();
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
                    var opts;
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
                    var opts;
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
})(AnyEvent);
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
})(base_event_1.BaseEvent);
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
})(AsyncEvent);
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
})(AsyncEvent);
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
})();
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
})(base_event_1.BaseEvent);
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
})(QueuedEvent);
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
})(QueuedEvent);
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
})(base_event_1.BaseEvent);
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
})(SyncEvent);
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
})(SyncEvent);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkaXN0L2xpYi9FdmVudFF1ZXVlLmpzIiwiZGlzdC9saWIvYW55LWV2ZW50LmpzIiwiZGlzdC9saWIvYXN5bmMtZXZlbnQuanMiLCJkaXN0L2xpYi9iYXNlLWV2ZW50LmpzIiwiZGlzdC9saWIvb2JqZWN0cy5qcyIsImRpc3QvbGliL3F1ZXVlZC1ldmVudC5qcyIsImRpc3QvbGliL3N5bmMtZXZlbnQuanMiLCJkaXN0L2xpYi9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG4ndXNlIHN0cmljdCc7XHJcbnZhciBzeW5jX2V2ZW50XzEgPSByZXF1aXJlKCcuL3N5bmMtZXZlbnQnKTtcclxuLyoqXHJcbiAqIFNpbXBsZSBzeW5jaHJvbm91cyBldmVudCBxdWV1ZSB0aGF0IG5lZWRzIHRvIGJlIGRyYWluZWQgbWFudWFsbHkuXHJcbiAqL1xyXG52YXIgRXZlbnRRdWV1ZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBFdmVudFF1ZXVlKCkge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFN5bmNFdmVudCB0cmlnZ2VyZWQgYWZ0ZXIgYW4gZXZlbnQgaXMgYWRkZWQgb3V0c2lkZSBvZiBhIGZsdXNoIG9wZXJhdGlvbi5cclxuICAgICAgICAgKiBAcGFyYW0gcXVldWUgVGhlIGV2ZW50IHF1ZXVlIGl0c2VsZlxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuZXZ0RmlsbGVkID0gbmV3IHN5bmNfZXZlbnRfMS5TeW5jRXZlbnQoKTtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTeW5jRXZlbnQgdHJpZ2dlcmVkIGFmdGVyIHRoZSBxdWV1ZSBpcyBmbHVzaGVkIGVtcHR5XHJcbiAgICAgICAgICogQHBhcmFtIHF1ZXVlIFRoZSBldmVudCBxdWV1ZSBpdHNlbGZcclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLmV2dERyYWluZWQgPSBuZXcgc3luY19ldmVudF8xLlN5bmNFdmVudCgpO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFF1ZXVlZCBlbGVtZW50c1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuX3F1ZXVlID0gW107XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogVHJ1ZSB3aGlsZSBmbHVzaCgpIG9yIGZsdXNoT25jZSgpIGlzIHJ1bm5pbmdcclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLl9mbHVzaGluZyA9IGZhbHNlO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgbW9kdWxlLWdsb2JhbCBldmVudCBxdWV1ZVxyXG4gICAgICovXHJcbiAgICBFdmVudFF1ZXVlLmdsb2JhbCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAoIUV2ZW50UXVldWUuX2luc3RhbmNlKSB7XHJcbiAgICAgICAgICAgIEV2ZW50UXVldWUucmVzZXRHbG9iYWwoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIEV2ZW50UXVldWUuX2luc3RhbmNlO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogVGVzdGluZyBwdXJwb3Nlc1xyXG4gICAgICovXHJcbiAgICBFdmVudFF1ZXVlLnJlc2V0R2xvYmFsID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIEV2ZW50UXVldWUuX2luc3RhbmNlID0gbmV3IEV2ZW50UXVldWUoKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdHJ1ZSBpZmYgdGhlIHF1ZXVlIGlzIGVtcHR5XHJcbiAgICAgKi9cclxuICAgIEV2ZW50UXVldWUucHJvdG90eXBlLmVtcHR5ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDA7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBBZGQgYW4gZWxlbWVudCB0byB0aGUgcXVldWUuIFRoZSBoYW5kbGVyIGlzIGNhbGxlZCB3aGVuIG9uZSBvZiB0aGUgZmx1c2hcclxuICAgICAqIG1ldGhvZHMgaXMgY2FsbGVkLlxyXG4gICAgICovXHJcbiAgICBFdmVudFF1ZXVlLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAoaGFuZGxlcikge1xyXG4gICAgICAgIHRoaXMuX3F1ZXVlLnB1c2goaGFuZGxlcik7XHJcbiAgICAgICAgaWYgKHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhdGhpcy5fZmx1c2hpbmcpIHtcclxuICAgICAgICAgICAgdGhpcy5ldnRGaWxsZWQucG9zdCh0aGlzKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxscyBhbGwgaGFuZGxlcnMgY3VycmVudGx5IGluIHRoZSBxdWV1ZS4gRG9lcyBub3QgY2FsbCBhbnkgaGFuZGxlcnMgYWRkZWRcclxuICAgICAqIGFzIGEgcmVzdWx0IG9mIHRoZSBmbHVzaFxyXG4gICAgICovXHJcbiAgICBFdmVudFF1ZXVlLnByb3RvdHlwZS5mbHVzaE9uY2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGVtcHR5ID0gKHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCk7XHJcbiAgICAgICAgdmFyIGZsdXNoaW5nID0gdGhpcy5fZmx1c2hpbmc7XHJcbiAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSB0cnVlO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHZhciBxdWV1ZSA9IHRoaXMuX3F1ZXVlO1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZSA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICBxdWV1ZVtpXSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkge1xyXG4gICAgICAgICAgICB0aGlzLl9mbHVzaGluZyA9IGZsdXNoaW5nO1xyXG4gICAgICAgICAgICBpZiAoIWVtcHR5ICYmICFmbHVzaGluZyAmJiB0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXZ0RHJhaW5lZC5wb3N0KHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogRmx1c2hlcyB0aGUgUXVldWVkRXZlbnRzLCBjYWxsaW5nIGFsbCBldmVudHMgY3VycmVudGx5IGluIHRoZSBxdWV1ZSBhbmQgdGhvc2VcclxuICAgICAqIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXHJcbiAgICAgKiBAcGFyYW0gbWF4Um91bmRzIE9wdGlvbmFsLCBkZWZhdWx0IDEwLiBOdW1iZXIgb2YgaXRlcmF0aW9ucyBhZnRlciB3aGljaCB0byB0aHJvdyBhbiBlcnJvciBiZWNhdXNlXHJcbiAgICAgKiAgICAgICAgICAgICAgICAgIHRoZSBxdWV1ZSBrZWVwcyBmaWxsaW5nIHVwLiBTZXQgdG8gbnVsbCB0byBkaXNhYmxlIHRoaXMuXHJcbiAgICAgKi9cclxuICAgIEV2ZW50UXVldWUucHJvdG90eXBlLmZsdXNoID0gZnVuY3Rpb24gKG1heFJvdW5kcykge1xyXG4gICAgICAgIGlmIChtYXhSb3VuZHMgPT09IHZvaWQgMCkgeyBtYXhSb3VuZHMgPSAxMDsgfVxyXG4gICAgICAgIHZhciBlbXB0eSA9ICh0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDApO1xyXG4gICAgICAgIHZhciBmbHVzaGluZyA9IHRoaXMuX2ZsdXNoaW5nO1xyXG4gICAgICAgIHRoaXMuX2ZsdXNoaW5nID0gdHJ1ZTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB2YXIgaSA9IDA7XHJcbiAgICAgICAgICAgIHdoaWxlICh0aGlzLl9xdWV1ZS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1heFJvdW5kcyA9PT0gJ251bWJlcicgJiYgaSA+PSBtYXhSb3VuZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigndW5hYmxlIHRvIGZsdXNoIHRoZSBxdWV1ZSBkdWUgdG8gcmVjdXJzaXZlbHkgYWRkZWQgZXZlbnQuIENsZWFyaW5nIHF1ZXVlIG5vdycpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5mbHVzaE9uY2UoKTtcclxuICAgICAgICAgICAgICAgICsraTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHtcclxuICAgICAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSBmbHVzaGluZztcclxuICAgICAgICAgICAgaWYgKCFlbXB0eSAmJiAhZmx1c2hpbmcgJiYgdGhpcy5fcXVldWUubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmV2dERyYWluZWQucG9zdCh0aGlzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICByZXR1cm4gRXZlbnRRdWV1ZTtcclxufSkoKTtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLmRlZmF1bHQgPSBFdmVudFF1ZXVlO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1FdmVudFF1ZXVlLmpzLm1hcCIsIi8vIENvcHlyaWdodCAoYykgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuJ3VzZSBzdHJpY3QnO1xyXG52YXIgX19leHRlbmRzID0gKHRoaXMgJiYgdGhpcy5fX2V4dGVuZHMpIHx8IGZ1bmN0aW9uIChkLCBiKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIGIpIGlmIChiLmhhc093blByb3BlcnR5KHApKSBkW3BdID0gYltwXTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59O1xyXG52YXIgb2JqZWN0c18xID0gcmVxdWlyZSgnLi9vYmplY3RzJyk7XHJcbnZhciBzeW5jX2V2ZW50XzEgPSByZXF1aXJlKCcuL3N5bmMtZXZlbnQnKTtcclxudmFyIGFzeW5jX2V2ZW50XzEgPSByZXF1aXJlKCcuL2FzeW5jLWV2ZW50Jyk7XHJcbnZhciBxdWV1ZWRfZXZlbnRfMSA9IHJlcXVpcmUoJy4vcXVldWVkLWV2ZW50Jyk7XHJcbihmdW5jdGlvbiAoRXZlbnRUeXBlKSB7XHJcbiAgICBFdmVudFR5cGVbRXZlbnRUeXBlW1wiU3luY1wiXSA9IDBdID0gXCJTeW5jXCI7XHJcbiAgICBFdmVudFR5cGVbRXZlbnRUeXBlW1wiQXN5bmNcIl0gPSAxXSA9IFwiQXN5bmNcIjtcclxuICAgIEV2ZW50VHlwZVtFdmVudFR5cGVbXCJRdWV1ZWRcIl0gPSAyXSA9IFwiUXVldWVkXCI7XHJcbn0pKGV4cG9ydHMuRXZlbnRUeXBlIHx8IChleHBvcnRzLkV2ZW50VHlwZSA9IHt9KSk7XHJcbnZhciBFdmVudFR5cGUgPSBleHBvcnRzLkV2ZW50VHlwZTtcclxuO1xyXG4vKipcclxuICogQW4gZXZlbnQgdGhhdCBiZWhhdmVzIGxpa2UgYSBTeW5jL0FzeW5jL1F1ZXVlZCBldmVudCBkZXBlbmRpbmcgb24gaG93XHJcbiAqIHlvdSBzdWJzY3JpYmUuXHJcbiAqL1xyXG52YXIgQW55RXZlbnQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gQW55RXZlbnQob3B0cykge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFVuZGVybHlpbmcgZXZlbnQgaW1wbGVtZW50YXRpb25zOyBvbmUgZm9yIGV2ZXJ5IGF0dGFjaCB0eXBlICsgb3B0cyBjb21iaW5hdGlvblxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuX2V2ZW50cyA9IFtdO1xyXG4gICAgICAgIGlmIChvcHRzICYmIG9wdHMubW9uaXRvckF0dGFjaCkge1xyXG4gICAgICAgICAgICB0aGlzLmV2dEZpcnN0QXR0YWNoZWQgPSBuZXcgVm9pZEFueUV2ZW50KCk7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0TGFzdERldGFjaGVkID0gbmV3IFZvaWRBbnlFdmVudCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogc2FtZSBhcyBhdHRhY2hTeW5jL2F0dGFjaEFzeW5jL2F0dGFjaFF1ZXVlZDsgYmFzZWQgb24gdGhlIGdpdmVuIGVudW1cclxuICAgICAqIEBwYXJhbSBtb2RlIGRldGVybWluZXMgd2hldGhlciB0byBhdHRhY2ggc3luYy9hc3luYy9xdWV1ZWRcclxuICAgICAqL1xyXG4gICAgQW55RXZlbnQucHJvdG90eXBlLmF0dGFjaCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBwcmV2Q291bnQgPSAoISF0aGlzLmV2dEZpcnN0QXR0YWNoZWQgPyB0aGlzLmxpc3RlbmVyQ291bnQoKSA6IDApO1xyXG4gICAgICAgIHZhciBtb2RlID0gRXZlbnRUeXBlLlN5bmM7XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgbW9kZSA9IGFyZ3Muc2hpZnQoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3dpdGNoIChtb2RlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLlN5bmM6XHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIG91cnNlbHZlcyBhcyBkZWZhdWx0ICdib3VuZFRvJyBhcmd1bWVudFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDAgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXJncy51bnNoaWZ0KHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB2YXIgZXZlbnRfMTtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fZXZlbnRzW2ldIGluc3RhbmNlb2Ygc3luY19ldmVudF8xLlN5bmNFdmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRfMSA9IHRoaXMuX2V2ZW50c1tpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWV2ZW50XzEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRfMSA9IG5ldyBzeW5jX2V2ZW50XzEuU3luY0V2ZW50KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50cy5wdXNoKGV2ZW50XzEpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBldmVudF8xLmF0dGFjaC5hcHBseShldmVudF8xLCBhcmdzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIEV2ZW50VHlwZS5Bc3luYzpcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgb3B0cztcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAxICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCBvdXJzZWx2ZXMgYXMgZGVmYXVsdCAnYm91bmRUbycgYXJndW1lbnRcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAwICYmIHR5cGVvZiBhcmdzWzBdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGV2ZW50XzI7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2V2ZW50c1tpXSBpbnN0YW5jZW9mIGFzeW5jX2V2ZW50XzEuQXN5bmNFdmVudFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgb2JqZWN0c18xLnNoYWxsb3dFcXVhbHModGhpcy5fZXZlbnRzW2ldLm9wdGlvbnMsIG9wdHMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudF8yID0gdGhpcy5fZXZlbnRzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghZXZlbnRfMikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudF8yID0gbmV3IGFzeW5jX2V2ZW50XzEuQXN5bmNFdmVudChvcHRzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzLnB1c2goZXZlbnRfMik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50XzIuYXR0YWNoLmFwcGx5KGV2ZW50XzIsIGFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLlF1ZXVlZDpcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgb3B0cztcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAxICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCBvdXJzZWx2ZXMgYXMgZGVmYXVsdCAnYm91bmRUbycgYXJndW1lbnRcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAwICYmIHR5cGVvZiBhcmdzWzBdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGV2ZW50XzM7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2V2ZW50c1tpXSBpbnN0YW5jZW9mIHF1ZXVlZF9ldmVudF8xLlF1ZXVlZEV2ZW50XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAmJiBvYmplY3RzXzEuc2hhbGxvd0VxdWFscyh0aGlzLl9ldmVudHNbaV0ub3B0aW9ucywgb3B0cykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50XzMgPSB0aGlzLl9ldmVudHNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFldmVudF8zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50XzMgPSBuZXcgcXVldWVkX2V2ZW50XzEuUXVldWVkRXZlbnQob3B0cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50cy5wdXNoKGV2ZW50XzMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBldmVudF8zLmF0dGFjaC5hcHBseShldmVudF8zLCBhcmdzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIEV2ZW50VHlwZScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5ldnRGaXJzdEF0dGFjaGVkICYmIHByZXZDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLmV2dEZpcnN0QXR0YWNoZWQucG9zdCgpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBldmVudCBoYW5kbGVycyBhcyBpZiBpdCB3ZXJlIGEgc3luYyBldmVudC4gSXQgaXMgc2ltcGx5IGNhbGxlZCAnYXR0YWNoJ1xyXG4gICAgICogc28gdGhhdCB0aGlzIGNsYXNzIGFkaGVyZXMgdG8gdGhlIEJhc2VFdmVudDxUPiBzaWduYXR1cmUuXHJcbiAgICAgKi9cclxuICAgIEFueUV2ZW50LnByb3RvdHlwZS5hdHRhY2hTeW5jID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYXJncy51bnNoaWZ0KEV2ZW50VHlwZS5TeW5jKTtcclxuICAgICAgICB0aGlzLmF0dGFjaC5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBldmVudCBoYW5kbGVycyBhcyBpZiBpdCB3ZXJlIGEgYS1zeW5jIGV2ZW50XHJcbiAgICAgKi9cclxuICAgIEFueUV2ZW50LnByb3RvdHlwZS5hdHRhY2hBc3luYyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuQXN5bmMpO1xyXG4gICAgICAgIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGV2ZW50IGhhbmRsZXJzIGFzIGlmIGl0IHdlcmUgYSBxdWV1ZWQgZXZlbnRcclxuICAgICAqL1xyXG4gICAgQW55RXZlbnQucHJvdG90eXBlLmF0dGFjaFF1ZXVlZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuUXVldWVkKTtcclxuICAgICAgICB0aGlzLmF0dGFjaC5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBldmVudCBoYW5kbGVycyByZWdhcmRsZXNzIG9mIHR5cGVcclxuICAgICAqL1xyXG4gICAgQW55RXZlbnQucHJvdG90eXBlLmRldGFjaCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBwcmV2Q291bnQgPSAoISF0aGlzLmV2dExhc3REZXRhY2hlZCA/IHRoaXMubGlzdGVuZXJDb3VudCgpIDogMCk7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgdGhpcy5fZXZlbnRzW2ldLmRldGFjaC5hcHBseSh0aGlzLl9ldmVudHNbaV0sIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoISF0aGlzLmV2dExhc3REZXRhY2hlZCAmJiBwcmV2Q291bnQgPiAwICYmIHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0TGFzdERldGFjaGVkLnBvc3QoKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBQb3N0IGFuIGV2ZW50IHRvIGFsbCBjdXJyZW50IGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBBbnlFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgLy8gbWFrZSBhIGNvcHkgb2YgdGhlIGFycmF5IGZpcnN0IHRvIGNvdmVyIHRoZSBjYXNlIHdoZXJlIGV2ZW50IGhhbmRsZXJzXHJcbiAgICAgICAgLy8gYXJlIGF0dGFjaGVkIGR1cmluZyB0aGUgcG9zdFxyXG4gICAgICAgIHZhciBldmVudHMgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBldmVudHMucHVzaCh0aGlzLl9ldmVudHNbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICA7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgZXZlbnRzW2ldLnBvc3QoZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogVGhlIG51bWJlciBvZiBhdHRhY2hlZCBsaXN0ZW5lcnNcclxuICAgICAqL1xyXG4gICAgQW55RXZlbnQucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IDA7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgcmVzdWx0ICs9IHRoaXMuX2V2ZW50c1tpXS5saXN0ZW5lckNvdW50KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEFueUV2ZW50O1xyXG59KSgpO1xyXG5leHBvcnRzLkFueUV2ZW50ID0gQW55RXZlbnQ7XHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgQW55RXZlbnRzIHdpdGhvdXQgZGF0YVxyXG4gKi9cclxudmFyIFZvaWRBbnlFdmVudCA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XHJcbiAgICBfX2V4dGVuZHMoVm9pZEFueUV2ZW50LCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gVm9pZEFueUV2ZW50KCkge1xyXG4gICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBBc3luY0V2ZW50LlxyXG4gICAgICovXHJcbiAgICBWb2lkQW55RXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5wb3N0LmNhbGwodGhpcywgdW5kZWZpbmVkKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gVm9pZEFueUV2ZW50O1xyXG59KShBbnlFdmVudCk7XHJcbmV4cG9ydHMuVm9pZEFueUV2ZW50ID0gVm9pZEFueUV2ZW50O1xyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbnZhciBFcnJvckFueUV2ZW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhFcnJvckFueUV2ZW50LCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gRXJyb3JBbnlFdmVudCgpIHtcclxuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuICAgIEVycm9yQW55RXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIGlmICh0aGlzLmxpc3RlbmVyQ291bnQoKSA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJlcnJvciBldmVudCBwb3N0ZWQgd2hpbGUgbm8gbGlzdGVuZXJzIGF0dGFjaGVkLiBFcnJvcjogXCIgKyBkYXRhLm1lc3NhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBfc3VwZXIucHJvdG90eXBlLnBvc3QuY2FsbCh0aGlzLCBkYXRhKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gRXJyb3JBbnlFdmVudDtcclxufSkoQW55RXZlbnQpO1xyXG5leHBvcnRzLkVycm9yQW55RXZlbnQgPSBFcnJvckFueUV2ZW50O1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1hbnktZXZlbnQuanMubWFwIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG4ndXNlIHN0cmljdCc7XHJcbnZhciBfX2V4dGVuZHMgPSAodGhpcyAmJiB0aGlzLl9fZXh0ZW5kcykgfHwgZnVuY3Rpb24gKGQsIGIpIHtcclxuICAgIGZvciAodmFyIHAgaW4gYikgaWYgKGIuaGFzT3duUHJvcGVydHkocCkpIGRbcF0gPSBiW3BdO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn07XHJcbnZhciBiYXNlX2V2ZW50XzEgPSByZXF1aXJlKCcuL2Jhc2UtZXZlbnQnKTtcclxuLyoqXHJcbiAqIEEtc3luY2hyb25vdXMgZXZlbnQuIEhhbmRsZXJzIGFyZSBjYWxsZWQgaW4gdGhlIG5leHQgTm9kZS5KUyBjeWNsZS5cclxuICogLSBPcHRpb25hbGx5IGNvbmRlbnNlcyBtdWx0aXBsZSBwb3N0KCkgY2FsbHMgaW50byBvbmUgKHRoZSBsYXN0IHBvc3QoKSBnZXRzIHRocm91Z2gpXHJcbiAqIC0gSGFuZGxlcnMgYXJlIGNhbGxlZCBvbmx5IGZvciBldmVudHMgcG9zdGVkIGFmdGVyIHRoZXkgd2VyZSBhdHRhY2hlZC5cclxuICogLSBIYW5kbGVycyBhcmUgbm90IGNhbGxlZCBhbnltb3JlIHdoZW4gdGhleSBhcmUgZGV0YWNoZWQsIGV2ZW4gaWYgYSBwb3N0KCkgaXMgaW4gcHJvZ3Jlc3NcclxuICovXHJcbnZhciBBc3luY0V2ZW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhBc3luY0V2ZW50LCBfc3VwZXIpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBDb25zdHJ1Y3RvclxyXG4gICAgICogQHBhcmFtIG9wdHMgT3B0aW9uYWwuIFZhcmlvdXMgc2V0dGluZ3M6XHJcbiAgICAgKiAgICAgICAgICAgICAtIGNvbmRlbnNlZDogYSBCb29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0byBjb25kZW5zZSBtdWx0aXBsZSBwb3N0KCkgY2FsbHMgd2l0aGluIHRoZSBzYW1lIGN5Y2xlLlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBBc3luY0V2ZW50KG9wdHMpIHtcclxuICAgICAgICBfc3VwZXIuY2FsbCh0aGlzKTtcclxuICAgICAgICB0aGlzLl9xdWV1ZWQgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRzO1xyXG4gICAgICAgIHZhciBvcHRpb25zID0gb3B0cyB8fCB7fTtcclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuY29uZGVuc2VkID09PSAnYm9vbGVhbicpIHtcclxuICAgICAgICAgICAgdGhpcy5fY29uZGVuc2VkID0gb3B0aW9ucy5jb25kZW5zZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9jb25kZW5zZWQgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFRoZSBkZWZhdWx0IHNjaGVkdWxlciB1c2VzIHNldEltbWVkaWF0ZSgpIG9yIHNldFRpbWVvdXQoLi4uLCAwKSBpZiBzZXRJbW1lZGlhdGUgaXMgbm90IGF2YWlsYWJsZS5cclxuICAgICAqL1xyXG4gICAgQXN5bmNFdmVudC5kZWZhdWx0U2NoZWR1bGVyID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgICovXHJcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIC8vIGJyb3dzZXJzIGRvbid0IGFsd2F5cyBzdXBwb3J0IHNldEltbWVkaWF0ZSgpXHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy8gbm9kZS5qc1xyXG4gICAgICAgICAgICBzZXRJbW1lZGlhdGUoY2FsbGJhY2spO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEJ5IGRlZmF1bHQsIEFzeW5jRXZlbnQgdXNlcyBzZXRJbW1lZGlhdGUoKSB0byBzY2hlZHVsZSBldmVudCBoYW5kbGVyIGludm9jYXRpb24uXHJcbiAgICAgKiBZb3UgY2FuIGNoYW5nZSB0aGlzIGZvciBlLmcuIHNldFRpbWVvdXQoLi4uLCAwKSBieSBjYWxsaW5nIHRoaXMgc3RhdGljIG1ldGhvZCBvbmNlLlxyXG4gICAgICogQHBhcmFtIHNjaGVkdWxlciBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYSBjYWxsYmFjayBhbmQgZXhlY3V0ZXMgaXQgaW4gdGhlIG5leHQgTm9kZS5KUyBjeWNsZS5cclxuICAgICAqL1xyXG4gICAgQXN5bmNFdmVudC5zZXRTY2hlZHVsZXIgPSBmdW5jdGlvbiAoc2NoZWR1bGVyKSB7XHJcbiAgICAgICAgQXN5bmNFdmVudC5fc2NoZWR1bGVyID0gc2NoZWR1bGVyO1xyXG4gICAgfTtcclxuICAgIEFzeW5jRXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5fY29uZGVuc2VkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZERhdGEgPSBhcmdzO1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBBc3luY0V2ZW50Ll9zY2hlZHVsZXIoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGltbWVkaWF0ZWx5IG1hcmsgbm9uLXF1ZXVlZCB0byBhbGxvdyBuZXcgQXN5bmNFdmVudCB0byBoYXBwZW4gYXMgcmVzdWx0XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gb2YgY2FsbGluZyBoYW5kbGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLl9xdWV1ZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAvLyBjYWNoZSBsaXN0ZW5lcnMgYW5kIGRhdGEgYmVjYXVzZSB0aGV5IG1pZ2h0IGNoYW5nZSB3aGlsZSBjYWxsaW5nIGV2ZW50IGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBfdGhpcy5fcXVldWVkRGF0YTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gX3RoaXMuX3F1ZXVlZExpc3RlbmVycztcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9jYWxsKGxpc3RlbmVyLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgQXN5bmNFdmVudC5fc2NoZWR1bGVyKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLl9jYWxsKGxpc3RlbmVyLCBhcmdzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8vIGluaGVyaXRlZFxyXG4gICAgQXN5bmNFdmVudC5wcm90b3R5cGUuX2NhbGwgPSBmdW5jdGlvbiAobGlzdGVuZXIsIGFyZ3MpIHtcclxuICAgICAgICAvLyBwZXJmb3JtYW5jZSBvcHRpbWl6YXRpb246IGRvbid0IHVzZSBjb25zZWN1dGl2ZSBub2RlanMgY3ljbGVzXHJcbiAgICAgICAgLy8gZm9yIGFzeW5jZXZlbnRzIGF0dGFjaGVkIHRvIGFzeW5jZXZlbnRzXHJcbiAgICAgICAgaWYgKGxpc3RlbmVyLmV2ZW50ICYmIGxpc3RlbmVyLmV2ZW50IGluc3RhbmNlb2YgQXN5bmNFdmVudCkge1xyXG4gICAgICAgICAgICBsaXN0ZW5lci5ldmVudC5fcG9zdERpcmVjdChhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIF9zdXBlci5wcm90b3R5cGUuX2NhbGwuY2FsbCh0aGlzLCBsaXN0ZW5lciwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogUGVyZm9ybWFuY2Ugb3B0aW1pemF0aW9uOiBpZiB0aGlzIGFzeW5jIHNpZ25hbCBpcyBhdHRhY2hlZCB0byBhbm90aGVyXHJcbiAgICAgKiBhc3luYyBzaWduYWwsIHdlJ3JlIGFscmVhZHkgYSB0aGUgbmV4dCBjeWNsZSBhbmQgd2UgY2FuIGNhbGwgbGlzdGVuZXJzXHJcbiAgICAgKiBkaXJlY3RseVxyXG4gICAgICovXHJcbiAgICBBc3luY0V2ZW50LnByb3RvdHlwZS5fcG9zdERpcmVjdCA9IGZ1bmN0aW9uIChhcmdzKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGNvcHkgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGJlY2F1c2UgdGhpcy5fbGlzdGVuZXJzIG1pZ2h0IGJlIHJlcGxhY2VkIGR1cmluZ1xyXG4gICAgICAgIC8vIHRoZSBoYW5kbGVyIGNhbGxzXHJcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFRoZSBjdXJyZW50IHNjaGVkdWxlclxyXG4gICAgICovXHJcbiAgICBBc3luY0V2ZW50Ll9zY2hlZHVsZXIgPSBBc3luY0V2ZW50LmRlZmF1bHRTY2hlZHVsZXI7XHJcbiAgICByZXR1cm4gQXN5bmNFdmVudDtcclxufSkoYmFzZV9ldmVudF8xLkJhc2VFdmVudCk7XHJcbmV4cG9ydHMuQXN5bmNFdmVudCA9IEFzeW5jRXZlbnQ7XHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgQXN5bmNFdmVudHMgd2l0aG91dCBkYXRhXHJcbiAqL1xyXG52YXIgVm9pZEFzeW5jRXZlbnQgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKFZvaWRBc3luY0V2ZW50LCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gVm9pZEFzeW5jRXZlbnQoKSB7XHJcbiAgICAgICAgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuXHJcbiAgICAgKi9cclxuICAgIFZvaWRBc3luY0V2ZW50LnByb3RvdHlwZS5wb3N0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIF9zdXBlci5wcm90b3R5cGUucG9zdC5jYWxsKHRoaXMsIHVuZGVmaW5lZCk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIFZvaWRBc3luY0V2ZW50O1xyXG59KShBc3luY0V2ZW50KTtcclxuZXhwb3J0cy5Wb2lkQXN5bmNFdmVudCA9IFZvaWRBc3luY0V2ZW50O1xyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbnZhciBFcnJvckFzeW5jRXZlbnQgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKEVycm9yQXN5bmNFdmVudCwgX3N1cGVyKTtcclxuICAgIGZ1bmN0aW9uIEVycm9yQXN5bmNFdmVudCgpIHtcclxuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuICAgIEVycm9yQXN5bmNFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImVycm9yIGV2ZW50IHBvc3RlZCB3aGlsZSBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuIEVycm9yOiBcIiArIGRhdGEubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIF9zdXBlci5wcm90b3R5cGUucG9zdC5jYWxsKHRoaXMsIGRhdGEpO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBFcnJvckFzeW5jRXZlbnQ7XHJcbn0pKEFzeW5jRXZlbnQpO1xyXG5leHBvcnRzLkVycm9yQXN5bmNFdmVudCA9IEVycm9yQXN5bmNFdmVudDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXN5bmMtZXZlbnQuanMubWFwIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG4ndXNlIHN0cmljdCc7XHJcbi8qKlxyXG4gKiBCYXNlIGNsYXNzIGZvciBldmVudHMuXHJcbiAqIEhhbmRsZXMgYXR0YWNoaW5nIGFuZCBkZXRhY2hpbmcgbGlzdGVuZXJzXHJcbiAqL1xyXG52YXIgQmFzZUV2ZW50ID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIEJhc2VFdmVudCgpIHtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBib3VuZFRvIChPcHRpb25hbCkgVGhlIHRoaXMgYXJndW1lbnQgb2YgdGhlIGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBjYWxsLlxyXG4gICAgICovXHJcbiAgICBCYXNlRXZlbnQucHJvdG90eXBlLmF0dGFjaCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBib3VuZFRvO1xyXG4gICAgICAgIHZhciBoYW5kbGVyO1xyXG4gICAgICAgIHZhciBldmVudDtcclxuICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdLnBvc3QgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgZXZlbnQgPSBhcmdzWzBdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmdzWzBdICE9PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3QgYSBmdW5jdGlvbiBvciBvYmplY3QgYXMgZmlyc3QgYXJndW1lbnQnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICA7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYXJnc1sxXSAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3QgYSBmdW5jdGlvbiBhcyBzZWNvbmQgYXJndW1lbnQnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBib3VuZFRvID0gYXJnc1swXTtcclxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVycyA9IFtdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy8gbWFrZSBhIGNvcHkgb2YgdGhlIGFycmF5IHNvIGV2ZW50cyB0aGF0IGFyZSB1bmRlcndheSBoYXZlIGEgc3RhYmxlIGxvY2FsIGNvcHlcclxuICAgICAgICAgICAgLy8gb2YgdGhlIGxpc3RlbmVycyBhcnJheSBhdCB0aGUgdGltZSBvZiBwb3N0KClcclxuICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzLm1hcChmdW5jdGlvbiAobGlzdGVuZXIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcjtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2xpc3RlbmVycy5wdXNoKHtcclxuICAgICAgICAgICAgZGVsZXRlZDogZmFsc2UsXHJcbiAgICAgICAgICAgIGJvdW5kVG86IGJvdW5kVG8sXHJcbiAgICAgICAgICAgIGhhbmRsZXI6IGhhbmRsZXIsXHJcbiAgICAgICAgICAgIGV2ZW50OiBldmVudFxyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogRGV0YWNoIGltcGxlbWVudGF0aW9uLiBTZWUgdGhlIG92ZXJsb2FkcyBmb3IgZGVzY3JpcHRpb24uXHJcbiAgICAgKi9cclxuICAgIEJhc2VFdmVudC5wcm90b3R5cGUuZGV0YWNoID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgYXJnc1tfaSAtIDBdID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBib3VuZFRvO1xyXG4gICAgICAgIHZhciBoYW5kbGVyO1xyXG4gICAgICAgIHZhciBldmVudDtcclxuICAgICAgICBpZiAoYXJncy5sZW5ndGggPj0gMSkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIChhcmdzWzBdKSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoYXJncy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGFyZ3NbMF0ucG9zdCA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgZXZlbnQgPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgYm91bmRUbyA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID49IDIpIHtcclxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIHJlbW92ZSBsaXN0ZW5lcnMgQU5EIG1hcmsgdGhlbSBhcyBkZWxldGVkIHNvIHN1YmNsYXNzZXMgZG9uJ3Qgc2VuZCBhbnkgbW9yZSBldmVudHMgdG8gdGhlbVxyXG4gICAgICAgIHRoaXMuX2xpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycy5maWx0ZXIoZnVuY3Rpb24gKGxpc3RlbmVyKSB7XHJcbiAgICAgICAgICAgIGlmICgodHlwZW9mIGhhbmRsZXIgPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmhhbmRsZXIgPT09IGhhbmRsZXIpXHJcbiAgICAgICAgICAgICAgICAmJiAodHlwZW9mIGV2ZW50ID09PSAndW5kZWZpbmVkJyB8fCBsaXN0ZW5lci5ldmVudCA9PT0gZXZlbnQpXHJcbiAgICAgICAgICAgICAgICAmJiAodHlwZW9mIGJvdW5kVG8gPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmJvdW5kVG8gPT09IGJvdW5kVG8pKSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5kZWxldGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBpZiAodGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIEFic3RyYWN0IHBvc3QoKSBtZXRob2QgdG8gYmUgYWJsZSB0byBjb25uZWN0IGFueSB0eXBlIG9mIGV2ZW50IHRvIGFueSBvdGhlciBkaXJlY3RseVxyXG4gICAgICogQGFic3RyYWN0XHJcbiAgICAgKi9cclxuICAgIEJhc2VFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhYnN0cmFjdCcpO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogVGhlIG51bWJlciBvZiBhdHRhY2hlZCBsaXN0ZW5lcnNcclxuICAgICAqL1xyXG4gICAgQmFzZUV2ZW50LnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fbGlzdGVuZXJzID8gdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA6IDApO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogQ2FsbCB0aGUgZ2l2ZW4gbGlzdGVuZXIsIGlmIGl0IGlzIG5vdCBtYXJrZWQgYXMgJ2RlbGV0ZWQnXHJcbiAgICAgKiBAcGFyYW0gbGlzdGVuZXIgVGhlIGxpc3RlbmVyIHRvIGNhbGxcclxuICAgICAqIEBwYXJhbSBhcmdzIFRoZSBhcmd1bWVudHMgdG8gdGhlIGhhbmRsZXJcclxuICAgICAqL1xyXG4gICAgQmFzZUV2ZW50LnByb3RvdHlwZS5fY2FsbCA9IGZ1bmN0aW9uIChsaXN0ZW5lciwgYXJncykge1xyXG4gICAgICAgIGlmICghbGlzdGVuZXIuZGVsZXRlZCkge1xyXG4gICAgICAgICAgICBpZiAobGlzdGVuZXIuZXZlbnQpIHtcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVyLmV2ZW50LnBvc3QuYXBwbHkobGlzdGVuZXIuZXZlbnQsIGFyZ3MpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuaGFuZGxlci5hcHBseSgodHlwZW9mIGxpc3RlbmVyLmJvdW5kVG8gPT09ICdvYmplY3QnID8gbGlzdGVuZXIuYm91bmRUbyA6IHRoaXMpLCBhcmdzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICByZXR1cm4gQmFzZUV2ZW50O1xyXG59KSgpO1xyXG5leHBvcnRzLkJhc2VFdmVudCA9IEJhc2VFdmVudDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YmFzZS1ldmVudC5qcy5tYXAiLCIvLyBDb3B5cmlnaHQgKGMpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcbid1c2Ugc3RyaWN0JztcclxuZnVuY3Rpb24gc2hhbGxvd0VxdWFscyhhLCBiKSB7XHJcbiAgICBpZiAoYSA9PT0gYikge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiBhICE9PSB0eXBlb2YgYikge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHN3aXRjaCAodHlwZW9mIGEpIHtcclxuICAgICAgICBjYXNlICdib29sZWFuJzpcclxuICAgICAgICBjYXNlICdudW1iZXInOlxyXG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XHJcbiAgICAgICAgY2FzZSAnZnVuY3Rpb24nOlxyXG4gICAgICAgIGNhc2UgJ3N5bWJvbCc6XHJcbiAgICAgICAgY2FzZSAndW5kZWZpbmVkJzpcclxuICAgICAgICAgICAgLy8gYWxyZWFkeSBkaWQgPT09IGNvbXBhcmVcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNhc2UgJ29iamVjdCc6XHJcbiAgICAgICAgICAgIGlmIChhID09PSBudWxsIHx8IGIgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYWxyZWFkeSBjb21wYXJlZCA9PT1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhKSB8fCBBcnJheS5pc0FycmF5KGIpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoYSkgfHwgIUFycmF5LmlzQXJyYXkoYikpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHZhciBuYW1lO1xyXG4gICAgICAgICAgICB2YXIgbmFtZXNBID0gW107XHJcbiAgICAgICAgICAgIHZhciBuYW1lc0IgPSBbXTtcclxuICAgICAgICAgICAgZm9yIChuYW1lIGluIGEpIHtcclxuICAgICAgICAgICAgICAgIGlmIChhLmhhc093blByb3BlcnR5KG5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZXNBLnB1c2gobmFtZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZm9yIChuYW1lIGluIGIpIHtcclxuICAgICAgICAgICAgICAgIGlmIChiLmhhc093blByb3BlcnR5KG5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZXNCLnB1c2gobmFtZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbmFtZXNBLnNvcnQoKTtcclxuICAgICAgICAgICAgbmFtZXNCLnNvcnQoKTtcclxuICAgICAgICAgICAgaWYgKG5hbWVzQS5qb2luKCcsJykgIT09IG5hbWVzQi5qb2luKCcsJykpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbmFtZXNBLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYVtuYW1lc0FbaV1dICE9PSBiW25hbWVzQVtpXV0pIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG59XHJcbmV4cG9ydHMuc2hhbGxvd0VxdWFscyA9IHNoYWxsb3dFcXVhbHM7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW9iamVjdHMuanMubWFwIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG4ndXNlIHN0cmljdCc7XHJcbnZhciBfX2V4dGVuZHMgPSAodGhpcyAmJiB0aGlzLl9fZXh0ZW5kcykgfHwgZnVuY3Rpb24gKGQsIGIpIHtcclxuICAgIGZvciAodmFyIHAgaW4gYikgaWYgKGIuaGFzT3duUHJvcGVydHkocCkpIGRbcF0gPSBiW3BdO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn07XHJcbnZhciBiYXNlX2V2ZW50XzEgPSByZXF1aXJlKCcuL2Jhc2UtZXZlbnQnKTtcclxudmFyIEV2ZW50UXVldWVfMSA9IHJlcXVpcmUoJy4vRXZlbnRRdWV1ZScpO1xyXG4vKipcclxuICogRXZlbnQgdGhhdCBzdGF5cyBpbiBhIHF1ZXVlIHVudGlsIHlvdSBwcm9jZXNzIHRoZSBxdWV1ZS4gQWxsb3dzIGZpbmUtZ3JhaW5lZFxyXG4gKiBjb250cm9sIG92ZXIgd2hlbiBldmVudHMgaGFwcGVuLlxyXG4gKiAtIE9wdGlvbmFsbHkgY29uZGVuc2VzIG11bHRpcGxlIHBvc3QoKSBjYWxscyBpbnRvIG9uZS5cclxuICogLSBIYW5kbGVycyBhcmUgY2FsbGVkIG9ubHkgZm9yIGV2ZW50cyBwb3N0ZWQgYWZ0ZXIgdGhleSB3ZXJlIGF0dGFjaGVkLlxyXG4gKiAtIEhhbmRsZXJzIGFyZSBub3QgY2FsbGVkIGFueW1vcmUgd2hlbiB0aGV5IGFyZSBkZXRhY2hlZCwgZXZlbiBpZiBhIHBvc3QoKSBpcyBpbiBwcm9ncmVzc1xyXG4gKi9cclxudmFyIFF1ZXVlZEV2ZW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhRdWV1ZWRFdmVudCwgX3N1cGVyKTtcclxuICAgIC8qKlxyXG4gICAgICogQ29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSBvcHRzIE9wdGlvbmFsLCBhbiBvYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nIG1lbWJlcnM6XHJcbiAgICAgKiAgICAgICAgICAgICAtIGNvbmRlbnNlZDogYSBCb29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0byBjb25kZW5zZSBtdWx0aXBsZSBjYWxscyB0byBwb3N0KCkgaW50byBvbmUgKGRlZmF1bHQgZmFsc2UpXHJcbiAgICAgKiAgICAgICAgICAgICAtIHF1ZXVlOiBhIHNwZWNpZmljIGV2ZW50IHF1ZXVlIHRvIHVzZS4gVGhlIGdsb2JhbCBFdmVudFF1ZXVlIGluc3RhbmNlIGlzIHVzZWQgaWYgbm90IGdpdmVuLlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBRdWV1ZWRFdmVudChvcHRzKSB7XHJcbiAgICAgICAgX3N1cGVyLmNhbGwodGhpcyk7XHJcbiAgICAgICAgdGhpcy5fcXVldWVkID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0cztcclxuICAgICAgICB2YXIgb3B0aW9ucyA9IG9wdHMgfHwge307XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmNvbmRlbnNlZCA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IG9wdGlvbnMuY29uZGVuc2VkO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fY29uZGVuc2VkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5xdWV1ZSA9PT0gJ29iamVjdCcgJiYgb3B0aW9ucy5xdWV1ZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZSA9IG9wdGlvbnMucXVldWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgUXVldWVkRXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcXVldWUgPSAodGhpcy5fcXVldWUgPyB0aGlzLl9xdWV1ZSA6IEV2ZW50UXVldWVfMS5kZWZhdWx0Lmdsb2JhbCgpKTtcclxuICAgICAgICBpZiAodGhpcy5fY29uZGVuc2VkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZERhdGEgPSBhcmdzO1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBxdWV1ZS5hZGQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGltbWVkaWF0ZWx5IG1hcmsgbm9uLXF1ZXVlZCB0byBhbGxvdyBuZXcgQXN5bmNFdmVudCB0byBoYXBwZW4gYXMgcmVzdWx0XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gb2YgY2FsbGluZyBoYW5kbGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLl9xdWV1ZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAvLyBjYWNoZSBsaXN0ZW5lcnMgYW5kIGRhdGEgYmVjYXVzZSB0aGV5IG1pZ2h0IGNoYW5nZSB3aGlsZSBjYWxsaW5nIGV2ZW50IGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBfdGhpcy5fcXVldWVkRGF0YTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gX3RoaXMuX3F1ZXVlZExpc3RlbmVycztcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9jYWxsKGxpc3RlbmVyLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgcXVldWUuYWRkKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLl9jYWxsKGxpc3RlbmVyLCBhcmdzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHJldHVybiBRdWV1ZWRFdmVudDtcclxufSkoYmFzZV9ldmVudF8xLkJhc2VFdmVudCk7XHJcbmV4cG9ydHMuUXVldWVkRXZlbnQgPSBRdWV1ZWRFdmVudDtcclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBldmVudHMgd2l0aG91dCBkYXRhXHJcbiAqL1xyXG52YXIgVm9pZFF1ZXVlZEV2ZW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhWb2lkUXVldWVkRXZlbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBWb2lkUXVldWVkRXZlbnQoKSB7XHJcbiAgICAgICAgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIGV2ZW50LlxyXG4gICAgICovXHJcbiAgICBWb2lkUXVldWVkRXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5wb3N0LmNhbGwodGhpcywgdW5kZWZpbmVkKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gVm9pZFF1ZXVlZEV2ZW50O1xyXG59KShRdWV1ZWRFdmVudCk7XHJcbmV4cG9ydHMuVm9pZFF1ZXVlZEV2ZW50ID0gVm9pZFF1ZXVlZEV2ZW50O1xyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbnZhciBFcnJvclF1ZXVlZEV2ZW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhFcnJvclF1ZXVlZEV2ZW50LCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gRXJyb3JRdWV1ZWRFdmVudCgpIHtcclxuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuICAgIEVycm9yUXVldWVkRXZlbnQucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6IFwiICsgZGF0YS5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5wb3N0LmNhbGwodGhpcywgZGF0YSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEVycm9yUXVldWVkRXZlbnQ7XHJcbn0pKFF1ZXVlZEV2ZW50KTtcclxuZXhwb3J0cy5FcnJvclF1ZXVlZEV2ZW50ID0gRXJyb3JRdWV1ZWRFdmVudDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cXVldWVkLWV2ZW50LmpzLm1hcCIsIi8vIENvcHlyaWdodCAoYykgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuJ3VzZSBzdHJpY3QnO1xyXG52YXIgX19leHRlbmRzID0gKHRoaXMgJiYgdGhpcy5fX2V4dGVuZHMpIHx8IGZ1bmN0aW9uIChkLCBiKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIGIpIGlmIChiLmhhc093blByb3BlcnR5KHApKSBkW3BdID0gYltwXTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59O1xyXG52YXIgYmFzZV9ldmVudF8xID0gcmVxdWlyZSgnLi9iYXNlLWV2ZW50Jyk7XHJcbi8qKlxyXG4gKiBUaGlzIGlzIGEgdHJ1ZSBFdmVudEVtaXR0ZXIgcmVwbGFjZW1lbnQ6IHRoZSBoYW5kbGVycyBhcmUgY2FsbGVkIHN5bmNocm9ub3VzbHkgd2hlblxyXG4gKiB5b3UgcG9zdCB0aGUgZXZlbnQuXHJcbiAqIC0gQWxsb3dzIGJldHRlciBlcnJvciBoYW5kbGluZyBieSBhZ2dyZWdhdGluZyBhbnkgZXJyb3JzIHRocm93biBieSBoYW5kbGVycy5cclxuICogLSBQcmV2ZW50cyBsaXZlbG9jayBieSB0aHJvd2luZyBhbiBlcnJvciB3aGVuIHJlY3Vyc2lvbiBkZXB0aCBpcyBhYm92ZSBhIG1heGltdW0uXHJcbiAqIC0gSGFuZGxlcnMgYXJlIGNhbGxlZCBvbmx5IGZvciBldmVudHMgcG9zdGVkIGFmdGVyIHRoZXkgd2VyZSBhdHRhY2hlZC5cclxuICogLSBIYW5kbGVycyBhcmUgbm90IGNhbGxlZCBhbnltb3JlIHdoZW4gdGhleSBhcmUgZGV0YWNoZWQsIGV2ZW4gaWYgYSBwb3N0KCkgaXMgaW4gcHJvZ3Jlc3NcclxuICovXHJcbnZhciBTeW5jRXZlbnQgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKFN5bmNFdmVudCwgX3N1cGVyKTtcclxuICAgIGZ1bmN0aW9uIFN5bmNFdmVudCgpIHtcclxuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZWN1cnNpdmUgcG9zdCgpIGludm9jYXRpb25zXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy5fcmVjdXJzaW9uID0gMDtcclxuICAgIH1cclxuICAgIFN5bmNFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2kgLSAwXSA9IGFyZ3VtZW50c1tfaV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9yZWN1cnNpb24rKztcclxuICAgICAgICBpZiAoU3luY0V2ZW50Lk1BWF9SRUNVUlNJT05fREVQVEggPiAwICYmXHJcbiAgICAgICAgICAgIHRoaXMuX3JlY3Vyc2lvbiA+IFN5bmNFdmVudC5NQVhfUkVDVVJTSU9OX0RFUFRIKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZXZlbnQgZmlyZWQgcmVjdXJzaXZlbHknKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gY29weSBhIHJlZmVyZW5jZSB0byB0aGUgYXJyYXkgYmVjYXVzZSB0aGlzLl9saXN0ZW5lcnMgbWlnaHQgYmUgcmVwbGFjZWQgZHVyaW5nXHJcbiAgICAgICAgLy8gdGhlIGhhbmRsZXIgY2FsbHNcclxuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3JlY3Vyc2lvbi0tO1xyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogTWF4aW11bSBudW1iZXIgb2YgdGltZXMgdGhhdCBhbiBldmVudCBoYW5kbGVyIG1heSBjYXVzZSB0aGUgc2FtZSBldmVudFxyXG4gICAgICogcmVjdXJzaXZlbHkuXHJcbiAgICAgKi9cclxuICAgIFN5bmNFdmVudC5NQVhfUkVDVVJTSU9OX0RFUFRIID0gMTA7XHJcbiAgICByZXR1cm4gU3luY0V2ZW50O1xyXG59KShiYXNlX2V2ZW50XzEuQmFzZUV2ZW50KTtcclxuZXhwb3J0cy5TeW5jRXZlbnQgPSBTeW5jRXZlbnQ7XHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgZXZlbnRzIHdpdGhvdXQgZGF0YVxyXG4gKi9cclxudmFyIFZvaWRTeW5jRXZlbnQgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKFZvaWRTeW5jRXZlbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBWb2lkU3luY0V2ZW50KCkge1xyXG4gICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBldmVudC5cclxuICAgICAqL1xyXG4gICAgVm9pZFN5bmNFdmVudC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBfc3VwZXIucHJvdG90eXBlLnBvc3QuY2FsbCh0aGlzLCB1bmRlZmluZWQpO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBWb2lkU3luY0V2ZW50O1xyXG59KShTeW5jRXZlbnQpO1xyXG5leHBvcnRzLlZvaWRTeW5jRXZlbnQgPSBWb2lkU3luY0V2ZW50O1xyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbnZhciBFcnJvclN5bmNFdmVudCA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XHJcbiAgICBfX2V4dGVuZHMoRXJyb3JTeW5jRXZlbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBFcnJvclN5bmNFdmVudCgpIHtcclxuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuICAgIEVycm9yU3luY0V2ZW50LnByb3RvdHlwZS5wb3N0ID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICBpZiAodGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6IFwiICsgZGF0YS5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgX3N1cGVyLnByb3RvdHlwZS5wb3N0LmNhbGwodGhpcywgZGF0YSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEVycm9yU3luY0V2ZW50O1xyXG59KShTeW5jRXZlbnQpO1xyXG5leHBvcnRzLkVycm9yU3luY0V2ZW50ID0gRXJyb3JTeW5jRXZlbnQ7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN5bmMtZXZlbnQuanMubWFwIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG4ndXNlIHN0cmljdCc7XHJcbmZ1bmN0aW9uIF9fZXhwb3J0KG0pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKCFleHBvcnRzLmhhc093blByb3BlcnR5KHApKSBleHBvcnRzW3BdID0gbVtwXTtcclxufVxyXG5fX2V4cG9ydChyZXF1aXJlKCcuL2Jhc2UtZXZlbnQnKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoJy4vc3luYy1ldmVudCcpKTtcclxuX19leHBvcnQocmVxdWlyZSgnLi9xdWV1ZWQtZXZlbnQnKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoJy4vYXN5bmMtZXZlbnQnKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoJy4vYW55LWV2ZW50JykpO1xyXG52YXIgRXZlbnRRdWV1ZV8xID0gcmVxdWlyZSgnLi9FdmVudFF1ZXVlJyk7XHJcbnZhciBFdmVudFF1ZXVlXzIgPSByZXF1aXJlKCcuL0V2ZW50UXVldWUnKTtcclxuZXhwb3J0cy5FdmVudFF1ZXVlID0gRXZlbnRRdWV1ZV8yLmRlZmF1bHQ7XHJcbi8qKlxyXG4gKiBUaGUgZ2xvYmFsIGV2ZW50IHF1ZXVlIGZvciBRdWV1ZWRFdmVudHNcclxuICovXHJcbmZ1bmN0aW9uIHF1ZXVlKCkge1xyXG4gICAgcmV0dXJuIEV2ZW50UXVldWVfMS5kZWZhdWx0Lmdsb2JhbCgpO1xyXG59XHJcbmV4cG9ydHMucXVldWUgPSBxdWV1ZTtcclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGZ1bmN0aW9uLCBzYW1lIGFzIEV2ZW50UXVldWUuZ2xvYmFsKCkuZmx1c2hPbmNlKCkuXHJcbiAqIEZsdXNoZXMgdGhlIFF1ZXVlZEV2ZW50cywgY2FsbGluZyBhbGwgZXZlbnRzIGN1cnJlbnRseSBpbiB0aGUgcXVldWUgYnV0IG5vdFxyXG4gKiBhbnkgZXZlbnRzIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXHJcbiAqL1xyXG5mdW5jdGlvbiBmbHVzaE9uY2UoKSB7XHJcbiAgICBFdmVudFF1ZXVlXzEuZGVmYXVsdC5nbG9iYWwoKS5mbHVzaE9uY2UoKTtcclxufVxyXG5leHBvcnRzLmZsdXNoT25jZSA9IGZsdXNoT25jZTtcclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGZ1bmN0aW9uLCBzYW1lIGFzIEV2ZW50UXVldWUuZ2xvYmFsKCkuZmx1c2goKS5cclxuICogRmx1c2hlcyB0aGUgUXVldWVkRXZlbnRzLCBjYWxsaW5nIGFsbCBoYW5kbGVycyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlIGFuZCB0aG9zZVxyXG4gKiBwdXQgaW50byB0aGUgcXVldWUgYXMgYSByZXN1bHQgb2YgdGhlIGZsdXNoLlxyXG4gKiBAcGFyYW0gbWF4Um91bmRzIE9wdGlvbmFsLCBkZWZhdWx0IDEwLiBOdW1iZXIgb2YgaXRlcmF0aW9ucyBhZnRlciB3aGljaCB0byB0aHJvdyBhbiBlcnJvciBiZWNhdXNlXHJcbiAqICAgICAgICAgICAgICAgICAgdGhlIHF1ZXVlIGtlZXBzIGZpbGxpbmcgdXAuIFNldCB0byB1bmRlZmluZWQgb3IgbnVsbCB0byBkaXNhYmxlIHRoaXMuXHJcbiAqL1xyXG5mdW5jdGlvbiBmbHVzaChtYXhSb3VuZHMpIHtcclxuICAgIGlmIChtYXhSb3VuZHMgPT09IHZvaWQgMCkgeyBtYXhSb3VuZHMgPSAxMDsgfVxyXG4gICAgRXZlbnRRdWV1ZV8xLmRlZmF1bHQuZ2xvYmFsKCkuZmx1c2gobWF4Um91bmRzKTtcclxufVxyXG5leHBvcnRzLmZsdXNoID0gZmx1c2g7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCJdfQ==
return require('ts-events');
});