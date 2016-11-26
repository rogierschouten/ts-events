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
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
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
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
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
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
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
            var listeners_1 = this._listeners;
            AsyncEvent._scheduler(function () {
                for (var i = 0; i < listeners_1.length; ++i) {
                    var listener = listeners_1[i];
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
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
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
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
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
            var namesA = [];
            var namesB = [];
            for (var name_1 in a) {
                if (a.hasOwnProperty(name_1)) {
                    namesA.push(name_1);
                }
            }
            for (var name_2 in b) {
                if (b.hasOwnProperty(name_2)) {
                    namesB.push(name_2);
                }
            }
            namesA.sort();
            namesB.sort();
            if (namesA.join(',') !== namesB.join(',')) {
                return false;
            }
            for (var i = 0; i < namesA.length; ++i) {
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
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
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
            var listeners_1 = this._listeners;
            queue.add(function () {
                for (var i = 0; i < listeners_1.length; ++i) {
                    var listener = listeners_1[i];
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
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
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
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmNcXGxpYlxcRXZlbnRRdWV1ZS50cyIsInNyY1xcbGliXFxhbnktZXZlbnQudHMiLCJzcmNcXGxpYlxcYXN5bmMtZXZlbnQudHMiLCJzcmNcXGxpYlxcYmFzZS1ldmVudC50cyIsInNyY1xcbGliXFxvYmplY3RzLnRzIiwic3JjXFxsaWJcXHF1ZXVlZC1ldmVudC50cyIsInNyY1xcbGliXFxzeW5jLWV2ZW50LnRzIiwic3JjXFxsaWJcXGluZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsNkRBQTZEO0FBQzdELGVBQWU7QUFFZixZQUFZLENBQUM7QUFFYiwyQkFBd0IsY0FBYyxDQUFDLENBQUE7QUFFdkM7O0dBRUc7QUFDSDtJQUFBO1FBRUk7OztXQUdHO1FBQ0ksY0FBUyxHQUEwQixJQUFJLHNCQUFTLEVBQWMsQ0FBQztRQUN0RTs7O1dBR0c7UUFDSSxlQUFVLEdBQTBCLElBQUksc0JBQVMsRUFBYyxDQUFDO1FBd0J2RTs7V0FFRztRQUNLLFdBQU0sR0FBbUIsRUFBRSxDQUFDO1FBRXBDOztXQUVHO1FBQ0ssY0FBUyxHQUFZLEtBQUssQ0FBQztJQXFFdkMsQ0FBQztJQTlGRzs7T0FFRztJQUNXLGlCQUFNLEdBQXBCO1FBQ0ksRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN4QixVQUFVLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDN0IsQ0FBQztRQUNELE1BQU0sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDO0lBQ2hDLENBQUM7SUFFRDs7T0FFRztJQUNXLHNCQUFXLEdBQXpCO1FBQ0ksVUFBVSxDQUFDLFNBQVMsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFZRDs7T0FFRztJQUNJLDBCQUFLLEdBQVo7UUFDSSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FB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LGFBQWEsQ0FBQyxFQUFBO0FBRTVCLDJCQUFvQyxjQUFjLENBQUMsQ0FBQTtBQUNuRCwyQkFBb0MsY0FBYyxDQUFDO0FBQTNDLDBDQUEyQztBQUVuRDs7R0FFRztBQUNIO0lBQ0ksTUFBTSxDQUFDLG9CQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDL0IsQ0FBQztBQUZlLGFBQUssUUFFcEIsQ0FBQTtBQUVEOzs7O0dBSUc7QUFDSDtJQUNJLG9CQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUM7QUFDcEMsQ0FBQztBQUZlLGlCQUFTLFlBRXhCLENBQUE7QUFFRDs7Ozs7O0dBTUc7QUFDSCxlQUFzQixTQUFzQjtJQUF0Qix5QkFBc0IsR0FBdEIsY0FBc0I7SUFDeEMsb0JBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUZlLGFBQUssUUFFcEIsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCB7U3luY0V2ZW50fSBmcm9tICcuL3N5bmMtZXZlbnQnO1xyXG5cclxuLyoqXHJcbiAqIFNpbXBsZSBzeW5jaHJvbm91cyBldmVudCBxdWV1ZSB0aGF0IG5lZWRzIHRvIGJlIGRyYWluZWQgbWFudWFsbHkuXHJcbiAqL1xyXG5jbGFzcyBFdmVudFF1ZXVlIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFN5bmNFdmVudCB0cmlnZ2VyZWQgYWZ0ZXIgYW4gZXZlbnQgaXMgYWRkZWQgb3V0c2lkZSBvZiBhIGZsdXNoIG9wZXJhdGlvbi5cclxuICAgICAqIEBwYXJhbSBxdWV1ZSBUaGUgZXZlbnQgcXVldWUgaXRzZWxmXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBldnRGaWxsZWQ6IFN5bmNFdmVudDxFdmVudFF1ZXVlPiA9IG5ldyBTeW5jRXZlbnQ8RXZlbnRRdWV1ZT4oKTtcclxuICAgIC8qKlxyXG4gICAgICogU3luY0V2ZW50IHRyaWdnZXJlZCBhZnRlciB0aGUgcXVldWUgaXMgZmx1c2hlZCBlbXB0eVxyXG4gICAgICogQHBhcmFtIHF1ZXVlIFRoZSBldmVudCBxdWV1ZSBpdHNlbGZcclxuICAgICAqL1xyXG4gICAgcHVibGljIGV2dERyYWluZWQ6IFN5bmNFdmVudDxFdmVudFF1ZXVlPiA9IG5ldyBTeW5jRXZlbnQ8RXZlbnRRdWV1ZT4oKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBtb2R1bGUtZ2xvYmFsIGV2ZW50IHF1ZXVlXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc3RhdGljIF9pbnN0YW5jZTogRXZlbnRRdWV1ZTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBtb2R1bGUtZ2xvYmFsIGV2ZW50IHF1ZXVlXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzdGF0aWMgZ2xvYmFsKCk6IEV2ZW50UXVldWUge1xyXG4gICAgICAgIGlmICghRXZlbnRRdWV1ZS5faW5zdGFuY2UpIHtcclxuICAgICAgICAgICAgRXZlbnRRdWV1ZS5yZXNldEdsb2JhbCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gRXZlbnRRdWV1ZS5faW5zdGFuY2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUZXN0aW5nIHB1cnBvc2VzXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzdGF0aWMgcmVzZXRHbG9iYWwoKTogdm9pZCB7XHJcbiAgICAgICAgRXZlbnRRdWV1ZS5faW5zdGFuY2UgPSBuZXcgRXZlbnRRdWV1ZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUXVldWVkIGVsZW1lbnRzXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX3F1ZXVlOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVHJ1ZSB3aGlsZSBmbHVzaCgpIG9yIGZsdXNoT25jZSgpIGlzIHJ1bm5pbmdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfZmx1c2hpbmc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdHJ1ZSBpZmYgdGhlIHF1ZXVlIGlzIGVtcHR5XHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBlbXB0eSgpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fcXVldWUubGVuZ3RoID09PSAwO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkIGFuIGVsZW1lbnQgdG8gdGhlIHF1ZXVlLiBUaGUgaGFuZGxlciBpcyBjYWxsZWQgd2hlbiBvbmUgb2YgdGhlIGZsdXNoXHJcbiAgICAgKiBtZXRob2RzIGlzIGNhbGxlZC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGFkZChoYW5kbGVyOiAoKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5fcXVldWUucHVzaChoYW5kbGVyKTtcclxuICAgICAgICBpZiAodGhpcy5fcXVldWUubGVuZ3RoID09PSAxICYmICF0aGlzLl9mbHVzaGluZykge1xyXG4gICAgICAgICAgICB0aGlzLmV2dEZpbGxlZC5wb3N0KHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxzIGFsbCBoYW5kbGVycyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlLiBEb2VzIG5vdCBjYWxsIGFueSBoYW5kbGVycyBhZGRlZFxyXG4gICAgICogYXMgYSByZXN1bHQgb2YgdGhlIGZsdXNoXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBmbHVzaE9uY2UoKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgZW1wdHkgPSAodGhpcy5fcXVldWUubGVuZ3RoID09PSAwKTtcclxuICAgICAgICBjb25zdCBmbHVzaGluZyA9IHRoaXMuX2ZsdXNoaW5nO1xyXG4gICAgICAgIHRoaXMuX2ZsdXNoaW5nID0gdHJ1ZTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBxdWV1ZSA9IHRoaXMuX3F1ZXVlO1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZSA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICBxdWV1ZVtpXSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSBmbHVzaGluZztcclxuICAgICAgICAgICAgaWYgKCFlbXB0eSAmJiAhZmx1c2hpbmcgJiYgdGhpcy5fcXVldWUubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmV2dERyYWluZWQucG9zdCh0aGlzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZsdXNoZXMgdGhlIFF1ZXVlZEV2ZW50cywgY2FsbGluZyBhbGwgZXZlbnRzIGN1cnJlbnRseSBpbiB0aGUgcXVldWUgYW5kIHRob3NlXHJcbiAgICAgKiBwdXQgaW50byB0aGUgcXVldWUgYXMgYSByZXN1bHQgb2YgdGhlIGZsdXNoLlxyXG4gICAgICogQHBhcmFtIG1heFJvdW5kcyBPcHRpb25hbCwgZGVmYXVsdCAxMC4gTnVtYmVyIG9mIGl0ZXJhdGlvbnMgYWZ0ZXIgd2hpY2ggdG8gdGhyb3cgYW4gZXJyb3IgYmVjYXVzZVxyXG4gICAgICogICAgICAgICAgICAgICAgICB0aGUgcXVldWUga2VlcHMgZmlsbGluZyB1cC4gU2V0IHRvIG51bGwgdG8gZGlzYWJsZSB0aGlzLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZmx1c2gobWF4Um91bmRzOiBudW1iZXIgPSAxMCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IGVtcHR5ID0gKHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCk7XHJcbiAgICAgICAgY29uc3QgZmx1c2hpbmcgPSB0aGlzLl9mbHVzaGluZztcclxuICAgICAgICB0aGlzLl9mbHVzaGluZyA9IHRydWU7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgbGV0IGkgPSAwO1xyXG4gICAgICAgICAgICB3aGlsZSAodGhpcy5fcXVldWUubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtYXhSb3VuZHMgPT09ICdudW1iZXInICYmIGkgPj0gbWF4Um91bmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWUgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuYWJsZSB0byBmbHVzaCB0aGUgcXVldWUgZHVlIHRvIHJlY3Vyc2l2ZWx5IGFkZGVkIGV2ZW50LiBDbGVhcmluZyBxdWV1ZSBub3cnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuZmx1c2hPbmNlKCk7XHJcbiAgICAgICAgICAgICAgICArK2k7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICB0aGlzLl9mbHVzaGluZyA9IGZsdXNoaW5nO1xyXG4gICAgICAgICAgICBpZiAoIWVtcHR5ICYmICFmbHVzaGluZyAmJiB0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXZ0RHJhaW5lZC5wb3N0KHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBFdmVudFF1ZXVlO1xyXG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCB7c2hhbGxvd0VxdWFsc30gZnJvbSAnLi9vYmplY3RzJztcclxuXHJcbmltcG9ydCB7QmFzZUV2ZW50LCBQb3N0YWJsZSwgTGlzdGVuZXJ9IGZyb20gJy4vYmFzZS1ldmVudCc7XHJcbmltcG9ydCB7U3luY0V2ZW50fSBmcm9tICcuL3N5bmMtZXZlbnQnO1xyXG5pbXBvcnQge0FzeW5jRXZlbnQsIEFzeW5jRXZlbnRPcHRzfSBmcm9tICcuL2FzeW5jLWV2ZW50JztcclxuaW1wb3J0IHtRdWV1ZWRFdmVudCwgUXVldWVkRXZlbnRPcHRzfSBmcm9tICcuL3F1ZXVlZC1ldmVudCc7XHJcblxyXG5leHBvcnQgZW51bSBFdmVudFR5cGUge1xyXG4gICAgU3luYyxcclxuICAgIEFzeW5jLFxyXG4gICAgUXVldWVkXHJcbn07XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFueUV2ZW50T3B0cyB7XHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBldnRGaXJzdEF0dGFjaGVkIGFuZCBldnRMYXN0RGV0YWNoZWQgc28geW91IGNhbiBtb25pdG9yIHdoZW4gc29tZW9uZSBpcyBzdWJzY3JpYmVkXHJcbiAgICAgKi9cclxuICAgIG1vbml0b3JBdHRhY2g/OiBib29sZWFuO1xyXG59XHJcblxyXG4vKipcclxuICogQW4gZXZlbnQgdGhhdCBiZWhhdmVzIGxpa2UgYSBTeW5jL0FzeW5jL1F1ZXVlZCBldmVudCBkZXBlbmRpbmcgb24gaG93XHJcbiAqIHlvdSBzdWJzY3JpYmUuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQW55RXZlbnQ8VD4gaW1wbGVtZW50cyBQb3N0YWJsZTxUPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUcmlnZ2VyZWQgd2hlbmV2ZXIgc29tZW9uZSBhdHRhY2hlcyBhbmQgbm9ib2R5IHdhcyBhdHRhY2hlZC5cclxuICAgICAqIE5vdGU6IHlvdSBtdXN0IGNhbGwgdGhlIGNvbnN0cnVjdG9yIHdpdGggbW9uaXRvckF0dGFjaCBzZXQgdG8gdHJ1ZSB0byBjcmVhdGUgdGhpcyBldmVudCFcclxuICAgICAqL1xyXG4gICAgcHVibGljIGV2dEZpcnN0QXR0YWNoZWQ6IFZvaWRBbnlFdmVudDtcclxuICAgIC8qKlxyXG4gICAgICogVHJpZ2dlcmVkIHdoZW5ldmVyIHNvbWVvbmUgZGV0YWNoZXMgYW5kIG5vYm9keSBpcyBhdHRhY2hlZCBhbnltb3JlXHJcbiAgICAgKiBOb3RlOiB5b3UgbXVzdCBjYWxsIHRoZSBjb25zdHJ1Y3RvciB3aXRoIG1vbml0b3JBdHRhY2ggc2V0IHRvIHRydWUgdG8gY3JlYXRlIHRoaXMgZXZlbnQhXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBldnRMYXN0RGV0YWNoZWQ6IFZvaWRBbnlFdmVudDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFVuZGVybHlpbmcgZXZlbnQgaW1wbGVtZW50YXRpb25zOyBvbmUgZm9yIGV2ZXJ5IGF0dGFjaCB0eXBlICsgb3B0cyBjb21iaW5hdGlvblxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9ldmVudHM6IEJhc2VFdmVudDxUPltdID0gW107XHJcblxyXG4gICAgY29uc3RydWN0b3Iob3B0cz86IEFueUV2ZW50T3B0cykge1xyXG4gICAgICAgIGlmIChvcHRzICYmIG9wdHMubW9uaXRvckF0dGFjaCkge1xyXG4gICAgICAgICAgICB0aGlzLmV2dEZpcnN0QXR0YWNoZWQgPSBuZXcgVm9pZEFueUV2ZW50KCk7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0TGFzdERldGFjaGVkID0gbmV3IFZvaWRBbnlFdmVudCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgYXR0YWNoKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaChib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaChldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoKG1vZGU6IEV2ZW50VHlwZSwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoKG1vZGU6IEV2ZW50VHlwZSwgYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2gobW9kZTogRXZlbnRUeXBlLCBldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIHNhbWUgYXMgYXR0YWNoU3luYy9hdHRhY2hBc3luYy9hdHRhY2hRdWV1ZWQ7IGJhc2VkIG9uIHRoZSBnaXZlbiBlbnVtXHJcbiAgICAgKiBAcGFyYW0gbW9kZSBkZXRlcm1pbmVzIHdoZXRoZXIgdG8gYXR0YWNoIHN5bmMvYXN5bmMvcXVldWVkXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhdHRhY2goLi4uYXJnczogYW55W10pOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBwcmV2Q291bnQgPSAoISF0aGlzLmV2dEZpcnN0QXR0YWNoZWQgPyB0aGlzLmxpc3RlbmVyQ291bnQoKSA6IDApO1xyXG4gICAgICAgIGxldCBtb2RlID0gRXZlbnRUeXBlLlN5bmM7XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgbW9kZSA9IGFyZ3Muc2hpZnQoKSBhcyBFdmVudFR5cGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN3aXRjaCAobW9kZSkge1xyXG4gICAgICAgICAgICBjYXNlIEV2ZW50VHlwZS5TeW5jOiB7XHJcbiAgICAgICAgICAgICAgICAvLyBhZGQgb3Vyc2VsdmVzIGFzIGRlZmF1bHQgJ2JvdW5kVG8nIGFyZ3VtZW50XHJcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAwICYmIHR5cGVvZiBhcmdzWzBdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXJncy51bnNoaWZ0KHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbGV0IGV2ZW50OiBCYXNlRXZlbnQ8VD47XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9ldmVudHNbaV0gaW5zdGFuY2VvZiBTeW5jRXZlbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSB0aGlzLl9ldmVudHNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKCFldmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gbmV3IFN5bmNFdmVudDxUPigpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50cy5wdXNoKGV2ZW50KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGV2ZW50LmF0dGFjaC5hcHBseShldmVudCwgYXJncyk7XHJcbiAgICAgICAgICAgIH0gYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLkFzeW5jOiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgb3B0czogQXN5bmNFdmVudE9wdHM7XHJcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAxICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3B0cyA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIC8vIGFkZCBvdXJzZWx2ZXMgYXMgZGVmYXVsdCAnYm91bmRUbycgYXJndW1lbnRcclxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDAgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgICAgICBhcmdzLnVuc2hpZnQodGhpcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBsZXQgZXZlbnQ6IEJhc2VFdmVudDxUPjtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2V2ZW50c1tpXSBpbnN0YW5jZW9mIEFzeW5jRXZlbnRcclxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgc2hhbGxvd0VxdWFscygoPEFzeW5jRXZlbnQ8VD4+dGhpcy5fZXZlbnRzW2ldKS5vcHRpb25zLCBvcHRzKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9IHRoaXMuX2V2ZW50c1tpXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoIWV2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBuZXcgQXN5bmNFdmVudDxUPihvcHRzKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHMucHVzaChldmVudCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBldmVudC5hdHRhY2guYXBwbHkoZXZlbnQsIGFyZ3MpO1xyXG4gICAgICAgICAgICB9IGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIEV2ZW50VHlwZS5RdWV1ZWQ6IHtcclxuICAgICAgICAgICAgICAgIGxldCBvcHRzOiBRdWV1ZWRFdmVudE9wdHM7XHJcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAxICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3B0cyA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIC8vIGFkZCBvdXJzZWx2ZXMgYXMgZGVmYXVsdCAnYm91bmRUbycgYXJndW1lbnRcclxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDAgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgICAgICBhcmdzLnVuc2hpZnQodGhpcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBsZXQgZXZlbnQ6IEJhc2VFdmVudDxUPjtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2V2ZW50c1tpXSBpbnN0YW5jZW9mIFF1ZXVlZEV2ZW50XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICYmIHNoYWxsb3dFcXVhbHMoKDxRdWV1ZWRFdmVudDxUPj50aGlzLl9ldmVudHNbaV0pLm9wdGlvbnMsIG9wdHMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gdGhpcy5fZXZlbnRzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICghZXZlbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBldmVudCA9IG5ldyBRdWV1ZWRFdmVudDxUPihvcHRzKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHMucHVzaChldmVudCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBldmVudC5hdHRhY2guYXBwbHkoZXZlbnQsIGFyZ3MpO1xyXG4gICAgICAgICAgICB9IGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIEV2ZW50VHlwZScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5ldnRGaXJzdEF0dGFjaGVkICYmIHByZXZDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLmV2dEZpcnN0QXR0YWNoZWQucG9zdCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgYXR0YWNoU3luYyhoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoU3luYyhib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2hTeW5jKGV2ZW50OiBQb3N0YWJsZTxUPik6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBldmVudCBoYW5kbGVycyBhcyBpZiBpdCB3ZXJlIGEgc3luYyBldmVudC4gSXQgaXMgc2ltcGx5IGNhbGxlZCAnYXR0YWNoJ1xyXG4gICAgICogc28gdGhhdCB0aGlzIGNsYXNzIGFkaGVyZXMgdG8gdGhlIEJhc2VFdmVudDxUPiBzaWduYXR1cmUuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhdHRhY2hTeW5jKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgYXJncy51bnNoaWZ0KEV2ZW50VHlwZS5TeW5jKTtcclxuICAgICAgICB0aGlzLmF0dGFjaC5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgYXR0YWNoQXN5bmMoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoQXN5bmMoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzKTogdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2hBc3luYyhldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBldmVudCBoYW5kbGVycyBhcyBpZiBpdCB3ZXJlIGEgYS1zeW5jIGV2ZW50XHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhdHRhY2hBc3luYyguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuQXN5bmMpO1xyXG4gICAgICAgIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhdHRhY2hRdWV1ZWQoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaFF1ZXVlZChib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2hRdWV1ZWQoZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGV2ZW50IGhhbmRsZXJzIGFzIGlmIGl0IHdlcmUgYSBxdWV1ZWQgZXZlbnRcclxuICAgICAqL1xyXG4gICAgcHVibGljIGF0dGFjaFF1ZXVlZCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuUXVldWVkKTtcclxuICAgICAgICB0aGlzLmF0dGFjaC5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgZGV0YWNoKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogdm9pZDtcclxuICAgIHB1YmxpYyBkZXRhY2goYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgZGV0YWNoKGJvdW5kVG86IE9iamVjdCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgZGV0YWNoKGV2ZW50OiBQb3N0YWJsZTxUPik6IHZvaWQ7XHJcbiAgICBwdWJsaWMgZGV0YWNoKCk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBldmVudCBoYW5kbGVycyByZWdhcmRsZXNzIG9mIHR5cGVcclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHByZXZDb3VudCA9ICghIXRoaXMuZXZ0TGFzdERldGFjaGVkID8gdGhpcy5saXN0ZW5lckNvdW50KCkgOiAwKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB0aGlzLl9ldmVudHNbaV0uZGV0YWNoLmFwcGx5KHRoaXMuX2V2ZW50c1tpXSwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghIXRoaXMuZXZ0TGFzdERldGFjaGVkICYmIHByZXZDb3VudCA+IDAgJiYgdGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy5ldnRMYXN0RGV0YWNoZWQucG9zdCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFBvc3QgYW4gZXZlbnQgdG8gYWxsIGN1cnJlbnQgbGlzdGVuZXJzXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IFQpOiB2b2lkIHtcclxuICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYXJyYXkgZmlyc3QgdG8gY292ZXIgdGhlIGNhc2Ugd2hlcmUgZXZlbnQgaGFuZGxlcnNcclxuICAgICAgICAvLyBhcmUgYXR0YWNoZWQgZHVyaW5nIHRoZSBwb3N0XHJcbiAgICAgICAgY29uc3QgZXZlbnRzOiBCYXNlRXZlbnQ8VD5bXSA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGV2ZW50cy5wdXNoKHRoaXMuX2V2ZW50c1tpXSk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBldmVudHNbaV0ucG9zdChkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGF0dGFjaGVkIGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgbGlzdGVuZXJDb3VudCgpOiBudW1iZXIge1xyXG4gICAgICAgIGxldCByZXN1bHQgPSAwO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCArPSB0aGlzLl9ldmVudHNbaV0ubGlzdGVuZXJDb3VudCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ29udmVuaWVuY2UgY2xhc3MgZm9yIEFueUV2ZW50cyB3aXRob3V0IGRhdGFcclxuICovXHJcbmV4cG9ydCBjbGFzcyBWb2lkQW55RXZlbnQgZXh0ZW5kcyBBbnlFdmVudDx2b2lkPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBBc3luY0V2ZW50LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcG9zdCgpOiB2b2lkIHtcclxuICAgICAgICBzdXBlci5wb3N0KHVuZGVmaW5lZCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTaW1pbGFyIHRvICdlcnJvcicgZXZlbnQgb24gRXZlbnRFbWl0dGVyOiB0aHJvd3Mgd2hlbiBhIHBvc3QoKSBvY2N1cnMgd2hpbGUgbm8gaGFuZGxlcnMgc2V0LlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEVycm9yQW55RXZlbnQgZXh0ZW5kcyBBbnlFdmVudDxFcnJvcj4ge1xyXG5cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IEVycm9yKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6ICR7ZGF0YS5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdXBlci5wb3N0KGRhdGEpO1xyXG4gICAgfVxyXG59XHJcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlLCBMaXN0ZW5lcn0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuXHJcbi8qKlxyXG4gKiBPcHRpb25zIGZvciB0aGUgQXN5bmNFdmVudCBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBBc3luY0V2ZW50T3B0cyB7XHJcbiAgICAvKipcclxuICAgICAqIENvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZSB3aGlsZSB0aGUgcHJldmlvdXMgb25lXHJcbiAgICAgKiBoYXMgbm90IGJlZW4gaGFuZGxlZCB5ZXQuXHJcbiAgICAgKi9cclxuICAgIGNvbmRlbnNlZD86IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBLXN5bmNocm9ub3VzIGV2ZW50LiBIYW5kbGVycyBhcmUgY2FsbGVkIGluIHRoZSBuZXh0IE5vZGUuSlMgY3ljbGUuXHJcbiAqIC0gT3B0aW9uYWxseSBjb25kZW5zZXMgbXVsdGlwbGUgcG9zdCgpIGNhbGxzIGludG8gb25lICh0aGUgbGFzdCBwb3N0KCkgZ2V0cyB0aHJvdWdoKVxyXG4gKiAtIEhhbmRsZXJzIGFyZSBjYWxsZWQgb25seSBmb3IgZXZlbnRzIHBvc3RlZCBhZnRlciB0aGV5IHdlcmUgYXR0YWNoZWQuXHJcbiAqIC0gSGFuZGxlcnMgYXJlIG5vdCBjYWxsZWQgYW55bW9yZSB3aGVuIHRoZXkgYXJlIGRldGFjaGVkLCBldmVuIGlmIGEgcG9zdCgpIGlzIGluIHByb2dyZXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQXN5bmNFdmVudDxUPiBleHRlbmRzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFVzZWQgaW50ZXJuYWxseSAtIHRoZSBleGFjdCBvcHRpb25zIG9iamVjdCBnaXZlbiB0byBjb25zdHJ1Y3RvclxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb3B0aW9uczogQXN5bmNFdmVudE9wdHM7XHJcblxyXG4gICAgcHJpdmF0ZSBfY29uZGVuc2VkOiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkOiBib29sZWFuID0gZmFsc2U7XHJcbiAgICBwcml2YXRlIF9xdWV1ZWRMaXN0ZW5lcnM6IExpc3RlbmVyPFQ+W107XHJcbiAgICBwcml2YXRlIF9xdWV1ZWREYXRhOiBhbnlbXTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBkZWZhdWx0IHNjaGVkdWxlciB1c2VzIHNldEltbWVkaWF0ZSgpIG9yIHNldFRpbWVvdXQoLi4uLCAwKSBpZiBzZXRJbW1lZGlhdGUgaXMgbm90IGF2YWlsYWJsZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0U2NoZWR1bGVyKGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgICovXHJcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIC8vIGJyb3dzZXJzIGRvbid0IGFsd2F5cyBzdXBwb3J0IHNldEltbWVkaWF0ZSgpXHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIG5vZGUuanNcclxuICAgICAgICAgICAgc2V0SW1tZWRpYXRlKGNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgY3VycmVudCBzY2hlZHVsZXJcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgX3NjaGVkdWxlcjogKGNhbGxiYWNrOiAoKSA9PiB2b2lkKSA9PiB2b2lkID0gQXN5bmNFdmVudC5kZWZhdWx0U2NoZWR1bGVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQnkgZGVmYXVsdCwgQXN5bmNFdmVudCB1c2VzIHNldEltbWVkaWF0ZSgpIHRvIHNjaGVkdWxlIGV2ZW50IGhhbmRsZXIgaW52b2NhdGlvbi5cclxuICAgICAqIFlvdSBjYW4gY2hhbmdlIHRoaXMgZm9yIGUuZy4gc2V0VGltZW91dCguLi4sIDApIGJ5IGNhbGxpbmcgdGhpcyBzdGF0aWMgbWV0aG9kIG9uY2UuXHJcbiAgICAgKiBAcGFyYW0gc2NoZWR1bGVyIEEgZnVuY3Rpb24gdGhhdCB0YWtlcyBhIGNhbGxiYWNrIGFuZCBleGVjdXRlcyBpdCBpbiB0aGUgbmV4dCBOb2RlLkpTIGN5Y2xlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIHNldFNjaGVkdWxlcihzY2hlZHVsZXI6IChjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4gdm9pZCk6IHZvaWQge1xyXG4gICAgICAgIEFzeW5jRXZlbnQuX3NjaGVkdWxlciA9IHNjaGVkdWxlcjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENvbnN0cnVjdG9yXHJcbiAgICAgKiBAcGFyYW0gb3B0cyBPcHRpb25hbC4gVmFyaW91cyBzZXR0aW5nczpcclxuICAgICAqICAgICAgICAgICAgIC0gY29uZGVuc2VkOiBhIEJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRvIGNvbmRlbnNlIG11bHRpcGxlIHBvc3QoKSBjYWxscyB3aXRoaW4gdGhlIHNhbWUgY3ljbGUuXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG9wdHM/OiBBc3luY0V2ZW50T3B0cykge1xyXG4gICAgICAgIHN1cGVyKCk7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0cztcclxuICAgICAgICBjb25zdCBvcHRpb25zOiBBc3luY0V2ZW50T3B0cyA9IG9wdHMgfHwge307XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmNvbmRlbnNlZCA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IG9wdGlvbnMuY29uZGVuc2VkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuIEhhbmRsZXJzIGFyZSBjYWxsZWQgaW4gdGhlIG5leHQgTm9kZS5KUyBjeWNsZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoZGF0YTogVCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgcG9zdCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5fY29uZGVuc2VkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZERhdGEgPSBhcmdzO1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBBc3luY0V2ZW50Ll9zY2hlZHVsZXIoKCk6IHZvaWQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGltbWVkaWF0ZWx5IG1hcmsgbm9uLXF1ZXVlZCB0byBhbGxvdyBuZXcgQXN5bmNFdmVudCB0byBoYXBwZW4gYXMgcmVzdWx0XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gb2YgY2FsbGluZyBoYW5kbGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhY2hlIGxpc3RlbmVycyBhbmQgZGF0YSBiZWNhdXNlIHRoZXkgbWlnaHQgY2hhbmdlIHdoaWxlIGNhbGxpbmcgZXZlbnQgaGFuZGxlcnNcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5fcXVldWVkRGF0YTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnM7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHsgLy8gbm90IGNvbmRlbnNlZFxyXG4gICAgICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgICAgIEFzeW5jRXZlbnQuX3NjaGVkdWxlcigoKTogdm9pZCA9PiB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gaW5oZXJpdGVkXHJcbiAgICBwcm90ZWN0ZWQgX2NhbGwobGlzdGVuZXI6IExpc3RlbmVyPFQ+LCBhcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIC8vIHBlcmZvcm1hbmNlIG9wdGltaXphdGlvbjogZG9uJ3QgdXNlIGNvbnNlY3V0aXZlIG5vZGVqcyBjeWNsZXNcclxuICAgICAgICAvLyBmb3IgYXN5bmNldmVudHMgYXR0YWNoZWQgdG8gYXN5bmNldmVudHNcclxuICAgICAgICBpZiAobGlzdGVuZXIuZXZlbnQgJiYgbGlzdGVuZXIuZXZlbnQgaW5zdGFuY2VvZiBBc3luY0V2ZW50KSB7XHJcbiAgICAgICAgICAgICg8QXN5bmNFdmVudDxUPj5saXN0ZW5lci5ldmVudCkuX3Bvc3REaXJlY3QoYXJncyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgc3VwZXIuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFBlcmZvcm1hbmNlIG9wdGltaXphdGlvbjogaWYgdGhpcyBhc3luYyBzaWduYWwgaXMgYXR0YWNoZWQgdG8gYW5vdGhlclxyXG4gICAgICogYXN5bmMgc2lnbmFsLCB3ZSdyZSBhbHJlYWR5IGEgdGhlIG5leHQgY3ljbGUgYW5kIHdlIGNhbiBjYWxsIGxpc3RlbmVyc1xyXG4gICAgICogZGlyZWN0bHlcclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIF9wb3N0RGlyZWN0KGFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGNvcHkgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGJlY2F1c2UgdGhpcy5fbGlzdGVuZXJzIG1pZ2h0IGJlIHJlcGxhY2VkIGR1cmluZ1xyXG4gICAgICAgIC8vIHRoZSBoYW5kbGVyIGNhbGxzXHJcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgQXN5bmNFdmVudHMgd2l0aG91dCBkYXRhXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVm9pZEFzeW5jRXZlbnQgZXh0ZW5kcyBBc3luY0V2ZW50PHZvaWQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KCk6IHZvaWQge1xyXG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFNpbWlsYXIgdG8gJ2Vycm9yJyBldmVudCBvbiBFdmVudEVtaXR0ZXI6IHRocm93cyB3aGVuIGEgcG9zdCgpIG9jY3VycyB3aGlsZSBubyBoYW5kbGVycyBzZXQuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXJyb3JBc3luY0V2ZW50IGV4dGVuZHMgQXN5bmNFdmVudDxFcnJvcj4ge1xyXG5cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IEVycm9yKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6ICR7ZGF0YS5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdXBlci5wb3N0KGRhdGEpO1xyXG4gICAgfVxyXG59XHJcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQb3N0YWJsZTxUPiB7XHJcbiAgICBwb3N0KGRhdGE6IFQpOiB2b2lkO1xyXG59XHJcblxyXG4vKipcclxuICogSW50ZXJuYWwgaW50ZXJmYWNlIGJldHdlZW4gQmFzZUV2ZW50IGFuZCBpdHMgc3ViY2xhc3Nlc1xyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBMaXN0ZW5lcjxUPiB7XHJcbiAgICAvKipcclxuICAgICAqIEluZGljYXRlcyB0aGF0IHRoZSBsaXN0ZW5lciB3YXMgZGV0YWNoZWRcclxuICAgICAqL1xyXG4gICAgZGVsZXRlZDogYm9vbGVhbjtcclxuICAgIC8qKlxyXG4gICAgICogVGhlIGhhbmRsZXJcclxuICAgICAqL1xyXG4gICAgaGFuZGxlcj86IChkYXRhOiBUKSA9PiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgdGhpcyBwb2ludGVyIGZvciB0aGUgaGFuZGxlclxyXG4gICAgICovXHJcbiAgICBib3VuZFRvPzogT2JqZWN0O1xyXG4gICAgLyoqXHJcbiAgICAgKiBJbnN0ZWFkIG9mIGEgaGFuZGxlciwgYW4gYXR0YWNoZWQgZXZlbnRcclxuICAgICAqL1xyXG4gICAgZXZlbnQ/OiBQb3N0YWJsZTxUPjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEJhc2UgY2xhc3MgZm9yIGV2ZW50cy5cclxuICogSGFuZGxlcyBhdHRhY2hpbmcgYW5kIGRldGFjaGluZyBsaXN0ZW5lcnNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBCYXNlRXZlbnQ8VD4gaW1wbGVtZW50cyBQb3N0YWJsZTxUPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2hlZCBsaXN0ZW5lcnMuIE5PVEU6IGRvIG5vdCBtb2RpZnkuXHJcbiAgICAgKiBJbnN0ZWFkLCByZXBsYWNlIHdpdGggYSBuZXcgYXJyYXkgd2l0aCBwb3NzaWJseSB0aGUgc2FtZSBlbGVtZW50cy4gVGhpcyBlbnN1cmVzXHJcbiAgICAgKiB0aGF0IGFueSByZWZlcmVuY2VzIHRvIHRoZSBhcnJheSBieSBldmVudHMgdGhhdCBhcmUgdW5kZXJ3YXkgcmVtYWluIHRoZSBzYW1lLlxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgX2xpc3RlbmVyczogTGlzdGVuZXI8VD5bXTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBhbiBldmVudCBoYW5kbGVyXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gdG8gY2FsbC4gVGhlIHRoaXMgYXJndW1lbnQgb2YgdGhlIGZ1bmN0aW9uIHdpbGwgYmUgdGhpcyBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhdHRhY2goaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlclxyXG4gICAgICogQHBhcmFtIGJvdW5kVG8gVGhlIHRoaXMgYXJndW1lbnQgb2YgdGhlIGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBjYWxsLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgZGlyZWN0bHlcclxuICAgICAqIEBwYXJhbSBldmVudCBUaGUgZXZlbnQgdG8gYmUgcG9zdGVkXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhdHRhY2goZXZlbnQ6IFBvc3RhYmxlPFQ+KTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBib3VuZFRvIChPcHRpb25hbCkgVGhlIHRoaXMgYXJndW1lbnQgb2YgdGhlIGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBjYWxsLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgbGV0IGJvdW5kVG86IE9iamVjdDtcclxuICAgICAgICBsZXQgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQ7XHJcbiAgICAgICAgbGV0IGV2ZW50OiBQb3N0YWJsZTxUPjtcclxuICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF07XHJcbiAgICAgICAgfSBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXS5wb3N0ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGV2ZW50ID0gYXJnc1swXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gIT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdCBhIGZ1bmN0aW9uIG9yIG9iamVjdCBhcyBmaXJzdCBhcmd1bWVudCcpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMV0gIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0IGEgZnVuY3Rpb24gYXMgc2Vjb25kIGFyZ3VtZW50Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYm91bmRUbyA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzFdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycykge1xyXG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lcnMgPSBbXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYXJyYXkgc28gZXZlbnRzIHRoYXQgYXJlIHVuZGVyd2F5IGhhdmUgYSBzdGFibGUgbG9jYWwgY29weVxyXG4gICAgICAgICAgICAvLyBvZiB0aGUgbGlzdGVuZXJzIGFycmF5IGF0IHRoZSB0aW1lIG9mIHBvc3QoKVxyXG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMubWFwKChsaXN0ZW5lcjogTGlzdGVuZXI8VD4pOiBMaXN0ZW5lcjxUPiA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbGlzdGVuZXI7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9saXN0ZW5lcnMucHVzaCh7XHJcbiAgICAgICAgICAgIGRlbGV0ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICBib3VuZFRvOiBib3VuZFRvLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyLFxyXG4gICAgICAgICAgICBldmVudDogZXZlbnRcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBhbGwgbGlzdGVuZXJzIHdpdGggdGhlIGdpdmVuIGhhbmRsZXIgZnVuY3Rpb25cclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaChoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBhbGwgbGlzdGVuZXJzIHdpdGggdGhlIGdpdmVuIGhhbmRsZXIgZnVuY3Rpb24gYW5kIGJvdW5kVG8gb2JqZWN0LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggYWxsIGxpc3RlbmVycyB0aGF0IHdlcmUgYXR0YWNoZWQgd2l0aCB0aGUgZ2l2ZW4gYm91bmRUbyBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBkZXRhY2goYm91bmRUbzogT2JqZWN0KTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogRGV0YWNoIHRoZSBnaXZlbiBldmVudC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaChldmVudDogUG9zdGFibGU8VD4pOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggYWxsIGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKCk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBpbXBsZW1lbnRhdGlvbi4gU2VlIHRoZSBvdmVybG9hZHMgZm9yIGRlc2NyaXB0aW9uLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBib3VuZFRvOiBPYmplY3Q7XHJcbiAgICAgICAgbGV0IGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkO1xyXG4gICAgICAgIGxldCBldmVudDogUG9zdGFibGU8VD47XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID49IDEpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiAoYXJnc1swXSkgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdLnBvc3QgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGV2ZW50ID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGJvdW5kVG8gPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA+PSAyKSB7XHJcbiAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzFdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVycyBBTkQgbWFyayB0aGVtIGFzIGRlbGV0ZWQgc28gc3ViY2xhc3NlcyBkb24ndCBzZW5kIGFueSBtb3JlIGV2ZW50cyB0byB0aGVtXHJcbiAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzLmZpbHRlcigobGlzdGVuZXI6IExpc3RlbmVyPFQ+KTogYm9vbGVhbiA9PiB7XHJcbiAgICAgICAgICAgIGlmICgodHlwZW9mIGhhbmRsZXIgPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmhhbmRsZXIgPT09IGhhbmRsZXIpXHJcbiAgICAgICAgICAgICAgICAmJiAodHlwZW9mIGV2ZW50ID09PSAndW5kZWZpbmVkJyB8fCBsaXN0ZW5lci5ldmVudCA9PT0gZXZlbnQpXHJcbiAgICAgICAgICAgICAgICAmJiAodHlwZW9mIGJvdW5kVG8gPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmJvdW5kVG8gPT09IGJvdW5kVG8pKSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5kZWxldGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBYnN0cmFjdCBwb3N0KCkgbWV0aG9kIHRvIGJlIGFibGUgdG8gY29ubmVjdCBhbnkgdHlwZSBvZiBldmVudCB0byBhbnkgb3RoZXIgZGlyZWN0bHlcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcG9zdChkYXRhOiBUKTogdm9pZCB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhYnN0cmFjdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIG51bWJlciBvZiBhdHRhY2hlZCBsaXN0ZW5lcnNcclxuICAgICAqL1xyXG4gICAgcHVibGljIGxpc3RlbmVyQ291bnQoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2xpc3RlbmVycyA/IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggOiAwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGwgdGhlIGdpdmVuIGxpc3RlbmVyLCBpZiBpdCBpcyBub3QgbWFya2VkIGFzICdkZWxldGVkJ1xyXG4gICAgICogQHBhcmFtIGxpc3RlbmVyIFRoZSBsaXN0ZW5lciB0byBjYWxsXHJcbiAgICAgKiBAcGFyYW0gYXJncyBUaGUgYXJndW1lbnRzIHRvIHRoZSBoYW5kbGVyXHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBfY2FsbChsaXN0ZW5lcjogTGlzdGVuZXI8VD4sIGFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCFsaXN0ZW5lci5kZWxldGVkKSB7XHJcbiAgICAgICAgICAgIGlmIChsaXN0ZW5lci5ldmVudCkge1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuZXZlbnQucG9zdC5hcHBseShsaXN0ZW5lci5ldmVudCwgYXJncyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5oYW5kbGVyLmFwcGx5KCh0eXBlb2YgbGlzdGVuZXIuYm91bmRUbyA9PT0gJ29iamVjdCcgPyBsaXN0ZW5lci5ib3VuZFRvIDogdGhpcyksIGFyZ3MpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxufVxyXG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaGFsbG93RXF1YWxzKGE6IGFueSwgYjogYW55KTogYm9vbGVhbiB7XHJcbiAgICBpZiAoYSA9PT0gYikge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiBhICE9PSB0eXBlb2YgYikge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHN3aXRjaCAodHlwZW9mIGEpIHtcclxuICAgICAgICBjYXNlICdib29sZWFuJzpcclxuICAgICAgICBjYXNlICdudW1iZXInOlxyXG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XHJcbiAgICAgICAgY2FzZSAnZnVuY3Rpb24nOlxyXG4gICAgICAgIGNhc2UgJ3N5bWJvbCc6XHJcbiAgICAgICAgY2FzZSAndW5kZWZpbmVkJzpcclxuICAgICAgICAgICAgLy8gYWxyZWFkeSBkaWQgPT09IGNvbXBhcmVcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNhc2UgJ29iamVjdCc6XHJcbiAgICAgICAgICAgIGlmIChhID09PSBudWxsIHx8IGIgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYWxyZWFkeSBjb21wYXJlZCA9PT1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhKSB8fCBBcnJheS5pc0FycmF5KGIpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoYSkgfHwgIUFycmF5LmlzQXJyYXkoYikpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWVzQTogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICAgICAgY29uc3QgbmFtZXNCOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gYSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGEuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lc0EucHVzaChuYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gYikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGIuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lc0IucHVzaChuYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBuYW1lc0Euc29ydCgpO1xyXG4gICAgICAgICAgICBuYW1lc0Iuc29ydCgpO1xyXG4gICAgICAgICAgICBpZiAobmFtZXNBLmpvaW4oJywnKSAhPT0gbmFtZXNCLmpvaW4oJywnKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXNBLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYVtuYW1lc0FbaV1dICE9PSBiW25hbWVzQVtpXV0pIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG59XHJcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlLCBMaXN0ZW5lcn0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuaW1wb3J0IHtkZWZhdWx0IGFzIEV2ZW50UXVldWV9IGZyb20gJy4vRXZlbnRRdWV1ZSc7XHJcblxyXG4vKipcclxuICogT3B0aW9ucyBmb3IgdGhlIFF1ZXVlZEV2ZW50IGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFF1ZXVlZEV2ZW50T3B0cyB7XHJcbiAgICAvKipcclxuICAgICAqIENvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZS5cclxuICAgICAqL1xyXG4gICAgY29uZGVuc2VkPzogYm9vbGVhbjtcclxuICAgIC8qKlxyXG4gICAgICogU3BlY2lmaWMgZXZlbnQgcXVldWUgdG8gdXNlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSBnbG9iYWwgaW5zdGFuY2UgaXMgdXNlZC5cclxuICAgICAqL1xyXG4gICAgcXVldWU/OiBFdmVudFF1ZXVlO1xyXG59XHJcblxyXG4vKipcclxuICogRXZlbnQgdGhhdCBzdGF5cyBpbiBhIHF1ZXVlIHVudGlsIHlvdSBwcm9jZXNzIHRoZSBxdWV1ZS4gQWxsb3dzIGZpbmUtZ3JhaW5lZFxyXG4gKiBjb250cm9sIG92ZXIgd2hlbiBldmVudHMgaGFwcGVuLlxyXG4gKiAtIE9wdGlvbmFsbHkgY29uZGVuc2VzIG11bHRpcGxlIHBvc3QoKSBjYWxscyBpbnRvIG9uZS5cclxuICogLSBIYW5kbGVycyBhcmUgY2FsbGVkIG9ubHkgZm9yIGV2ZW50cyBwb3N0ZWQgYWZ0ZXIgdGhleSB3ZXJlIGF0dGFjaGVkLlxyXG4gKiAtIEhhbmRsZXJzIGFyZSBub3QgY2FsbGVkIGFueW1vcmUgd2hlbiB0aGV5IGFyZSBkZXRhY2hlZCwgZXZlbiBpZiBhIHBvc3QoKSBpcyBpbiBwcm9ncmVzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFF1ZXVlZEV2ZW50PFQ+IGV4dGVuZHMgQmFzZUV2ZW50PFQ+IGltcGxlbWVudHMgUG9zdGFibGU8VD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXNlZCBpbnRlcm5hbGx5IC0gdGhlIGV4YWN0IG9wdGlvbnMgb2JqZWN0IGdpdmVuIHRvIGNvbnN0cnVjdG9yXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBvcHRpb25zOiBRdWV1ZWRFdmVudE9wdHM7XHJcblxyXG4gICAgcHJpdmF0ZSBfY29uZGVuc2VkOiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWU6IEV2ZW50UXVldWU7XHJcbiAgICBwcml2YXRlIF9xdWV1ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuICAgIHByaXZhdGUgX3F1ZXVlZExpc3RlbmVyczogTGlzdGVuZXI8VD5bXTtcclxuICAgIHByaXZhdGUgX3F1ZXVlZERhdGE6IGFueVtdO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSBvcHRzIE9wdGlvbmFsLCBhbiBvYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nIG1lbWJlcnM6XHJcbiAgICAgKiAgICAgICAgICAgICAtIGNvbmRlbnNlZDogYSBCb29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0byBjb25kZW5zZSBtdWx0aXBsZSBjYWxscyB0byBwb3N0KCkgaW50byBvbmUgKGRlZmF1bHQgZmFsc2UpXHJcbiAgICAgKiAgICAgICAgICAgICAtIHF1ZXVlOiBhIHNwZWNpZmljIGV2ZW50IHF1ZXVlIHRvIHVzZS4gVGhlIGdsb2JhbCBFdmVudFF1ZXVlIGluc3RhbmNlIGlzIHVzZWQgaWYgbm90IGdpdmVuLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRzPzogUXVldWVkRXZlbnRPcHRzKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRzO1xyXG4gICAgICAgIGNvbnN0IG9wdGlvbnM6IFF1ZXVlZEV2ZW50T3B0cyA9IG9wdHMgfHwge307XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmNvbmRlbnNlZCA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IG9wdGlvbnMuY29uZGVuc2VkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMucXVldWUgPT09ICdvYmplY3QnICYmIG9wdGlvbnMucXVldWUgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWUgPSBvcHRpb25zLnF1ZXVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogU2VuZCB0aGUgZXZlbnQuIEV2ZW50cyBhcmUgcXVldWVkIGluIHRoZSBldmVudCBxdWV1ZSB1bnRpbCBmbHVzaGVkIG91dC5cclxuICAgICogSWYgdGhlICdjb25kZW5zZWQnIG9wdGlvbiB3YXMgZ2l2ZW4gaW4gdGhlIGNvbnN0cnVjdG9yLCBtdWx0aXBsZSBwb3N0cygpXHJcbiAgICAqIGJldHdlZW4gcXVldWUgZmx1c2hlcyBhcmUgY29uZGVuc2VkIGludG8gb25lIGNhbGwgd2l0aCB0aGUgZGF0YSBmcm9tIHRoZVxyXG4gICAgKiBsYXN0IHBvc3QoKSBjYWxsLlxyXG4gICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IFQpOiB2b2lkO1xyXG4gICAgcHVibGljIHBvc3QoLi4uYXJnczogYW55W10pOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcXVldWUgPSAodGhpcy5fcXVldWUgPyB0aGlzLl9xdWV1ZSA6IEV2ZW50UXVldWUuZ2xvYmFsKCkpO1xyXG4gICAgICAgIGlmICh0aGlzLl9jb25kZW5zZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkRGF0YSA9IGFyZ3M7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZExpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3F1ZXVlZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHF1ZXVlLmFkZCgoKTogdm9pZCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaW1tZWRpYXRlbHkgbWFyayBub24tcXVldWVkIHRvIGFsbG93IG5ldyBBc3luY0V2ZW50IHRvIGhhcHBlbiBhcyByZXN1bHRcclxuICAgICAgICAgICAgICAgICAgICAvLyBvZiBjYWxsaW5nIGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY2FjaGUgbGlzdGVuZXJzIGFuZCBkYXRhIGJlY2F1c2UgdGhleSBtaWdodCBjaGFuZ2Ugd2hpbGUgY2FsbGluZyBldmVudCBoYW5kbGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9xdWV1ZWREYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX3F1ZXVlZExpc3RlbmVycztcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgeyAvLyBub3QgY29uZGVuc2VkXHJcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgcXVldWUuYWRkKCgpOiB2b2lkID0+IHtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgYXJncyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBldmVudHMgd2l0aG91dCBkYXRhXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVm9pZFF1ZXVlZEV2ZW50IGV4dGVuZHMgUXVldWVkRXZlbnQ8dm9pZD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgZXZlbnQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KCk6IHZvaWQge1xyXG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcclxuICAgIH1cclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTaW1pbGFyIHRvICdlcnJvcicgZXZlbnQgb24gRXZlbnRFbWl0dGVyOiB0aHJvd3Mgd2hlbiBhIHBvc3QoKSBvY2N1cnMgd2hpbGUgbm8gaGFuZGxlcnMgc2V0LlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEVycm9yUXVldWVkRXZlbnQgZXh0ZW5kcyBRdWV1ZWRFdmVudDxFcnJvcj4ge1xyXG5cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IEVycm9yKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGVycm9yIGV2ZW50IHBvc3RlZCB3aGlsZSBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuIEVycm9yOiAke2RhdGEubWVzc2FnZX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3VwZXIucG9zdChkYXRhKTtcclxuICAgIH1cclxufVxyXG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCB7QmFzZUV2ZW50LCBQb3N0YWJsZX0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuXHJcbi8qKlxyXG4gKiBUaGlzIGlzIGEgdHJ1ZSBFdmVudEVtaXR0ZXIgcmVwbGFjZW1lbnQ6IHRoZSBoYW5kbGVycyBhcmUgY2FsbGVkIHN5bmNocm9ub3VzbHkgd2hlblxyXG4gKiB5b3UgcG9zdCB0aGUgZXZlbnQuXHJcbiAqIC0gQWxsb3dzIGJldHRlciBlcnJvciBoYW5kbGluZyBieSBhZ2dyZWdhdGluZyBhbnkgZXJyb3JzIHRocm93biBieSBoYW5kbGVycy5cclxuICogLSBQcmV2ZW50cyBsaXZlbG9jayBieSB0aHJvd2luZyBhbiBlcnJvciB3aGVuIHJlY3Vyc2lvbiBkZXB0aCBpcyBhYm92ZSBhIG1heGltdW0uXHJcbiAqIC0gSGFuZGxlcnMgYXJlIGNhbGxlZCBvbmx5IGZvciBldmVudHMgcG9zdGVkIGFmdGVyIHRoZXkgd2VyZSBhdHRhY2hlZC5cclxuICogLSBIYW5kbGVycyBhcmUgbm90IGNhbGxlZCBhbnltb3JlIHdoZW4gdGhleSBhcmUgZGV0YWNoZWQsIGV2ZW4gaWYgYSBwb3N0KCkgaXMgaW4gcHJvZ3Jlc3NcclxuICovXHJcbmV4cG9ydCBjbGFzcyBTeW5jRXZlbnQ8VD4gZXh0ZW5kcyBCYXNlRXZlbnQ8VD4gaW1wbGVtZW50cyBQb3N0YWJsZTxUPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBNYXhpbXVtIG51bWJlciBvZiB0aW1lcyB0aGF0IGFuIGV2ZW50IGhhbmRsZXIgbWF5IGNhdXNlIHRoZSBzYW1lIGV2ZW50XHJcbiAgICAgKiByZWN1cnNpdmVseS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBNQVhfUkVDVVJTSU9OX0RFUFRIOiBudW1iZXIgPSAxMDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlY3Vyc2l2ZSBwb3N0KCkgaW52b2NhdGlvbnNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfcmVjdXJzaW9uOiBudW1iZXIgPSAwO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgZXZlbnQuIEhhbmRsZXJzIGFyZSBjYWxsZWQgaW1tZWRpYXRlbHkgYW5kIHN5bmNocm9ub3VzbHkuXHJcbiAgICAgKiBJZiBhbiBlcnJvciBpcyB0aHJvd24gYnkgYSBoYW5kbGVyLCB0aGUgcmVtYWluaW5nIGhhbmRsZXJzIGFyZSBzdGlsbCBjYWxsZWQuXHJcbiAgICAgKiBBZnRlcndhcmQsIGFuIEFnZ3JlZ2F0ZUVycm9yIGlzIHRocm93biB3aXRoIHRoZSBvcmlnaW5hbCBlcnJvcihzKSBpbiBpdHMgJ2NhdXNlcycgcHJvcGVydHkuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IFQpOiB2b2lkO1xyXG4gICAgcHVibGljIHBvc3QoLi4uYXJnczogYW55W10pOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fcmVjdXJzaW9uKys7XHJcbiAgICAgICAgaWYgKFN5bmNFdmVudC5NQVhfUkVDVVJTSU9OX0RFUFRIID4gMCAmJlxyXG4gICAgICAgICAgICB0aGlzLl9yZWN1cnNpb24gPiBTeW5jRXZlbnQuTUFYX1JFQ1VSU0lPTl9ERVBUSCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2V2ZW50IGZpcmVkIHJlY3Vyc2l2ZWx5Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGNvcHkgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGJlY2F1c2UgdGhpcy5fbGlzdGVuZXJzIG1pZ2h0IGJlIHJlcGxhY2VkIGR1cmluZ1xyXG4gICAgICAgIC8vIHRoZSBoYW5kbGVyIGNhbGxzXHJcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fcmVjdXJzaW9uLS07XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgZXZlbnRzIHdpdGhvdXQgZGF0YVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZvaWRTeW5jRXZlbnQgZXh0ZW5kcyBTeW5jRXZlbnQ8dm9pZD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgZXZlbnQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KCk6IHZvaWQge1xyXG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFNpbWlsYXIgdG8gJ2Vycm9yJyBldmVudCBvbiBFdmVudEVtaXR0ZXI6IHRocm93cyB3aGVuIGEgcG9zdCgpIG9jY3VycyB3aGlsZSBubyBoYW5kbGVycyBzZXQuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXJyb3JTeW5jRXZlbnQgZXh0ZW5kcyBTeW5jRXZlbnQ8RXJyb3I+IHtcclxuXHJcbiAgICBwdWJsaWMgcG9zdChkYXRhOiBFcnJvcik6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLmxpc3RlbmVyQ291bnQoKSA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGVycm9yIGV2ZW50IHBvc3RlZCB3aGlsZSBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuIEVycm9yOiAke2RhdGEubWVzc2FnZX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3VwZXIucG9zdChkYXRhKTtcclxuICAgIH1cclxufVxyXG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmV4cG9ydCAqIGZyb20gJy4vYmFzZS1ldmVudCc7XHJcbmV4cG9ydCAqIGZyb20gJy4vc3luYy1ldmVudCc7XHJcbmV4cG9ydCAqIGZyb20gJy4vcXVldWVkLWV2ZW50JztcclxuZXhwb3J0ICogZnJvbSAnLi9hc3luYy1ldmVudCc7XHJcbmV4cG9ydCAqIGZyb20gJy4vYW55LWV2ZW50JztcclxuXHJcbmltcG9ydCB7ZGVmYXVsdCBhcyBFdmVudFF1ZXVlfSBmcm9tICcuL0V2ZW50UXVldWUnO1xyXG5leHBvcnQge2RlZmF1bHQgYXMgRXZlbnRRdWV1ZX0gZnJvbSAnLi9FdmVudFF1ZXVlJztcclxuXHJcbi8qKlxyXG4gKiBUaGUgZ2xvYmFsIGV2ZW50IHF1ZXVlIGZvciBRdWV1ZWRFdmVudHNcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBxdWV1ZSgpOiBFdmVudFF1ZXVlIHtcclxuICAgIHJldHVybiBFdmVudFF1ZXVlLmdsb2JhbCgpO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVuaWVuY2UgZnVuY3Rpb24sIHNhbWUgYXMgRXZlbnRRdWV1ZS5nbG9iYWwoKS5mbHVzaE9uY2UoKS5cclxuICogRmx1c2hlcyB0aGUgUXVldWVkRXZlbnRzLCBjYWxsaW5nIGFsbCBldmVudHMgY3VycmVudGx5IGluIHRoZSBxdWV1ZSBidXQgbm90XHJcbiAqIGFueSBldmVudHMgcHV0IGludG8gdGhlIHF1ZXVlIGFzIGEgcmVzdWx0IG9mIHRoZSBmbHVzaC5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmbHVzaE9uY2UoKTogdm9pZCB7XHJcbiAgICBFdmVudFF1ZXVlLmdsb2JhbCgpLmZsdXNoT25jZSgpO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVuaWVuY2UgZnVuY3Rpb24sIHNhbWUgYXMgRXZlbnRRdWV1ZS5nbG9iYWwoKS5mbHVzaCgpLlxyXG4gKiBGbHVzaGVzIHRoZSBRdWV1ZWRFdmVudHMsIGNhbGxpbmcgYWxsIGhhbmRsZXJzIGN1cnJlbnRseSBpbiB0aGUgcXVldWUgYW5kIHRob3NlXHJcbiAqIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXHJcbiAqIEBwYXJhbSBtYXhSb3VuZHMgT3B0aW9uYWwsIGRlZmF1bHQgMTAuIE51bWJlciBvZiBpdGVyYXRpb25zIGFmdGVyIHdoaWNoIHRvIHRocm93IGFuIGVycm9yIGJlY2F1c2VcclxuICogICAgICAgICAgICAgICAgICB0aGUgcXVldWUga2VlcHMgZmlsbGluZyB1cC4gU2V0IHRvIHVuZGVmaW5lZCBvciBudWxsIHRvIGRpc2FibGUgdGhpcy5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmbHVzaChtYXhSb3VuZHM6IG51bWJlciA9IDEwKTogdm9pZCB7XHJcbiAgICBFdmVudFF1ZXVlLmdsb2JhbCgpLmZsdXNoKG1heFJvdW5kcyk7XHJcbn1cclxuIl19
return require('ts-events');
});