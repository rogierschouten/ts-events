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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbGliL0V2ZW50UXVldWUudHMiLCJzcmMvbGliL2FueS1ldmVudC50cyIsImRpc3QvbGliL3NyYy9saWIvYXN5bmMtZXZlbnQudHMiLCJzcmMvbGliL2Jhc2UtZXZlbnQudHMiLCJzcmMvbGliL29iamVjdHMudHMiLCJzcmMvbGliL3F1ZXVlZC1ldmVudC50cyIsInNyYy9saWIvc3luYy1ldmVudC50cyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvdGltZXJzLWJyb3dzZXJpZnkvbWFpbi5qcyIsInNyYy9saWIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSw2REFBNkQ7QUFDN0QsZUFBZTtBQUVmLFlBQVksQ0FBQzs7QUFFYiwyQ0FBdUM7QUFFdkM7O0dBRUc7QUFDSDtJQUFBO1FBRUk7OztXQUdHO1FBQ0ksY0FBUyxHQUEwQixJQUFJLHNCQUFTLEVBQWMsQ0FBQztRQUN0RTs7O1dBR0c7UUFDSSxlQUFVLEdBQTBCLElBQUksc0JBQVMsRUFBYyxDQUFDO1FBd0J2RTs7V0FFRztRQUNLLFdBQU0sR0FBbUIsRUFBRSxDQUFDO1FBRXBDOztXQUVHO1FBQ0ssY0FBUyxHQUFZLEtBQUssQ0FBQztJQXFFdkMsQ0FBQztJQTlGRzs7T0FFRztJQUNXLGlCQUFNLEdBQXBCO1FBQ0ksSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUU7WUFDdkIsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO1NBQzVCO1FBQ0QsT0FBTyxVQUFVLENBQUMsU0FBUyxDQUFDO0lBQ2hDLENBQUM7SUFFRDs7T0FFRztJQUNXLHNCQUFXLEdBQXpCO1FBQ0ksVUFBVSxDQUFDLFNBQVMsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFZRDs7T0FFRztJQUNJLDBCQUFLLEdBQVo7UUFDSSxPQUFPLElBQUksQ0FBQyxNQUFN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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNFQSw2REFBNkQ7QUFDN0QsZUFBZTtBQUVmLFlBQVksQ0FBQzs7Ozs7QUFFYixrQ0FBNkI7QUFDN0Isa0NBQTZCO0FBQzdCLG9DQUErQjtBQUMvQixtQ0FBOEI7QUFDOUIsaUNBQTRCO0FBRTVCLDJDQUFtRDtBQUNuRCwyQ0FBbUQ7QUFBM0Msa0NBQUEsT0FBTyxDQUFjO0FBRTdCOztHQUVHO0FBQ0gsU0FBZ0IsS0FBSztJQUNqQixPQUFPLG9CQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDL0IsQ0FBQztBQUZELHNCQUVDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLFNBQVM7SUFDckIsb0JBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUNwQyxDQUFDO0FBRkQsOEJBRUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxTQUFnQixLQUFLLENBQUMsU0FBc0I7SUFBdEIsMEJBQUEsRUFBQSxjQUFzQjtJQUN4QyxvQkFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUN6QyxDQUFDO0FBRkQsc0JBRUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCB7U3luY0V2ZW50fSBmcm9tICcuL3N5bmMtZXZlbnQnO1xyXG5cclxuLyoqXHJcbiAqIFNpbXBsZSBzeW5jaHJvbm91cyBldmVudCBxdWV1ZSB0aGF0IG5lZWRzIHRvIGJlIGRyYWluZWQgbWFudWFsbHkuXHJcbiAqL1xyXG5jbGFzcyBFdmVudFF1ZXVlIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFN5bmNFdmVudCB0cmlnZ2VyZWQgYWZ0ZXIgYW4gZXZlbnQgaXMgYWRkZWQgb3V0c2lkZSBvZiBhIGZsdXNoIG9wZXJhdGlvbi5cclxuICAgICAqIEBwYXJhbSBxdWV1ZSBUaGUgZXZlbnQgcXVldWUgaXRzZWxmXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBldnRGaWxsZWQ6IFN5bmNFdmVudDxFdmVudFF1ZXVlPiA9IG5ldyBTeW5jRXZlbnQ8RXZlbnRRdWV1ZT4oKTtcclxuICAgIC8qKlxyXG4gICAgICogU3luY0V2ZW50IHRyaWdnZXJlZCBhZnRlciB0aGUgcXVldWUgaXMgZmx1c2hlZCBlbXB0eVxyXG4gICAgICogQHBhcmFtIHF1ZXVlIFRoZSBldmVudCBxdWV1ZSBpdHNlbGZcclxuICAgICAqL1xyXG4gICAgcHVibGljIGV2dERyYWluZWQ6IFN5bmNFdmVudDxFdmVudFF1ZXVlPiA9IG5ldyBTeW5jRXZlbnQ8RXZlbnRRdWV1ZT4oKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBtb2R1bGUtZ2xvYmFsIGV2ZW50IHF1ZXVlXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc3RhdGljIF9pbnN0YW5jZTogRXZlbnRRdWV1ZTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBtb2R1bGUtZ2xvYmFsIGV2ZW50IHF1ZXVlXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzdGF0aWMgZ2xvYmFsKCk6IEV2ZW50UXVldWUge1xyXG4gICAgICAgIGlmICghRXZlbnRRdWV1ZS5faW5zdGFuY2UpIHtcclxuICAgICAgICAgICAgRXZlbnRRdWV1ZS5yZXNldEdsb2JhbCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gRXZlbnRRdWV1ZS5faW5zdGFuY2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUZXN0aW5nIHB1cnBvc2VzXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzdGF0aWMgcmVzZXRHbG9iYWwoKTogdm9pZCB7XHJcbiAgICAgICAgRXZlbnRRdWV1ZS5faW5zdGFuY2UgPSBuZXcgRXZlbnRRdWV1ZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUXVldWVkIGVsZW1lbnRzXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX3F1ZXVlOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVHJ1ZSB3aGlsZSBmbHVzaCgpIG9yIGZsdXNoT25jZSgpIGlzIHJ1bm5pbmdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfZmx1c2hpbmc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdHJ1ZSBpZmYgdGhlIHF1ZXVlIGlzIGVtcHR5XHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBlbXB0eSgpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fcXVldWUubGVuZ3RoID09PSAwO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkIGFuIGVsZW1lbnQgdG8gdGhlIHF1ZXVlLiBUaGUgaGFuZGxlciBpcyBjYWxsZWQgd2hlbiBvbmUgb2YgdGhlIGZsdXNoXHJcbiAgICAgKiBtZXRob2RzIGlzIGNhbGxlZC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGFkZChoYW5kbGVyOiAoKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5fcXVldWUucHVzaChoYW5kbGVyKTtcclxuICAgICAgICBpZiAodGhpcy5fcXVldWUubGVuZ3RoID09PSAxICYmICF0aGlzLl9mbHVzaGluZykge1xyXG4gICAgICAgICAgICB0aGlzLmV2dEZpbGxlZC5wb3N0KHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGxzIGFsbCBoYW5kbGVycyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlLiBEb2VzIG5vdCBjYWxsIGFueSBoYW5kbGVycyBhZGRlZFxyXG4gICAgICogYXMgYSByZXN1bHQgb2YgdGhlIGZsdXNoXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBmbHVzaE9uY2UoKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgZW1wdHkgPSAodGhpcy5fcXVldWUubGVuZ3RoID09PSAwKTtcclxuICAgICAgICBjb25zdCBmbHVzaGluZyA9IHRoaXMuX2ZsdXNoaW5nO1xyXG4gICAgICAgIHRoaXMuX2ZsdXNoaW5nID0gdHJ1ZTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBxdWV1ZSA9IHRoaXMuX3F1ZXVlO1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZSA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICBxdWV1ZVtpXSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSBmbHVzaGluZztcclxuICAgICAgICAgICAgaWYgKCFlbXB0eSAmJiAhZmx1c2hpbmcgJiYgdGhpcy5fcXVldWUubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmV2dERyYWluZWQucG9zdCh0aGlzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZsdXNoZXMgdGhlIFF1ZXVlZEV2ZW50cywgY2FsbGluZyBhbGwgZXZlbnRzIGN1cnJlbnRseSBpbiB0aGUgcXVldWUgYW5kIHRob3NlXHJcbiAgICAgKiBwdXQgaW50byB0aGUgcXVldWUgYXMgYSByZXN1bHQgb2YgdGhlIGZsdXNoLlxyXG4gICAgICogQHBhcmFtIG1heFJvdW5kcyBPcHRpb25hbCwgZGVmYXVsdCAxMC4gTnVtYmVyIG9mIGl0ZXJhdGlvbnMgYWZ0ZXIgd2hpY2ggdG8gdGhyb3cgYW4gZXJyb3IgYmVjYXVzZVxyXG4gICAgICogICAgICAgICAgICAgICAgICB0aGUgcXVldWUga2VlcHMgZmlsbGluZyB1cC4gU2V0IHRvIG51bGwgdG8gZGlzYWJsZSB0aGlzLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZmx1c2gobWF4Um91bmRzOiBudW1iZXIgPSAxMCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IGVtcHR5ID0gKHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCk7XHJcbiAgICAgICAgY29uc3QgZmx1c2hpbmcgPSB0aGlzLl9mbHVzaGluZztcclxuICAgICAgICB0aGlzLl9mbHVzaGluZyA9IHRydWU7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgbGV0IGkgPSAwO1xyXG4gICAgICAgICAgICB3aGlsZSAodGhpcy5fcXVldWUubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtYXhSb3VuZHMgPT09ICdudW1iZXInICYmIGkgPj0gbWF4Um91bmRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWUgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuYWJsZSB0byBmbHVzaCB0aGUgcXVldWUgZHVlIHRvIHJlY3Vyc2l2ZWx5IGFkZGVkIGV2ZW50LiBDbGVhcmluZyBxdWV1ZSBub3cnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuZmx1c2hPbmNlKCk7XHJcbiAgICAgICAgICAgICAgICArK2k7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICB0aGlzLl9mbHVzaGluZyA9IGZsdXNoaW5nO1xyXG4gICAgICAgICAgICBpZiAoIWVtcHR5ICYmICFmbHVzaGluZyAmJiB0aGlzLl9xdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXZ0RHJhaW5lZC5wb3N0KHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBFdmVudFF1ZXVlO1xyXG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCB7c2hhbGxvd0VxdWFsc30gZnJvbSAnLi9vYmplY3RzJztcclxuXHJcbmltcG9ydCB7QmFzZUV2ZW50LCBQb3N0YWJsZSwgTGlzdGVuZXJ9IGZyb20gJy4vYmFzZS1ldmVudCc7XHJcbmltcG9ydCB7U3luY0V2ZW50fSBmcm9tICcuL3N5bmMtZXZlbnQnO1xyXG5pbXBvcnQge0FzeW5jRXZlbnQsIEFzeW5jRXZlbnRPcHRzfSBmcm9tICcuL2FzeW5jLWV2ZW50JztcclxuaW1wb3J0IHtRdWV1ZWRFdmVudCwgUXVldWVkRXZlbnRPcHRzfSBmcm9tICcuL3F1ZXVlZC1ldmVudCc7XHJcblxyXG5leHBvcnQgZW51bSBFdmVudFR5cGUge1xyXG4gICAgU3luYyxcclxuICAgIEFzeW5jLFxyXG4gICAgUXVldWVkXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQW55RXZlbnRPcHRzIHtcclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIGV2dEZpcnN0QXR0YWNoZWQgYW5kIGV2dExhc3REZXRhY2hlZCBzbyB5b3UgY2FuIG1vbml0b3Igd2hlbiBzb21lb25lIGlzIHN1YnNjcmliZWRcclxuICAgICAqL1xyXG4gICAgbW9uaXRvckF0dGFjaD86IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBbiBldmVudCB0aGF0IGJlaGF2ZXMgbGlrZSBhIFN5bmMvQXN5bmMvUXVldWVkIGV2ZW50IGRlcGVuZGluZyBvbiBob3dcclxuICogeW91IHN1YnNjcmliZS5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBBbnlFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRyaWdnZXJlZCB3aGVuZXZlciBzb21lb25lIGF0dGFjaGVzIGFuZCBub2JvZHkgd2FzIGF0dGFjaGVkLlxyXG4gICAgICogTm90ZTogeW91IG11c3QgY2FsbCB0aGUgY29uc3RydWN0b3Igd2l0aCBtb25pdG9yQXR0YWNoIHNldCB0byB0cnVlIHRvIGNyZWF0ZSB0aGlzIGV2ZW50IVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZXZ0Rmlyc3RBdHRhY2hlZDogVm9pZEFueUV2ZW50O1xyXG4gICAgLyoqXHJcbiAgICAgKiBUcmlnZ2VyZWQgd2hlbmV2ZXIgc29tZW9uZSBkZXRhY2hlcyBhbmQgbm9ib2R5IGlzIGF0dGFjaGVkIGFueW1vcmVcclxuICAgICAqIE5vdGU6IHlvdSBtdXN0IGNhbGwgdGhlIGNvbnN0cnVjdG9yIHdpdGggbW9uaXRvckF0dGFjaCBzZXQgdG8gdHJ1ZSB0byBjcmVhdGUgdGhpcyBldmVudCFcclxuICAgICAqL1xyXG4gICAgcHVibGljIGV2dExhc3REZXRhY2hlZDogVm9pZEFueUV2ZW50O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVW5kZXJseWluZyBldmVudCBpbXBsZW1lbnRhdGlvbnM7IG9uZSBmb3IgZXZlcnkgYXR0YWNoIHR5cGUgKyBvcHRzIGNvbWJpbmF0aW9uXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2V2ZW50czogQmFzZUV2ZW50PFQ+W10gPSBbXTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRzPzogQW55RXZlbnRPcHRzKSB7XHJcbiAgICAgICAgaWYgKG9wdHMgJiYgb3B0cy5tb25pdG9yQXR0YWNoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0Rmlyc3RBdHRhY2hlZCA9IG5ldyBWb2lkQW55RXZlbnQoKTtcclxuICAgICAgICAgICAgdGhpcy5ldnRMYXN0RGV0YWNoZWQgPSBuZXcgVm9pZEFueUV2ZW50KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogTGVnYWN5IG1ldGhvZFxyXG4gICAgICogc2FtZSBhcyBhdHRhY2hTeW5jL2F0dGFjaEFzeW5jL2F0dGFjaFF1ZXVlZDsgYmFzZWQgb24gdGhlIGdpdmVuIGVudW1cclxuICAgICAqIEBwYXJhbSBtb2RlIGRldGVybWluZXMgd2hldGhlciB0byBhdHRhY2ggc3luYy9hc3luYy9xdWV1ZWRcclxuICAgICAqL1xyXG4gICAgcHVibGljIGF0dGFjaChoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2goYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2goZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaChtb2RlOiBFdmVudFR5cGUsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaChtb2RlOiBFdmVudFR5cGUsIGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoKG1vZGU6IEV2ZW50VHlwZSwgZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaCguLi5hcmdzOiBhbnlbXSk6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIGxldCBtb2RlID0gRXZlbnRUeXBlLlN5bmM7XHJcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgbW9kZSA9IGFyZ3Muc2hpZnQoKSBhcyBFdmVudFR5cGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBib3VuZFRvOiBPYmplY3QgPSB0aGlzOyAvLyBhZGQgb3Vyc2VsdmVzIGFzIGRlZmF1bHQgJ2JvdW5kVG8nIGFyZ3VtZW50XHJcbiAgICAgICAgbGV0IGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkO1xyXG4gICAgICAgIGxldCBvcHRzOiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cztcclxuICAgICAgICBsZXQgcG9zdGFibGU6IFBvc3RhYmxlPFQ+O1xyXG4gICAgICAgIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gJ2Z1bmN0aW9uJyB8fCAoYXJnc1swXSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGFyZ3NbMF0ucG9zdCA9PT0gJ2Z1bmN0aW9uJykpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHBvc3RhYmxlID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcHRzID0gYXJnc1sxXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBib3VuZFRvID0gYXJnc1swXTtcclxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMV07XHJcbiAgICAgICAgICAgIG9wdHMgPSBhcmdzWzJdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcy5fYXR0YWNoKG1vZGUsIGJvdW5kVG8sIGhhbmRsZXIsIHBvc3RhYmxlLCBvcHRzLCBmYWxzZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBMZWdhY3kgbWV0aG9kXHJcbiAgICAgKiBzYW1lIGFzIG9uY2VTeW5jL29uY2VBc3luYy9vbmNlUXVldWVkOyBiYXNlZCBvbiB0aGUgZ2l2ZW4gZW51bVxyXG4gICAgICogQHBhcmFtIG1vZGUgZGV0ZXJtaW5lcyB3aGV0aGVyIHRvIG9uY2Ugc3luYy9hc3luYy9xdWV1ZWRcclxuICAgICAqL1xyXG4gICAgcHVibGljIG9uY2UoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZShib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2UoZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2UobW9kZTogRXZlbnRUeXBlLCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBvbmNlKG1vZGU6IEV2ZW50VHlwZSwgYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBvbmNlKG1vZGU6IEV2ZW50VHlwZSwgZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2UoLi4uYXJnczogYW55W10pOiAoKSA9PiB2b2lkIHtcclxuICAgICAgICBsZXQgbW9kZSA9IEV2ZW50VHlwZS5TeW5jO1xyXG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDAgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgIG1vZGUgPSBhcmdzLnNoaWZ0KCkgYXMgRXZlbnRUeXBlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgYm91bmRUbzogT2JqZWN0ID0gdGhpczsgLy8gYWRkIG91cnNlbHZlcyBhcyBkZWZhdWx0ICdib3VuZFRvJyBhcmd1bWVudFxyXG4gICAgICAgIGxldCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZDtcclxuICAgICAgICBsZXQgb3B0czogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHM7XHJcbiAgICAgICAgbGV0IHBvc3RhYmxlOiBQb3N0YWJsZTxUPjtcclxuICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicgfHwgKGFyZ3NbMF0gJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdvYmplY3QnICYmIHR5cGVvZiBhcmdzWzBdLnBvc3QgPT09ICdmdW5jdGlvbicpKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBwb3N0YWJsZSA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3B0cyA9IGFyZ3NbMV07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYm91bmRUbyA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzFdO1xyXG4gICAgICAgICAgICBvcHRzID0gYXJnc1syXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F0dGFjaChtb2RlLCBib3VuZFRvLCBoYW5kbGVyLCBwb3N0YWJsZSwgb3B0cywgdHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfYXR0YWNoKFxyXG4gICAgICAgIG1vZGU6IEV2ZW50VHlwZSxcclxuICAgICAgICBib3VuZFRvOiBPYmplY3QgfCB1bmRlZmluZWQsXHJcbiAgICAgICAgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQgfCB1bmRlZmluZWQsXHJcbiAgICAgICAgcG9zdGFibGU6IFBvc3RhYmxlPFQ+IHwgdW5kZWZpbmVkLFxyXG4gICAgICAgIG9wdHM6IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzIHwgdW5kZWZpbmVkLFxyXG4gICAgICAgIG9uY2U6IGJvb2xlYW5cclxuICAgICk6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHByZXZDb3VudCA9ICghIXRoaXMuZXZ0Rmlyc3RBdHRhY2hlZCA/IHRoaXMubGlzdGVuZXJDb3VudCgpIDogMCk7XHJcbiAgICAgICAgbGV0IGV2ZW50OiBCYXNlRXZlbnQ8VD47XHJcbiAgICAgICAgc3dpdGNoIChtb2RlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLlN5bmM6IHtcclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZXZ0IG9mIHRoaXMuX2V2ZW50cykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChldnQgaW5zdGFuY2VvZiBTeW5jRXZlbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBldnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKCFldmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gbmV3IFN5bmNFdmVudDxUPigpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50cy5wdXNoKGV2ZW50KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBFdmVudFR5cGUuQXN5bmM6IHtcclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZXZ0IG9mIHRoaXMuX2V2ZW50cykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChldnQgaW5zdGFuY2VvZiBBc3luY0V2ZW50ICYmIHNoYWxsb3dFcXVhbHMoKDxBc3luY0V2ZW50PFQ+PmV2dCkub3B0aW9ucywgb3B0cykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBldnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKCFldmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gbmV3IEFzeW5jRXZlbnQ8VD4ob3B0cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzLnB1c2goZXZlbnQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIEV2ZW50VHlwZS5RdWV1ZWQ6IHtcclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZXZ0IG9mIHRoaXMuX2V2ZW50cykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChldnQgaW5zdGFuY2VvZiBRdWV1ZWRFdmVudCAmJiBzaGFsbG93RXF1YWxzKCg8UXVldWVkRXZlbnQ8VD4+ZXZ0KS5vcHRpb25zLCBvcHRzKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9IGV2dDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoIWV2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBuZXcgUXVldWVkRXZlbnQ8VD4ob3B0cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzLnB1c2goZXZlbnQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIEV2ZW50VHlwZScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgZGV0YWNoZXI6ICgpID0+IHZvaWQ7XHJcbiAgICAgICAgaWYgKG9uY2UpIHtcclxuICAgICAgICAgICAgaWYgKHBvc3RhYmxlKSB7XHJcbiAgICAgICAgICAgICAgICBkZXRhY2hlciA9IGV2ZW50Lm9uY2UocG9zdGFibGUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZGV0YWNoZXIgPSBldmVudC5vbmNlKGJvdW5kVG8sIGhhbmRsZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKHBvc3RhYmxlKSB7XHJcbiAgICAgICAgICAgICAgICBkZXRhY2hlciA9IGV2ZW50LmF0dGFjaChwb3N0YWJsZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBkZXRhY2hlciA9IGV2ZW50LmF0dGFjaChib3VuZFRvLCBoYW5kbGVyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5ldnRGaXJzdEF0dGFjaGVkICYmIHByZXZDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLmV2dEZpcnN0QXR0YWNoZWQucG9zdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gKCk6IHZvaWQgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBwcmV2Q291bnQgPSAoISF0aGlzLmV2dExhc3REZXRhY2hlZCA/IHRoaXMubGlzdGVuZXJDb3VudCgpIDogMCk7XHJcbiAgICAgICAgICAgIGRldGFjaGVyKCk7XHJcbiAgICAgICAgICAgIGlmICghIXRoaXMuZXZ0TGFzdERldGFjaGVkICYmIHByZXZDb3VudCA+IDAgJiYgdGhpcy5saXN0ZW5lckNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXZ0TGFzdERldGFjaGVkLnBvc3QoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGF0dGFjaFN5bmMoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaFN5bmMoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoU3luYyhldmVudDogUG9zdGFibGU8VD4pOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaFN5bmMoLi4uYXJnczogYW55W10pOiAoKSA9PiB2b2lkIHtcclxuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLlN5bmMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLmF0dGFjaC5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgb25jZVN5bmMoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2VTeW5jKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2VTeW5jKGV2ZW50OiBQb3N0YWJsZTxUPik6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZVN5bmMoLi4uYXJnczogYW55W10pOiAoKSA9PiB2b2lkIHtcclxuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLlN5bmMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLm9uY2UuYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGF0dGFjaEFzeW5jKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaEFzeW5jKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgYXR0YWNoQXN5bmMoZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogQXN5bmNFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaEFzeW5jKC4uLmFyZ3M6IGFueVtdKTogKCkgPT4gdm9pZCB7XHJcbiAgICAgICAgYXJncy51bnNoaWZ0KEV2ZW50VHlwZS5Bc3luYyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBvbmNlQXN5bmMoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZUFzeW5jKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XHJcbiAgICBwdWJsaWMgb25jZUFzeW5jKGV2ZW50OiBQb3N0YWJsZTxUPiwgb3B0cz86IEFzeW5jRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBvbmNlQXN5bmMoLi4uYXJnczogYW55W10pOiAoKSA9PiB2b2lkIHtcclxuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLkFzeW5jKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5vbmNlLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhdHRhY2hRdWV1ZWQoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIGF0dGFjaFF1ZXVlZChib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2hRdWV1ZWQoZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBhdHRhY2hRdWV1ZWQoLi4uYXJnczogYW55W10pOiAoKSA9PiB2b2lkIHtcclxuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLlF1ZXVlZCk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBvbmNlUXVldWVkKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBvbmNlUXVldWVkKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xyXG4gICAgcHVibGljIG9uY2VRdWV1ZWQoZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcclxuICAgIHB1YmxpYyBvbmNlUXVldWVkKC4uLmFyZ3M6IGFueVtdKTogKCkgPT4gdm9pZCB7XHJcbiAgICAgICAgYXJncy51bnNoaWZ0KEV2ZW50VHlwZS5RdWV1ZWQpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLm9uY2UuYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGRldGFjaChoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgZGV0YWNoKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgcHVibGljIGRldGFjaChib3VuZFRvOiBPYmplY3QpOiB2b2lkO1xyXG4gICAgcHVibGljIGRldGFjaChldmVudDogUG9zdGFibGU8VD4pOiB2b2lkO1xyXG4gICAgcHVibGljIGRldGFjaCgpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggZXZlbnQgaGFuZGxlcnMgcmVnYXJkbGVzcyBvZiB0eXBlXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBkZXRhY2goLi4uYXJnczogYW55W10pOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBwcmV2Q291bnQgPSAoISF0aGlzLmV2dExhc3REZXRhY2hlZCA/IHRoaXMubGlzdGVuZXJDb3VudCgpIDogMCk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9ldmVudHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgdGhpcy5fZXZlbnRzW2ldLmRldGFjaC5hcHBseSh0aGlzLl9ldmVudHNbaV0sIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoISF0aGlzLmV2dExhc3REZXRhY2hlZCAmJiBwcmV2Q291bnQgPiAwICYmIHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZ0TGFzdERldGFjaGVkLnBvc3QoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQb3N0IGFuIGV2ZW50IHRvIGFsbCBjdXJyZW50IGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcG9zdChkYXRhOiBUKTogdm9pZCB7XHJcbiAgICAgICAgLy8gbWFrZSBhIGNvcHkgb2YgdGhlIGFycmF5IGZpcnN0IHRvIGNvdmVyIHRoZSBjYXNlIHdoZXJlIGV2ZW50IGhhbmRsZXJzXHJcbiAgICAgICAgLy8gYXJlIGF0dGFjaGVkIGR1cmluZyB0aGUgcG9zdFxyXG4gICAgICAgIGNvbnN0IGV2ZW50czogQmFzZUV2ZW50PFQ+W10gPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBldmVudHMucHVzaCh0aGlzLl9ldmVudHNbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBldmVudHNbaV0ucG9zdChkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGF0dGFjaGVkIGxpc3RlbmVyc1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgbGlzdGVuZXJDb3VudCgpOiBudW1iZXIge1xyXG4gICAgICAgIGxldCByZXN1bHQgPSAwO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZXZlbnRzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCArPSB0aGlzLl9ldmVudHNbaV0ubGlzdGVuZXJDb3VudCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ29udmVuaWVuY2UgY2xhc3MgZm9yIEFueUV2ZW50cyB3aXRob3V0IGRhdGFcclxuICovXHJcbmV4cG9ydCBjbGFzcyBWb2lkQW55RXZlbnQgZXh0ZW5kcyBBbnlFdmVudDx2b2lkPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZW5kIHRoZSBBc3luY0V2ZW50LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcG9zdCgpOiB2b2lkIHtcclxuICAgICAgICBzdXBlci5wb3N0KHVuZGVmaW5lZCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTaW1pbGFyIHRvICdlcnJvcicgZXZlbnQgb24gRXZlbnRFbWl0dGVyOiB0aHJvd3Mgd2hlbiBhIHBvc3QoKSBvY2N1cnMgd2hpbGUgbm8gaGFuZGxlcnMgc2V0LlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEVycm9yQW55RXZlbnQgZXh0ZW5kcyBBbnlFdmVudDxFcnJvcj4ge1xyXG5cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IEVycm9yKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6ICR7ZGF0YS5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdXBlci5wb3N0KGRhdGEpO1xyXG4gICAgfVxyXG59XHJcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlLCBMaXN0ZW5lcn0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuXHJcbi8qKlxyXG4gKiBPcHRpb25zIGZvciB0aGUgQXN5bmNFdmVudCBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBBc3luY0V2ZW50T3B0cyB7XHJcbiAgICAvKipcclxuICAgICAqIENvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZSB3aGlsZSB0aGUgcHJldmlvdXMgb25lXHJcbiAgICAgKiBoYXMgbm90IGJlZW4gaGFuZGxlZCB5ZXQuXHJcbiAgICAgKi9cclxuICAgIGNvbmRlbnNlZD86IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBLXN5bmNocm9ub3VzIGV2ZW50LiBIYW5kbGVycyBhcmUgY2FsbGVkIGluIHRoZSBuZXh0IE5vZGUuSlMgY3ljbGUuXHJcbiAqIC0gT3B0aW9uYWxseSBjb25kZW5zZXMgbXVsdGlwbGUgcG9zdCgpIGNhbGxzIGludG8gb25lICh0aGUgbGFzdCBwb3N0KCkgZ2V0cyB0aHJvdWdoKVxyXG4gKiAtIEhhbmRsZXJzIGFyZSBjYWxsZWQgb25seSBmb3IgZXZlbnRzIHBvc3RlZCBhZnRlciB0aGV5IHdlcmUgYXR0YWNoZWQuXHJcbiAqIC0gSGFuZGxlcnMgYXJlIG5vdCBjYWxsZWQgYW55bW9yZSB3aGVuIHRoZXkgYXJlIGRldGFjaGVkLCBldmVuIGlmIGEgcG9zdCgpIGlzIGluIHByb2dyZXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQXN5bmNFdmVudDxUPiBleHRlbmRzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFVzZWQgaW50ZXJuYWxseSAtIHRoZSBleGFjdCBvcHRpb25zIG9iamVjdCBnaXZlbiB0byBjb25zdHJ1Y3RvclxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb3B0aW9uczogQXN5bmNFdmVudE9wdHM7XHJcblxyXG4gICAgcHJpdmF0ZSBfY29uZGVuc2VkOiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWVkOiBib29sZWFuID0gZmFsc2U7XHJcbiAgICBwcml2YXRlIF9xdWV1ZWRMaXN0ZW5lcnM6IExpc3RlbmVyPFQ+W107XHJcbiAgICBwcml2YXRlIF9xdWV1ZWREYXRhOiBhbnlbXTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBkZWZhdWx0IHNjaGVkdWxlciB1c2VzIHNldEltbWVkaWF0ZSgpIG9yIHNldFRpbWVvdXQoLi4uLCAwKSBpZiBzZXRJbW1lZGlhdGUgaXMgbm90IGF2YWlsYWJsZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0U2NoZWR1bGVyKGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgICovXHJcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIC8vIGJyb3dzZXJzIGRvbid0IGFsd2F5cyBzdXBwb3J0IHNldEltbWVkaWF0ZSgpXHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIG5vZGUuanNcclxuICAgICAgICAgICAgc2V0SW1tZWRpYXRlKGNhbGxiYWNrKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgY3VycmVudCBzY2hlZHVsZXJcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgX3NjaGVkdWxlcjogKGNhbGxiYWNrOiAoKSA9PiB2b2lkKSA9PiB2b2lkID0gQXN5bmNFdmVudC5kZWZhdWx0U2NoZWR1bGVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQnkgZGVmYXVsdCwgQXN5bmNFdmVudCB1c2VzIHNldEltbWVkaWF0ZSgpIHRvIHNjaGVkdWxlIGV2ZW50IGhhbmRsZXIgaW52b2NhdGlvbi5cclxuICAgICAqIFlvdSBjYW4gY2hhbmdlIHRoaXMgZm9yIGUuZy4gc2V0VGltZW91dCguLi4sIDApIGJ5IGNhbGxpbmcgdGhpcyBzdGF0aWMgbWV0aG9kIG9uY2UuXHJcbiAgICAgKiBAcGFyYW0gc2NoZWR1bGVyIEEgZnVuY3Rpb24gdGhhdCB0YWtlcyBhIGNhbGxiYWNrIGFuZCBleGVjdXRlcyBpdCBpbiB0aGUgbmV4dCBOb2RlLkpTIGN5Y2xlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIHNldFNjaGVkdWxlcihzY2hlZHVsZXI6IChjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4gdm9pZCk6IHZvaWQge1xyXG4gICAgICAgIEFzeW5jRXZlbnQuX3NjaGVkdWxlciA9IHNjaGVkdWxlcjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENvbnN0cnVjdG9yXHJcbiAgICAgKiBAcGFyYW0gb3B0cyBPcHRpb25hbC4gVmFyaW91cyBzZXR0aW5nczpcclxuICAgICAqICAgICAgICAgICAgIC0gY29uZGVuc2VkOiBhIEJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRvIGNvbmRlbnNlIG11bHRpcGxlIHBvc3QoKSBjYWxscyB3aXRoaW4gdGhlIHNhbWUgY3ljbGUuXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG9wdHM/OiBBc3luY0V2ZW50T3B0cykge1xyXG4gICAgICAgIHN1cGVyKCk7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0cztcclxuICAgICAgICBjb25zdCBvcHRpb25zOiBBc3luY0V2ZW50T3B0cyA9IG9wdHMgfHwge307XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmNvbmRlbnNlZCA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IG9wdGlvbnMuY29uZGVuc2VkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuIEhhbmRsZXJzIGFyZSBjYWxsZWQgaW4gdGhlIG5leHQgTm9kZS5KUyBjeWNsZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoZGF0YTogVCk6IHZvaWQ7XHJcbiAgICBwdWJsaWMgcG9zdCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5fY29uZGVuc2VkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZERhdGEgPSBhcmdzO1xyXG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBBc3luY0V2ZW50Ll9zY2hlZHVsZXIoKCk6IHZvaWQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGltbWVkaWF0ZWx5IG1hcmsgbm9uLXF1ZXVlZCB0byBhbGxvdyBuZXcgQXN5bmNFdmVudCB0byBoYXBwZW4gYXMgcmVzdWx0XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gb2YgY2FsbGluZyBoYW5kbGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhY2hlIGxpc3RlbmVycyBhbmQgZGF0YSBiZWNhdXNlIHRoZXkgbWlnaHQgY2hhbmdlIHdoaWxlIGNhbGxpbmcgZXZlbnQgaGFuZGxlcnNcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5fcXVldWVkRGF0YTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnM7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHsgLy8gbm90IGNvbmRlbnNlZFxyXG4gICAgICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgICAgIEFzeW5jRXZlbnQuX3NjaGVkdWxlcigoKTogdm9pZCA9PiB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gaW5oZXJpdGVkXHJcbiAgICBwcm90ZWN0ZWQgX2NhbGwobGlzdGVuZXI6IExpc3RlbmVyPFQ+LCBhcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIC8vIHBlcmZvcm1hbmNlIG9wdGltaXphdGlvbjogZG9uJ3QgdXNlIGNvbnNlY3V0aXZlIG5vZGVqcyBjeWNsZXNcclxuICAgICAgICAvLyBmb3IgYXN5bmNldmVudHMgYXR0YWNoZWQgdG8gYXN5bmNldmVudHNcclxuICAgICAgICBpZiAobGlzdGVuZXIuZXZlbnQgJiYgbGlzdGVuZXIuZXZlbnQgaW5zdGFuY2VvZiBBc3luY0V2ZW50KSB7XHJcbiAgICAgICAgICAgICg8QXN5bmNFdmVudDxUPj5saXN0ZW5lci5ldmVudCkuX3Bvc3REaXJlY3QoYXJncyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgc3VwZXIuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFBlcmZvcm1hbmNlIG9wdGltaXphdGlvbjogaWYgdGhpcyBhc3luYyBzaWduYWwgaXMgYXR0YWNoZWQgdG8gYW5vdGhlclxyXG4gICAgICogYXN5bmMgc2lnbmFsLCB3ZSdyZSBhbHJlYWR5IGEgdGhlIG5leHQgY3ljbGUgYW5kIHdlIGNhbiBjYWxsIGxpc3RlbmVyc1xyXG4gICAgICogZGlyZWN0bHlcclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIF9wb3N0RGlyZWN0KGFyZ3M6IGFueVtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGNvcHkgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGJlY2F1c2UgdGhpcy5fbGlzdGVuZXJzIG1pZ2h0IGJlIHJlcGxhY2VkIGR1cmluZ1xyXG4gICAgICAgIC8vIHRoZSBoYW5kbGVyIGNhbGxzXHJcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgQXN5bmNFdmVudHMgd2l0aG91dCBkYXRhXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVm9pZEFzeW5jRXZlbnQgZXh0ZW5kcyBBc3luY0V2ZW50PHZvaWQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KCk6IHZvaWQge1xyXG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFNpbWlsYXIgdG8gJ2Vycm9yJyBldmVudCBvbiBFdmVudEVtaXR0ZXI6IHRocm93cyB3aGVuIGEgcG9zdCgpIG9jY3VycyB3aGlsZSBubyBoYW5kbGVycyBzZXQuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXJyb3JBc3luY0V2ZW50IGV4dGVuZHMgQXN5bmNFdmVudDxFcnJvcj4ge1xyXG5cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IEVycm9yKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZXJyb3IgZXZlbnQgcG9zdGVkIHdoaWxlIG5vIGxpc3RlbmVycyBhdHRhY2hlZC4gRXJyb3I6ICR7ZGF0YS5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzdXBlci5wb3N0KGRhdGEpO1xyXG4gICAgfVxyXG59XHJcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHsgdGltaW5nU2FmZUVxdWFsIH0gZnJvbSAnY3J5cHRvJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUG9zdGFibGU8VD4ge1xyXG4gICAgcG9zdChkYXRhOiBUKTogdm9pZDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEludGVybmFsIGludGVyZmFjZSBiZXR3ZWVuIEJhc2VFdmVudCBhbmQgaXRzIHN1YmNsYXNzZXNcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgTGlzdGVuZXI8VD4ge1xyXG4gICAgLyoqXHJcbiAgICAgKiBJbmRpY2F0ZXMgdGhhdCB0aGUgbGlzdGVuZXIgd2FzIGRldGFjaGVkXHJcbiAgICAgKi9cclxuICAgIGRlbGV0ZWQ6IGJvb2xlYW47XHJcbiAgICAvKipcclxuICAgICAqIFRoZSBoYW5kbGVyXHJcbiAgICAgKi9cclxuICAgIGhhbmRsZXI/OiAoZGF0YTogVCkgPT4gdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogVGhlIHRoaXMgcG9pbnRlciBmb3IgdGhlIGhhbmRsZXJcclxuICAgICAqL1xyXG4gICAgYm91bmRUbz86IE9iamVjdDtcclxuICAgIC8qKlxyXG4gICAgICogSW5zdGVhZCBvZiBhIGhhbmRsZXIsIGFuIGF0dGFjaGVkIGV2ZW50XHJcbiAgICAgKi9cclxuICAgIGV2ZW50PzogUG9zdGFibGU8VD47XHJcbiAgICAvKipcclxuICAgICAqIFJlbW92ZSBhZnRlciBmaXJzdCBjYWxsP1xyXG4gICAgICovXHJcbiAgICBvbmNlOiBib29sZWFuO1xyXG59XHJcblxyXG4vKipcclxuICogQmFzZSBjbGFzcyBmb3IgZXZlbnRzLlxyXG4gKiBIYW5kbGVzIGF0dGFjaGluZyBhbmQgZGV0YWNoaW5nIGxpc3RlbmVyc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaGVkIGxpc3RlbmVycy4gTk9URTogZG8gbm90IG1vZGlmeS5cclxuICAgICAqIEluc3RlYWQsIHJlcGxhY2Ugd2l0aCBhIG5ldyBhcnJheSB3aXRoIHBvc3NpYmx5IHRoZSBzYW1lIGVsZW1lbnRzLiBUaGlzIGVuc3VyZXNcclxuICAgICAqIHRoYXQgYW55IHJlZmVyZW5jZXMgdG8gdGhlIGFycmF5IGJ5IGV2ZW50cyB0aGF0IGFyZSB1bmRlcndheSByZW1haW4gdGhlIHNhbWUuXHJcbiAgICAgKi9cclxuICAgIHByb3RlY3RlZCBfbGlzdGVuZXJzOiBMaXN0ZW5lcjxUPltdO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBjYWxsLiBUaGUgdGhpcyBhcmd1bWVudCBvZiB0aGUgZnVuY3Rpb24gd2lsbCBiZSB0aGlzIG9iamVjdC5cclxuICAgICAqIEByZXR1cm5zIGZ1bmN0aW9uIHlvdSBjYW4gdXNlIGZvciBkZXRhY2hpbmcgZnJvbSB0aGUgZXZlbnQsIGluc3RlYWQgb2YgY2FsbGluZyBkZXRhY2goKVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSBib3VuZFRvIFRoZSB0aGlzIGFyZ3VtZW50IG9mIHRoZSBoYW5kbGVyXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gdG8gY2FsbC5cclxuICAgICAqIEByZXR1cm5zIGZ1bmN0aW9uIHlvdSBjYW4gdXNlIGZvciBkZXRhY2hpbmcgZnJvbSB0aGUgZXZlbnQsIGluc3RlYWQgb2YgY2FsbGluZyBkZXRhY2goKVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXR0YWNoKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiAoKSA9PiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgZGlyZWN0bHlcclxuICAgICAqIEBwYXJhbSBldmVudCBUaGUgZXZlbnQgdG8gYmUgcG9zdGVkXHJcbiAgICAgKiBAcmV0dXJucyBmdW5jdGlvbiB5b3UgY2FuIHVzZSBmb3IgZGV0YWNoaW5nIGZyb20gdGhlIGV2ZW50LCBpbnN0ZWFkIG9mIGNhbGxpbmcgZGV0YWNoKClcclxuICAgICAqL1xyXG4gICAgcHVibGljIGF0dGFjaChldmVudDogUG9zdGFibGU8VD4pOiAoKSA9PiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBBdHRhY2ggaW1wbGVtZW50YXRpb25cclxuICAgICAqL1xyXG4gICAgcHVibGljIGF0dGFjaChhOiAoKGRhdGE6IFQpID0+IHZvaWQpIHwgT2JqZWN0IHwgUG9zdGFibGU8VD4sIGI/OiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9hdHRhY2goYSwgYiwgZmFsc2UpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGhhbmRsZXIgd2hpY2ggYXV0b21hdGljYWxseSBnZXRzIHJlbW92ZWQgYWZ0ZXIgdGhlIGZpcnN0IGNhbGxcclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBjYWxsLiBUaGUgdGhpcyBhcmd1bWVudCBvZiB0aGUgZnVuY3Rpb24gd2lsbCBiZSB0aGlzIG9iamVjdC5cclxuICAgICAqIEByZXR1cm5zIGZ1bmN0aW9uIHlvdSBjYW4gdXNlIGZvciBkZXRhY2hpbmcgZnJvbSB0aGUgZXZlbnQsIGluc3RlYWQgb2YgY2FsbGluZyBkZXRhY2goKVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb25jZShoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBhbiBldmVudCBoYW5kbGVyIHdoaWNoIGF1dG9tYXRpY2FsbHkgZ2V0cyByZW1vdmVkIGFmdGVyIHRoZSBmaXJzdCBjYWxsXHJcbiAgICAgKiBAcGFyYW0gYm91bmRUbyBUaGUgdGhpcyBhcmd1bWVudCBvZiB0aGUgaGFuZGxlclxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuXHJcbiAgICAgKiBAcmV0dXJucyBmdW5jdGlvbiB5b3UgY2FuIHVzZSBmb3IgZGV0YWNoaW5nIGZyb20gdGhlIGV2ZW50LCBpbnN0ZWFkIG9mIGNhbGxpbmcgZGV0YWNoKClcclxuICAgICAqL1xyXG4gICAgcHVibGljIG9uY2UoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIEF0dGFjaCBhbiBldmVudCBkaXJlY3RseSBhbmQgZGUtYXR0YWNoIGFmdGVyIHRoZSBmaXJzdCBjYWxsXHJcbiAgICAgKiBAcGFyYW0gZXZlbnQgVGhlIGV2ZW50IHRvIGJlIHBvc3RlZFxyXG4gICAgICogQHJldHVybnMgZnVuY3Rpb24geW91IGNhbiB1c2UgZm9yIGRldGFjaGluZyBmcm9tIHRoZSBldmVudCwgaW5zdGVhZCBvZiBjYWxsaW5nIGRldGFjaCgpXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBvbmNlKGV2ZW50OiBQb3N0YWJsZTxUPik6ICgpID0+IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIE9uY2UgaW1wbGVtZW50YXRpb25cclxuICAgICAqL1xyXG4gICAgcHVibGljIG9uY2UoYTogKChkYXRhOiBUKSA9PiB2b2lkKSB8IE9iamVjdCB8IFBvc3RhYmxlPFQ+LCBiPzogKGRhdGE6IFQpID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYXR0YWNoKGEsIGIsIHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXR0YWNoIC8gb25jZSBpbXBsZW1lbnRhdGlvblxyXG4gICAgICogQHBhcmFtIGFcclxuICAgICAqIEBwYXJhbSBiXHJcbiAgICAgKiBAcGFyYW0gb25jZVxyXG4gICAgICogQHJldHVybnMgZnVuY3Rpb24geW91IGNhbiB1c2UgZm9yIGRldGFjaGluZyBmcm9tIHRoZSBldmVudCwgaW5zdGVhZCBvZiBjYWxsaW5nIGRldGFjaCgpXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgX2F0dGFjaChhOiAoKGRhdGE6IFQpID0+IHZvaWQpIHwgT2JqZWN0IHwgUG9zdGFibGU8VD4sIGI6ICgoZGF0YTogVCkgPT4gdm9pZCkgfCB1bmRlZmluZWQsIG9uY2U6IGJvb2xlYW4pOiAoKSA9PiB2b2lkIHtcclxuICAgICAgICBsZXQgYm91bmRUbzogT2JqZWN0O1xyXG4gICAgICAgIGxldCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZDtcclxuICAgICAgICBsZXQgZXZlbnQ6IFBvc3RhYmxlPFQ+O1xyXG4gICAgICAgIGxldCByZXN1bHQ6ICgpID0+IHZvaWQ7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBhID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGhhbmRsZXIgPSBhIGFzICgoZGF0YTogVCkgPT4gdm9pZCk7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9ICgpID0+IHRoaXMuZGV0YWNoKGhhbmRsZXIpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoIWIgJiYgdHlwZW9mIChhIGFzIFBvc3RhYmxlPFQ+KS5wb3N0ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGV2ZW50ID0gYSBhcyBQb3N0YWJsZTxUPjtcclxuICAgICAgICAgICAgcmVzdWx0ID0gKCkgPT4gdGhpcy5kZXRhY2goZXZlbnQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYSAhPT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0IGEgZnVuY3Rpb24gb3Igb2JqZWN0IGFzIGZpcnN0IGFyZ3VtZW50Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBiICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdCBhIGZ1bmN0aW9uIGFzIHNlY29uZCBhcmd1bWVudCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJvdW5kVG8gPSBhO1xyXG4gICAgICAgICAgICBoYW5kbGVyID0gYjtcclxuICAgICAgICAgICAgcmVzdWx0ID0gKCkgPT4gdGhpcy5kZXRhY2goYm91bmRUbywgaGFuZGxlcik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVycyA9IFtdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIG1ha2UgYSBjb3B5IG9mIHRoZSBhcnJheSBzbyBldmVudHMgdGhhdCBhcmUgdW5kZXJ3YXkgaGF2ZSBhIHN0YWJsZSBsb2NhbCBjb3B5XHJcbiAgICAgICAgICAgIC8vIG9mIHRoZSBsaXN0ZW5lcnMgYXJyYXkgYXQgdGhlIHRpbWUgb2YgcG9zdCgpXHJcbiAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycy5zbGljZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9saXN0ZW5lcnMucHVzaCh7XHJcbiAgICAgICAgICAgIGRlbGV0ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICBib3VuZFRvLFxyXG4gICAgICAgICAgICBoYW5kbGVyLFxyXG4gICAgICAgICAgICBldmVudCxcclxuICAgICAgICAgICAgb25jZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggYWxsIGxpc3RlbmVycyB3aXRoIHRoZSBnaXZlbiBoYW5kbGVyIGZ1bmN0aW9uXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBkZXRhY2goaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggYWxsIGxpc3RlbmVycyB3aXRoIHRoZSBnaXZlbiBoYW5kbGVyIGZ1bmN0aW9uIGFuZCBib3VuZFRvIG9iamVjdC5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaChib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogRGV0YWNoIGFsbCBsaXN0ZW5lcnMgdGhhdCB3ZXJlIGF0dGFjaGVkIHdpdGggdGhlIGdpdmVuIGJvdW5kVG8gb2JqZWN0LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZGV0YWNoKGJvdW5kVG86IE9iamVjdCk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIERldGFjaCB0aGUgZ2l2ZW4gZXZlbnQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBkZXRhY2goZXZlbnQ6IFBvc3RhYmxlPFQ+KTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICogRGV0YWNoIGFsbCBsaXN0ZW5lcnNcclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaCgpOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRhY2ggaW1wbGVtZW50YXRpb24uIFNlZSB0aGUgb3ZlcmxvYWRzIGZvciBkZXNjcmlwdGlvbi5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGRldGFjaCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgYm91bmRUbzogT2JqZWN0O1xyXG4gICAgICAgIGxldCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZDtcclxuICAgICAgICBsZXQgZXZlbnQ6IFBvc3RhYmxlPFQ+O1xyXG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA+PSAxKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgKGFyZ3NbMF0pID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXS5wb3N0ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBldmVudCA9IGFyZ3NbMF07XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBib3VuZFRvID0gYXJnc1swXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoYXJncy5sZW5ndGggPj0gMikge1xyXG4gICAgICAgICAgICBoYW5kbGVyID0gYXJnc1sxXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHJlbW92ZSBsaXN0ZW5lcnMgQU5EIG1hcmsgdGhlbSBhcyBkZWxldGVkIHNvIHN1YmNsYXNzZXMgZG9uJ3Qgc2VuZCBhbnkgbW9yZSBldmVudHMgdG8gdGhlbVxyXG4gICAgICAgIHRoaXMuX2xpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycy5maWx0ZXIoKGxpc3RlbmVyOiBMaXN0ZW5lcjxUPik6IGJvb2xlYW4gPT4ge1xyXG4gICAgICAgICAgICBpZiAoKHR5cGVvZiBoYW5kbGVyID09PSAndW5kZWZpbmVkJyB8fCBsaXN0ZW5lci5oYW5kbGVyID09PSBoYW5kbGVyKVxyXG4gICAgICAgICAgICAgICAgJiYgKHR5cGVvZiBldmVudCA9PT0gJ3VuZGVmaW5lZCcgfHwgbGlzdGVuZXIuZXZlbnQgPT09IGV2ZW50KVxyXG4gICAgICAgICAgICAgICAgJiYgKHR5cGVvZiBib3VuZFRvID09PSAndW5kZWZpbmVkJyB8fCBsaXN0ZW5lci5ib3VuZFRvID09PSBib3VuZFRvKSkge1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuZGVsZXRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWJzdHJhY3QgcG9zdCgpIG1ldGhvZCB0byBiZSBhYmxlIHRvIGNvbm5lY3QgYW55IHR5cGUgb2YgZXZlbnQgdG8gYW55IG90aGVyIGRpcmVjdGx5XHJcbiAgICAgKiBAYWJzdHJhY3RcclxuICAgICAqL1xyXG4gICAgcHVibGljIHBvc3QoZGF0YTogVCk6IHZvaWQge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignYWJzdHJhY3QnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBudW1iZXIgb2YgYXR0YWNoZWQgbGlzdGVuZXJzXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBsaXN0ZW5lckNvdW50KCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9saXN0ZW5lcnMgPyB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoIDogMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxsIHRoZSBnaXZlbiBsaXN0ZW5lciwgaWYgaXQgaXMgbm90IG1hcmtlZCBhcyAnZGVsZXRlZCdcclxuICAgICAqIEBwYXJhbSBsaXN0ZW5lciBUaGUgbGlzdGVuZXIgdG8gY2FsbFxyXG4gICAgICogQHBhcmFtIGFyZ3MgVGhlIGFyZ3VtZW50cyB0byB0aGUgaGFuZGxlclxyXG4gICAgICovXHJcbiAgICBwcm90ZWN0ZWQgX2NhbGwobGlzdGVuZXI6IExpc3RlbmVyPFQ+LCBhcmdzOiBhbnlbXSk6IHZvaWQge1xyXG4gICAgICAgIGlmICghbGlzdGVuZXIuZGVsZXRlZCkge1xyXG4gICAgICAgICAgICBpZiAobGlzdGVuZXIub25jZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVycyBBTkQgbWFyayBhcyBkZWxldGVkIHNvIHN1YmNsYXNzZXMgZG9uJ3Qgc2VuZCBhbnkgbW9yZSBldmVudHMgdG8gdGhlbVxyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuZGVsZXRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9saXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMuZmlsdGVyKChsOiBMaXN0ZW5lcjxUPik6IGJvb2xlYW4gPT4gbCAhPT0gbGlzdGVuZXIpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChsaXN0ZW5lci5ldmVudCkge1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuZXZlbnQucG9zdC5hcHBseShsaXN0ZW5lci5ldmVudCwgYXJncyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5oYW5kbGVyLmFwcGx5KCh0eXBlb2YgbGlzdGVuZXIuYm91bmRUbyA9PT0gJ29iamVjdCcgPyBsaXN0ZW5lci5ib3VuZFRvIDogdGhpcyksIGFyZ3MpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxufVxyXG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaGFsbG93RXF1YWxzKGE6IGFueSwgYjogYW55KTogYm9vbGVhbiB7XHJcbiAgICBpZiAoYSA9PT0gYikge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiBhICE9PSB0eXBlb2YgYikge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHN3aXRjaCAodHlwZW9mIGEpIHtcclxuICAgICAgICBjYXNlICdib29sZWFuJzpcclxuICAgICAgICBjYXNlICdudW1iZXInOlxyXG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XHJcbiAgICAgICAgY2FzZSAnZnVuY3Rpb24nOlxyXG4gICAgICAgIGNhc2UgJ3N5bWJvbCc6XHJcbiAgICAgICAgY2FzZSAndW5kZWZpbmVkJzpcclxuICAgICAgICAgICAgLy8gYWxyZWFkeSBkaWQgPT09IGNvbXBhcmVcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNhc2UgJ29iamVjdCc6XHJcbiAgICAgICAgICAgIGlmIChhID09PSBudWxsIHx8IGIgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYWxyZWFkeSBjb21wYXJlZCA9PT1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhKSB8fCBBcnJheS5pc0FycmF5KGIpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoYSkgfHwgIUFycmF5LmlzQXJyYXkoYikpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWVzQTogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICAgICAgY29uc3QgbmFtZXNCOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gYSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGEuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lc0EucHVzaChuYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gYikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGIuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lc0IucHVzaChuYW1lKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBuYW1lc0Euc29ydCgpO1xyXG4gICAgICAgICAgICBuYW1lc0Iuc29ydCgpO1xyXG4gICAgICAgICAgICBpZiAobmFtZXNBLmpvaW4oJywnKSAhPT0gbmFtZXNCLmpvaW4oJywnKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXNBLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYVtuYW1lc0FbaV1dICE9PSBiW25hbWVzQVtpXV0pIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG59XHJcbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XHJcbi8vIExpY2Vuc2U6IElTQ1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlLCBMaXN0ZW5lcn0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuaW1wb3J0IHtkZWZhdWx0IGFzIEV2ZW50UXVldWV9IGZyb20gJy4vRXZlbnRRdWV1ZSc7XHJcblxyXG4vKipcclxuICogT3B0aW9ucyBmb3IgdGhlIFF1ZXVlZEV2ZW50IGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFF1ZXVlZEV2ZW50T3B0cyB7XHJcbiAgICAvKipcclxuICAgICAqIENvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZS5cclxuICAgICAqL1xyXG4gICAgY29uZGVuc2VkPzogYm9vbGVhbjtcclxuICAgIC8qKlxyXG4gICAgICogU3BlY2lmaWMgZXZlbnQgcXVldWUgdG8gdXNlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSBnbG9iYWwgaW5zdGFuY2UgaXMgdXNlZC5cclxuICAgICAqL1xyXG4gICAgcXVldWU/OiBFdmVudFF1ZXVlO1xyXG59XHJcblxyXG4vKipcclxuICogRXZlbnQgdGhhdCBzdGF5cyBpbiBhIHF1ZXVlIHVudGlsIHlvdSBwcm9jZXNzIHRoZSBxdWV1ZS4gQWxsb3dzIGZpbmUtZ3JhaW5lZFxyXG4gKiBjb250cm9sIG92ZXIgd2hlbiBldmVudHMgaGFwcGVuLlxyXG4gKiAtIE9wdGlvbmFsbHkgY29uZGVuc2VzIG11bHRpcGxlIHBvc3QoKSBjYWxscyBpbnRvIG9uZS5cclxuICogLSBIYW5kbGVycyBhcmUgY2FsbGVkIG9ubHkgZm9yIGV2ZW50cyBwb3N0ZWQgYWZ0ZXIgdGhleSB3ZXJlIGF0dGFjaGVkLlxyXG4gKiAtIEhhbmRsZXJzIGFyZSBub3QgY2FsbGVkIGFueW1vcmUgd2hlbiB0aGV5IGFyZSBkZXRhY2hlZCwgZXZlbiBpZiBhIHBvc3QoKSBpcyBpbiBwcm9ncmVzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFF1ZXVlZEV2ZW50PFQ+IGV4dGVuZHMgQmFzZUV2ZW50PFQ+IGltcGxlbWVudHMgUG9zdGFibGU8VD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXNlZCBpbnRlcm5hbGx5IC0gdGhlIGV4YWN0IG9wdGlvbnMgb2JqZWN0IGdpdmVuIHRvIGNvbnN0cnVjdG9yXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBvcHRpb25zOiBRdWV1ZWRFdmVudE9wdHM7XHJcblxyXG4gICAgcHJpdmF0ZSBfY29uZGVuc2VkOiBib29sZWFuO1xyXG4gICAgcHJpdmF0ZSBfcXVldWU6IEV2ZW50UXVldWU7XHJcbiAgICBwcml2YXRlIF9xdWV1ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuICAgIHByaXZhdGUgX3F1ZXVlZExpc3RlbmVyczogTGlzdGVuZXI8VD5bXTtcclxuICAgIHByaXZhdGUgX3F1ZXVlZERhdGE6IGFueVtdO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSBvcHRzIE9wdGlvbmFsLCBhbiBvYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nIG1lbWJlcnM6XHJcbiAgICAgKiAgICAgICAgICAgICAtIGNvbmRlbnNlZDogYSBCb29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0byBjb25kZW5zZSBtdWx0aXBsZSBjYWxscyB0byBwb3N0KCkgaW50byBvbmUgKGRlZmF1bHQgZmFsc2UpXHJcbiAgICAgKiAgICAgICAgICAgICAtIHF1ZXVlOiBhIHNwZWNpZmljIGV2ZW50IHF1ZXVlIHRvIHVzZS4gVGhlIGdsb2JhbCBFdmVudFF1ZXVlIGluc3RhbmNlIGlzIHVzZWQgaWYgbm90IGdpdmVuLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihvcHRzPzogUXVldWVkRXZlbnRPcHRzKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRzO1xyXG4gICAgICAgIGNvbnN0IG9wdGlvbnM6IFF1ZXVlZEV2ZW50T3B0cyA9IG9wdHMgfHwge307XHJcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmNvbmRlbnNlZCA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IG9wdGlvbnMuY29uZGVuc2VkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMucXVldWUgPT09ICdvYmplY3QnICYmIG9wdGlvbnMucXVldWUgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWUgPSBvcHRpb25zLnF1ZXVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogU2VuZCB0aGUgZXZlbnQuIEV2ZW50cyBhcmUgcXVldWVkIGluIHRoZSBldmVudCBxdWV1ZSB1bnRpbCBmbHVzaGVkIG91dC5cclxuICAgICogSWYgdGhlICdjb25kZW5zZWQnIG9wdGlvbiB3YXMgZ2l2ZW4gaW4gdGhlIGNvbnN0cnVjdG9yLCBtdWx0aXBsZSBwb3N0cygpXHJcbiAgICAqIGJldHdlZW4gcXVldWUgZmx1c2hlcyBhcmUgY29uZGVuc2VkIGludG8gb25lIGNhbGwgd2l0aCB0aGUgZGF0YSBmcm9tIHRoZVxyXG4gICAgKiBsYXN0IHBvc3QoKSBjYWxsLlxyXG4gICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IFQpOiB2b2lkO1xyXG4gICAgcHVibGljIHBvc3QoLi4uYXJnczogYW55W10pOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcXVldWUgPSAodGhpcy5fcXVldWUgPyB0aGlzLl9xdWV1ZSA6IEV2ZW50UXVldWUuZ2xvYmFsKCkpO1xyXG4gICAgICAgIGlmICh0aGlzLl9jb25kZW5zZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5fcXVldWVkRGF0YSA9IGFyZ3M7XHJcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZExpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3F1ZXVlZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHF1ZXVlLmFkZCgoKTogdm9pZCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaW1tZWRpYXRlbHkgbWFyayBub24tcXVldWVkIHRvIGFsbG93IG5ldyBBc3luY0V2ZW50IHRvIGhhcHBlbiBhcyByZXN1bHRcclxuICAgICAgICAgICAgICAgICAgICAvLyBvZiBjYWxsaW5nIGhhbmRsZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY2FjaGUgbGlzdGVuZXJzIGFuZCBkYXRhIGJlY2F1c2UgdGhleSBtaWdodCBjaGFuZ2Ugd2hpbGUgY2FsbGluZyBldmVudCBoYW5kbGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9xdWV1ZWREYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX3F1ZXVlZExpc3RlbmVycztcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgeyAvLyBub3QgY29uZGVuc2VkXHJcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcclxuICAgICAgICAgICAgcXVldWUuYWRkKCgpOiB2b2lkID0+IHtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgYXJncyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBldmVudHMgd2l0aG91dCBkYXRhXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVm9pZFF1ZXVlZEV2ZW50IGV4dGVuZHMgUXVldWVkRXZlbnQ8dm9pZD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgZXZlbnQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KCk6IHZvaWQge1xyXG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcclxuICAgIH1cclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTaW1pbGFyIHRvICdlcnJvcicgZXZlbnQgb24gRXZlbnRFbWl0dGVyOiB0aHJvd3Mgd2hlbiBhIHBvc3QoKSBvY2N1cnMgd2hpbGUgbm8gaGFuZGxlcnMgc2V0LlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEVycm9yUXVldWVkRXZlbnQgZXh0ZW5kcyBRdWV1ZWRFdmVudDxFcnJvcj4ge1xyXG5cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IEVycm9yKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGVycm9yIGV2ZW50IHBvc3RlZCB3aGlsZSBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuIEVycm9yOiAke2RhdGEubWVzc2FnZX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3VwZXIucG9zdChkYXRhKTtcclxuICAgIH1cclxufVxyXG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxyXG4vLyBMaWNlbnNlOiBJU0NcclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCB7QmFzZUV2ZW50LCBQb3N0YWJsZX0gZnJvbSAnLi9iYXNlLWV2ZW50JztcclxuXHJcbi8qKlxyXG4gKiBUaGlzIGlzIGEgdHJ1ZSBFdmVudEVtaXR0ZXIgcmVwbGFjZW1lbnQ6IHRoZSBoYW5kbGVycyBhcmUgY2FsbGVkIHN5bmNocm9ub3VzbHkgd2hlblxyXG4gKiB5b3UgcG9zdCB0aGUgZXZlbnQuXHJcbiAqIC0gQWxsb3dzIGJldHRlciBlcnJvciBoYW5kbGluZyBieSBhZ2dyZWdhdGluZyBhbnkgZXJyb3JzIHRocm93biBieSBoYW5kbGVycy5cclxuICogLSBQcmV2ZW50cyBsaXZlbG9jayBieSB0aHJvd2luZyBhbiBlcnJvciB3aGVuIHJlY3Vyc2lvbiBkZXB0aCBpcyBhYm92ZSBhIG1heGltdW0uXHJcbiAqIC0gSGFuZGxlcnMgYXJlIGNhbGxlZCBvbmx5IGZvciBldmVudHMgcG9zdGVkIGFmdGVyIHRoZXkgd2VyZSBhdHRhY2hlZC5cclxuICogLSBIYW5kbGVycyBhcmUgbm90IGNhbGxlZCBhbnltb3JlIHdoZW4gdGhleSBhcmUgZGV0YWNoZWQsIGV2ZW4gaWYgYSBwb3N0KCkgaXMgaW4gcHJvZ3Jlc3NcclxuICovXHJcbmV4cG9ydCBjbGFzcyBTeW5jRXZlbnQ8VD4gZXh0ZW5kcyBCYXNlRXZlbnQ8VD4gaW1wbGVtZW50cyBQb3N0YWJsZTxUPiB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBNYXhpbXVtIG51bWJlciBvZiB0aW1lcyB0aGF0IGFuIGV2ZW50IGhhbmRsZXIgbWF5IGNhdXNlIHRoZSBzYW1lIGV2ZW50XHJcbiAgICAgKiByZWN1cnNpdmVseS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBNQVhfUkVDVVJTSU9OX0RFUFRIOiBudW1iZXIgPSAxMDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlY3Vyc2l2ZSBwb3N0KCkgaW52b2NhdGlvbnNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBfcmVjdXJzaW9uOiBudW1iZXIgPSAwO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgZXZlbnQuIEhhbmRsZXJzIGFyZSBjYWxsZWQgaW1tZWRpYXRlbHkgYW5kIHN5bmNocm9ub3VzbHkuXHJcbiAgICAgKiBJZiBhbiBlcnJvciBpcyB0aHJvd24gYnkgYSBoYW5kbGVyLCB0aGUgcmVtYWluaW5nIGhhbmRsZXJzIGFyZSBzdGlsbCBjYWxsZWQuXHJcbiAgICAgKiBBZnRlcndhcmQsIGFuIEFnZ3JlZ2F0ZUVycm9yIGlzIHRocm93biB3aXRoIHRoZSBvcmlnaW5hbCBlcnJvcihzKSBpbiBpdHMgJ2NhdXNlcycgcHJvcGVydHkuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IFQpOiB2b2lkO1xyXG4gICAgcHVibGljIHBvc3QoLi4uYXJnczogYW55W10pOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fcmVjdXJzaW9uKys7XHJcbiAgICAgICAgaWYgKFN5bmNFdmVudC5NQVhfUkVDVVJTSU9OX0RFUFRIID4gMCAmJlxyXG4gICAgICAgICAgICB0aGlzLl9yZWN1cnNpb24gPiBTeW5jRXZlbnQuTUFYX1JFQ1VSU0lPTl9ERVBUSCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2V2ZW50IGZpcmVkIHJlY3Vyc2l2ZWx5Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGNvcHkgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGJlY2F1c2UgdGhpcy5fbGlzdGVuZXJzIG1pZ2h0IGJlIHJlcGxhY2VkIGR1cmluZ1xyXG4gICAgICAgIC8vIHRoZSBoYW5kbGVyIGNhbGxzXHJcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG4gICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fcmVjdXJzaW9uLS07XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgZXZlbnRzIHdpdGhvdXQgZGF0YVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZvaWRTeW5jRXZlbnQgZXh0ZW5kcyBTeW5jRXZlbnQ8dm9pZD4ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2VuZCB0aGUgZXZlbnQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBwb3N0KCk6IHZvaWQge1xyXG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFNpbWlsYXIgdG8gJ2Vycm9yJyBldmVudCBvbiBFdmVudEVtaXR0ZXI6IHRocm93cyB3aGVuIGEgcG9zdCgpIG9jY3VycyB3aGlsZSBubyBoYW5kbGVycyBzZXQuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXJyb3JTeW5jRXZlbnQgZXh0ZW5kcyBTeW5jRXZlbnQ8RXJyb3I+IHtcclxuXHJcbiAgICBwdWJsaWMgcG9zdChkYXRhOiBFcnJvcik6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLmxpc3RlbmVyQ291bnQoKSA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGVycm9yIGV2ZW50IHBvc3RlZCB3aGlsZSBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuIEVycm9yOiAke2RhdGEubWVzc2FnZX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgc3VwZXIucG9zdChkYXRhKTtcclxuICAgIH1cclxufVxyXG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy9icm93c2VyLmpzJykubmV4dFRpY2s7XG52YXIgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgaW1tZWRpYXRlSWRzID0ge307XG52YXIgbmV4dEltbWVkaWF0ZUlkID0gMDtcblxuLy8gRE9NIEFQSXMsIGZvciBjb21wbGV0ZW5lc3NcblxuZXhwb3J0cy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldFRpbWVvdXQsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJUaW1lb3V0KTtcbn07XG5leHBvcnRzLnNldEludGVydmFsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldEludGVydmFsLCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFySW50ZXJ2YWwpO1xufTtcbmV4cG9ydHMuY2xlYXJUaW1lb3V0ID1cbmV4cG9ydHMuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKHRpbWVvdXQpIHsgdGltZW91dC5jbG9zZSgpOyB9O1xuXG5mdW5jdGlvbiBUaW1lb3V0KGlkLCBjbGVhckZuKSB7XG4gIHRoaXMuX2lkID0gaWQ7XG4gIHRoaXMuX2NsZWFyRm4gPSBjbGVhckZuO1xufVxuVGltZW91dC5wcm90b3R5cGUudW5yZWYgPSBUaW1lb3V0LnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHt9O1xuVGltZW91dC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fY2xlYXJGbi5jYWxsKHdpbmRvdywgdGhpcy5faWQpO1xufTtcblxuLy8gRG9lcyBub3Qgc3RhcnQgdGhlIHRpbWUsIGp1c3Qgc2V0cyB1cCB0aGUgbWVtYmVycyBuZWVkZWQuXG5leHBvcnRzLmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0sIG1zZWNzKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSBtc2Vjcztcbn07XG5cbmV4cG9ydHMudW5lbnJvbGwgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSAtMTtcbn07XG5cbmV4cG9ydHMuX3VucmVmQWN0aXZlID0gZXhwb3J0cy5hY3RpdmUgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcblxuICB2YXIgbXNlY3MgPSBpdGVtLl9pZGxlVGltZW91dDtcbiAgaWYgKG1zZWNzID49IDApIHtcbiAgICBpdGVtLl9pZGxlVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiBvblRpbWVvdXQoKSB7XG4gICAgICBpZiAoaXRlbS5fb25UaW1lb3V0KVxuICAgICAgICBpdGVtLl9vblRpbWVvdXQoKTtcbiAgICB9LCBtc2Vjcyk7XG4gIH1cbn07XG5cbi8vIFRoYXQncyBub3QgaG93IG5vZGUuanMgaW1wbGVtZW50cyBpdCBidXQgdGhlIGV4cG9zZWQgYXBpIGlzIHRoZSBzYW1lLlxuZXhwb3J0cy5zZXRJbW1lZGlhdGUgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBzZXRJbW1lZGlhdGUgOiBmdW5jdGlvbihmbikge1xuICB2YXIgaWQgPSBuZXh0SW1tZWRpYXRlSWQrKztcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHMubGVuZ3RoIDwgMiA/IGZhbHNlIDogc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIGltbWVkaWF0ZUlkc1tpZF0gPSB0cnVlO1xuXG4gIG5leHRUaWNrKGZ1bmN0aW9uIG9uTmV4dFRpY2soKSB7XG4gICAgaWYgKGltbWVkaWF0ZUlkc1tpZF0pIHtcbiAgICAgIC8vIGZuLmNhbGwoKSBpcyBmYXN0ZXIgc28gd2Ugb3B0aW1pemUgZm9yIHRoZSBjb21tb24gdXNlLWNhc2VcbiAgICAgIC8vIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vY2FsbC1hcHBseS1zZWd1XG4gICAgICBpZiAoYXJncykge1xuICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCk7XG4gICAgICB9XG4gICAgICAvLyBQcmV2ZW50IGlkcyBmcm9tIGxlYWtpbmdcbiAgICAgIGV4cG9ydHMuY2xlYXJJbW1lZGlhdGUoaWQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGlkO1xufTtcblxuZXhwb3J0cy5jbGVhckltbWVkaWF0ZSA9IHR5cGVvZiBjbGVhckltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gY2xlYXJJbW1lZGlhdGUgOiBmdW5jdGlvbihpZCkge1xuICBkZWxldGUgaW1tZWRpYXRlSWRzW2lkXTtcbn07IiwiLy8gQ29weXJpZ2h0IMKpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cclxuLy8gTGljZW5zZTogSVNDXHJcblxyXG4ndXNlIHN0cmljdCc7XHJcblxyXG5leHBvcnQgKiBmcm9tICcuL2Jhc2UtZXZlbnQnO1xyXG5leHBvcnQgKiBmcm9tICcuL3N5bmMtZXZlbnQnO1xyXG5leHBvcnQgKiBmcm9tICcuL3F1ZXVlZC1ldmVudCc7XHJcbmV4cG9ydCAqIGZyb20gJy4vYXN5bmMtZXZlbnQnO1xyXG5leHBvcnQgKiBmcm9tICcuL2FueS1ldmVudCc7XHJcblxyXG5pbXBvcnQge2RlZmF1bHQgYXMgRXZlbnRRdWV1ZX0gZnJvbSAnLi9FdmVudFF1ZXVlJztcclxuZXhwb3J0IHtkZWZhdWx0IGFzIEV2ZW50UXVldWV9IGZyb20gJy4vRXZlbnRRdWV1ZSc7XHJcblxyXG4vKipcclxuICogVGhlIGdsb2JhbCBldmVudCBxdWV1ZSBmb3IgUXVldWVkRXZlbnRzXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcXVldWUoKTogRXZlbnRRdWV1ZSB7XHJcbiAgICByZXR1cm4gRXZlbnRRdWV1ZS5nbG9iYWwoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGZ1bmN0aW9uLCBzYW1lIGFzIEV2ZW50UXVldWUuZ2xvYmFsKCkuZmx1c2hPbmNlKCkuXHJcbiAqIEZsdXNoZXMgdGhlIFF1ZXVlZEV2ZW50cywgY2FsbGluZyBhbGwgZXZlbnRzIGN1cnJlbnRseSBpbiB0aGUgcXVldWUgYnV0IG5vdFxyXG4gKiBhbnkgZXZlbnRzIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZmx1c2hPbmNlKCk6IHZvaWQge1xyXG4gICAgRXZlbnRRdWV1ZS5nbG9iYWwoKS5mbHVzaE9uY2UoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlbmllbmNlIGZ1bmN0aW9uLCBzYW1lIGFzIEV2ZW50UXVldWUuZ2xvYmFsKCkuZmx1c2goKS5cclxuICogRmx1c2hlcyB0aGUgUXVldWVkRXZlbnRzLCBjYWxsaW5nIGFsbCBoYW5kbGVycyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlIGFuZCB0aG9zZVxyXG4gKiBwdXQgaW50byB0aGUgcXVldWUgYXMgYSByZXN1bHQgb2YgdGhlIGZsdXNoLlxyXG4gKiBAcGFyYW0gbWF4Um91bmRzIE9wdGlvbmFsLCBkZWZhdWx0IDEwLiBOdW1iZXIgb2YgaXRlcmF0aW9ucyBhZnRlciB3aGljaCB0byB0aHJvdyBhbiBlcnJvciBiZWNhdXNlXHJcbiAqICAgICAgICAgICAgICAgICAgdGhlIHF1ZXVlIGtlZXBzIGZpbGxpbmcgdXAuIFNldCB0byB1bmRlZmluZWQgb3IgbnVsbCB0byBkaXNhYmxlIHRoaXMuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZmx1c2gobWF4Um91bmRzOiBudW1iZXIgPSAxMCk6IHZvaWQge1xyXG4gICAgRXZlbnRRdWV1ZS5nbG9iYWwoKS5mbHVzaChtYXhSb3VuZHMpO1xyXG59XHJcbiJdfQ==
return require('ts-events');
});