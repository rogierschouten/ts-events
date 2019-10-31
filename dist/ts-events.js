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
require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var sync_event_1 = require("./sync-event");
/**
 * Simple synchronous event queue that needs to be drained manually.
 */
var EventQueue = /** @class */ (function () {
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
exports.default = EventQueue;
},{"./sync-event":7}],2:[function(require,module,exports){
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var objects_1 = require("./objects");
var sync_event_1 = require("./sync-event");
var async_event_1 = require("./async-event");
var queued_event_1 = require("./queued-event");
var EventType;
(function (EventType) {
    EventType[EventType["Sync"] = 0] = "Sync";
    EventType[EventType["Async"] = 1] = "Async";
    EventType[EventType["Queued"] = 2] = "Queued";
})(EventType = exports.EventType || (exports.EventType = {}));
/**
 * An event that behaves like a Sync/Async/Queued event depending on how
 * you subscribe.
 */
var AnyEvent = /** @class */ (function () {
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
    AnyEvent.prototype.attach = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var mode = EventType.Sync;
        if (args.length > 0 && typeof args[0] === 'number') {
            mode = args.shift();
        }
        var boundTo = this; // add ourselves as default 'boundTo' argument
        var handler;
        var opts;
        var postable;
        if (typeof args[0] === 'function' || (args[0] && typeof args[0] === 'object' && typeof args[0].post === 'function')) {
            if (typeof args[0] === 'function') {
                handler = args[0];
            }
            else {
                postable = args[0];
            }
            opts = args[1];
        }
        else {
            boundTo = args[0];
            handler = args[1];
            opts = args[2];
        }
        return this._attach(mode, boundTo, handler, postable, opts, false);
    };
    AnyEvent.prototype.once = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var mode = EventType.Sync;
        if (args.length > 0 && typeof args[0] === 'number') {
            mode = args.shift();
        }
        var boundTo = this; // add ourselves as default 'boundTo' argument
        var handler;
        var opts;
        var postable;
        if (typeof args[0] === 'function' || (args[0] && typeof args[0] === 'object' && typeof args[0].post === 'function')) {
            if (typeof args[0] === 'function') {
                handler = args[0];
            }
            else {
                postable = args[0];
            }
            opts = args[1];
        }
        else {
            boundTo = args[0];
            handler = args[1];
            opts = args[2];
        }
        return this._attach(mode, boundTo, handler, postable, opts, true);
    };
    AnyEvent.prototype._attach = function (mode, boundTo, handler, postable, opts, once) {
        var _this = this;
        var prevCount = (!!this.evtFirstAttached ? this.listenerCount() : 0);
        var event;
        switch (mode) {
            case EventType.Sync:
                {
                    for (var _i = 0, _a = this._events; _i < _a.length; _i++) {
                        var evt = _a[_i];
                        if (evt instanceof sync_event_1.SyncEvent) {
                            event = evt;
                        }
                    }
                    if (!event) {
                        event = new sync_event_1.SyncEvent();
                        this._events.push(event);
                    }
                }
                break;
            case EventType.Async:
                {
                    for (var _b = 0, _c = this._events; _b < _c.length; _b++) {
                        var evt = _c[_b];
                        if (evt instanceof async_event_1.AsyncEvent && objects_1.shallowEquals(evt.options, opts)) {
                            event = evt;
                        }
                    }
                    if (!event) {
                        event = new async_event_1.AsyncEvent(opts);
                        this._events.push(event);
                    }
                }
                break;
            case EventType.Queued:
                {
                    for (var _d = 0, _e = this._events; _d < _e.length; _d++) {
                        var evt = _e[_d];
                        if (evt instanceof queued_event_1.QueuedEvent && objects_1.shallowEquals(evt.options, opts)) {
                            event = evt;
                        }
                    }
                    if (!event) {
                        event = new queued_event_1.QueuedEvent(opts);
                        this._events.push(event);
                    }
                }
                break;
            default:
                throw new Error('unknown EventType');
        }
        var detacher;
        if (once) {
            if (postable) {
                detacher = event.once(postable);
            }
            else {
                detacher = event.once(boundTo, handler);
            }
        }
        else {
            if (postable) {
                detacher = event.attach(postable);
            }
            else {
                detacher = event.attach(boundTo, handler);
            }
        }
        if (this.evtFirstAttached && prevCount === 0) {
            this.evtFirstAttached.post();
        }
        return function () {
            var prevCount = (!!_this.evtLastDetached ? _this.listenerCount() : 0);
            detacher();
            if (!!_this.evtLastDetached && prevCount > 0 && _this.listenerCount() === 0) {
                _this.evtLastDetached.post();
            }
        };
    };
    AnyEvent.prototype.attachSync = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.unshift(EventType.Sync);
        return this.attach.apply(this, args);
    };
    AnyEvent.prototype.onceSync = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.unshift(EventType.Sync);
        return this.once.apply(this, args);
    };
    AnyEvent.prototype.attachAsync = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.unshift(EventType.Async);
        return this.attach.apply(this, args);
    };
    AnyEvent.prototype.onceAsync = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.unshift(EventType.Async);
        return this.once.apply(this, args);
    };
    AnyEvent.prototype.attachQueued = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.unshift(EventType.Queued);
        return this.attach.apply(this, args);
    };
    AnyEvent.prototype.onceQueued = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.unshift(EventType.Queued);
        return this.once.apply(this, args);
    };
    /**
     * Detach event handlers regardless of type
     */
    AnyEvent.prototype.detach = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
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
var VoidAnyEvent = /** @class */ (function (_super) {
    __extends(VoidAnyEvent, _super);
    function VoidAnyEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
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
var ErrorAnyEvent = /** @class */ (function (_super) {
    __extends(ErrorAnyEvent, _super);
    function ErrorAnyEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
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
(function (setImmediate){
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var base_event_1 = require("./base-event");
/**
 * A-synchronous event. Handlers are called in the next Node.JS cycle.
 * - Optionally condenses multiple post() calls into one (the last post() gets through)
 * - Handlers are called only for events posted after they were attached.
 * - Handlers are not called anymore when they are detached, even if a post() is in progress
 */
var AsyncEvent = /** @class */ (function (_super) {
    __extends(AsyncEvent, _super);
    /**
     * Constructor
     * @param opts Optional. Various settings:
     *             - condensed: a Boolean indicating whether to condense multiple post() calls within the same cycle.
     */
    function AsyncEvent(opts) {
        var _this = _super.call(this) || this;
        _this._queued = false;
        _this.options = opts;
        var options = opts || {};
        if (typeof options.condensed === 'boolean') {
            _this._condensed = options.condensed;
        }
        else {
            _this._condensed = false;
        }
        return _this;
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
            args[_i] = arguments[_i];
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
        else { // not condensed
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
var VoidAsyncEvent = /** @class */ (function (_super) {
    __extends(VoidAsyncEvent, _super);
    function VoidAsyncEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
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
var ErrorAsyncEvent = /** @class */ (function (_super) {
    __extends(ErrorAsyncEvent, _super);
    function ErrorAsyncEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
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
}).call(this,require("timers").setImmediate)

},{"./base-event":4,"timers":9}],4:[function(require,module,exports){
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Base class for events.
 * Handles attaching and detaching listeners
 */
var BaseEvent = /** @class */ (function () {
    function BaseEvent() {
    }
    /**
     * Attach implementation
     */
    BaseEvent.prototype.attach = function (a, b) {
        return this._attach(a, b, false);
    };
    /**
     * Once implementation
     */
    BaseEvent.prototype.once = function (a, b) {
        return this._attach(a, b, true);
    };
    /**
     * Attach / once implementation
     * @param a
     * @param b
     * @param once
     * @returns function you can use for detaching from the event, instead of calling detach()
     */
    BaseEvent.prototype._attach = function (a, b, once) {
        var _this = this;
        var boundTo;
        var handler;
        var event;
        var result;
        if (typeof a === 'function') {
            handler = a;
            result = function () { return _this.detach(handler); };
        }
        else if (!b && typeof a.post === 'function') {
            event = a;
            result = function () { return _this.detach(event); };
        }
        else {
            if (typeof a !== 'object') {
                throw new Error('Expect a function or object as first argument');
            }
            if (typeof b !== 'function') {
                throw new Error('Expect a function as second argument');
            }
            boundTo = a;
            handler = b;
            result = function () { return _this.detach(boundTo, handler); };
        }
        if (!this._listeners) {
            this._listeners = [];
        }
        else {
            // make a copy of the array so events that are underway have a stable local copy
            // of the listeners array at the time of post()
            this._listeners = this._listeners.slice();
        }
        this._listeners.push({
            deleted: false,
            boundTo: boundTo,
            handler: handler,
            event: event,
            once: once
        });
        return result;
    };
    /**
     * Detach implementation. See the overloads for description.
     */
    BaseEvent.prototype.detach = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
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
            if (listener.once) {
                // remove listeners AND mark as deleted so subclasses don't send any more events to them
                listener.deleted = true;
                this._listeners = this._listeners.filter(function (l) { return l !== listener; });
                if (this._listeners.length === 0) {
                    delete this._listeners;
                }
            }
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
Object.defineProperty(exports, "__esModule", { value: true });
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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var base_event_1 = require("./base-event");
var EventQueue_1 = require("./EventQueue");
/**
 * Event that stays in a queue until you process the queue. Allows fine-grained
 * control over when events happen.
 * - Optionally condenses multiple post() calls into one.
 * - Handlers are called only for events posted after they were attached.
 * - Handlers are not called anymore when they are detached, even if a post() is in progress
 */
var QueuedEvent = /** @class */ (function (_super) {
    __extends(QueuedEvent, _super);
    /**
     * Constructor
     * @param opts Optional, an object with the following members:
     *             - condensed: a Boolean indicating whether to condense multiple calls to post() into one (default false)
     *             - queue: a specific event queue to use. The global EventQueue instance is used if not given.
     */
    function QueuedEvent(opts) {
        var _this = _super.call(this) || this;
        _this._queued = false;
        _this.options = opts;
        var options = opts || {};
        if (typeof options.condensed === 'boolean') {
            _this._condensed = options.condensed;
        }
        else {
            _this._condensed = false;
        }
        if (typeof options.queue === 'object' && options.queue !== null) {
            _this._queue = options.queue;
        }
        return _this;
    }
    QueuedEvent.prototype.post = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
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
        else { // not condensed
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
var VoidQueuedEvent = /** @class */ (function (_super) {
    __extends(VoidQueuedEvent, _super);
    function VoidQueuedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
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
var ErrorQueuedEvent = /** @class */ (function (_super) {
    __extends(ErrorQueuedEvent, _super);
    function ErrorQueuedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var base_event_1 = require("./base-event");
/**
 * This is a true EventEmitter replacement: the handlers are called synchronously when
 * you post the event.
 * - Allows better error handling by aggregating any errors thrown by handlers.
 * - Prevents livelock by throwing an error when recursion depth is above a maximum.
 * - Handlers are called only for events posted after they were attached.
 * - Handlers are not called anymore when they are detached, even if a post() is in progress
 */
var SyncEvent = /** @class */ (function (_super) {
    __extends(SyncEvent, _super);
    function SyncEvent() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        /**
         * Recursive post() invocations
         */
        _this._recursion = 0;
        return _this;
    }
    SyncEvent.prototype.post = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
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
var VoidSyncEvent = /** @class */ (function (_super) {
    __extends(VoidSyncEvent, _super);
    function VoidSyncEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
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
var ErrorSyncEvent = /** @class */ (function (_super) {
    __extends(ErrorSyncEvent, _super);
    function ErrorSyncEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
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
},{"./base-event":4}],8:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],9:[function(require,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,require("timers").setImmediate,require("timers").clearImmediate)

},{"process/browser.js":8,"timers":9}],"ts-events":[function(require,module,exports){
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./base-event"));
__export(require("./sync-event"));
__export(require("./queued-event"));
__export(require("./async-event"));
__export(require("./any-event"));
var EventQueue_1 = require("./EventQueue");
var EventQueue_2 = require("./EventQueue");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbGliL0V2ZW50UXVldWUudHMiLCJzcmMvbGliL2FueS1ldmVudC50cyIsImRpc3QvbGliL3NyYy9saWIvYXN5bmMtZXZlbnQudHMiLCJzcmMvbGliL2Jhc2UtZXZlbnQudHMiLCJzcmMvbGliL29iamVjdHMudHMiLCJzcmMvbGliL3F1ZXVlZC1ldmVudC50cyIsInNyYy9saWIvc3luYy1ldmVudC50cyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvdGltZXJzLWJyb3dzZXJpZnkvbWFpbi5qcyIsInNyYy9saWIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSw2REFBNkQ7QUFDN0QsZUFBZTtBQUVmLFlBQVksQ0FBQzs7QUFFYiwyQ0FBdUM7QUFFdkM7O0dBRUc7QUFDSDtJQUFBO1FBRUk7OztXQUdHO1FBQ0ksY0FBUyxHQUEwQixJQUFJLHNCQUFTLEVBQWMsQ0FBQztRQUN0RTs7O1dBR0c7UUFDSSxlQUFVLEdBQTBCLElBQUksc0JBQVMsRUFBYyxDQUFDO1FBd0J2RTs7V0FFRztRQUNLLFdBQU0sR0FBbUIsRUFBRSxDQUFDO1FBRXBDOztXQUVHO1FBQ0ssY0FBUyxHQUFZLEtBQUssQ0FBQztJQXFFdkMsQ0FBQztJQTlGRzs7T0FFRztJQUNXLGlCQUFNLEdBQXBCO1FBQ0ksSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUU7WUFDdkIsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO1NBQzVCO1FBQ0QsT0FBTyxVQUFVLENBQUMsU0FBUyxDQUFDO0lBQ2hDLENBQUM7SUFFRDs7T0FFRztJQUNXLHNCQUFXLEdBQXpCO1FBQ0ksVUFBVSxDQUFDLFNBQVMsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFZRDs7T0FFRztJQUNJLDBCQUFLLEdBQVo7UUFDSSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksd0JBQUcsR0FBVixVQUFXLE9BQW1CO1FBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzFCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUM3QyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM3QjtJQUNMLENBQUM7SUFFRDs7O09BR0c7SUFDSSw4QkFBUyxHQUFoQjtRQUNJLElBQU0sS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDekMsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUNoQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztRQUN0QixJQUFJO1lBQ0EsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUMxQixJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUNqQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtnQkFDbkMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7YUFDZDtTQUNKO2dCQUFTO1lBQ04sSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7WUFDMUIsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Z0JBQ2pELElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzlCO1NBQ0o7SUFDTCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSSwwQkFBSyxHQUFaLFVBQWEsU0FBc0I7UUFBdEIsMEJBQUEsRUFBQSxjQUFzQjtRQUMvQixJQUFNLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3pDLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDaEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDdEIsSUFBSTtZQUNBLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNWLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUMzQixJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsSUFBSSxDQUFDLElBQUksU0FBUyxFQUFFO29CQUNqRCxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztvQkFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyw4RUFBOEUsQ0FBQyxDQUFDO2lCQUNuRztnQkFDRCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2pCLEVBQUUsQ0FBQyxDQUFDO2FBQ1A7U0FDSjtnQkFBUztZQUNOLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDO1lBQzFCLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUNqRCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUM5QjtTQUNKO0lBQ0wsQ0FBQztJQUNMLGlCQUFDO0FBQUQsQ0FoSEEsQUFnSEMsSUFBQTtBQUVELGtCQUFlLFVBQVUsQ0FBQzs7QUM1SDFCLDZEQUE2RDtBQUM3RCxlQUFlO0FBRWYsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7QUFFYixxQ0FBd0M7QUFHeEMsMkNBQXVDO0FBQ3ZDLDZDQUF5RDtBQUN6RCwrQ0FBNEQ7QUFFNUQsSUFBWSxTQUlYO0FBSkQsV0FBWSxTQUFTO0lBQ2pCLHlDQUFJLENBQUE7SUFDSiwyQ0FBSyxDQUFBO0lBQ0wsNkNBQU0sQ0FBQTtBQUNWLENBQUMsRUFKVyxTQUFTLEdBQVQsaUJBQVMsS0FBVCxpQkFBUyxRQUlwQjtBQVNEOzs7R0FHRztBQUNIO0lBa0JJLGtCQUFZLElBQW1CO1FBTC9COztXQUVHO1FBQ0ssWUFBTyxHQUFtQixFQUFFLENBQUM7UUFHakMsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRTtZQUM1QixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUMzQyxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7U0FDN0M7SUFDTCxDQUFDO0lBYU0seUJBQU0sR0FBYjtRQUFjLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ3hCLElBQUksSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDMUIsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLEVBQUU7WUFDaEQsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQWUsQ0FBQztTQUNwQztRQUNELElBQUksT0FBTyxHQUFXLElBQUksQ0FBQyxDQUFDLDhDQUE4QztRQUMxRSxJQUFJLE9BQTBCLENBQUM7UUFDL0IsSUFBSSxJQUFzQyxDQUFDO1FBQzNDLElBQUksUUFBcUIsQ0FBQztRQUMxQixJQUFJLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLElBQUksT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxFQUFFO1lBQ2pILElBQUksT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssVUFBVSxFQUFFO2dCQUMvQixPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ3JCO2lCQUFNO2dCQUNILFFBQVEsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDdEI7WUFDRCxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ2xCO2FBQU07WUFDSCxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xCLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEIsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNsQjtRQUNELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFhTSx1QkFBSSxHQUFYO1FBQVksY0FBYzthQUFkLFVBQWMsRUFBZCxxQkFBYyxFQUFkLElBQWM7WUFBZCx5QkFBYzs7UUFDdEIsSUFBSSxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQztRQUMxQixJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsRUFBRTtZQUNoRCxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBZSxDQUFDO1NBQ3BDO1FBQ0QsSUFBSSxPQUFPLEdBQVcsSUFBSSxDQUFDLENBQUMsOENBQThDO1FBQzFFLElBQUksT0FBMEIsQ0FBQztRQUMvQixJQUFJLElBQXNDLENBQUM7UUFDM0MsSUFBSSxRQUFxQixDQUFDO1FBQzFCLElBQUksT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsSUFBSSxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLEVBQUU7WUFDakgsSUFBSSxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxVQUFVLEVBQUU7Z0JBQy9CLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDckI7aUJBQU07Z0JBQ0gsUUFBUSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUN0QjtZQUNELElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbEI7YUFBTTtZQUNILE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEIsT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsQixJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ2xCO1FBQ0QsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdEUsQ0FBQztJQUVPLDBCQUFPLEdBQWYsVUFDSSxJQUFlLEVBQ2YsT0FBMkIsRUFDM0IsT0FBc0MsRUFDdEMsUUFBaUMsRUFDakMsSUFBa0QsRUFDbEQsSUFBYTtRQU5qQixpQkF1RUM7UUEvREcsSUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksS0FBbUIsQ0FBQztRQUN4QixRQUFRLElBQUksRUFBRTtZQUNWLEtBQUssU0FBUyxDQUFDLElBQUk7Z0JBQUU7b0JBQ2pCLEtBQWtCLFVBQVksRUFBWixLQUFBLElBQUksQ0FBQyxPQUFPLEVBQVosY0FBWSxFQUFaLElBQVksRUFBRTt3QkFBM0IsSUFBTSxHQUFHLFNBQUE7d0JBQ1YsSUFBSSxHQUFHLFlBQVksc0JBQVMsRUFBRTs0QkFDMUIsS0FBSyxHQUFHLEdBQUcsQ0FBQzt5QkFDZjtxQkFDSjtvQkFDRCxJQUFJLENBQUMsS0FBSyxFQUFFO3dCQUNSLEtBQUssR0FBRyxJQUFJLHNCQUFTLEVBQUssQ0FBQzt3QkFDM0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7cUJBQzVCO2lCQUNKO2dCQUFDLE1BQU07WUFDUixLQUFLLFNBQVMsQ0FBQyxLQUFLO2dCQUFFO29CQUNsQixLQUFrQixVQUFZLEVBQVosS0FBQSxJQUFJLENBQUMsT0FBTyxFQUFaLGNBQVksRUFBWixJQUFZLEVBQUU7d0JBQTNCLElBQU0sR0FBRyxTQUFBO3dCQUNWLElBQUksR0FBRyxZQUFZLHdCQUFVLElBQUksdUJBQWEsQ0FBaUIsR0FBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsRUFBRTs0QkFDaEYsS0FBSyxHQUFHLEdBQUcsQ0FBQzt5QkFDZjtxQkFDSjtvQkFDRCxJQUFJLENBQUMsS0FBSyxFQUFFO3dCQUNSLEtBQUssR0FBRyxJQUFJLHdCQUFVLENBQUksSUFBSSxDQUFDLENBQUM7d0JBQ2hDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO3FCQUM1QjtpQkFDSjtnQkFBQyxNQUFNO1lBQ1IsS0FBSyxTQUFTLENBQUMsTUFBTTtnQkFBRTtvQkFDbkIsS0FBa0IsVUFBWSxFQUFaLEtBQUEsSUFBSSxDQUFDLE9BQU8sRUFBWixjQUFZLEVBQVosSUFBWSxFQUFFO3dCQUEzQixJQUFNLEdBQUcsU0FBQTt3QkFDVixJQUFJLEdBQUcsWUFBWSwwQkFBVyxJQUFJLHVCQUFhLENBQWtCLEdBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUU7NEJBQ2xGLEtBQUssR0FBRyxHQUFHLENBQUM7eUJBQ2Y7cUJBQ0o7b0JBQ0QsSUFBSSxDQUFDLEtBQUssRUFBRTt3QkFDUixLQUFLLEdBQUcsSUFBSSwwQkFBVyxDQUFJLElBQUksQ0FBQyxDQUFDO3dCQUNqQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztxQkFDNUI7aUJBQ0o7Z0JBQUMsTUFBTTtZQUNSO2dCQUNJLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztTQUM1QztRQUNELElBQUksUUFBb0IsQ0FBQztRQUN6QixJQUFJLElBQUksRUFBRTtZQUNOLElBQUksUUFBUSxFQUFFO2dCQUNWLFFBQVEsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQ25DO2lCQUFNO2dCQUNILFFBQVEsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQzthQUMzQztTQUNKO2FBQU07WUFDSCxJQUFJLFFBQVEsRUFBRTtnQkFDVixRQUFRLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNyQztpQkFBTTtnQkFDSCxRQUFRLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDN0M7U0FDSjtRQUNELElBQUksSUFBSSxDQUFDLGdCQUFnQixJQUFJLFNBQVMsS0FBSyxDQUFDLEVBQUU7WUFDMUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxDQUFDO1NBQ2hDO1FBQ0QsT0FBTztZQUNILElBQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdEUsUUFBUSxFQUFFLENBQUM7WUFDWCxJQUFJLENBQUMsQ0FBQyxLQUFJLENBQUMsZUFBZSxJQUFJLFNBQVMsR0FBRyxDQUFDLElBQUksS0FBSSxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsRUFBRTtnQkFDdkUsS0FBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQzthQUMvQjtRQUNMLENBQUMsQ0FBQztJQUNOLENBQUM7SUFLTSw2QkFBVSxHQUFqQjtRQUFrQixjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUM1QixJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBS00sMkJBQVEsR0FBZjtRQUFnQixjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUMxQixJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBS00sOEJBQVcsR0FBbEI7UUFBbUIsY0FBYzthQUFkLFVBQWMsRUFBZCxxQkFBYyxFQUFkLElBQWM7WUFBZCx5QkFBYzs7UUFDN0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUtNLDRCQUFTLEdBQWhCO1FBQWlCLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQzNCLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFLTSwrQkFBWSxHQUFuQjtRQUFvQixjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUM5QixJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMvQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBS00sNkJBQVUsR0FBakI7UUFBa0IsY0FBYzthQUFkLFVBQWMsRUFBZCxxQkFBYyxFQUFkLElBQWM7WUFBZCx5QkFBYzs7UUFDNUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQU9EOztPQUVHO0lBQ0kseUJBQU0sR0FBYjtRQUFjLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ3hCLElBQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdEUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO1lBQzFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3ZEO1FBQ0QsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsSUFBSSxTQUFTLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLEVBQUU7WUFDdkUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUMvQjtJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNJLHVCQUFJLEdBQVgsVUFBWSxJQUFPO1FBQ2Ysd0VBQXdFO1FBQ3hFLCtCQUErQjtRQUMvQixJQUFNLE1BQU0sR0FBbUIsRUFBRSxDQUFDO1FBQ2xDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtZQUMxQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNoQztRQUNELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO1lBQ3BDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEI7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxnQ0FBYSxHQUFwQjtRQUNJLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNmLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtZQUMxQyxNQUFNLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztTQUM3QztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2xCLENBQUM7SUFDTCxlQUFDO0FBQUQsQ0FuUUEsQUFtUUMsSUFBQTtBQW5RWSw0QkFBUTtBQXFRckI7O0dBRUc7QUFDSDtJQUFrQyxnQ0FBYztJQUFoRDs7SUFRQSxDQUFDO0lBTkc7O09BRUc7SUFDSSwyQkFBSSxHQUFYO1FBQ0ksaUJBQU0sSUFBSSxZQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzFCLENBQUM7SUFDTCxtQkFBQztBQUFELENBUkEsQUFRQyxDQVJpQyxRQUFRLEdBUXpDO0FBUlksb0NBQVk7QUFVekI7O0dBRUc7QUFDSDtJQUFtQyxpQ0FBZTtJQUFsRDs7SUFRQSxDQUFDO0lBTlUsNEJBQUksR0FBWCxVQUFZLElBQVc7UUFDbkIsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxFQUFFO1lBQzVCLE1BQU0sSUFBSSxLQUFLLENBQUMsNERBQTBELElBQUksQ0FBQyxPQUFTLENBQUMsQ0FBQztTQUM3RjtRQUNELGlCQUFNLElBQUksWUFBQyxJQUFJLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBQ0wsb0JBQUM7QUFBRCxDQVJBLEFBUUMsQ0FSa0MsUUFBUSxHQVExQztBQVJZLHNDQUFhOzs7QUNsVDFCLDZEQUE2RDtBQUM3RCxlQUFlO0FBRWYsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7QUFFYiwyQ0FBMkQ7QUFhM0Q7Ozs7O0dBS0c7QUFDSDtJQUFtQyw4QkFBWTtJQXdDM0M7Ozs7T0FJRztJQUNILG9CQUFZLElBQXFCO1FBQWpDLFlBQ0ksaUJBQU8sU0FRVjtRQTlDTyxhQUFPLEdBQVksS0FBSyxDQUFDO1FBdUM3QixLQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUNwQixJQUFNLE9BQU8sR0FBbUIsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUMzQyxJQUFJLE9BQU8sT0FBTyxDQUFDLFNBQVMsS0FBSyxTQUFTLEVBQUU7WUFDeEMsS0FBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDO1NBQ3ZDO2FBQU07WUFDSCxLQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztTQUMzQjs7SUFDTCxDQUFDO0lBMUNEOztPQUVHO0lBQ1csMkJBQWdCLEdBQTlCLFVBQStCLFFBQW9CO1FBQy9DLDJCQUEyQjtRQUMzQixJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVcsRUFBRTtZQUMvQiwrQ0FBK0M7WUFDL0MsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUMzQjthQUFNO1lBQ0gsVUFBVTtZQUNWLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUMxQjtJQUNMLENBQUM7SUFPRDs7OztPQUlHO0lBQ1csdUJBQVksR0FBMUIsVUFBMkIsU0FBeUM7UUFDaEUsVUFBVSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7SUFDdEMsQ0FBQztJQXNCTSx5QkFBSSxHQUFYO1FBQUEsaUJBaUNDO1FBakNXLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNsRCxPQUFPO1NBQ1Y7UUFDRCxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDakIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7WUFDeEIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDeEMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO2dCQUNkLE9BQU87YUFDVjtpQkFBTTtnQkFDSCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztnQkFDcEIsVUFBVSxDQUFDLFVBQVUsQ0FBQztvQkFDbEIsMEVBQTBFO29CQUMxRSxzQkFBc0I7b0JBQ3RCLEtBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO29CQUNyQixrRkFBa0Y7b0JBQ2xGLElBQU0sSUFBSSxHQUFHLEtBQUksQ0FBQyxXQUFXLENBQUM7b0JBQzlCLElBQU0sU0FBUyxHQUFHLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQztvQkFDeEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7d0JBQ3ZDLElBQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDOUIsS0FBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7cUJBQzlCO2dCQUNMLENBQUMsQ0FBQyxDQUFDO2FBQ047U0FDSjthQUFNLEVBQUUsZ0JBQWdCO1lBQ3JCLElBQU0sV0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDbEMsVUFBVSxDQUFDLFVBQVUsQ0FBQztnQkFDbEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7b0JBQ3ZDLElBQU0sUUFBUSxHQUFHLFdBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDOUIsS0FBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7aUJBQzlCO1lBQ0wsQ0FBQyxDQUFDLENBQUM7U0FDTjtJQUNMLENBQUM7SUFFRCxZQUFZO0lBQ0YsMEJBQUssR0FBZixVQUFnQixRQUFxQixFQUFFLElBQVc7UUFDOUMsZ0VBQWdFO1FBQ2hFLDBDQUEwQztRQUMxQyxJQUFJLFFBQVEsQ0FBQyxLQUFLLElBQUksUUFBUSxDQUFDLEtBQUssWUFBWSxVQUFVLEVBQUU7WUFDeEMsUUFBUSxDQUFDLEtBQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDckQ7YUFBTTtZQUNILGlCQUFNLEtBQUssWUFBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDL0I7SUFDTCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNPLGdDQUFXLEdBQXJCLFVBQXNCLElBQVc7UUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2xELE9BQU87U0FDVjtRQUNELGlGQUFpRjtRQUNqRixvQkFBb0I7UUFDcEIsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUNsQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtZQUN2QyxJQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDOUI7SUFDTCxDQUFDO0lBaEdEOztPQUVHO0lBQ1kscUJBQVUsR0FBbUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDO0lBOEY1RixpQkFBQztDQTNIRCxBQTJIQyxDQTNIa0Msc0JBQVMsR0EySDNDO0FBM0hZLGdDQUFVO0FBNkh2Qjs7R0FFRztBQUNIO0lBQW9DLGtDQUFnQjtJQUFwRDs7SUFRQSxDQUFDO0lBTkc7O09BRUc7SUFDSSw2QkFBSSxHQUFYO1FBQ0ksaUJBQU0sSUFBSSxZQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzFCLENBQUM7SUFDTCxxQkFBQztBQUFELENBUkEsQUFRQyxDQVJtQyxVQUFVLEdBUTdDO0FBUlksd0NBQWM7QUFVM0I7O0dBRUc7QUFDSDtJQUFxQyxtQ0FBaUI7SUFBdEQ7O0lBUUEsQ0FBQztJQU5VLDhCQUFJLEdBQVgsVUFBWSxJQUFXO1FBQ25CLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsRUFBRTtZQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLDREQUEwRCxJQUFJLENBQUMsT0FBUyxDQUFDLENBQUM7U0FDN0Y7UUFDRCxpQkFBTSxJQUFJLFlBQUMsSUFBSSxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUNMLHNCQUFDO0FBQUQsQ0FSQSxBQVFDLENBUm9DLFVBQVUsR0FROUM7QUFSWSwwQ0FBZTs7OztBQ3JLNUIsNkRBQTZEO0FBQzdELGVBQWU7QUFFZixZQUFZLENBQUM7O0FBa0NiOzs7R0FHRztBQUNIO0lBQUE7SUE0TUEsQ0FBQztJQWhMRzs7T0FFRztJQUNJLDBCQUFNLEdBQWIsVUFBYyxDQUE2QyxFQUFFLENBQXFCO1FBQzlFLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFxQkQ7O09BRUc7SUFDSSx3QkFBSSxHQUFYLFVBQVksQ0FBNkMsRUFBRSxDQUFxQjtRQUM1RSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0ssMkJBQU8sR0FBZixVQUFnQixDQUE2QyxFQUFFLENBQWtDLEVBQUUsSUFBYTtRQUFoSCxpQkFxQ0M7UUFwQ0csSUFBSSxPQUFlLENBQUM7UUFDcEIsSUFBSSxPQUEwQixDQUFDO1FBQy9CLElBQUksS0FBa0IsQ0FBQztRQUN2QixJQUFJLE1BQWtCLENBQUM7UUFDdkIsSUFBSSxPQUFPLENBQUMsS0FBSyxVQUFVLEVBQUU7WUFDekIsT0FBTyxHQUFHLENBQXdCLENBQUM7WUFDbkMsTUFBTSxHQUFHLGNBQU0sT0FBQSxLQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFwQixDQUFvQixDQUFDO1NBQ3ZDO2FBQU0sSUFBSSxDQUFDLENBQUMsSUFBSSxPQUFRLENBQWlCLENBQUMsSUFBSSxLQUFLLFVBQVUsRUFBRTtZQUM1RCxLQUFLLEdBQUcsQ0FBZ0IsQ0FBQztZQUN6QixNQUFNLEdBQUcsY0FBTSxPQUFBLEtBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQWxCLENBQWtCLENBQUM7U0FDckM7YUFBTTtZQUNILElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLCtDQUErQyxDQUFDLENBQUM7YUFDcEU7WUFDRCxJQUFJLE9BQU8sQ0FBQyxLQUFLLFVBQVUsRUFBRTtnQkFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO2FBQzNEO1lBQ0QsT0FBTyxHQUFHLENBQUMsQ0FBQztZQUNaLE9BQU8sR0FBRyxDQUFDLENBQUM7WUFDWixNQUFNLEdBQUcsY0FBTSxPQUFBLEtBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUE3QixDQUE2QixDQUFDO1NBQ2hEO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDbEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7U0FDeEI7YUFBTTtZQUNILGdGQUFnRjtZQUNoRiwrQ0FBK0M7WUFDL0MsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO1NBQzdDO1FBQ0QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUM7WUFDakIsT0FBTyxFQUFFLEtBQUs7WUFDZCxPQUFPLFNBQUE7WUFDUCxPQUFPLFNBQUE7WUFDUCxLQUFLLE9BQUE7WUFDTCxJQUFJLE1BQUE7U0FDUCxDQUFDLENBQUM7UUFDSCxPQUFPLE1BQU0sQ0FBQztJQUNsQixDQUFDO0lBc0JEOztPQUVHO0lBQ0ksMEJBQU0sR0FBYjtRQUFjLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNsRCxPQUFPO1NBQ1Y7UUFDRCxJQUFJLE9BQWUsQ0FBQztRQUNwQixJQUFJLE9BQTBCLENBQUM7UUFDL0IsSUFBSSxLQUFrQixDQUFDO1FBQ3ZCLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7WUFDbEIsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssVUFBVSxFQUFFO2dCQUNqQyxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ3JCO2lCQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsRUFBRTtnQkFDaEUsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNuQjtpQkFBTTtnQkFDSCxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ3JCO1NBQ0o7UUFDRCxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO1lBQ2xCLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDckI7UUFFRCw2RkFBNkY7UUFDN0YsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxVQUFDLFFBQXFCO1lBQzNELElBQUksQ0FBQyxPQUFPLE9BQU8sS0FBSyxXQUFXLElBQUksUUFBUSxDQUFDLE9BQU8sS0FBSyxPQUFPLENBQUM7bUJBQzdELENBQUMsT0FBTyxLQUFLLEtBQUssV0FBVyxJQUFJLFFBQVEsQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDO21CQUMxRCxDQUFDLE9BQU8sT0FBTyxLQUFLLFdBQVcsSUFBSSxRQUFRLENBQUMsT0FBTyxLQUFLLE9BQU8sQ0FBQyxFQUFFO2dCQUNyRSxRQUFRLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztnQkFDeEIsT0FBTyxLQUFLLENBQUM7YUFDaEI7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzlCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQztTQUMxQjtJQUNMLENBQUM7SUFFRDs7O09BR0c7SUFDSSx3QkFBSSxHQUFYLFVBQVksSUFBTztRQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVEOztPQUVHO0lBQ0ksaUNBQWEsR0FBcEI7UUFDSSxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7OztPQUlHO0lBQ08seUJBQUssR0FBZixVQUFnQixRQUFxQixFQUFFLElBQVc7UUFDOUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUU7WUFDbkIsSUFBSSxRQUFRLENBQUMsSUFBSSxFQUFFO2dCQUNmLHdGQUF3RjtnQkFDeEYsUUFBUSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7Z0JBQ3hCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsVUFBQyxDQUFjLElBQWMsT0FBQSxDQUFDLEtBQUssUUFBUSxFQUFkLENBQWMsQ0FBQyxDQUFDO2dCQUN0RixJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtvQkFDOUIsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO2lCQUMxQjthQUNKO1lBQ0QsSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFFO2dCQUNoQixRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQzthQUNuRDtpQkFBTTtnQkFDSCxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sUUFBUSxDQUFDLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2FBQ2xHO1NBQ0o7SUFDTCxDQUFDO0lBRUwsZ0JBQUM7QUFBRCxDQTVNQSxBQTRNQyxJQUFBO0FBNU1ZLDhCQUFTOztBQ3pDdEIsNkRBQTZEO0FBQzdELGVBQWU7QUFFZixZQUFZLENBQUM7O0FBRWIsU0FBZ0IsYUFBYSxDQUFDLENBQU0sRUFBRSxDQUFNO0lBQ3hDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNULE9BQU8sSUFBSSxDQUFDO0tBQ2Y7SUFDRCxJQUFJLE9BQU8sQ0FBQyxLQUFLLE9BQU8sQ0FBQyxFQUFFO1FBQ3ZCLE9BQU8sS0FBSyxDQUFDO0tBQ2hCO0lBQ0QsUUFBUSxPQUFPLENBQUMsRUFBRTtRQUNkLEtBQUssU0FBUyxDQUFDO1FBQ2YsS0FBSyxRQUFRLENBQUM7UUFDZCxLQUFLLFFBQVEsQ0FBQztRQUNkLEtBQUssVUFBVSxDQUFDO1FBQ2hCLEtBQUssUUFBUSxDQUFDO1FBQ2QsS0FBSyxXQUFXO1lBQ1osMEJBQTBCO1lBQzFCLE9BQU8sS0FBSyxDQUFDO1FBQ2pCLEtBQUssUUFBUTtZQUNULElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxFQUFFO2dCQUMxQixPQUFPLEtBQUssQ0FBQyxDQUFDLHVCQUF1QjthQUN4QztZQUNELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUN0QyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7b0JBQ3hDLE9BQU8sS0FBSyxDQUFDO2lCQUNoQjtnQkFDRCxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE1BQU0sRUFBRTtvQkFDdkIsT0FBTyxLQUFLLENBQUM7aUJBQ2hCO2dCQUNELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO29CQUMvQixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7d0JBQ2YsT0FBTyxLQUFLLENBQUM7cUJBQ2hCO2lCQUNKO2dCQUNELE9BQU8sSUFBSSxDQUFDO2FBQ2Y7WUFDRCxJQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7WUFDNUIsSUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO1lBQzVCLEtBQUssSUFBTSxNQUFJLElBQUksQ0FBQyxFQUFFO2dCQUNsQixJQUFJLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBSSxDQUFDLEVBQUU7b0JBQ3hCLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBSSxDQUFDLENBQUM7aUJBQ3JCO2FBQ0o7WUFDRCxLQUFLLElBQU0sTUFBSSxJQUFJLENBQUMsRUFBRTtnQkFDbEIsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLE1BQUksQ0FBQyxFQUFFO29CQUN4QixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQUksQ0FBQyxDQUFDO2lCQUNyQjthQUNKO1lBQ0QsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2QsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2QsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3ZDLE9BQU8sS0FBSyxDQUFDO2FBQ2hCO1lBQ0QsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7Z0JBQ3BDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtvQkFDL0IsT0FBTyxLQUFLLENBQUM7aUJBQ2hCO2FBQ0o7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNoQjtZQUNJLE9BQU8sS0FBSyxDQUFDO0tBQ3BCO0FBQ0wsQ0FBQztBQTVERCxzQ0E0REM7O0FDakVELDZEQUE2RDtBQUM3RCxlQUFlO0FBRWYsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7QUFFYiwyQ0FBMkQ7QUFDM0QsMkNBQW1EO0FBZ0JuRDs7Ozs7O0dBTUc7QUFDSDtJQUFvQywrQkFBWTtJQWE1Qzs7Ozs7T0FLRztJQUNILHFCQUFZLElBQXNCO1FBQWxDLFlBQ0ksaUJBQU8sU0FXVjtRQXRCTyxhQUFPLEdBQVksS0FBSyxDQUFDO1FBWTdCLEtBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBQ3BCLElBQU0sT0FBTyxHQUFvQixJQUFJLElBQUksRUFBRSxDQUFDO1FBQzVDLElBQUksT0FBTyxPQUFPLENBQUMsU0FBUyxLQUFLLFNBQVMsRUFBRTtZQUN4QyxLQUFJLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7U0FDdkM7YUFBTTtZQUNILEtBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1NBQzNCO1FBQ0QsSUFBSSxPQUFPLE9BQU8sQ0FBQyxLQUFLLEtBQUssUUFBUSxJQUFJLE9BQU8sQ0FBQyxLQUFLLEtBQUssSUFBSSxFQUFFO1lBQzdELEtBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQztTQUMvQjs7SUFDTCxDQUFDO0lBU00sMEJBQUksR0FBWDtRQUFBLGlCQWtDQztRQWxDVyxjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEQsT0FBTztTQUNWO1FBQ0QsSUFBTSxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxvQkFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDaEUsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ2pCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1lBQ3hDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDZCxPQUFPO2FBQ1Y7aUJBQU07Z0JBQ0gsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7Z0JBQ3BCLEtBQUssQ0FBQyxHQUFHLENBQUM7b0JBQ04sMEVBQTBFO29CQUMxRSxzQkFBc0I7b0JBQ3RCLEtBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO29CQUNyQixrRkFBa0Y7b0JBQ2xGLElBQU0sSUFBSSxHQUFHLEtBQUksQ0FBQyxXQUFXLENBQUM7b0JBQzlCLElBQU0sU0FBUyxHQUFHLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQztvQkFDeEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7d0JBQ3ZDLElBQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDOUIsS0FBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7cUJBQzlCO2dCQUNMLENBQUMsQ0FBQyxDQUFDO2FBQ047U0FDSjthQUFNLEVBQUUsZ0JBQWdCO1lBQ3JCLElBQU0sV0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDbEMsS0FBSyxDQUFDLEdBQUcsQ0FBQztnQkFDTixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBUyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtvQkFDdkMsSUFBTSxRQUFRLEdBQUcsV0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUM5QixLQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztpQkFDOUI7WUFDTCxDQUFDLENBQUMsQ0FBQztTQUNOO0lBQ0wsQ0FBQztJQUNMLGtCQUFDO0FBQUQsQ0EzRUEsQUEyRUMsQ0EzRW1DLHNCQUFTLEdBMkU1QztBQTNFWSxrQ0FBVztBQTZFeEI7O0dBRUc7QUFDSDtJQUFxQyxtQ0FBaUI7SUFBdEQ7O0lBUUEsQ0FBQztJQU5HOztPQUVHO0lBQ0ksOEJBQUksR0FBWDtRQUNJLGlCQUFNLElBQUksWUFBQyxTQUFTLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBQ0wsc0JBQUM7QUFBRCxDQVJBLEFBUUMsQ0FSb0MsV0FBVyxHQVEvQztBQVJZLDBDQUFlO0FBVzVCOztHQUVHO0FBQ0g7SUFBc0Msb0NBQWtCO0lBQXhEOztJQVFBLENBQUM7SUFOVSwrQkFBSSxHQUFYLFVBQVksSUFBVztRQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEQsTUFBTSxJQUFJLEtBQUssQ0FBQyw0REFBMEQsSUFBSSxDQUFDLE9BQVMsQ0FBQyxDQUFDO1NBQzdGO1FBQ0QsaUJBQU0sSUFBSSxZQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JCLENBQUM7SUFDTCx1QkFBQztBQUFELENBUkEsQUFRQyxDQVJxQyxXQUFXLEdBUWhEO0FBUlksNENBQWdCOztBQzNIN0IsNkRBQTZEO0FBQzdELGVBQWU7QUFFZixZQUFZLENBQUM7Ozs7Ozs7Ozs7Ozs7OztBQUViLDJDQUFpRDtBQUVqRDs7Ozs7OztHQU9HO0FBQ0g7SUFBa0MsNkJBQVk7SUFBOUM7UUFBQSxxRUFxQ0M7UUE3Qkc7O1dBRUc7UUFDSyxnQkFBVSxHQUFXLENBQUMsQ0FBQzs7SUEwQm5DLENBQUM7SUFsQlUsd0JBQUksR0FBWDtRQUFZLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNsRCxPQUFPO1NBQ1Y7UUFDRCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbEIsSUFBSSxTQUFTLENBQUMsbUJBQW1CLEdBQUcsQ0FBQztZQUNqQyxJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRTtZQUNqRCxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7U0FDOUM7UUFDRCxpRkFBaUY7UUFDakYsb0JBQW9CO1FBQ3BCLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDbEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7WUFDdkMsSUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzlCLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzlCO1FBQ0QsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3RCLENBQUM7SUFsQ0Q7OztPQUdHO0lBQ1csNkJBQW1CLEdBQVcsRUFBRSxDQUFDO0lBK0JuRCxnQkFBQztDQXJDRCxBQXFDQyxDQXJDaUMsc0JBQVMsR0FxQzFDO0FBckNZLDhCQUFTO0FBdUN0Qjs7R0FFRztBQUNIO0lBQW1DLGlDQUFlO0lBQWxEOztJQVFBLENBQUM7SUFORzs7T0FFRztJQUNJLDRCQUFJLEdBQVg7UUFDSSxpQkFBTSxJQUFJLFlBQUMsU0FBUyxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUNMLG9CQUFDO0FBQUQsQ0FSQSxBQVFDLENBUmtDLFNBQVMsR0FRM0M7QUFSWSxzQ0FBYTtBQVUxQjs7R0FFRztBQUNIO0lBQW9DLGtDQUFnQjtJQUFwRDs7SUFRQSxDQUFDO0lBTlUsNkJBQUksR0FBWCxVQUFZLElBQVc7UUFDbkIsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxFQUFFO1lBQzVCLE1BQU0sSUFBSSxLQUFLLENBQUMsNERBQTBELElBQUksQ0FBQyxPQUFTLENBQUMsQ0FBQztTQUM3RjtRQUNELGlCQUFNLElBQUksWUFBQyxJQUFJLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBQ0wscUJBQUM7QUFBRCxDQVJBLEFBUUMsQ0FSbUMsU0FBUyxHQVE1QztBQVJZLHdDQUFjOztBQ3RFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDM0VBLDZEQUE2RDtBQUM3RCxlQUFlO0FBRWYsWUFBWSxDQUFDOzs7OztBQUViLGtDQUE2QjtBQUM3QixrQ0FBNkI7QUFDN0Isb0NBQStCO0FBQy9CLG1DQUE4QjtBQUM5QixpQ0FBNEI7QUFFNUIsMkNBQW1EO0FBQ25ELDJDQUFtRDtBQUEzQyxrQ0FBQSxPQUFPLENBQWM7QUFFN0I7O0dBRUc7QUFDSCxTQUFnQixLQUFLO0lBQ2pCLE9BQU8sb0JBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUMvQixDQUFDO0FBRkQsc0JBRUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBZ0IsU0FBUztJQUNyQixvQkFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ3BDLENBQUM7QUFGRCw4QkFFQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQWdCLEtBQUssQ0FBQyxTQUFzQjtJQUF0QiwwQkFBQSxFQUFBLGNBQXNCO0lBQ3hDLG9CQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3pDLENBQUM7QUFGRCxzQkFFQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtTeW5jRXZlbnR9IGZyb20gJy4vc3luYy1ldmVudCc7XHJcblxyXG4vKipcclxuICogU2ltcGxlIHN5bmNocm9ub3VzIGV2ZW50IHF1ZXVlIHRoYXQgbmVlZHMgdG8gYmUgZHJhaW5lZCBtYW51YWxseS5cclxuICovXHJcbmNsYXNzIEV2ZW50UXVldWUge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU3luY0V2ZW50IHRyaWdnZXJlZCBhZnRlciBhbiBldmVudCBpcyBhZGRlZCBvdXRzaWRlIG9mIGEgZmx1c2ggb3BlcmF0aW9uLlxyXG4gICAgICogQHBhcmFtIHF1ZXVlIFRoZSBldmVudCBxdWV1ZSBpdHNlbGZcclxuICAgICAqL1xyXG4gICAgcHVibGljIGV2dEZpbGxlZDogU3luY0V2ZW50PEV2ZW50UXVldWU+ID0gbmV3IFN5bmNFdmVudDxFdmVudFF1ZXVlPigpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBTeW5jRXZlbnQgdHJpZ2dlcmVkIGFmdGVyIHRoZSBxdWV1ZSBpcyBmbHVzaGVkIGVtcHR5XHJcbiAgICAgKiBAcGFyYW0gcXVldWUgVGhlIGV2ZW50IHF1ZXVlIGl0c2VsZlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZXZ0RHJhaW5lZDogU3luY0V2ZW50PEV2ZW50UXVldWU+ID0gbmV3IFN5bmNFdmVudDxFdmVudFF1ZXVlPigpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIG1vZHVsZS1nbG9iYWwgZXZlbnQgcXVldWVcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgX2luc3RhbmNlOiBFdmVudFF1ZXVlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIG1vZHVsZS1nbG9iYWwgZXZlbnQgcXVldWVcclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBnbG9iYWwoKTogRXZlbnRRdWV1ZSB7XHJcbiAgICAgICAgaWYgKCFFdmVudFF1ZXVlLl9pbnN0YW5jZSkge1xyXG4gICAgICAgICAgICBFdmVudFF1ZXVlLnJlc2V0R2xvYmFsKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBFdmVudFF1ZXVlLl9pbnN0YW5jZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRlc3RpbmcgcHVycG9zZXNcclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyByZXNldEdsb2JhbCgpOiB2b2lkIHtcclxuICAgICAgICBFdmVudFF1ZXVlLl9pbnN0YW5jZSA9IG5ldyBFdmVudFF1ZXVlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBRdWV1ZWQgZWxlbWVudHNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfcXVldWU6ICgoKSA9PiB2b2lkKVtdID0gW107XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUcnVlIHdoaWxlIGZsdXNoKCkgb3IgZmx1c2hPbmNlKCkgaXMgcnVubmluZ1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9mbHVzaGluZzogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0cnVlIGlmZiB0aGUgcXVldWUgaXMgZW1wdHlcclxuICAgICAqL1xyXG4gICAgcHVibGljIGVtcHR5KCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDA7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGQgYW4gZWxlbWVudCB0byB0aGUgcXVldWUuIFRoZSBoYW5kbGVyIGlzIGNhbGxlZCB3aGVuIG9uZSBvZiB0aGUgZmx1c2hcclxuICAgICAqIG1ldGhvZHMgaXMgY2FsbGVkLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYWRkKGhhbmRsZXI6ICgpID0+IHZvaWQpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLl9xdWV1ZS5wdXNoKGhhbmRsZXIpO1xyXG4gICAgICAgIGlmICh0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDEgJiYgIXRoaXMuX2ZsdXNoaW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0RmlsbGVkLnBvc3QodGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsbHMgYWxsIGhhbmRsZXJzIGN1cnJlbnRseSBpbiB0aGUgcXVldWUuIERvZXMgbm90IGNhbGwgYW55IGhhbmRsZXJzIGFkZGVkXHJcbiAgICAgKiBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2hcclxuICAgICAqL1xyXG4gICAgcHVibGljIGZsdXNoT25jZSgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBlbXB0eSA9ICh0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDApO1xyXG4gICAgICAgIGNvbnN0IGZsdXNoaW5nID0gdGhpcy5fZmx1c2hpbmc7XHJcbiAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSB0cnVlO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHF1ZXVlID0gdGhpcy5fcXVldWU7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlID0gW107XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgIHF1ZXVlW2ldKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICB0aGlzLl9mbHVzaGluZyA9IGZsdXNoaW5nO1xyXG4gICAgICAgICAgICBpZiAoIWVtcHR5ICYmICFmbHVzaGluZyAmJiB0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXZ0RHJhaW5lZC5wb3N0KHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmx1c2hlcyB0aGUgUXVldWVkRXZlbnRzLCBjYWxsaW5nIGFsbCBldmVudHMgY3VycmVudGx5IGluIHRoZSBxdWV1ZSBhbmQgdGhvc2VcclxuICAgICAqIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXHJcbiAgICAgKiBAcGFyYW0gbWF4Um91bmRzIE9wdGlvbmFsLCBkZWZhdWx0IDEwLiBOdW1iZXIgb2YgaXRlcmF0aW9ucyBhZnRlciB3aGljaCB0byB0aHJvdyBhbiBlcnJvciBiZWNhdXNlXHJcbiAgICAgKiAgICAgICAgICAgICAgICAgIHRoZSBxdWV1ZSBrZWVwcyBmaWxsaW5nIHVwLiBTZXQgdG8gbnVsbCB0byBkaXNhYmxlIHRoaXMuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBmbHVzaChtYXhSb3VuZHM6IG51bWJlciA9IDEwKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgZW1wdHkgPSAodGhpcy5fcXVldWUubGVuZ3RoID09PSAwKTtcclxuICAgICAgICBjb25zdCBmbHVzaGluZyA9IHRoaXMuX2ZsdXNoaW5nO1xyXG4gICAgICAgIHRoaXMuX2ZsdXNoaW5nID0gdHJ1ZTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBsZXQgaSA9IDA7XHJcbiAgICAgICAgICAgIHdoaWxlICh0aGlzLl9xdWV1ZS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1heFJvdW5kcyA9PT0gJ251bWJlcicgJiYgaSA+PSBtYXhSb3VuZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigndW5hYmxlIHRvIGZsdXNoIHRoZSBxdWV1ZSBkdWUgdG8gcmVjdXJzaXZlbHkgYWRkZWQgZXZlbnQuIENsZWFyaW5nIHF1ZXVlIG5vdycpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5mbHVzaE9uY2UoKTtcclxuICAgICAgICAgICAgICAgICsraTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2ZsdXNoaW5nID0gZmx1c2hpbmc7XHJcbiAgICAgICAgICAgIGlmICghZW1wdHkgJiYgIWZsdXNoaW5nICYmIHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ldnREcmFpbmVkLnBvc3QodGhpcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IEV2ZW50UXVldWU7XHJcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtzaGFsbG93RXF1YWxzfSBmcm9tICcuL29iamVjdHMnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlLCBMaXN0ZW5lcn0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuaW1wb3J0IHtTeW5jRXZlbnR9IGZyb20gJy4vc3luYy1ldmVudCc7XHJcbmltcG9ydCB7QXN5bmNFdmVudCwgQXN5bmNFdmVudE9wdHN9IGZyb20gJy4vYXN5bmMtZXZlbnQnO1xyXG5pbXBvcnQge1F1ZXVlZEV2ZW50LCBRdWV1ZWRFdmVudE9wdHN9IGZyb20gJy4vcXVldWVkLWV2ZW50JztcclxuXHJcbmV4cG9ydCBlbnVtIEV2ZW50VHlwZSB7XHJcbiAgICBTeW5jLFxyXG4gICAgQXN5bmMsXHJcbiAgICBRdWV1ZWRcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBbnlFdmVudE9wdHMge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgZXZ0Rmlyc3RBdHRhY2hlZCBhbmQgZXZ0TGFzdERldGFjaGVkIHNvIHlvdSBjYW4gbW9uaXRvciB3aGVuIHNvbWVvbmUgaXMgc3Vic2NyaWJlZFxyXG4gICAgICovXHJcbiAgICBtb25pdG9yQXR0YWNoPzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFuIGV2ZW50IHRoYXQgYmVoYXZlcyBsaWtlIGEgU3luYy9Bc3luYy9RdWV1ZWQgZXZlbnQgZGVwZW5kaW5nIG9uIGhvd1xyXG4gKiB5b3Ugc3Vic2NyaWJlLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEFueUV2ZW50PFQ+IGltcGxlbWVudHMgUG9zdGFibGU8VD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVHJpZ2dlcmVkIHdoZW5ldmVyIHNvbWVvbmUgYXR0YWNoZXMgYW5kIG5vYm9keSB3YXMgYXR0YWNoZWQuXHJcbiAgICAgKiBOb3RlOiB5b3UgbXVzdCBjYWxsIHRoZSBjb25zdHJ1Y3RvciB3aXRoIG1vbml0b3JBdHRhY2ggc2V0IHRvIHRydWUgdG8gY3JlYXRlIHRoaXMgZXZlbnQhXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBldnRGaXJzdEF0dGFjaGVkOiBWb2lkQW55RXZlbnQ7XHJcbiAgICAvKipcclxuICAgICAqIFRyaWdnZXJlZCB3aGVuZXZlciBzb21lb25lIGRldGFjaGVzIGFuZCBub2JvZHkgaXMgYXR0YWNoZWQgYW55bW9yZVxyXG4gICAgICogTm90ZTogeW91IG11c3QgY2FsbCB0aGUgY29uc3RydWN0b3Igd2l0aCBtb25pdG9yQXR0YWNoIHNldCB0byB0cnVlIHRvIGNyZWF0ZSB0aGlzIGV2ZW50IVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZXZ0TGFzdERldGFjaGVkOiBWb2lkQW55RXZlbnQ7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVbmRlcmx5aW5nIGV2ZW50IGltcGxlbWVudGF0aW9uczsgb25lIGZvciBldmVyeSBhdHRhY2ggdHlwZSArIG9wdHMgY29tYmluYXRpb25cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfZXZlbnRzOiBCYXNlRXZlbnQ8VD5bXSA9IFtdO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKG9wdHM/OiBBbnlFdmVudE9wdHMpIHtcclxuICAgICAgICBpZiAob3B0cyAmJiBvcHRzLm1vbml0b3JBdHRhY2gpIHtcclxuICAgICAgICAgICAgdGhpcy5ldnRGaXJzdEF0dGFjaGVkID0gbmV3IFZvaWRBbnlFdmVudCgpO1xyXG4gICAgICAgICAgICB0aGlzLmV2dExhc3REZXRhY2hlZCA9IG5ldyBWb2lkQW55RXZlbnQoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBMZWdhY3kgbWV0aG9kXHJcbiAgICAgKiBzYW1lIGFzIGF0dGFjaFN5bmMvYXR0YWNoQXN5bmMvYXR0YWNoUXVldWVkOyBiYXNlZCBvbiB0aGUgZ2l2ZW4gZW51bVxyXG4gICAgICogQHBhcmFtIG1vZGUgZGV0ZXJtaW5lcyB3aGV0aGVyIHRvIGF0dGFjaCBzeW5jL2FzeW5jL3F1ZXVlZFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaChib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaChldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoKG1vZGU6IEV2ZW50VHlwZSwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoKG1vZGU6IEV2ZW50VHlwZSwgYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2gobW9kZTogRXZlbnRUeXBlLCBldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoKC4uLmFyZ3M6IGFueVtdKTogKCkgPT4gdm9pZCB7XHJcbiAgICAgICAgbGV0IG1vZGUgPSBFdmVudFR5cGUuU3luYztcclxuICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAwICYmIHR5cGVvZiBhcmdzWzBdID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICBtb2RlID0gYXJncy5zaGlmdCgpIGFzIEV2ZW50VHlwZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbGV0IGJvdW5kVG86IE9iamVjdCA9IHRoaXM7IC8vIGFkZCBvdXJzZWx2ZXMgYXMgZGVmYXVsdCAnYm91bmRUbycgYXJndW1lbnRcclxuICAgICAgICBsZXQgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQ7XHJcbiAgICAgICAgbGV0IG9wdHM6IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzO1xyXG4gICAgICAgIGxldCBwb3N0YWJsZTogUG9zdGFibGU8VD47XHJcbiAgICAgICAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSAnZnVuY3Rpb24nIHx8IChhcmdzWzBdICYmIHR5cGVvZiBhcmdzWzBdID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgYXJnc1swXS5wb3N0ID09PSAnZnVuY3Rpb24nKSkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcG9zdGFibGUgPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG9wdHMgPSBhcmdzWzFdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGJvdW5kVG8gPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICBoYW5kbGVyID0gYXJnc1sxXTtcclxuICAgICAgICAgICAgb3B0cyA9IGFyZ3NbMl07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzLl9hdHRhY2gobW9kZSwgYm91bmRUbywgaGFuZGxlciwgcG9zdGFibGUsIG9wdHMsIGZhbHNlKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIExlZ2FjeSBtZXRob2RcclxuICAgICAqIHNhbWUgYXMgb25jZVN5bmMvb25jZUFzeW5jL29uY2VRdWV1ZWQ7IGJhc2VkIG9uIHRoZSBnaXZlbiBlbnVtXHJcbiAgICAgKiBAcGFyYW0gbW9kZSBkZXRlcm1pbmVzIHdoZXRoZXIgdG8gb25jZSBzeW5jL2FzeW5jL3F1ZXVlZFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb25jZShoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBvbmNlKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZShldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZShtb2RlOiBFdmVudFR5cGUsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2UobW9kZTogRXZlbnRUeXBlLCBib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2UobW9kZTogRXZlbnRUeXBlLCBldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZSguLi5hcmdzOiBhbnlbXSk6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIGxldCBtb2RlID0gRXZlbnRUeXBlLlN5bmM7XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgbW9kZSA9IGFyZ3Muc2hpZnQoKSBhcyBFdmVudFR5cGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBib3VuZFRvOiBPYmplY3QgPSB0aGlzOyAvLyBhZGQgb3Vyc2VsdmVzIGFzIGRlZmF1bHQgJ2JvdW5kVG8nIGFyZ3VtZW50XHJcbiAgICAgICAgbGV0IGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkO1xyXG4gICAgICAgIGxldCBvcHRzOiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cztcclxuICAgICAgICBsZXQgcG9zdGFibGU6IFBvc3RhYmxlPFQ+O1xyXG4gICAgICAgIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gJ2Z1bmN0aW9uJyB8fCAoYXJnc1swXSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGFyZ3NbMF0ucG9zdCA9PT0gJ2Z1bmN0aW9uJykpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHBvc3RhYmxlID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcHRzID0gYXJnc1sxXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBib3VuZFRvID0gYXJnc1swXTtcclxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMV07XHJcbiAgICAgICAgICAgIG9wdHMgPSBhcmdzWzJdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcy5fYXR0YWNoKG1vZGUsIGJvdW5kVG8sIGhhbmRsZXIsIHBvc3RhYmxlLCBvcHRzLCB0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9hdHRhY2goXHJcbiAgICAgICAgbW9kZTogRXZlbnRUeXBlLFxyXG4gICAgICAgIGJvdW5kVG86IE9iamVjdCB8IHVuZGVmaW5lZCxcclxuICAgICAgICBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCB8IHVuZGVmaW5lZCxcclxuICAgICAgICBwb3N0YWJsZTogUG9zdGFibGU8VD4gfCB1bmRlZmluZWQsXHJcbiAgICAgICAgb3B0czogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMgfCB1bmRlZmluZWQsXHJcbiAgICAgICAgb25jZTogYm9vbGVhblxyXG4gICAgKTogKCkgPT4gdm9pZCB7XHJcbiAgICAgICAgY29uc3QgcHJldkNvdW50ID0gKCEhdGhpcy5ldnRGaXJzdEF0dGFjaGVkID8gdGhpcy5saXN0ZW5lckNvdW50KCkgOiAwKTtcclxuICAgICAgICBsZXQgZXZlbnQ6IEJhc2VFdmVudDxUPjtcclxuICAgICAgICBzd2l0Y2ggKG1vZGUpIHtcclxuICAgICAgICAgICAgY2FzZSBFdmVudFR5cGUuU3luYzoge1xyXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBldnQgb2YgdGhpcy5fZXZlbnRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV2dCBpbnN0YW5jZW9mIFN5bmNFdmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9IGV2dDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoIWV2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBuZXcgU3luY0V2ZW50PFQ+KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzLnB1c2goZXZlbnQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIEV2ZW50VHlwZS5Bc3luYzoge1xyXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBldnQgb2YgdGhpcy5fZXZlbnRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV2dCBpbnN0YW5jZW9mIEFzeW5jRXZlbnQgJiYgc2hhbGxvd0VxdWFscygoPEFzeW5jRXZlbnQ8VD4+ZXZ0KS5vcHRpb25zLCBvcHRzKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9IGV2dDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoIWV2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBuZXcgQXN5bmNFdmVudDxUPihvcHRzKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHMucHVzaChldmVudCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLlF1ZXVlZDoge1xyXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBldnQgb2YgdGhpcy5fZXZlbnRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV2dCBpbnN0YW5jZW9mIFF1ZXVlZEV2ZW50ICYmIHNoYWxsb3dFcXVhbHMoKDxRdWV1ZWRFdmVudDxUPj5ldnQpLm9wdGlvbnMsIG9wdHMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gZXZ0O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICghZXZlbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBldmVudCA9IG5ldyBRdWV1ZWRFdmVudDxUPihvcHRzKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHMucHVzaChldmVudCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gYnJlYWs7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vua25vd24gRXZlbnRUeXBlJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBkZXRhY2hlcjogKCkgPT4gdm9pZDtcclxuICAgICAgICBpZiAob25jZSkge1xyXG4gICAgICAgICAgICBpZiAocG9zdGFibGUpIHtcclxuICAgICAgICAgICAgICAgIGRldGFjaGVyID0gZXZlbnQub25jZShwb3N0YWJsZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBkZXRhY2hlciA9IGV2ZW50Lm9uY2UoYm91bmRUbywgaGFuZGxlcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAocG9zdGFibGUpIHtcclxuICAgICAgICAgICAgICAgIGRldGFjaGVyID0gZXZlbnQuYXR0YWNoKHBvc3RhYmxlKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGRldGFjaGVyID0gZXZlbnQuYXR0YWNoKGJvdW5kVG8sIGhhbmRsZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmV2dEZpcnN0QXR0YWNoZWQgJiYgcHJldkNvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0Rmlyc3RBdHRhY2hlZC5wb3N0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAoKTogdm9pZCA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHByZXZDb3VudCA9ICghIXRoaXMuZXZ0TGFzdERldGFjaGVkID8gdGhpcy5saXN0ZW5lckNvdW50KCkgOiAwKTtcclxuICAgICAgICAgICAgZGV0YWNoZXIoKTtcclxuICAgICAgICAgICAgaWYgKCEhdGhpcy5ldnRMYXN0RGV0YWNoZWQgJiYgcHJldkNvdW50ID4gMCAmJiB0aGlzLmxpc3RlbmVyQ291bnQoKSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ldnRMYXN0RGV0YWNoZWQucG9zdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgYXR0YWNoU3luYyhoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoU3luYyhib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2hTeW5jKGV2ZW50OiBQb3N0YWJsZTxUPik6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoU3luYyguLi5hcmdzOiBhbnlbXSk6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuU3luYyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBvbmNlU3luYyhoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZVN5bmMoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZVN5bmMoZXZlbnQ6IFBvc3RhYmxlPFQ+KTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBvbmNlU3luYyguLi5hcmdzOiBhbnlbXSk6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuU3luYyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMub25jZS5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgYXR0YWNoQXN5bmMoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoQXN5bmMoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2hBc3luYyhldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoQXN5bmMoLi4uYXJnczogYW55W10pOiAoKSA9PiB2b2lkIHtcclxuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLkFzeW5jKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5hdHRhY2guYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIG9uY2VBc3luYyhoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBvbmNlQXN5bmMoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBvbmNlQXN5bmMoZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogQXN5bmNFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2VBc3luYyguLi5hcmdzOiBhbnlbXSk6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuQXN5bmMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLm9uY2UuYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGF0dGFjaFF1ZXVlZChoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoUXVldWVkKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaFF1ZXVlZChldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaFF1ZXVlZCguLi5hcmdzOiBhbnlbXSk6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuUXVldWVkKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5hdHRhY2guYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIG9uY2VRdWV1ZWQoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2VRdWV1ZWQoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZVF1ZXVlZChldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2VRdWV1ZWQoLi4uYXJnczogYW55W10pOiAoKSA9PiB2b2lkIHtcclxuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLlF1ZXVlZCk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMub25jZS5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgZGV0YWNoKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogdm9pZDtcclxuICAgIHB1YmxpYyBkZXRhY2goYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgZGV0YWNoKGJvdW5kVG86IE9iamVjdCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgZGV0YWNoKGV2ZW50OiBQb3N0YWJsZTxUPik6IHZvaWQ7XHJcbiAgICBwdWJsaWMgZGV0YWNoKCk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBldmVudCBoYW5kbGVycyByZWdhcmRsZXNzIG9mIHR5cGVcclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHByZXZDb3VudCA9ICghIXRoaXMuZXZ0TGFzdERldGFjaGVkID8gdGhpcy5saXN0ZW5lckNvdW50KCkgOiAwKTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB0aGlzLl9ldmVudHNbaV0uZGV0YWNoLmFwcGx5KHRoaXMuX2V2ZW50c1tpXSwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghIXRoaXMuZXZ0TGFzdERldGFjaGVkICYmIHByZXZDb3VudCA+IDAgJiYgdGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy5ldnRMYXN0RGV0YWNoZWQucG9zdCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFBvc3QgYW4gZXZlbnQgdG8gYWxsIGN1cnJlbnQgbGlzdGVuZXJzXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IFQpOiB2b2lkIHtcclxuICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYXJyYXkgZmlyc3QgdG8gY292ZXIgdGhlIGNhc2Ugd2hlcmUgZXZlbnQgaGFuZGxlcnNcclxuICAgICAgICAvLyBhcmUgYXR0YWNoZWQgZHVyaW5nIHRoZSBwb3N0XHJcbiAgICAgICAgY29uc3QgZXZlbnRzOiBCYXNlRXZlbnQ8VD5bXSA9IFtdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGV2ZW50cy5wdXNoKHRoaXMuX2V2ZW50c1tpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGV2ZW50c1tpXS5wb3N0KGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBudW1iZXIgb2YgYXR0YWNoZWQgbGlzdGVuZXJzXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBsaXN0ZW5lckNvdW50KCk6IG51bWJlciB7XHJcbiAgICAgICAgbGV0IHJlc3VsdCA9IDA7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgcmVzdWx0ICs9IHRoaXMuX2V2ZW50c1tpXS5saXN0ZW5lckNvdW50KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgQW55RXZlbnRzIHdpdGhvdXQgZGF0YVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZvaWRBbnlFdmVudCBleHRlbmRzIEFueUV2ZW50PHZvaWQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KCk6IHZvaWQge1xyXG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFNpbWlsYXIgdG8gJ2Vycm9yJyBldmVudCBvbiBFdmVudEVtaXR0ZXI6IHRocm93cyB3aGVuIGEgcG9zdCgpIG9jY3VycyB3aGlsZSBubyBoYW5kbGVycyBzZXQuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXJyb3JBbnlFdmVudCBleHRlbmRzIEFueUV2ZW50PEVycm9yPiB7XHJcblxyXG4gICAgcHVibGljIHBvc3QoZGF0YTogRXJyb3IpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBlcnJvciBldmVudCBwb3N0ZWQgd2hpbGUgbm8gbGlzdGVuZXJzIGF0dGFjaGVkLiBFcnJvcjogJHtkYXRhLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN1cGVyLnBvc3QoZGF0YSk7XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gQ29weXJpZ2h0IMKpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcblxyXG4ndXNlIHN0cmljdCc7XHJcblxyXG5pbXBvcnQge0Jhc2VFdmVudCwgUG9zdGFibGUsIExpc3RlbmVyfSBmcm9tICcuL2Jhc2UtZXZlbnQnO1xyXG5cclxuLyoqXHJcbiAqIE9wdGlvbnMgZm9yIHRoZSBBc3luY0V2ZW50IGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIEFzeW5jRXZlbnRPcHRzIHtcclxuICAgIC8qKlxyXG4gICAgICogQ29uZGVuc2UgbXVsdGlwbGUgY2FsbHMgdG8gcG9zdCgpIGludG8gb25lIHdoaWxlIHRoZSBwcmV2aW91cyBvbmVcclxuICAgICAqIGhhcyBub3QgYmVlbiBoYW5kbGVkIHlldC5cclxuICAgICAqL1xyXG4gICAgY29uZGVuc2VkPzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEEtc3luY2hyb25vdXMgZXZlbnQuIEhhbmRsZXJzIGFyZSBjYWxsZWQgaW4gdGhlIG5leHQgTm9kZS5KUyBjeWNsZS5cclxuICogLSBPcHRpb25hbGx5IGNvbmRlbnNlcyBtdWx0aXBsZSBwb3N0KCkgY2FsbHMgaW50byBvbmUgKHRoZSBsYXN0IHBvc3QoKSBnZXRzIHRocm91Z2gpXHJcbiAqIC0gSGFuZGxlcnMgYXJlIGNhbGxlZCBvbmx5IGZvciBldmVudHMgcG9zdGVkIGFmdGVyIHRoZXkgd2VyZSBhdHRhY2hlZC5cclxuICogLSBIYW5kbGVycyBhcmUgbm90IGNhbGxlZCBhbnltb3JlIHdoZW4gdGhleSBhcmUgZGV0YWNoZWQsIGV2ZW4gaWYgYSBwb3N0KCkgaXMgaW4gcHJvZ3Jlc3NcclxuICovXHJcbmV4cG9ydCBjbGFzcyBBc3luY0V2ZW50PFQ+IGV4dGVuZHMgQmFzZUV2ZW50PFQ+IGltcGxlbWVudHMgUG9zdGFibGU8VD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXNlZCBpbnRlcm5hbGx5IC0gdGhlIGV4YWN0IG9wdGlvbnMgb2JqZWN0IGdpdmVuIHRvIGNvbnN0cnVjdG9yXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBvcHRpb25zOiBBc3luY0V2ZW50T3B0cztcclxuXHJcbiAgICBwcml2YXRlIF9jb25kZW5zZWQ6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9xdWV1ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuICAgIHByaXZhdGUgX3F1ZXVlZExpc3RlbmVyczogTGlzdGVuZXI8VD5bXTtcclxuICAgIHByaXZhdGUgX3F1ZXVlZERhdGE6IGFueVtdO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIGRlZmF1bHQgc2NoZWR1bGVyIHVzZXMgc2V0SW1tZWRpYXRlKCkgb3Igc2V0VGltZW91dCguLi4sIDApIGlmIHNldEltbWVkaWF0ZSBpcyBub3QgYXZhaWxhYmxlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIGRlZmF1bHRTY2hlZHVsZXIoY2FsbGJhY2s6ICgpID0+IHZvaWQpOiB2b2lkIHtcclxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAgKi9cclxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgLy8gYnJvd3NlcnMgZG9uJ3QgYWx3YXlzIHN1cHBvcnQgc2V0SW1tZWRpYXRlKClcclxuICAgICAgICAgICAgc2V0VGltZW91dChjYWxsYmFjaywgMCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gbm9kZS5qc1xyXG4gICAgICAgICAgICBzZXRJbW1lZGlhdGUoY2FsbGJhY2spO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBjdXJyZW50IHNjaGVkdWxlclxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0YXRpYyBfc2NoZWR1bGVyOiAoY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+IHZvaWQgPSBBc3luY0V2ZW50LmRlZmF1bHRTY2hlZHVsZXI7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBCeSBkZWZhdWx0LCBBc3luY0V2ZW50IHVzZXMgc2V0SW1tZWRpYXRlKCkgdG8gc2NoZWR1bGUgZXZlbnQgaGFuZGxlciBpbnZvY2F0aW9uLlxyXG4gICAgICogWW91IGNhbiBjaGFuZ2UgdGhpcyBmb3IgZS5nLiBzZXRUaW1lb3V0KC4uLiwgMCkgYnkgY2FsbGluZyB0aGlzIHN0YXRpYyBtZXRob2Qgb25jZS5cclxuICAgICAqIEBwYXJhbSBzY2hlZHVsZXIgQSBmdW5jdGlvbiB0aGF0IHRha2VzIGEgY2FsbGJhY2sgYW5kIGV4ZWN1dGVzIGl0IGluIHRoZSBuZXh0IE5vZGUuSlMgY3ljbGUuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzdGF0aWMgc2V0U2NoZWR1bGVyKHNjaGVkdWxlcjogKGNhbGxiYWNrOiAoKSA9PiB2b2lkKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICAgICAgQXN5bmNFdmVudC5fc2NoZWR1bGVyID0gc2NoZWR1bGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSBvcHRzIE9wdGlvbmFsLiBWYXJpb3VzIHNldHRpbmdzOlxyXG4gICAgICogICAgICAgICAgICAgLSBjb25kZW5zZWQ6IGEgQm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgdG8gY29uZGVuc2UgbXVsdGlwbGUgcG9zdCgpIGNhbGxzIHdpdGhpbiB0aGUgc2FtZSBjeWNsZS5cclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3Iob3B0cz86IEFzeW5jRXZlbnRPcHRzKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRzO1xyXG4gICAgICAgIGNvbnN0IG9wdGlvbnM6IEFzeW5jRXZlbnRPcHRzID0gb3B0cyB8fCB7fTtcclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuY29uZGVuc2VkID09PSAnYm9vbGVhbicpIHtcclxuICAgICAgICAgICAgdGhpcy5fY29uZGVuc2VkID0gb3B0aW9ucy5jb25kZW5zZWQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fY29uZGVuc2VkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgQXN5bmNFdmVudC4gSGFuZGxlcnMgYXJlIGNhbGxlZCBpbiB0aGUgbmV4dCBOb2RlLkpTIGN5Y2xlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcG9zdChkYXRhOiBUKTogdm9pZDtcclxuICAgIHB1YmxpYyBwb3N0KC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLl9jb25kZW5zZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkRGF0YSA9IGFyZ3M7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZExpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3F1ZXVlZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIEFzeW5jRXZlbnQuX3NjaGVkdWxlcigoKTogdm9pZCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaW1tZWRpYXRlbHkgbWFyayBub24tcXVldWVkIHRvIGFsbG93IG5ldyBBc3luY0V2ZW50IHRvIGhhcHBlbiBhcyByZXN1bHRcclxuICAgICAgICAgICAgICAgICAgICAvLyBvZiBjYWxsaW5nIGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY2FjaGUgbGlzdGVuZXJzIGFuZCBkYXRhIGJlY2F1c2UgdGhleSBtaWdodCBjaGFuZ2Ugd2hpbGUgY2FsbGluZyBldmVudCBoYW5kbGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9xdWV1ZWREYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX3F1ZXVlZExpc3RlbmVycztcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgeyAvLyBub3QgY29uZGVuc2VkXHJcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgQXN5bmNFdmVudC5fc2NoZWR1bGVyKCgpOiB2b2lkID0+IHtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgYXJncyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBpbmhlcml0ZWRcclxuICAgIHByb3RlY3RlZCBfY2FsbChsaXN0ZW5lcjogTGlzdGVuZXI8VD4sIGFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgLy8gcGVyZm9ybWFuY2Ugb3B0aW1pemF0aW9uOiBkb24ndCB1c2UgY29uc2VjdXRpdmUgbm9kZWpzIGN5Y2xlc1xyXG4gICAgICAgIC8vIGZvciBhc3luY2V2ZW50cyBhdHRhY2hlZCB0byBhc3luY2V2ZW50c1xyXG4gICAgICAgIGlmIChsaXN0ZW5lci5ldmVudCAmJiBsaXN0ZW5lci5ldmVudCBpbnN0YW5jZW9mIEFzeW5jRXZlbnQpIHtcclxuICAgICAgICAgICAgKDxBc3luY0V2ZW50PFQ+Pmxpc3RlbmVyLmV2ZW50KS5fcG9zdERpcmVjdChhcmdzKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzdXBlci5fY2FsbChsaXN0ZW5lciwgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUGVyZm9ybWFuY2Ugb3B0aW1pemF0aW9uOiBpZiB0aGlzIGFzeW5jIHNpZ25hbCBpcyBhdHRhY2hlZCB0byBhbm90aGVyXHJcbiAgICAgKiBhc3luYyBzaWduYWwsIHdlJ3JlIGFscmVhZHkgYSB0aGUgbmV4dCBjeWNsZSBhbmQgd2UgY2FuIGNhbGwgbGlzdGVuZXJzXHJcbiAgICAgKiBkaXJlY3RseVxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgX3Bvc3REaXJlY3QoYXJnczogYW55W10pOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gY29weSBhIHJlZmVyZW5jZSB0byB0aGUgYXJyYXkgYmVjYXVzZSB0aGlzLl9saXN0ZW5lcnMgbWlnaHQgYmUgcmVwbGFjZWQgZHVyaW5nXHJcbiAgICAgICAgLy8gdGhlIGhhbmRsZXIgY2FsbHNcclxuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBBc3luY0V2ZW50cyB3aXRob3V0IGRhdGFcclxuICovXHJcbmV4cG9ydCBjbGFzcyBWb2lkQXN5bmNFdmVudCBleHRlbmRzIEFzeW5jRXZlbnQ8dm9pZD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgQXN5bmNFdmVudC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoKTogdm9pZCB7XHJcbiAgICAgICAgc3VwZXIucG9zdCh1bmRlZmluZWQpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBFcnJvckFzeW5jRXZlbnQgZXh0ZW5kcyBBc3luY0V2ZW50PEVycm9yPiB7XHJcblxyXG4gICAgcHVibGljIHBvc3QoZGF0YTogRXJyb3IpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBlcnJvciBldmVudCBwb3N0ZWQgd2hpbGUgbm8gbGlzdGVuZXJzIGF0dGFjaGVkLiBFcnJvcjogJHtkYXRhLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN1cGVyLnBvc3QoZGF0YSk7XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gQ29weXJpZ2h0IMKpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcblxyXG4ndXNlIHN0cmljdCc7XHJcblxyXG5pbXBvcnQgeyB0aW1pbmdTYWZlRXF1YWwgfSBmcm9tICdjcnlwdG8nO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQb3N0YWJsZTxUPiB7XHJcbiAgICBwb3N0KGRhdGE6IFQpOiB2b2lkO1xyXG59XHJcblxyXG4vKipcclxuICogSW50ZXJuYWwgaW50ZXJmYWNlIGJldHdlZW4gQmFzZUV2ZW50IGFuZCBpdHMgc3ViY2xhc3Nlc1xyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBMaXN0ZW5lcjxUPiB7XHJcbiAgICAvKipcclxuICAgICAqIEluZGljYXRlcyB0aGF0IHRoZSBsaXN0ZW5lciB3YXMgZGV0YWNoZWRcclxuICAgICAqL1xyXG4gICAgZGVsZXRlZDogYm9vbGVhbjtcclxuICAgIC8qKlxyXG4gICAgICogVGhlIGhhbmRsZXJcclxuICAgICAqL1xyXG4gICAgaGFuZGxlcj86IChkYXRhOiBUKSA9PiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgdGhpcyBwb2ludGVyIGZvciB0aGUgaGFuZGxlclxyXG4gICAgICovXHJcbiAgICBib3VuZFRvPzogT2JqZWN0O1xyXG4gICAgLyoqXHJcbiAgICAgKiBJbnN0ZWFkIG9mIGEgaGFuZGxlciwgYW4gYXR0YWNoZWQgZXZlbnRcclxuICAgICAqL1xyXG4gICAgZXZlbnQ/OiBQb3N0YWJsZTxUPjtcclxuICAgIC8qKlxyXG4gICAgICogUmVtb3ZlIGFmdGVyIGZpcnN0IGNhbGw/XHJcbiAgICAgKi9cclxuICAgIG9uY2U6IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBCYXNlIGNsYXNzIGZvciBldmVudHMuXHJcbiAqIEhhbmRsZXMgYXR0YWNoaW5nIGFuZCBkZXRhY2hpbmcgbGlzdGVuZXJzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQmFzZUV2ZW50PFQ+IGltcGxlbWVudHMgUG9zdGFibGU8VD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoZWQgbGlzdGVuZXJzLiBOT1RFOiBkbyBub3QgbW9kaWZ5LlxyXG4gICAgICogSW5zdGVhZCwgcmVwbGFjZSB3aXRoIGEgbmV3IGFycmF5IHdpdGggcG9zc2libHkgdGhlIHNhbWUgZWxlbWVudHMuIFRoaXMgZW5zdXJlc1xyXG4gICAgICogdGhhdCBhbnkgcmVmZXJlbmNlcyB0byB0aGUgYXJyYXkgYnkgZXZlbnRzIHRoYXQgYXJlIHVuZGVyd2F5IHJlbWFpbiB0aGUgc2FtZS5cclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIF9saXN0ZW5lcnM6IExpc3RlbmVyPFQ+W107XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlclxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuIFRoZSB0aGlzIGFyZ3VtZW50IG9mIHRoZSBmdW5jdGlvbiB3aWxsIGJlIHRoaXMgb2JqZWN0LlxyXG4gICAgICogQHJldHVybnMgZnVuY3Rpb24geW91IGNhbiB1c2UgZm9yIGRldGFjaGluZyBmcm9tIHRoZSBldmVudCwgaW5zdGVhZCBvZiBjYWxsaW5nIGRldGFjaCgpXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhdHRhY2goaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiAoKSA9PiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlclxyXG4gICAgICogQHBhcmFtIGJvdW5kVG8gVGhlIHRoaXMgYXJndW1lbnQgb2YgdGhlIGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBjYWxsLlxyXG4gICAgICogQHJldHVybnMgZnVuY3Rpb24geW91IGNhbiB1c2UgZm9yIGRldGFjaGluZyBmcm9tIHRoZSBldmVudCwgaW5zdGVhZCBvZiBjYWxsaW5nIGRldGFjaCgpXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhdHRhY2goYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBhbiBldmVudCBkaXJlY3RseVxyXG4gICAgICogQHBhcmFtIGV2ZW50IFRoZSBldmVudCB0byBiZSBwb3N0ZWRcclxuICAgICAqIEByZXR1cm5zIGZ1bmN0aW9uIHlvdSBjYW4gdXNlIGZvciBkZXRhY2hpbmcgZnJvbSB0aGUgZXZlbnQsIGluc3RlYWQgb2YgY2FsbGluZyBkZXRhY2goKVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoKGV2ZW50OiBQb3N0YWJsZTxUPik6ICgpID0+IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBpbXBsZW1lbnRhdGlvblxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoKGE6ICgoZGF0YTogVCkgPT4gdm9pZCkgfCBPYmplY3QgfCBQb3N0YWJsZTxUPiwgYj86IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F0dGFjaChhLCBiLCBmYWxzZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlciB3aGljaCBhdXRvbWF0aWNhbGx5IGdldHMgcmVtb3ZlZCBhZnRlciB0aGUgZmlyc3QgY2FsbFxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuIFRoZSB0aGlzIGFyZ3VtZW50IG9mIHRoZSBmdW5jdGlvbiB3aWxsIGJlIHRoaXMgb2JqZWN0LlxyXG4gICAgICogQHJldHVybnMgZnVuY3Rpb24geW91IGNhbiB1c2UgZm9yIGRldGFjaGluZyBmcm9tIHRoZSBldmVudCwgaW5zdGVhZCBvZiBjYWxsaW5nIGRldGFjaCgpXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBvbmNlKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGhhbmRsZXIgd2hpY2ggYXV0b21hdGljYWxseSBnZXRzIHJlbW92ZWQgYWZ0ZXIgdGhlIGZpcnN0IGNhbGxcclxuICAgICAqIEBwYXJhbSBib3VuZFRvIFRoZSB0aGlzIGFyZ3VtZW50IG9mIHRoZSBoYW5kbGVyXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gdG8gY2FsbC5cclxuICAgICAqIEByZXR1cm5zIGZ1bmN0aW9uIHlvdSBjYW4gdXNlIGZvciBkZXRhY2hpbmcgZnJvbSB0aGUgZXZlbnQsIGluc3RlYWQgb2YgY2FsbGluZyBkZXRhY2goKVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb25jZShib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGRpcmVjdGx5IGFuZCBkZS1hdHRhY2ggYWZ0ZXIgdGhlIGZpcnN0IGNhbGxcclxuICAgICAqIEBwYXJhbSBldmVudCBUaGUgZXZlbnQgdG8gYmUgcG9zdGVkXHJcbiAgICAgKiBAcmV0dXJucyBmdW5jdGlvbiB5b3UgY2FuIHVzZSBmb3IgZGV0YWNoaW5nIGZyb20gdGhlIGV2ZW50LCBpbnN0ZWFkIG9mIGNhbGxpbmcgZGV0YWNoKClcclxuICAgICAqL1xyXG4gICAgcHVibGljIG9uY2UoZXZlbnQ6IFBvc3RhYmxlPFQ+KTogKCkgPT4gdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogT25jZSBpbXBsZW1lbnRhdGlvblxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb25jZShhOiAoKGRhdGE6IFQpID0+IHZvaWQpIHwgT2JqZWN0IHwgUG9zdGFibGU8VD4sIGI/OiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hdHRhY2goYSwgYiwgdHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggLyBvbmNlIGltcGxlbWVudGF0aW9uXHJcbiAgICAgKiBAcGFyYW0gYVxyXG4gICAgICogQHBhcmFtIGJcclxuICAgICAqIEBwYXJhbSBvbmNlXHJcbiAgICAgKiBAcmV0dXJucyBmdW5jdGlvbiB5b3UgY2FuIHVzZSBmb3IgZGV0YWNoaW5nIGZyb20gdGhlIGV2ZW50LCBpbnN0ZWFkIG9mIGNhbGxpbmcgZGV0YWNoKClcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfYXR0YWNoKGE6ICgoZGF0YTogVCkgPT4gdm9pZCkgfCBPYmplY3QgfCBQb3N0YWJsZTxUPiwgYjogKChkYXRhOiBUKSA9PiB2b2lkKSB8IHVuZGVmaW5lZCwgb25jZTogYm9vbGVhbik6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIGxldCBib3VuZFRvOiBPYmplY3Q7XHJcbiAgICAgICAgbGV0IGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkO1xyXG4gICAgICAgIGxldCBldmVudDogUG9zdGFibGU8VD47XHJcbiAgICAgICAgbGV0IHJlc3VsdDogKCkgPT4gdm9pZDtcclxuICAgICAgICBpZiAodHlwZW9mIGEgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgaGFuZGxlciA9IGEgYXMgKChkYXRhOiBUKSA9PiB2b2lkKTtcclxuICAgICAgICAgICAgcmVzdWx0ID0gKCkgPT4gdGhpcy5kZXRhY2goaGFuZGxlcik7XHJcbiAgICAgICAgfSBlbHNlIGlmICghYiAmJiB0eXBlb2YgKGEgYXMgUG9zdGFibGU8VD4pLnBvc3QgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgZXZlbnQgPSBhIGFzIFBvc3RhYmxlPFQ+O1xyXG4gICAgICAgICAgICByZXN1bHQgPSAoKSA9PiB0aGlzLmRldGFjaChldmVudCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBhICE9PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3QgYSBmdW5jdGlvbiBvciBvYmplY3QgYXMgZmlyc3QgYXJndW1lbnQnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGIgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0IGEgZnVuY3Rpb24gYXMgc2Vjb25kIGFyZ3VtZW50Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYm91bmRUbyA9IGE7XHJcbiAgICAgICAgICAgIGhhbmRsZXIgPSBiO1xyXG4gICAgICAgICAgICByZXN1bHQgPSAoKSA9PiB0aGlzLmRldGFjaChib3VuZFRvLCBoYW5kbGVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gW107XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gbWFrZSBhIGNvcHkgb2YgdGhlIGFycmF5IHNvIGV2ZW50cyB0aGF0IGFyZSB1bmRlcndheSBoYXZlIGEgc3RhYmxlIGxvY2FsIGNvcHlcclxuICAgICAgICAgICAgLy8gb2YgdGhlIGxpc3RlbmVycyBhcnJheSBhdCB0aGUgdGltZSBvZiBwb3N0KClcclxuICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzLnNsaWNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2xpc3RlbmVycy5wdXNoKHtcclxuICAgICAgICAgICAgZGVsZXRlZDogZmFsc2UsXHJcbiAgICAgICAgICAgIGJvdW5kVG8sXHJcbiAgICAgICAgICAgIGhhbmRsZXIsXHJcbiAgICAgICAgICAgIGV2ZW50LFxyXG4gICAgICAgICAgICBvbmNlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBhbGwgbGlzdGVuZXJzIHdpdGggdGhlIGdpdmVuIGhhbmRsZXIgZnVuY3Rpb25cclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaChoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBhbGwgbGlzdGVuZXJzIHdpdGggdGhlIGdpdmVuIGhhbmRsZXIgZnVuY3Rpb24gYW5kIGJvdW5kVG8gb2JqZWN0LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggYWxsIGxpc3RlbmVycyB0aGF0IHdlcmUgYXR0YWNoZWQgd2l0aCB0aGUgZ2l2ZW4gYm91bmRUbyBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBkZXRhY2goYm91bmRUbzogT2JqZWN0KTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogRGV0YWNoIHRoZSBnaXZlbiBldmVudC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaChldmVudDogUG9zdGFibGU8VD4pOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggYWxsIGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKCk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCBpbXBsZW1lbnRhdGlvbi4gU2VlIHRoZSBvdmVybG9hZHMgZm9yIGRlc2NyaXB0aW9uLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBib3VuZFRvOiBPYmplY3Q7XHJcbiAgICAgICAgbGV0IGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkO1xyXG4gICAgICAgIGxldCBldmVudDogUG9zdGFibGU8VD47XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID49IDEpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiAoYXJnc1swXSkgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxICYmIHR5cGVvZiBhcmdzWzBdLnBvc3QgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGV2ZW50ID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGJvdW5kVG8gPSBhcmdzWzBdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA+PSAyKSB7XHJcbiAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzFdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVycyBBTkQgbWFyayB0aGVtIGFzIGRlbGV0ZWQgc28gc3ViY2xhc3NlcyBkb24ndCBzZW5kIGFueSBtb3JlIGV2ZW50cyB0byB0aGVtXHJcbiAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzLmZpbHRlcigobGlzdGVuZXI6IExpc3RlbmVyPFQ+KTogYm9vbGVhbiA9PiB7XHJcbiAgICAgICAgICAgIGlmICgodHlwZW9mIGhhbmRsZXIgPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmhhbmRsZXIgPT09IGhhbmRsZXIpXHJcbiAgICAgICAgICAgICAgICAmJiAodHlwZW9mIGV2ZW50ID09PSAndW5kZWZpbmVkJyB8fCBsaXN0ZW5lci5ldmVudCA9PT0gZXZlbnQpXHJcbiAgICAgICAgICAgICAgICAmJiAodHlwZW9mIGJvdW5kVG8gPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmJvdW5kVG8gPT09IGJvdW5kVG8pKSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5kZWxldGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBYnN0cmFjdCBwb3N0KCkgbWV0aG9kIHRvIGJlIGFibGUgdG8gY29ubmVjdCBhbnkgdHlwZSBvZiBldmVudCB0byBhbnkgb3RoZXIgZGlyZWN0bHlcclxuICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcG9zdChkYXRhOiBUKTogdm9pZCB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhYnN0cmFjdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIG51bWJlciBvZiBhdHRhY2hlZCBsaXN0ZW5lcnNcclxuICAgICAqL1xyXG4gICAgcHVibGljIGxpc3RlbmVyQ291bnQoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2xpc3RlbmVycyA/IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggOiAwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGwgdGhlIGdpdmVuIGxpc3RlbmVyLCBpZiBpdCBpcyBub3QgbWFya2VkIGFzICdkZWxldGVkJ1xyXG4gICAgICogQHBhcmFtIGxpc3RlbmVyIFRoZSBsaXN0ZW5lciB0byBjYWxsXHJcbiAgICAgKiBAcGFyYW0gYXJncyBUaGUgYXJndW1lbnRzIHRvIHRoZSBoYW5kbGVyXHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBfY2FsbChsaXN0ZW5lcjogTGlzdGVuZXI8VD4sIGFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCFsaXN0ZW5lci5kZWxldGVkKSB7XHJcbiAgICAgICAgICAgIGlmIChsaXN0ZW5lci5vbmNlKSB7XHJcbiAgICAgICAgICAgICAgICAvLyByZW1vdmUgbGlzdGVuZXJzIEFORCBtYXJrIGFzIGRlbGV0ZWQgc28gc3ViY2xhc3NlcyBkb24ndCBzZW5kIGFueSBtb3JlIGV2ZW50cyB0byB0aGVtXHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5kZWxldGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycy5maWx0ZXIoKGw6IExpc3RlbmVyPFQ+KTogYm9vbGVhbiA9PiBsICE9PSBsaXN0ZW5lcik7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGxpc3RlbmVyLmV2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5ldmVudC5wb3N0LmFwcGx5KGxpc3RlbmVyLmV2ZW50LCBhcmdzKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVyLmhhbmRsZXIuYXBwbHkoKHR5cGVvZiBsaXN0ZW5lci5ib3VuZFRvID09PSAnb2JqZWN0JyA/IGxpc3RlbmVyLmJvdW5kVG8gOiB0aGlzKSwgYXJncyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG59XHJcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNoYWxsb3dFcXVhbHMoYTogYW55LCBiOiBhbnkpOiBib29sZWFuIHtcclxuICAgIGlmIChhID09PSBiKSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIGEgIT09IHR5cGVvZiBiKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgc3dpdGNoICh0eXBlb2YgYSkge1xyXG4gICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxyXG4gICAgICAgIGNhc2UgJ251bWJlcic6XHJcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcclxuICAgICAgICBjYXNlICdmdW5jdGlvbic6XHJcbiAgICAgICAgY2FzZSAnc3ltYm9sJzpcclxuICAgICAgICBjYXNlICd1bmRlZmluZWQnOlxyXG4gICAgICAgICAgICAvLyBhbHJlYWR5IGRpZCA9PT0gY29tcGFyZVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY2FzZSAnb2JqZWN0JzpcclxuICAgICAgICAgICAgaWYgKGEgPT09IG51bGwgfHwgYiA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBhbHJlYWR5IGNvbXBhcmVkID09PVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGEpIHx8IEFycmF5LmlzQXJyYXkoYikpIHtcclxuICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShhKSB8fCAhQXJyYXkuaXNBcnJheShiKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc3QgbmFtZXNBOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICBjb25zdCBuYW1lc0I6IHN0cmluZ1tdID0gW107XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgbmFtZSBpbiBhKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYS5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWVzQS5wdXNoKG5hbWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgbmFtZSBpbiBiKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYi5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWVzQi5wdXNoKG5hbWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG5hbWVzQS5zb3J0KCk7XHJcbiAgICAgICAgICAgIG5hbWVzQi5zb3J0KCk7XHJcbiAgICAgICAgICAgIGlmIChuYW1lc0Euam9pbignLCcpICE9PSBuYW1lc0Iuam9pbignLCcpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuYW1lc0EubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgIGlmIChhW25hbWVzQVtpXV0gIT09IGJbbmFtZXNBW2ldXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbn1cclxuIiwiLy8gQ29weXJpZ2h0IMKpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcblxyXG4ndXNlIHN0cmljdCc7XHJcblxyXG5pbXBvcnQge0Jhc2VFdmVudCwgUG9zdGFibGUsIExpc3RlbmVyfSBmcm9tICcuL2Jhc2UtZXZlbnQnO1xyXG5pbXBvcnQge2RlZmF1bHQgYXMgRXZlbnRRdWV1ZX0gZnJvbSAnLi9FdmVudFF1ZXVlJztcclxuXHJcbi8qKlxyXG4gKiBPcHRpb25zIGZvciB0aGUgUXVldWVkRXZlbnQgY29uc3RydWN0b3JcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgUXVldWVkRXZlbnRPcHRzIHtcclxuICAgIC8qKlxyXG4gICAgICogQ29uZGVuc2UgbXVsdGlwbGUgY2FsbHMgdG8gcG9zdCgpIGludG8gb25lLlxyXG4gICAgICovXHJcbiAgICBjb25kZW5zZWQ/OiBib29sZWFuO1xyXG4gICAgLyoqXHJcbiAgICAgKiBTcGVjaWZpYyBldmVudCBxdWV1ZSB0byB1c2UuIElmIG5vdCBwcm92aWRlZCwgdGhlIGdsb2JhbCBpbnN0YW5jZSBpcyB1c2VkLlxyXG4gICAgICovXHJcbiAgICBxdWV1ZT86IEV2ZW50UXVldWU7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFdmVudCB0aGF0IHN0YXlzIGluIGEgcXVldWUgdW50aWwgeW91IHByb2Nlc3MgdGhlIHF1ZXVlLiBBbGxvd3MgZmluZS1ncmFpbmVkXHJcbiAqIGNvbnRyb2wgb3ZlciB3aGVuIGV2ZW50cyBoYXBwZW4uXHJcbiAqIC0gT3B0aW9uYWxseSBjb25kZW5zZXMgbXVsdGlwbGUgcG9zdCgpIGNhbGxzIGludG8gb25lLlxyXG4gKiAtIEhhbmRsZXJzIGFyZSBjYWxsZWQgb25seSBmb3IgZXZlbnRzIHBvc3RlZCBhZnRlciB0aGV5IHdlcmUgYXR0YWNoZWQuXHJcbiAqIC0gSGFuZGxlcnMgYXJlIG5vdCBjYWxsZWQgYW55bW9yZSB3aGVuIHRoZXkgYXJlIGRldGFjaGVkLCBldmVuIGlmIGEgcG9zdCgpIGlzIGluIHByb2dyZXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUXVldWVkRXZlbnQ8VD4gZXh0ZW5kcyBCYXNlRXZlbnQ8VD4gaW1wbGVtZW50cyBQb3N0YWJsZTxUPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2VkIGludGVybmFsbHkgLSB0aGUgZXhhY3Qgb3B0aW9ucyBvYmplY3QgZ2l2ZW4gdG8gY29uc3RydWN0b3JcclxuICAgICAqL1xyXG4gICAgcHVibGljIG9wdGlvbnM6IFF1ZXVlZEV2ZW50T3B0cztcclxuXHJcbiAgICBwcml2YXRlIF9jb25kZW5zZWQ6IGJvb2xlYW47XHJcbiAgICBwcml2YXRlIF9xdWV1ZTogRXZlbnRRdWV1ZTtcclxuICAgIHByaXZhdGUgX3F1ZXVlZDogYm9vbGVhbiA9IGZhbHNlO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkTGlzdGVuZXJzOiBMaXN0ZW5lcjxUPltdO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkRGF0YTogYW55W107XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDb25zdHJ1Y3RvclxyXG4gICAgICogQHBhcmFtIG9wdHMgT3B0aW9uYWwsIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgbWVtYmVyczpcclxuICAgICAqICAgICAgICAgICAgIC0gY29uZGVuc2VkOiBhIEJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRvIGNvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZSAoZGVmYXVsdCBmYWxzZSlcclxuICAgICAqICAgICAgICAgICAgIC0gcXVldWU6IGEgc3BlY2lmaWMgZXZlbnQgcXVldWUgdG8gdXNlLiBUaGUgZ2xvYmFsIEV2ZW50UXVldWUgaW5zdGFuY2UgaXMgdXNlZCBpZiBub3QgZ2l2ZW4uXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpIHtcclxuICAgICAgICBzdXBlcigpO1xyXG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdHM7XHJcbiAgICAgICAgY29uc3Qgb3B0aW9uczogUXVldWVkRXZlbnRPcHRzID0gb3B0cyB8fCB7fTtcclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuY29uZGVuc2VkID09PSAnYm9vbGVhbicpIHtcclxuICAgICAgICAgICAgdGhpcy5fY29uZGVuc2VkID0gb3B0aW9ucy5jb25kZW5zZWQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fY29uZGVuc2VkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5xdWV1ZSA9PT0gJ29iamVjdCcgJiYgb3B0aW9ucy5xdWV1ZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZSA9IG9wdGlvbnMucXVldWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgKiBTZW5kIHRoZSBldmVudC4gRXZlbnRzIGFyZSBxdWV1ZWQgaW4gdGhlIGV2ZW50IHF1ZXVlIHVudGlsIGZsdXNoZWQgb3V0LlxyXG4gICAgKiBJZiB0aGUgJ2NvbmRlbnNlZCcgb3B0aW9uIHdhcyBnaXZlbiBpbiB0aGUgY29uc3RydWN0b3IsIG11bHRpcGxlIHBvc3RzKClcclxuICAgICogYmV0d2VlbiBxdWV1ZSBmbHVzaGVzIGFyZSBjb25kZW5zZWQgaW50byBvbmUgY2FsbCB3aXRoIHRoZSBkYXRhIGZyb20gdGhlXHJcbiAgICAqIGxhc3QgcG9zdCgpIGNhbGwuXHJcbiAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoZGF0YTogVCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgcG9zdCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBxdWV1ZSA9ICh0aGlzLl9xdWV1ZSA/IHRoaXMuX3F1ZXVlIDogRXZlbnRRdWV1ZS5nbG9iYWwoKSk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2NvbmRlbnNlZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWREYXRhID0gYXJncztcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkTGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgcXVldWUuYWRkKCgpOiB2b2lkID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBpbW1lZGlhdGVseSBtYXJrIG5vbi1xdWV1ZWQgdG8gYWxsb3cgbmV3IEFzeW5jRXZlbnQgdG8gaGFwcGVuIGFzIHJlc3VsdFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIG9mIGNhbGxpbmcgaGFuZGxlcnNcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAvLyBjYWNoZSBsaXN0ZW5lcnMgYW5kIGRhdGEgYmVjYXVzZSB0aGV5IG1pZ2h0IGNoYW5nZSB3aGlsZSBjYWxsaW5nIGV2ZW50IGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuX3F1ZXVlZERhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5fcXVldWVkTGlzdGVuZXJzO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7IC8vIG5vdCBjb25kZW5zZWRcclxuICAgICAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgICAgICBxdWV1ZS5hZGQoKCk6IHZvaWQgPT4ge1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBhcmdzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ29udmVuaWVuY2UgY2xhc3MgZm9yIGV2ZW50cyB3aXRob3V0IGRhdGFcclxuICovXHJcbmV4cG9ydCBjbGFzcyBWb2lkUXVldWVkRXZlbnQgZXh0ZW5kcyBRdWV1ZWRFdmVudDx2b2lkPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBldmVudC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoKTogdm9pZCB7XHJcbiAgICAgICAgc3VwZXIucG9zdCh1bmRlZmluZWQpO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNpbWlsYXIgdG8gJ2Vycm9yJyBldmVudCBvbiBFdmVudEVtaXR0ZXI6IHRocm93cyB3aGVuIGEgcG9zdCgpIG9jY3VycyB3aGlsZSBubyBoYW5kbGVycyBzZXQuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXJyb3JRdWV1ZWRFdmVudCBleHRlbmRzIFF1ZXVlZEV2ZW50PEVycm9yPiB7XHJcblxyXG4gICAgcHVibGljIHBvc3QoZGF0YTogRXJyb3IpOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6ICR7ZGF0YS5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdXBlci5wb3N0KGRhdGEpO1xyXG4gICAgfVxyXG59XHJcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlfSBmcm9tICcuL2Jhc2UtZXZlbnQnO1xyXG5cclxuLyoqXHJcbiAqIFRoaXMgaXMgYSB0cnVlIEV2ZW50RW1pdHRlciByZXBsYWNlbWVudDogdGhlIGhhbmRsZXJzIGFyZSBjYWxsZWQgc3luY2hyb25vdXNseSB3aGVuXHJcbiAqIHlvdSBwb3N0IHRoZSBldmVudC5cclxuICogLSBBbGxvd3MgYmV0dGVyIGVycm9yIGhhbmRsaW5nIGJ5IGFnZ3JlZ2F0aW5nIGFueSBlcnJvcnMgdGhyb3duIGJ5IGhhbmRsZXJzLlxyXG4gKiAtIFByZXZlbnRzIGxpdmVsb2NrIGJ5IHRocm93aW5nIGFuIGVycm9yIHdoZW4gcmVjdXJzaW9uIGRlcHRoIGlzIGFib3ZlIGEgbWF4aW11bS5cclxuICogLSBIYW5kbGVycyBhcmUgY2FsbGVkIG9ubHkgZm9yIGV2ZW50cyBwb3N0ZWQgYWZ0ZXIgdGhleSB3ZXJlIGF0dGFjaGVkLlxyXG4gKiAtIEhhbmRsZXJzIGFyZSBub3QgY2FsbGVkIGFueW1vcmUgd2hlbiB0aGV5IGFyZSBkZXRhY2hlZCwgZXZlbiBpZiBhIHBvc3QoKSBpcyBpbiBwcm9ncmVzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFN5bmNFdmVudDxUPiBleHRlbmRzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIE1heGltdW0gbnVtYmVyIG9mIHRpbWVzIHRoYXQgYW4gZXZlbnQgaGFuZGxlciBtYXkgY2F1c2UgdGhlIHNhbWUgZXZlbnRcclxuICAgICAqIHJlY3Vyc2l2ZWx5LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIE1BWF9SRUNVUlNJT05fREVQVEg6IG51bWJlciA9IDEwO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVjdXJzaXZlIHBvc3QoKSBpbnZvY2F0aW9uc1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIF9yZWN1cnNpb246IG51bWJlciA9IDA7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBldmVudC4gSGFuZGxlcnMgYXJlIGNhbGxlZCBpbW1lZGlhdGVseSBhbmQgc3luY2hyb25vdXNseS5cclxuICAgICAqIElmIGFuIGVycm9yIGlzIHRocm93biBieSBhIGhhbmRsZXIsIHRoZSByZW1haW5pbmcgaGFuZGxlcnMgYXJlIHN0aWxsIGNhbGxlZC5cclxuICAgICAqIEFmdGVyd2FyZCwgYW4gQWdncmVnYXRlRXJyb3IgaXMgdGhyb3duIHdpdGggdGhlIG9yaWdpbmFsIGVycm9yKHMpIGluIGl0cyAnY2F1c2VzJyBwcm9wZXJ0eS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoZGF0YTogVCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgcG9zdCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9yZWN1cnNpb24rKztcclxuICAgICAgICBpZiAoU3luY0V2ZW50Lk1BWF9SRUNVUlNJT05fREVQVEggPiAwICYmXHJcbiAgICAgICAgICAgIHRoaXMuX3JlY3Vyc2lvbiA+IFN5bmNFdmVudC5NQVhfUkVDVVJTSU9OX0RFUFRIKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZXZlbnQgZmlyZWQgcmVjdXJzaXZlbHknKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gY29weSBhIHJlZmVyZW5jZSB0byB0aGUgYXJyYXkgYmVjYXVzZSB0aGlzLl9saXN0ZW5lcnMgbWlnaHQgYmUgcmVwbGFjZWQgZHVyaW5nXHJcbiAgICAgICAgLy8gdGhlIGhhbmRsZXIgY2FsbHNcclxuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9yZWN1cnNpb24tLTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBldmVudHMgd2l0aG91dCBkYXRhXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVm9pZFN5bmNFdmVudCBleHRlbmRzIFN5bmNFdmVudDx2b2lkPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBldmVudC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoKTogdm9pZCB7XHJcbiAgICAgICAgc3VwZXIucG9zdCh1bmRlZmluZWQpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBFcnJvclN5bmNFdmVudCBleHRlbmRzIFN5bmNFdmVudDxFcnJvcj4ge1xyXG5cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IEVycm9yKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6ICR7ZGF0YS5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdXBlci5wb3N0KGRhdGEpO1xyXG4gICAgfVxyXG59XHJcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJ2YXIgbmV4dFRpY2sgPSByZXF1aXJlKCdwcm9jZXNzL2Jyb3dzZXIuanMnKS5uZXh0VGljaztcbnZhciBhcHBseSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseTtcbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbnZhciBpbW1lZGlhdGVJZHMgPSB7fTtcbnZhciBuZXh0SW1tZWRpYXRlSWQgPSAwO1xuXG4vLyBET00gQVBJcywgZm9yIGNvbXBsZXRlbmVzc1xuXG5leHBvcnRzLnNldFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBUaW1lb3V0KGFwcGx5LmNhbGwoc2V0VGltZW91dCwgd2luZG93LCBhcmd1bWVudHMpLCBjbGVhclRpbWVvdXQpO1xufTtcbmV4cG9ydHMuc2V0SW50ZXJ2YWwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBUaW1lb3V0KGFwcGx5LmNhbGwoc2V0SW50ZXJ2YWwsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJJbnRlcnZhbCk7XG59O1xuZXhwb3J0cy5jbGVhclRpbWVvdXQgPVxuZXhwb3J0cy5jbGVhckludGVydmFsID0gZnVuY3Rpb24odGltZW91dCkgeyB0aW1lb3V0LmNsb3NlKCk7IH07XG5cbmZ1bmN0aW9uIFRpbWVvdXQoaWQsIGNsZWFyRm4pIHtcbiAgdGhpcy5faWQgPSBpZDtcbiAgdGhpcy5fY2xlYXJGbiA9IGNsZWFyRm47XG59XG5UaW1lb3V0LnByb3RvdHlwZS51bnJlZiA9IFRpbWVvdXQucHJvdG90eXBlLnJlZiA9IGZ1bmN0aW9uKCkge307XG5UaW1lb3V0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9jbGVhckZuLmNhbGwod2luZG93LCB0aGlzLl9pZCk7XG59O1xuXG4vLyBEb2VzIG5vdCBzdGFydCB0aGUgdGltZSwganVzdCBzZXRzIHVwIHRoZSBtZW1iZXJzIG5lZWRlZC5cbmV4cG9ydHMuZW5yb2xsID0gZnVuY3Rpb24oaXRlbSwgbXNlY3MpIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuICBpdGVtLl9pZGxlVGltZW91dCA9IG1zZWNzO1xufTtcblxuZXhwb3J0cy51bmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuICBpdGVtLl9pZGxlVGltZW91dCA9IC0xO1xufTtcblxuZXhwb3J0cy5fdW5yZWZBY3RpdmUgPSBleHBvcnRzLmFjdGl2ZSA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuXG4gIHZhciBtc2VjcyA9IGl0ZW0uX2lkbGVUaW1lb3V0O1xuICBpZiAobXNlY3MgPj0gMCkge1xuICAgIGl0ZW0uX2lkbGVUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uIG9uVGltZW91dCgpIHtcbiAgICAgIGlmIChpdGVtLl9vblRpbWVvdXQpXG4gICAgICAgIGl0ZW0uX29uVGltZW91dCgpO1xuICAgIH0sIG1zZWNzKTtcbiAgfVxufTtcblxuLy8gVGhhdCdzIG5vdCBob3cgbm9kZS5qcyBpbXBsZW1lbnRzIGl0IGJ1dCB0aGUgZXhwb3NlZCBhcGkgaXMgdGhlIHNhbWUuXG5leHBvcnRzLnNldEltbWVkaWF0ZSA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHNldEltbWVkaWF0ZSA6IGZ1bmN0aW9uKGZuKSB7XG4gIHZhciBpZCA9IG5leHRJbW1lZGlhdGVJZCsrO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cy5sZW5ndGggPCAyID8gZmFsc2UgOiBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgaW1tZWRpYXRlSWRzW2lkXSA9IHRydWU7XG5cbiAgbmV4dFRpY2soZnVuY3Rpb24gb25OZXh0VGljaygpIHtcbiAgICBpZiAoaW1tZWRpYXRlSWRzW2lkXSkge1xuICAgICAgLy8gZm4uY2FsbCgpIGlzIGZhc3RlciBzbyB3ZSBvcHRpbWl6ZSBmb3IgdGhlIGNvbW1vbiB1c2UtY2FzZVxuICAgICAgLy8gQHNlZSBodHRwOi8vanNwZXJmLmNvbS9jYWxsLWFwcGx5LXNlZ3VcbiAgICAgIGlmIChhcmdzKSB7XG4gICAgICAgIGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm4uY2FsbChudWxsKTtcbiAgICAgIH1cbiAgICAgIC8vIFByZXZlbnQgaWRzIGZyb20gbGVha2luZ1xuICAgICAgZXhwb3J0cy5jbGVhckltbWVkaWF0ZShpZCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaWQ7XG59O1xuXG5leHBvcnRzLmNsZWFySW1tZWRpYXRlID0gdHlwZW9mIGNsZWFySW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBjbGVhckltbWVkaWF0ZSA6IGZ1bmN0aW9uKGlkKSB7XG4gIGRlbGV0ZSBpbW1lZGlhdGVJZHNbaWRdO1xufTsiLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmV4cG9ydCAqIGZyb20gJy4vYmFzZS1ldmVudCc7XHJcbmV4cG9ydCAqIGZyb20gJy4vc3luYy1ldmVudCc7XHJcbmV4cG9ydCAqIGZyb20gJy4vcXVldWVkLWV2ZW50JztcclxuZXhwb3J0ICogZnJvbSAnLi9hc3luYy1ldmVudCc7XHJcbmV4cG9ydCAqIGZyb20gJy4vYW55LWV2ZW50JztcclxuXHJcbmltcG9ydCB7ZGVmYXVsdCBhcyBFdmVudFF1ZXVlfSBmcm9tICcuL0V2ZW50UXVldWUnO1xyXG5leHBvcnQge2RlZmF1bHQgYXMgRXZlbnRRdWV1ZX0gZnJvbSAnLi9FdmVudFF1ZXVlJztcclxuXHJcbi8qKlxyXG4gKiBUaGUgZ2xvYmFsIGV2ZW50IHF1ZXVlIGZvciBRdWV1ZWRFdmVudHNcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBxdWV1ZSgpOiBFdmVudFF1ZXVlIHtcclxuICAgIHJldHVybiBFdmVudFF1ZXVlLmdsb2JhbCgpO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVuaWVuY2UgZnVuY3Rpb24sIHNhbWUgYXMgRXZlbnRRdWV1ZS5nbG9iYWwoKS5mbHVzaE9uY2UoKS5cclxuICogRmx1c2hlcyB0aGUgUXVldWVkRXZlbnRzLCBjYWxsaW5nIGFsbCBldmVudHMgY3VycmVudGx5IGluIHRoZSBxdWV1ZSBidXQgbm90XHJcbiAqIGFueSBldmVudHMgcHV0IGludG8gdGhlIHF1ZXVlIGFzIGEgcmVzdWx0IG9mIHRoZSBmbHVzaC5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmbHVzaE9uY2UoKTogdm9pZCB7XHJcbiAgICBFdmVudFF1ZXVlLmdsb2JhbCgpLmZsdXNoT25jZSgpO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVuaWVuY2UgZnVuY3Rpb24sIHNhbWUgYXMgRXZlbnRRdWV1ZS5nbG9iYWwoKS5mbHVzaCgpLlxyXG4gKiBGbHVzaGVzIHRoZSBRdWV1ZWRFdmVudHMsIGNhbGxpbmcgYWxsIGhhbmRsZXJzIGN1cnJlbnRseSBpbiB0aGUgcXVldWUgYW5kIHRob3NlXHJcbiAqIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXHJcbiAqIEBwYXJhbSBtYXhSb3VuZHMgT3B0aW9uYWwsIGRlZmF1bHQgMTAuIE51bWJlciBvZiBpdGVyYXRpb25zIGFmdGVyIHdoaWNoIHRvIHRocm93IGFuIGVycm9yIGJlY2F1c2VcclxuICogICAgICAgICAgICAgICAgICB0aGUgcXVldWUga2VlcHMgZmlsbGluZyB1cC4gU2V0IHRvIHVuZGVmaW5lZCBvciBudWxsIHRvIGRpc2FibGUgdGhpcy5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmbHVzaChtYXhSb3VuZHM6IG51bWJlciA9IDEwKTogdm9pZCB7XHJcbiAgICBFdmVudFF1ZXVlLmdsb2JhbCgpLmZsdXNoKG1heFJvdW5kcyk7XHJcbn1cclxuIl19
return require('ts-events');
});