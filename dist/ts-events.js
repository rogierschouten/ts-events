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
exports.ErrorAnyEvent = exports.VoidAnyEvent = exports.AnyEvent = exports.EventType = void 0;
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
    Object.defineProperty(AnyEvent.prototype, "evtListenersChanged", {
        /**
         * Sent when someone attaches or detaches
         */
        get: function () {
            if (!this._listenersChanged) {
                // need to delay-load to avoid stack overflow in constructor
                this._listenersChanged = new sync_event_1.VoidSyncEvent();
            }
            return this._listenersChanged;
        },
        enumerable: false,
        configurable: true
    });
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
        if (this.evtListenersChanged && prevCount !== this.listenerCount()) {
            this.evtListenersChanged.post();
        }
        return function () {
            var prevCount = (!!_this.evtLastDetached ? _this.listenerCount() : 0);
            detacher();
            if (!!_this.evtLastDetached && prevCount > 0 && _this.listenerCount() === 0) {
                _this.evtLastDetached.post();
            }
            if (_this.evtListenersChanged && prevCount !== _this.listenerCount()) {
                _this.evtListenersChanged.post();
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
        var prevCount = this.listenerCount();
        for (var i = 0; i < this._events.length; ++i) {
            this._events[i].detach.apply(this._events[i], args);
        }
        if (this.evtListenersChanged && prevCount !== this.listenerCount()) {
            this.evtListenersChanged.post();
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
exports.ErrorAsyncEvent = exports.VoidAsyncEvent = exports.AsyncEvent = void 0;
var base_event_1 = require("./base-event");
var sync_event_1 = require("./sync-event");
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
        if (opts === void 0) { opts = {}; }
        var _this = _super.call(this) || this;
        _this._queued = false;
        _this.options = opts;
        if (typeof opts.condensed === 'boolean') {
            _this._condensed = opts.condensed;
        }
        else {
            _this._condensed = false;
        }
        return _this;
    }
    Object.defineProperty(AsyncEvent.prototype, "evtListenersChanged", {
        /**
         * Sent when someone attaches or detaches
         */
        get: function () {
            if (!this._listenersChanged) {
                // need to delay-load to avoid stack overflow in constructor
                this._listenersChanged = new sync_event_1.VoidSyncEvent();
            }
            return this._listenersChanged;
        },
        enumerable: false,
        configurable: true
    });
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
    /** @inheritdoc */
    AsyncEvent.prototype._attach = function (a, b, once) {
        var _a, _b, _c, _d;
        var count = (_b = (_a = this._listeners) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        var result = _super.prototype._attach.call(this, a, b, once);
        if (this.evtListenersChanged && count !== ((_d = (_c = this._listeners) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0)) {
            this.evtListenersChanged.post();
        }
        return result;
    };
    /** @inheritdoc */
    AsyncEvent.prototype._detach = function () {
        var _a, _b, _c, _d;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var count = (_b = (_a = this._listeners) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        var result = _super.prototype._detach.apply(this, args);
        if (this.evtListenersChanged && count !== ((_d = (_c = this._listeners) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0)) {
            this.evtListenersChanged.post();
        }
        return result;
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

},{"./base-event":4,"./sync-event":7,"timers":9}],4:[function(require,module,exports){
// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseEvent = void 0;
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
            if (typeof a !== 'object' || a === undefined) {
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
        this._detach.apply(this, args);
    };
    /**
     * Detach implementation
     * @param args
     */
    BaseEvent.prototype._detach = function () {
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
        if (!this._listeners) {
            return;
        }
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
            else if (listener.handler) {
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
exports.shallowEquals = void 0;
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
exports.ErrorQueuedEvent = exports.VoidQueuedEvent = exports.QueuedEvent = void 0;
var base_event_1 = require("./base-event");
var EventQueue_1 = require("./EventQueue");
var sync_event_1 = require("./sync-event");
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
        if (opts === void 0) { opts = {}; }
        var _this = _super.call(this) || this;
        _this._queued = false;
        _this.options = opts;
        if (typeof opts.condensed === 'boolean') {
            _this._condensed = opts.condensed;
        }
        else {
            _this._condensed = false;
        }
        if (typeof opts.queue === 'object' && opts.queue !== null) {
            _this._queue = opts.queue;
        }
        return _this;
    }
    Object.defineProperty(QueuedEvent.prototype, "evtListenersChanged", {
        /**
         * Sent when someone attaches or detaches
         */
        get: function () {
            if (!this._listenersChanged) {
                // need to delay-load to avoid stack overflow in constructor
                this._listenersChanged = new sync_event_1.VoidSyncEvent();
            }
            return this._listenersChanged;
        },
        enumerable: false,
        configurable: true
    });
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
    /** @inheritdoc */
    QueuedEvent.prototype._attach = function (a, b, once) {
        var _a, _b, _c, _d;
        var count = (_b = (_a = this._listeners) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        var result = _super.prototype._attach.call(this, a, b, once);
        if (this.evtListenersChanged && count !== ((_d = (_c = this._listeners) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0)) {
            this.evtListenersChanged.post();
        }
        return result;
    };
    /** @inheritdoc */
    QueuedEvent.prototype._detach = function () {
        var _a, _b, _c, _d;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var count = (_b = (_a = this._listeners) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        var result = _super.prototype._detach.apply(this, args);
        if (this.evtListenersChanged && count !== ((_d = (_c = this._listeners) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0)) {
            this.evtListenersChanged.post();
        }
        return result;
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

},{"./EventQueue":1,"./base-event":4,"./sync-event":7}],7:[function(require,module,exports){
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
exports.ErrorSyncEvent = exports.VoidSyncEvent = exports.SyncEvent = void 0;
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
    Object.defineProperty(SyncEvent.prototype, "evtListenersChanged", {
        /**
         * Sent when someone attaches or detaches
         */
        get: function () {
            if (!this._listenersChanged) {
                // need to delay-load to avoid stack overflow in constructor
                this._listenersChanged = new VoidSyncEvent();
            }
            return this._listenersChanged;
        },
        enumerable: false,
        configurable: true
    });
    SyncEvent.prototype.post = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (!this._listeners || this._listeners.length === 0) {
            return;
        }
        this._recursion++;
        if (typeof SyncEvent.MAX_RECURSION_DEPTH === 'number'
            && Number.isInteger(SyncEvent.MAX_RECURSION_DEPTH)
            && SyncEvent.MAX_RECURSION_DEPTH > 0
            && this._recursion > SyncEvent.MAX_RECURSION_DEPTH) {
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
    /** @inheritdoc */
    SyncEvent.prototype._attach = function (a, b, once) {
        var _a, _b, _c, _d;
        var count = (_b = (_a = this._listeners) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        var result = _super.prototype._attach.call(this, a, b, once);
        if (this.evtListenersChanged && count !== ((_d = (_c = this._listeners) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0)) {
            this.evtListenersChanged.post();
        }
        return result;
    };
    /** @inheritdoc */
    SyncEvent.prototype._detach = function () {
        var _a, _b, _c, _d;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var count = (_b = (_a = this._listeners) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        var result = _super.prototype._detach.apply(this, args);
        if (this.evtListenersChanged && count !== ((_d = (_c = this._listeners) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0)) {
            this.evtListenersChanged.post();
        }
        return result;
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flush = exports.flushOnce = exports.queue = void 0;
__exportStar(require("./base-event"), exports);
__exportStar(require("./sync-event"), exports);
__exportStar(require("./queued-event"), exports);
__exportStar(require("./async-event"), exports);
__exportStar(require("./any-event"), exports);
var EventQueue_1 = require("./EventQueue");
var EventQueue_2 = require("./EventQueue");
Object.defineProperty(exports, "EventQueue", { enumerable: true, get: function () { return EventQueue_2.default; } });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbGliL0V2ZW50UXVldWUudHMiLCJzcmMvbGliL2FueS1ldmVudC50cyIsImRpc3QvbGliL3NyYy9saWIvYXN5bmMtZXZlbnQudHMiLCJzcmMvbGliL2Jhc2UtZXZlbnQudHMiLCJzcmMvbGliL29iamVjdHMudHMiLCJzcmMvbGliL3F1ZXVlZC1ldmVudC50cyIsInNyYy9saWIvc3luYy1ldmVudC50cyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvdGltZXJzLWJyb3dzZXJpZnkvbWFpbi5qcyIsInNyYy9saWIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSw2REFBNkQ7QUFDN0QsZUFBZTtBQUVmLFlBQVksQ0FBQzs7QUFFYiwyQ0FBdUM7QUFFdkM7O0dBRUc7QUFDSDtJQUFBO1FBRUk7OztXQUdHO1FBQ0ksY0FBUyxHQUEwQixJQUFJLHNCQUFTLEVBQWMsQ0FBQztRQUN0RTs7O1dBR0c7UUFDSSxlQUFVLEdBQTBCLElBQUksc0JBQVMsRUFBYyxDQUFDO1FBd0J2RTs7V0FFRztRQUNLLFdBQU0sR0FBbUIsRUFBRSxDQUFDO1FBRXBDOztXQUVHO1FBQ0ssY0FBUyxHQUFZLEtBQUssQ0FBQztJQXFFdkMsQ0FBQztJQTlGRzs7T0FFRztJQUNXLGlCQUFNLEdBQXBCO1FBQ0ksSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUU7WUFDdkIsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO1NBQzVCO1FBQ0QsT0FBTyxVQUFVLENBQUMsU0FBUyxDQUFDO0lBQ2hDLENBQUM7SUFFRDs7T0FFRztJQUNXLHNCQUFXLEdBQXpCO1FBQ0ksVUFBVSxDQUFDLFNBQVMsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFZRDs7T0FFRztJQUNJLDBCQUFLLEdBQVo7UUFDSSxPQUFPLElBQUksQ0FBQyxNQUFN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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDM0VBLDZEQUE2RDtBQUM3RCxlQUFlO0FBRWYsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7O0FBRWIsK0NBQTZCO0FBQzdCLCtDQUE2QjtBQUM3QixpREFBK0I7QUFDL0IsZ0RBQThCO0FBQzlCLDhDQUE0QjtBQUU1QiwyQ0FBbUQ7QUFDbkQsMkNBQW1EO0FBQTNDLHdHQUFBLE9BQU8sT0FBYztBQUU3Qjs7R0FFRztBQUNILFNBQWdCLEtBQUs7SUFDakIsT0FBTyxvQkFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQy9CLENBQUM7QUFGRCxzQkFFQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFnQixTQUFTO0lBQ3JCLG9CQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUM7QUFDcEMsQ0FBQztBQUZELDhCQUVDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsS0FBSyxDQUFDLFNBQTZCO0lBQTdCLDBCQUFBLEVBQUEsY0FBNkI7SUFDL0Msb0JBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUZELHNCQUVDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLy8gQ29weXJpZ2h0IMKpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cbi8vIExpY2Vuc2U6IElTQ1xuXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7U3luY0V2ZW50fSBmcm9tICcuL3N5bmMtZXZlbnQnO1xuXG4vKipcbiAqIFNpbXBsZSBzeW5jaHJvbm91cyBldmVudCBxdWV1ZSB0aGF0IG5lZWRzIHRvIGJlIGRyYWluZWQgbWFudWFsbHkuXG4gKi9cbmNsYXNzIEV2ZW50UXVldWUge1xuXG4gICAgLyoqXG4gICAgICogU3luY0V2ZW50IHRyaWdnZXJlZCBhZnRlciBhbiBldmVudCBpcyBhZGRlZCBvdXRzaWRlIG9mIGEgZmx1c2ggb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSBxdWV1ZSBUaGUgZXZlbnQgcXVldWUgaXRzZWxmXG4gICAgICovXG4gICAgcHVibGljIGV2dEZpbGxlZDogU3luY0V2ZW50PEV2ZW50UXVldWU+ID0gbmV3IFN5bmNFdmVudDxFdmVudFF1ZXVlPigpO1xuICAgIC8qKlxuICAgICAqIFN5bmNFdmVudCB0cmlnZ2VyZWQgYWZ0ZXIgdGhlIHF1ZXVlIGlzIGZsdXNoZWQgZW1wdHlcbiAgICAgKiBAcGFyYW0gcXVldWUgVGhlIGV2ZW50IHF1ZXVlIGl0c2VsZlxuICAgICAqL1xuICAgIHB1YmxpYyBldnREcmFpbmVkOiBTeW5jRXZlbnQ8RXZlbnRRdWV1ZT4gPSBuZXcgU3luY0V2ZW50PEV2ZW50UXVldWU+KCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbW9kdWxlLWdsb2JhbCBldmVudCBxdWV1ZVxuICAgICAqL1xuICAgIHByaXZhdGUgc3RhdGljIF9pbnN0YW5jZTogRXZlbnRRdWV1ZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBtb2R1bGUtZ2xvYmFsIGV2ZW50IHF1ZXVlXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBnbG9iYWwoKTogRXZlbnRRdWV1ZSB7XG4gICAgICAgIGlmICghRXZlbnRRdWV1ZS5faW5zdGFuY2UpIHtcbiAgICAgICAgICAgIEV2ZW50UXVldWUucmVzZXRHbG9iYWwoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gRXZlbnRRdWV1ZS5faW5zdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGVzdGluZyBwdXJwb3Nlc1xuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgcmVzZXRHbG9iYWwoKTogdm9pZCB7XG4gICAgICAgIEV2ZW50UXVldWUuX2luc3RhbmNlID0gbmV3IEV2ZW50UXVldWUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWV1ZWQgZWxlbWVudHNcbiAgICAgKi9cbiAgICBwcml2YXRlIF9xdWV1ZTogKCgpID0+IHZvaWQpW10gPSBbXTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgd2hpbGUgZmx1c2goKSBvciBmbHVzaE9uY2UoKSBpcyBydW5uaW5nXG4gICAgICovXG4gICAgcHJpdmF0ZSBfZmx1c2hpbmc6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZmYgdGhlIHF1ZXVlIGlzIGVtcHR5XG4gICAgICovXG4gICAgcHVibGljIGVtcHR5KCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5fcXVldWUubGVuZ3RoID09PSAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZCBhbiBlbGVtZW50IHRvIHRoZSBxdWV1ZS4gVGhlIGhhbmRsZXIgaXMgY2FsbGVkIHdoZW4gb25lIG9mIHRoZSBmbHVzaFxuICAgICAqIG1ldGhvZHMgaXMgY2FsbGVkLlxuICAgICAqL1xuICAgIHB1YmxpYyBhZGQoaGFuZGxlcjogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgICAgICB0aGlzLl9xdWV1ZS5wdXNoKGhhbmRsZXIpO1xuICAgICAgICBpZiAodGhpcy5fcXVldWUubGVuZ3RoID09PSAxICYmICF0aGlzLl9mbHVzaGluZykge1xuICAgICAgICAgICAgdGhpcy5ldnRGaWxsZWQucG9zdCh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxzIGFsbCBoYW5kbGVycyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlLiBEb2VzIG5vdCBjYWxsIGFueSBoYW5kbGVycyBhZGRlZFxuICAgICAqIGFzIGEgcmVzdWx0IG9mIHRoZSBmbHVzaFxuICAgICAqL1xuICAgIHB1YmxpYyBmbHVzaE9uY2UoKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGVtcHR5ID0gKHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCk7XG4gICAgICAgIGNvbnN0IGZsdXNoaW5nID0gdGhpcy5fZmx1c2hpbmc7XG4gICAgICAgIHRoaXMuX2ZsdXNoaW5nID0gdHJ1ZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHF1ZXVlID0gdGhpcy5fcXVldWU7XG4gICAgICAgICAgICB0aGlzLl9xdWV1ZSA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIHF1ZXVlW2ldKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLl9mbHVzaGluZyA9IGZsdXNoaW5nO1xuICAgICAgICAgICAgaWYgKCFlbXB0eSAmJiAhZmx1c2hpbmcgJiYgdGhpcy5fcXVldWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ldnREcmFpbmVkLnBvc3QodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGbHVzaGVzIHRoZSBRdWV1ZWRFdmVudHMsIGNhbGxpbmcgYWxsIGV2ZW50cyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlIGFuZCB0aG9zZVxuICAgICAqIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXG4gICAgICogQHBhcmFtIG1heFJvdW5kcyBPcHRpb25hbCwgZGVmYXVsdCAxMC4gTnVtYmVyIG9mIGl0ZXJhdGlvbnMgYWZ0ZXIgd2hpY2ggdG8gdGhyb3cgYW4gZXJyb3IgYmVjYXVzZVxuICAgICAqICAgICAgICAgICAgICAgICAgdGhlIHF1ZXVlIGtlZXBzIGZpbGxpbmcgdXAuIFNldCB0byBudWxsIHRvIGRpc2FibGUgdGhpcy5cbiAgICAgKi9cbiAgICBwdWJsaWMgZmx1c2gobWF4Um91bmRzOiBudW1iZXIgfCBudWxsID0gMTApOiB2b2lkIHtcbiAgICAgICAgY29uc3QgZW1wdHkgPSAodGhpcy5fcXVldWUubGVuZ3RoID09PSAwKTtcbiAgICAgICAgY29uc3QgZmx1c2hpbmcgPSB0aGlzLl9mbHVzaGluZztcbiAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSB0cnVlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICAgICAgd2hpbGUgKHRoaXMuX3F1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1heFJvdW5kcyA9PT0gJ251bWJlcicgJiYgaSA+PSBtYXhSb3VuZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWUgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmFibGUgdG8gZmx1c2ggdGhlIHF1ZXVlIGR1ZSB0byByZWN1cnNpdmVseSBhZGRlZCBldmVudC4gQ2xlYXJpbmcgcXVldWUgbm93Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuZmx1c2hPbmNlKCk7XG4gICAgICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdGhpcy5fZmx1c2hpbmcgPSBmbHVzaGluZztcbiAgICAgICAgICAgIGlmICghZW1wdHkgJiYgIWZsdXNoaW5nICYmIHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXZ0RHJhaW5lZC5wb3N0KHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFdmVudFF1ZXVlO1xuIiwiLy8gQ29weXJpZ2h0IMKpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cbi8vIExpY2Vuc2U6IElTQ1xuXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7c2hhbGxvd0VxdWFsc30gZnJvbSAnLi9vYmplY3RzJztcblxuaW1wb3J0IHtCYXNlRXZlbnQsIFBvc3RhYmxlfSBmcm9tICcuL2Jhc2UtZXZlbnQnO1xuaW1wb3J0IHtTeW5jRXZlbnQsIFZvaWRTeW5jRXZlbnR9IGZyb20gJy4vc3luYy1ldmVudCc7XG5pbXBvcnQge0FzeW5jRXZlbnQsIEFzeW5jRXZlbnRPcHRzfSBmcm9tICcuL2FzeW5jLWV2ZW50JztcbmltcG9ydCB7UXVldWVkRXZlbnQsIFF1ZXVlZEV2ZW50T3B0c30gZnJvbSAnLi9xdWV1ZWQtZXZlbnQnO1xuXG5leHBvcnQgZW51bSBFdmVudFR5cGUge1xuICAgIFN5bmMsXG4gICAgQXN5bmMsXG4gICAgUXVldWVkXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQW55RXZlbnRPcHRzIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgZXZ0Rmlyc3RBdHRhY2hlZCBhbmQgZXZ0TGFzdERldGFjaGVkIHNvIHlvdSBjYW4gbW9uaXRvciB3aGVuIHNvbWVvbmUgaXMgc3Vic2NyaWJlZFxuICAgICAqL1xuICAgIG1vbml0b3JBdHRhY2g/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEFuIGV2ZW50IHRoYXQgYmVoYXZlcyBsaWtlIGEgU3luYy9Bc3luYy9RdWV1ZWQgZXZlbnQgZGVwZW5kaW5nIG9uIGhvd1xuICogeW91IHN1YnNjcmliZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEFueUV2ZW50PFQ+IGltcGxlbWVudHMgUG9zdGFibGU8VD4ge1xuICAgIC8qKlxuICAgICAqIFNlbnQgd2hlbiBzb21lb25lIGF0dGFjaGVzIG9yIGRldGFjaGVzXG4gICAgICovXG4gICAgcHVibGljIGdldCBldnRMaXN0ZW5lcnNDaGFuZ2VkKCk6IFZvaWRTeW5jRXZlbnQge1xuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVyc0NoYW5nZWQpIHtcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gZGVsYXktbG9hZCB0byBhdm9pZCBzdGFjayBvdmVyZmxvdyBpbiBjb25zdHJ1Y3RvclxuICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzQ2hhbmdlZCA9IG5ldyBWb2lkU3luY0V2ZW50KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpc3RlbmVyc0NoYW5nZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXZlbnQgZm9yIGxpc3RlbmluZyB0byBsaXN0ZW5lciBjb3VudFxuICAgICAqL1xuICAgIHByaXZhdGUgX2xpc3RlbmVyc0NoYW5nZWQ/OiBWb2lkU3luY0V2ZW50O1xuXG4gICAgLyoqXG4gICAgICogVHJpZ2dlcmVkIHdoZW5ldmVyIHNvbWVvbmUgYXR0YWNoZXMgYW5kIG5vYm9keSB3YXMgYXR0YWNoZWQuXG4gICAgICogTm90ZTogeW91IG11c3QgY2FsbCB0aGUgY29uc3RydWN0b3Igd2l0aCBtb25pdG9yQXR0YWNoIHNldCB0byB0cnVlIHRvIGNyZWF0ZSB0aGlzIGV2ZW50IVxuICAgICAqL1xuICAgIHB1YmxpYyBldnRGaXJzdEF0dGFjaGVkOiBWb2lkQW55RXZlbnQ7XG4gICAgLyoqXG4gICAgICogVHJpZ2dlcmVkIHdoZW5ldmVyIHNvbWVvbmUgZGV0YWNoZXMgYW5kIG5vYm9keSBpcyBhdHRhY2hlZCBhbnltb3JlXG4gICAgICogTm90ZTogeW91IG11c3QgY2FsbCB0aGUgY29uc3RydWN0b3Igd2l0aCBtb25pdG9yQXR0YWNoIHNldCB0byB0cnVlIHRvIGNyZWF0ZSB0aGlzIGV2ZW50IVxuICAgICAqL1xuICAgIHB1YmxpYyBldnRMYXN0RGV0YWNoZWQ6IFZvaWRBbnlFdmVudDtcblxuICAgIC8qKlxuICAgICAqIFVuZGVybHlpbmcgZXZlbnQgaW1wbGVtZW50YXRpb25zOyBvbmUgZm9yIGV2ZXJ5IGF0dGFjaCB0eXBlICsgb3B0cyBjb21iaW5hdGlvblxuICAgICAqL1xuICAgIHByaXZhdGUgX2V2ZW50czogQmFzZUV2ZW50PFQ+W10gPSBbXTtcblxuICAgIGNvbnN0cnVjdG9yKG9wdHM/OiBBbnlFdmVudE9wdHMpIHtcbiAgICAgICAgaWYgKG9wdHMgJiYgb3B0cy5tb25pdG9yQXR0YWNoKSB7XG4gICAgICAgICAgICB0aGlzLmV2dEZpcnN0QXR0YWNoZWQgPSBuZXcgVm9pZEFueUV2ZW50KCk7XG4gICAgICAgICAgICB0aGlzLmV2dExhc3REZXRhY2hlZCA9IG5ldyBWb2lkQW55RXZlbnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExlZ2FjeSBtZXRob2RcbiAgICAgKiBzYW1lIGFzIGF0dGFjaFN5bmMvYXR0YWNoQXN5bmMvYXR0YWNoUXVldWVkOyBiYXNlZCBvbiB0aGUgZ2l2ZW4gZW51bVxuICAgICAqIEBwYXJhbSBtb2RlIGRldGVybWluZXMgd2hldGhlciB0byBhdHRhY2ggc3luYy9hc3luYy9xdWV1ZWRcbiAgICAgKi9cbiAgICBwdWJsaWMgYXR0YWNoKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xuICAgIHB1YmxpYyBhdHRhY2goYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgYXR0YWNoKGV2ZW50OiBQb3N0YWJsZTxUPiwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgYXR0YWNoKG1vZGU6IEV2ZW50VHlwZSwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIGF0dGFjaChtb2RlOiBFdmVudFR5cGUsIGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIGF0dGFjaChtb2RlOiBFdmVudFR5cGUsIGV2ZW50OiBQb3N0YWJsZTxUPiwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgYXR0YWNoKC4uLmFyZ3M6IGFueVtdKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIGxldCBtb2RlID0gRXZlbnRUeXBlLlN5bmM7XG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDAgJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBtb2RlID0gYXJncy5zaGlmdCgpIGFzIEV2ZW50VHlwZTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgYm91bmRUbzogT2JqZWN0ID0gdGhpczsgLy8gYWRkIG91cnNlbHZlcyBhcyBkZWZhdWx0ICdib3VuZFRvJyBhcmd1bWVudFxuICAgICAgICBsZXQgaGFuZGxlcjogKChkYXRhOiBUKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IG9wdHM6IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzO1xuICAgICAgICBsZXQgcG9zdGFibGU6IFBvc3RhYmxlPFQ+IHwgdW5kZWZpbmVkO1xuICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicgfHwgKGFyZ3NbMF0gJiYgdHlwZW9mIGFyZ3NbMF0gPT09ICdvYmplY3QnICYmIHR5cGVvZiBhcmdzWzBdLnBvc3QgPT09ICdmdW5jdGlvbicpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcG9zdGFibGUgPSBhcmdzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgb3B0cyA9IGFyZ3NbMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBib3VuZFRvID0gYXJnc1swXTtcbiAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzFdO1xuICAgICAgICAgICAgb3B0cyA9IGFyZ3NbMl07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2F0dGFjaChtb2RlLCBib3VuZFRvLCBoYW5kbGVyLCBwb3N0YWJsZSwgb3B0cywgZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExlZ2FjeSBtZXRob2RcbiAgICAgKiBzYW1lIGFzIG9uY2VTeW5jL29uY2VBc3luYy9vbmNlUXVldWVkOyBiYXNlZCBvbiB0aGUgZ2l2ZW4gZW51bVxuICAgICAqIEBwYXJhbSBtb2RlIGRldGVybWluZXMgd2hldGhlciB0byBvbmNlIHN5bmMvYXN5bmMvcXVldWVkXG4gICAgICovXG4gICAgcHVibGljIG9uY2UoaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIG9uY2UoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgb25jZShldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIG9uY2UobW9kZTogRXZlbnRUeXBlLCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgb25jZShtb2RlOiBFdmVudFR5cGUsIGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIG9uY2UobW9kZTogRXZlbnRUeXBlLCBldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyB8IFF1ZXVlZEV2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIG9uY2UoLi4uYXJnczogYW55W10pOiAoKSA9PiB2b2lkIHtcbiAgICAgICAgbGV0IG1vZGUgPSBFdmVudFR5cGUuU3luYztcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIG1vZGUgPSBhcmdzLnNoaWZ0KCkgYXMgRXZlbnRUeXBlO1xuICAgICAgICB9XG4gICAgICAgIGxldCBib3VuZFRvOiBvYmplY3QgPSB0aGlzOyAvLyBhZGQgb3Vyc2VsdmVzIGFzIGRlZmF1bHQgJ2JvdW5kVG8nIGFyZ3VtZW50XG4gICAgICAgIGxldCBoYW5kbGVyOiAoKGRhdGE6IFQpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuICAgICAgICBsZXQgb3B0czogQXN5bmNFdmVudE9wdHMgfCBRdWV1ZWRFdmVudE9wdHM7XG4gICAgICAgIGxldCBwb3N0YWJsZTogUG9zdGFibGU8VD4gfCB1bmRlZmluZWQ7XG4gICAgICAgIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gJ2Z1bmN0aW9uJyB8fCAoYXJnc1swXSAmJiB0eXBlb2YgYXJnc1swXSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGFyZ3NbMF0ucG9zdCA9PT0gJ2Z1bmN0aW9uJykpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzBdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwb3N0YWJsZSA9IGFyZ3NbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvcHRzID0gYXJnc1sxXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJvdW5kVG8gPSBhcmdzWzBdO1xuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMV07XG4gICAgICAgICAgICBvcHRzID0gYXJnc1syXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYXR0YWNoKG1vZGUsIGJvdW5kVG8sIGhhbmRsZXIsIHBvc3RhYmxlLCBvcHRzLCB0cnVlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIF9hdHRhY2goXG4gICAgICAgIG1vZGU6IEV2ZW50VHlwZSxcbiAgICAgICAgYm91bmRUbzogT2JqZWN0IHwgdW5kZWZpbmVkLFxuICAgICAgICBoYW5kbGVyOiAoKGRhdGE6IFQpID0+IHZvaWQpIHwgdW5kZWZpbmVkLFxuICAgICAgICBwb3N0YWJsZTogUG9zdGFibGU8VD4gfCB1bmRlZmluZWQsXG4gICAgICAgIG9wdHM6IEFzeW5jRXZlbnRPcHRzIHwgUXVldWVkRXZlbnRPcHRzIHwgdW5kZWZpbmVkLFxuICAgICAgICBvbmNlOiBib29sZWFuXG4gICAgKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIGNvbnN0IHByZXZDb3VudCA9ICghIXRoaXMuZXZ0Rmlyc3RBdHRhY2hlZCA/IHRoaXMubGlzdGVuZXJDb3VudCgpIDogMCk7XG4gICAgICAgIGxldCBldmVudDogQmFzZUV2ZW50PFQ+IHwgdW5kZWZpbmVkO1xuICAgICAgICBzd2l0Y2ggKG1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLlN5bmM6IHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGV2dCBvZiB0aGlzLl9ldmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV2dCBpbnN0YW5jZW9mIFN5bmNFdmVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBldnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFldmVudCkge1xuICAgICAgICAgICAgICAgICAgICBldmVudCA9IG5ldyBTeW5jRXZlbnQ8VD4oKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzLnB1c2goZXZlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEV2ZW50VHlwZS5Bc3luYzoge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZXZ0IG9mIHRoaXMuX2V2ZW50cykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXZ0IGluc3RhbmNlb2YgQXN5bmNFdmVudCAmJiBzaGFsbG93RXF1YWxzKCg8QXN5bmNFdmVudDxUPj5ldnQpLm9wdGlvbnMsIG9wdHMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9IGV2dDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50ID0gbmV3IEFzeW5jRXZlbnQ8VD4ob3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50cy5wdXNoKGV2ZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBFdmVudFR5cGUuUXVldWVkOiB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBldnQgb2YgdGhpcy5fZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChldnQgaW5zdGFuY2VvZiBRdWV1ZWRFdmVudCAmJiBzaGFsbG93RXF1YWxzKCg8UXVldWVkRXZlbnQ8VD4+ZXZ0KS5vcHRpb25zLCBvcHRzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBldnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFldmVudCkge1xuICAgICAgICAgICAgICAgICAgICBldmVudCA9IG5ldyBRdWV1ZWRFdmVudDxUPihvcHRzKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzLnB1c2goZXZlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigndW5rbm93biBFdmVudFR5cGUnKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgZGV0YWNoZXI6ICgpID0+IHZvaWQ7XG4gICAgICAgIGlmIChvbmNlKSB7XG4gICAgICAgICAgICBpZiAocG9zdGFibGUpIHtcbiAgICAgICAgICAgICAgICBkZXRhY2hlciA9IGV2ZW50Lm9uY2UocG9zdGFibGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZXRhY2hlciA9IGV2ZW50Lm9uY2UoYm91bmRUbyEsIGhhbmRsZXIhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChwb3N0YWJsZSkge1xuICAgICAgICAgICAgICAgIGRldGFjaGVyID0gZXZlbnQuYXR0YWNoKHBvc3RhYmxlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGV0YWNoZXIgPSBldmVudC5hdHRhY2goYm91bmRUbyEsIGhhbmRsZXIhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5ldnRGaXJzdEF0dGFjaGVkICYmIHByZXZDb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldnRGaXJzdEF0dGFjaGVkLnBvc3QoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5ldnRMaXN0ZW5lcnNDaGFuZ2VkICYmIHByZXZDb3VudCAhPT0gdGhpcy5saXN0ZW5lckNvdW50KCkpIHtcbiAgICAgICAgICAgIHRoaXMuZXZ0TGlzdGVuZXJzQ2hhbmdlZC5wb3N0KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICgpOiB2b2lkID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHByZXZDb3VudCA9ICghIXRoaXMuZXZ0TGFzdERldGFjaGVkID8gdGhpcy5saXN0ZW5lckNvdW50KCkgOiAwKTtcbiAgICAgICAgICAgIGRldGFjaGVyKCk7XG4gICAgICAgICAgICBpZiAoISF0aGlzLmV2dExhc3REZXRhY2hlZCAmJiBwcmV2Q291bnQgPiAwICYmIHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ldnRMYXN0RGV0YWNoZWQucG9zdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuZXZ0TGlzdGVuZXJzQ2hhbmdlZCAmJiBwcmV2Q291bnQgIT09IHRoaXMubGlzdGVuZXJDb3VudCgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ldnRMaXN0ZW5lcnNDaGFuZ2VkLnBvc3QoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXR0YWNoU3luYyhoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIGF0dGFjaFN5bmMoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIGF0dGFjaFN5bmMoZXZlbnQ6IFBvc3RhYmxlPFQ+KTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgYXR0YWNoU3luYyguLi5hcmdzOiBhbnlbXSk6ICgpID0+IHZvaWQge1xuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLlN5bmMpO1xuICAgICAgICByZXR1cm4gdGhpcy5hdHRhY2guYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuXG4gICAgcHVibGljIG9uY2VTeW5jKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgb25jZVN5bmMoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIG9uY2VTeW5jKGV2ZW50OiBQb3N0YWJsZTxUPik6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIG9uY2VTeW5jKC4uLmFyZ3M6IGFueVtdKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuU3luYyk7XG4gICAgICAgIHJldHVybiB0aGlzLm9uY2UuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuXG4gICAgcHVibGljIGF0dGFjaEFzeW5jKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xuICAgIHB1YmxpYyBhdHRhY2hBc3luYyhib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogQXN5bmNFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xuICAgIHB1YmxpYyBhdHRhY2hBc3luYyhldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIGF0dGFjaEFzeW5jKC4uLmFyZ3M6IGFueVtdKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuQXN5bmMpO1xuICAgICAgICByZXR1cm4gdGhpcy5hdHRhY2guYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuXG4gICAgcHVibGljIG9uY2VBc3luYyhoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCwgb3B0cz86IEFzeW5jRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgb25jZUFzeW5jKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIG9uY2VBc3luYyhldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBBc3luY0V2ZW50T3B0cyk6ICgpID0+IHZvaWQ7XG4gICAgcHVibGljIG9uY2VBc3luYyguLi5hcmdzOiBhbnlbXSk6ICgpID0+IHZvaWQge1xuICAgICAgICBhcmdzLnVuc2hpZnQoRXZlbnRUeXBlLkFzeW5jKTtcbiAgICAgICAgcmV0dXJuIHRoaXMub25jZS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXR0YWNoUXVldWVkKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgYXR0YWNoUXVldWVkKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQsIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xuICAgIHB1YmxpYyBhdHRhY2hRdWV1ZWQoZXZlbnQ6IFBvc3RhYmxlPFQ+LCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgYXR0YWNoUXVldWVkKC4uLmFyZ3M6IGFueVtdKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuUXVldWVkKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cblxuICAgIHB1YmxpYyBvbmNlUXVldWVkKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgb25jZVF1ZXVlZChib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkLCBvcHRzPzogUXVldWVkRXZlbnRPcHRzKTogKCkgPT4gdm9pZDtcbiAgICBwdWJsaWMgb25jZVF1ZXVlZChldmVudDogUG9zdGFibGU8VD4sIG9wdHM/OiBRdWV1ZWRFdmVudE9wdHMpOiAoKSA9PiB2b2lkO1xuICAgIHB1YmxpYyBvbmNlUXVldWVkKC4uLmFyZ3M6IGFueVtdKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIGFyZ3MudW5zaGlmdChFdmVudFR5cGUuUXVldWVkKTtcbiAgICAgICAgcmV0dXJuIHRoaXMub25jZS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZGV0YWNoKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogdm9pZDtcbiAgICBwdWJsaWMgZGV0YWNoKGJvdW5kVG86IE9iamVjdCwgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xuICAgIHB1YmxpYyBkZXRhY2goYm91bmRUbzogT2JqZWN0KTogdm9pZDtcbiAgICBwdWJsaWMgZGV0YWNoKGV2ZW50OiBQb3N0YWJsZTxUPik6IHZvaWQ7XG4gICAgcHVibGljIGRldGFjaCgpOiB2b2lkO1xuICAgIC8qKlxuICAgICAqIERldGFjaCBldmVudCBoYW5kbGVycyByZWdhcmRsZXNzIG9mIHR5cGVcbiAgICAgKi9cbiAgICBwdWJsaWMgZGV0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHByZXZDb3VudCA9IHRoaXMubGlzdGVuZXJDb3VudCgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRzW2ldLmRldGFjaC5hcHBseSh0aGlzLl9ldmVudHNbaV0sIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmV2dExpc3RlbmVyc0NoYW5nZWQgJiYgcHJldkNvdW50ICE9PSB0aGlzLmxpc3RlbmVyQ291bnQoKSkge1xuICAgICAgICAgICAgdGhpcy5ldnRMaXN0ZW5lcnNDaGFuZ2VkLnBvc3QoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoISF0aGlzLmV2dExhc3REZXRhY2hlZCAmJiBwcmV2Q291bnQgPiAwICYmIHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2dExhc3REZXRhY2hlZC5wb3N0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQb3N0IGFuIGV2ZW50IHRvIGFsbCBjdXJyZW50IGxpc3RlbmVyc1xuICAgICAqL1xuICAgIHB1YmxpYyBwb3N0KGRhdGE6IFQpOiB2b2lkIHtcbiAgICAgICAgLy8gbWFrZSBhIGNvcHkgb2YgdGhlIGFycmF5IGZpcnN0IHRvIGNvdmVyIHRoZSBjYXNlIHdoZXJlIGV2ZW50IGhhbmRsZXJzXG4gICAgICAgIC8vIGFyZSBhdHRhY2hlZCBkdXJpbmcgdGhlIHBvc3RcbiAgICAgICAgY29uc3QgZXZlbnRzOiBCYXNlRXZlbnQ8VD5bXSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgZXZlbnRzLnB1c2godGhpcy5fZXZlbnRzW2ldKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgZXZlbnRzW2ldLnBvc3QoZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGF0dGFjaGVkIGxpc3RlbmVyc1xuICAgICAqL1xuICAgIHB1YmxpYyBsaXN0ZW5lckNvdW50KCk6IG51bWJlciB7XG4gICAgICAgIGxldCByZXN1bHQgPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2V2ZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IHRoaXMuX2V2ZW50c1tpXS5saXN0ZW5lckNvdW50KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5cbi8qKlxuICogQ29udmVuaWVuY2UgY2xhc3MgZm9yIEFueUV2ZW50cyB3aXRob3V0IGRhdGFcbiAqL1xuZXhwb3J0IGNsYXNzIFZvaWRBbnlFdmVudCBleHRlbmRzIEFueUV2ZW50PHZvaWQ+IHtcblxuICAgIC8qKlxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuXG4gICAgICovXG4gICAgcHVibGljIHBvc3QoKTogdm9pZCB7XG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcbiAgICB9XG59XG5cbi8qKlxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cbiAqL1xuZXhwb3J0IGNsYXNzIEVycm9yQW55RXZlbnQgZXh0ZW5kcyBBbnlFdmVudDxFcnJvcj4ge1xuXG4gICAgcHVibGljIHBvc3QoZGF0YTogRXJyb3IpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGVycm9yIGV2ZW50IHBvc3RlZCB3aGlsZSBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuIEVycm9yOiAke2RhdGEubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBzdXBlci5wb3N0KGRhdGEpO1xuICAgIH1cbn1cbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XG4vLyBMaWNlbnNlOiBJU0NcblxuJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0Jhc2VFdmVudCwgUG9zdGFibGUsIExpc3RlbmVyfSBmcm9tICcuL2Jhc2UtZXZlbnQnO1xuaW1wb3J0IHtWb2lkU3luY0V2ZW50fSBmcm9tICcuL3N5bmMtZXZlbnQnO1xuXG4vKipcbiAqIE9wdGlvbnMgZm9yIHRoZSBBc3luY0V2ZW50IGNvbnN0cnVjdG9yXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXN5bmNFdmVudE9wdHMge1xuICAgIC8qKlxuICAgICAqIENvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZSB3aGlsZSB0aGUgcHJldmlvdXMgb25lXG4gICAgICogaGFzIG5vdCBiZWVuIGhhbmRsZWQgeWV0LlxuICAgICAqL1xuICAgIGNvbmRlbnNlZD86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQS1zeW5jaHJvbm91cyBldmVudC4gSGFuZGxlcnMgYXJlIGNhbGxlZCBpbiB0aGUgbmV4dCBOb2RlLkpTIGN5Y2xlLlxuICogLSBPcHRpb25hbGx5IGNvbmRlbnNlcyBtdWx0aXBsZSBwb3N0KCkgY2FsbHMgaW50byBvbmUgKHRoZSBsYXN0IHBvc3QoKSBnZXRzIHRocm91Z2gpXG4gKiAtIEhhbmRsZXJzIGFyZSBjYWxsZWQgb25seSBmb3IgZXZlbnRzIHBvc3RlZCBhZnRlciB0aGV5IHdlcmUgYXR0YWNoZWQuXG4gKiAtIEhhbmRsZXJzIGFyZSBub3QgY2FsbGVkIGFueW1vcmUgd2hlbiB0aGV5IGFyZSBkZXRhY2hlZCwgZXZlbiBpZiBhIHBvc3QoKSBpcyBpbiBwcm9ncmVzc1xuICovXG5leHBvcnQgY2xhc3MgQXN5bmNFdmVudDxUPiBleHRlbmRzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcbiAgICAvKipcbiAgICAgKiBTZW50IHdoZW4gc29tZW9uZSBhdHRhY2hlcyBvciBkZXRhY2hlc1xuICAgICAqL1xuICAgIHB1YmxpYyBnZXQgZXZ0TGlzdGVuZXJzQ2hhbmdlZCgpOiBWb2lkU3luY0V2ZW50IHtcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnNDaGFuZ2VkKSB7XG4gICAgICAgICAgICAvLyBuZWVkIHRvIGRlbGF5LWxvYWQgdG8gYXZvaWQgc3RhY2sgb3ZlcmZsb3cgaW4gY29uc3RydWN0b3JcbiAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc0NoYW5nZWQgPSBuZXcgVm9pZFN5bmNFdmVudCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9saXN0ZW5lcnNDaGFuZ2VkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV2ZW50IGZvciBsaXN0ZW5pbmcgdG8gbGlzdGVuZXIgY291bnRcbiAgICAgKi9cbiAgICBwcml2YXRlIF9saXN0ZW5lcnNDaGFuZ2VkPzogVm9pZFN5bmNFdmVudDtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgaW50ZXJuYWxseSAtIHRoZSBleGFjdCBvcHRpb25zIG9iamVjdCBnaXZlbiB0byBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIHB1YmxpYyBvcHRpb25zOiBBc3luY0V2ZW50T3B0cztcblxuICAgIHByaXZhdGUgX2NvbmRlbnNlZDogYm9vbGVhbjtcbiAgICBwcml2YXRlIF9xdWV1ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIF9xdWV1ZWRMaXN0ZW5lcnM6IExpc3RlbmVyPFQ+W107XG4gICAgcHJpdmF0ZSBfcXVldWVkRGF0YTogYW55W107XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGVmYXVsdCBzY2hlZHVsZXIgdXNlcyBzZXRJbW1lZGlhdGUoKSBvciBzZXRUaW1lb3V0KC4uLiwgMCkgaWYgc2V0SW1tZWRpYXRlIGlzIG5vdCBhdmFpbGFibGUuXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBkZWZhdWx0U2NoZWR1bGVyKGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICAqL1xuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIC8vIGJyb3dzZXJzIGRvbid0IGFsd2F5cyBzdXBwb3J0IHNldEltbWVkaWF0ZSgpXG4gICAgICAgICAgICBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vZGUuanNcbiAgICAgICAgICAgIHNldEltbWVkaWF0ZShjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBzY2hlZHVsZXJcbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBfc2NoZWR1bGVyOiAoY2FsbGJhY2s6ICgpID0+IHZvaWQpID0+IHZvaWQgPSBBc3luY0V2ZW50LmRlZmF1bHRTY2hlZHVsZXI7XG5cbiAgICAvKipcbiAgICAgKiBCeSBkZWZhdWx0LCBBc3luY0V2ZW50IHVzZXMgc2V0SW1tZWRpYXRlKCkgdG8gc2NoZWR1bGUgZXZlbnQgaGFuZGxlciBpbnZvY2F0aW9uLlxuICAgICAqIFlvdSBjYW4gY2hhbmdlIHRoaXMgZm9yIGUuZy4gc2V0VGltZW91dCguLi4sIDApIGJ5IGNhbGxpbmcgdGhpcyBzdGF0aWMgbWV0aG9kIG9uY2UuXG4gICAgICogQHBhcmFtIHNjaGVkdWxlciBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYSBjYWxsYmFjayBhbmQgZXhlY3V0ZXMgaXQgaW4gdGhlIG5leHQgTm9kZS5KUyBjeWNsZS5cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIHNldFNjaGVkdWxlcihzY2hlZHVsZXI6IChjYWxsYmFjazogKCkgPT4gdm9pZCkgPT4gdm9pZCk6IHZvaWQge1xuICAgICAgICBBc3luY0V2ZW50Ll9zY2hlZHVsZXIgPSBzY2hlZHVsZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uc3RydWN0b3JcbiAgICAgKiBAcGFyYW0gb3B0cyBPcHRpb25hbC4gVmFyaW91cyBzZXR0aW5nczpcbiAgICAgKiAgICAgICAgICAgICAtIGNvbmRlbnNlZDogYSBCb29sZWFuIGluZGljYXRpbmcgd2hldGhlciB0byBjb25kZW5zZSBtdWx0aXBsZSBwb3N0KCkgY2FsbHMgd2l0aGluIHRoZSBzYW1lIGN5Y2xlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9wdHM6IEFzeW5jRXZlbnRPcHRzID0ge30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0cztcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRzLmNvbmRlbnNlZCA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICB0aGlzLl9jb25kZW5zZWQgPSBvcHRzLmNvbmRlbnNlZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbmRlbnNlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VuZCB0aGUgQXN5bmNFdmVudC4gSGFuZGxlcnMgYXJlIGNhbGxlZCBpbiB0aGUgbmV4dCBOb2RlLkpTIGN5Y2xlLlxuICAgICAqL1xuICAgIHB1YmxpYyBwb3N0KGRhdGE6IFQpOiB2b2lkO1xuICAgIHB1YmxpYyBwb3N0KC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fY29uZGVuc2VkKSB7XG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWREYXRhID0gYXJncztcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlZExpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWV1ZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgQXN5bmNFdmVudC5fc2NoZWR1bGVyKCgpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaW1tZWRpYXRlbHkgbWFyayBub24tcXVldWVkIHRvIGFsbG93IG5ldyBBc3luY0V2ZW50IHRvIGhhcHBlbiBhcyByZXN1bHRcbiAgICAgICAgICAgICAgICAgICAgLy8gb2YgY2FsbGluZyBoYW5kbGVyc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY2FjaGUgbGlzdGVuZXJzIGFuZCBkYXRhIGJlY2F1c2UgdGhleSBtaWdodCBjaGFuZ2Ugd2hpbGUgY2FsbGluZyBldmVudCBoYW5kbGVyc1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5fcXVldWVkRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5fcXVldWVkTGlzdGVuZXJzO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgeyAvLyBub3QgY29uZGVuc2VkXG4gICAgICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG4gICAgICAgICAgICBBc3luY0V2ZW50Ll9zY2hlZHVsZXIoKCk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWxsKGxpc3RlbmVyLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGluaGVyaXRlZFxuICAgIHByb3RlY3RlZCBfY2FsbChsaXN0ZW5lcjogTGlzdGVuZXI8VD4sIGFyZ3M6IGFueVtdKTogdm9pZCB7XG4gICAgICAgIC8vIHBlcmZvcm1hbmNlIG9wdGltaXphdGlvbjogZG9uJ3QgdXNlIGNvbnNlY3V0aXZlIG5vZGVqcyBjeWNsZXNcbiAgICAgICAgLy8gZm9yIGFzeW5jZXZlbnRzIGF0dGFjaGVkIHRvIGFzeW5jZXZlbnRzXG4gICAgICAgIGlmIChsaXN0ZW5lci5ldmVudCAmJiBsaXN0ZW5lci5ldmVudCBpbnN0YW5jZW9mIEFzeW5jRXZlbnQpIHtcbiAgICAgICAgICAgICg8QXN5bmNFdmVudDxUPj5saXN0ZW5lci5ldmVudCkuX3Bvc3REaXJlY3QoYXJncyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdXBlci5fY2FsbChsaXN0ZW5lciwgYXJncyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQZXJmb3JtYW5jZSBvcHRpbWl6YXRpb246IGlmIHRoaXMgYXN5bmMgc2lnbmFsIGlzIGF0dGFjaGVkIHRvIGFub3RoZXJcbiAgICAgKiBhc3luYyBzaWduYWwsIHdlJ3JlIGFscmVhZHkgYSB0aGUgbmV4dCBjeWNsZSBhbmQgd2UgY2FuIGNhbGwgbGlzdGVuZXJzXG4gICAgICogZGlyZWN0bHlcbiAgICAgKi9cbiAgICBwcm90ZWN0ZWQgX3Bvc3REaXJlY3QoYXJnczogYW55W10pOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvcHkgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGJlY2F1c2UgdGhpcy5fbGlzdGVuZXJzIG1pZ2h0IGJlIHJlcGxhY2VkIGR1cmluZ1xuICAgICAgICAvLyB0aGUgaGFuZGxlciBjYWxsc1xuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcbiAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBpbmhlcml0ZG9jICovXG4gICAgcHJvdGVjdGVkIF9hdHRhY2goYTogKChkYXRhOiBUKSA9PiB2b2lkKSB8IE9iamVjdCB8IFBvc3RhYmxlPFQ+LCBiOiAoKGRhdGE6IFQpID0+IHZvaWQpIHwgdW5kZWZpbmVkLCBvbmNlOiBib29sZWFuKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fbGlzdGVuZXJzPy5sZW5ndGggPz8gMDtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX2F0dGFjaChhLCBiLCBvbmNlKTtcbiAgICAgICAgaWYgKHRoaXMuZXZ0TGlzdGVuZXJzQ2hhbmdlZCAmJiBjb3VudCAhPT0gKHRoaXMuX2xpc3RlbmVycz8ubGVuZ3RoID8/IDApKSB7XG4gICAgICAgICAgICB0aGlzLmV2dExpc3RlbmVyc0NoYW5nZWQucG9zdCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqIEBpbmhlcml0ZG9jICovXG4gICAgcHJvdGVjdGVkIF9kZXRhY2goLi4uYXJnczogYW55W10pOiB2b2lkIHtcbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLl9saXN0ZW5lcnM/Lmxlbmd0aCA/PyAwO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fZGV0YWNoKC4uLmFyZ3MpO1xuICAgICAgICBpZiAodGhpcy5ldnRMaXN0ZW5lcnNDaGFuZ2VkICYmIGNvdW50ICE9PSAodGhpcy5fbGlzdGVuZXJzPy5sZW5ndGggPz8gMCkpIHtcbiAgICAgICAgICAgIHRoaXMuZXZ0TGlzdGVuZXJzQ2hhbmdlZC5wb3N0KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5cbi8qKlxuICogQ29udmVuaWVuY2UgY2xhc3MgZm9yIEFzeW5jRXZlbnRzIHdpdGhvdXQgZGF0YVxuICovXG5leHBvcnQgY2xhc3MgVm9pZEFzeW5jRXZlbnQgZXh0ZW5kcyBBc3luY0V2ZW50PHZvaWQ+IHtcblxuICAgIC8qKlxuICAgICAqIFNlbmQgdGhlIEFzeW5jRXZlbnQuXG4gICAgICovXG4gICAgcHVibGljIHBvc3QoKTogdm9pZCB7XG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcbiAgICB9XG59XG5cbi8qKlxuICogU2ltaWxhciB0byAnZXJyb3InIGV2ZW50IG9uIEV2ZW50RW1pdHRlcjogdGhyb3dzIHdoZW4gYSBwb3N0KCkgb2NjdXJzIHdoaWxlIG5vIGhhbmRsZXJzIHNldC5cbiAqL1xuZXhwb3J0IGNsYXNzIEVycm9yQXN5bmNFdmVudCBleHRlbmRzIEFzeW5jRXZlbnQ8RXJyb3I+IHtcblxuICAgIHB1YmxpYyBwb3N0KGRhdGE6IEVycm9yKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLmxpc3RlbmVyQ291bnQoKSA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBlcnJvciBldmVudCBwb3N0ZWQgd2hpbGUgbm8gbGlzdGVuZXJzIGF0dGFjaGVkLiBFcnJvcjogJHtkYXRhLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICAgICAgc3VwZXIucG9zdChkYXRhKTtcbiAgICB9XG59XG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxuLy8gTGljZW5zZTogSVNDXG5cbid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHsgdGltaW5nU2FmZUVxdWFsIH0gZnJvbSAnY3J5cHRvJztcblxuZXhwb3J0IGludGVyZmFjZSBQb3N0YWJsZTxUPiB7XG4gICAgcG9zdChkYXRhOiBUKTogdm9pZDtcbn1cblxuLyoqXG4gKiBJbnRlcm5hbCBpbnRlcmZhY2UgYmV0d2VlbiBCYXNlRXZlbnQgYW5kIGl0cyBzdWJjbGFzc2VzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTGlzdGVuZXI8VD4ge1xuICAgIC8qKlxuICAgICAqIEluZGljYXRlcyB0aGF0IHRoZSBsaXN0ZW5lciB3YXMgZGV0YWNoZWRcbiAgICAgKi9cbiAgICBkZWxldGVkOiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFRoZSBoYW5kbGVyXG4gICAgICovXG4gICAgaGFuZGxlcj86IChkYXRhOiBUKSA9PiB2b2lkO1xuICAgIC8qKlxuICAgICAqIFRoZSB0aGlzIHBvaW50ZXIgZm9yIHRoZSBoYW5kbGVyXG4gICAgICovXG4gICAgYm91bmRUbz86IE9iamVjdDtcbiAgICAvKipcbiAgICAgKiBJbnN0ZWFkIG9mIGEgaGFuZGxlciwgYW4gYXR0YWNoZWQgZXZlbnRcbiAgICAgKi9cbiAgICBldmVudD86IFBvc3RhYmxlPFQ+O1xuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhZnRlciBmaXJzdCBjYWxsP1xuICAgICAqL1xuICAgIG9uY2U6IGJvb2xlYW47XG59XG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgZXZlbnRzLlxuICogSGFuZGxlcyBhdHRhY2hpbmcgYW5kIGRldGFjaGluZyBsaXN0ZW5lcnNcbiAqL1xuZXhwb3J0IGNsYXNzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcblxuICAgIC8qKlxuICAgICAqIEF0dGFjaGVkIGxpc3RlbmVycy4gTk9URTogZG8gbm90IG1vZGlmeS5cbiAgICAgKiBJbnN0ZWFkLCByZXBsYWNlIHdpdGggYSBuZXcgYXJyYXkgd2l0aCBwb3NzaWJseSB0aGUgc2FtZSBlbGVtZW50cy4gVGhpcyBlbnN1cmVzXG4gICAgICogdGhhdCBhbnkgcmVmZXJlbmNlcyB0byB0aGUgYXJyYXkgYnkgZXZlbnRzIHRoYXQgYXJlIHVuZGVyd2F5IHJlbWFpbiB0aGUgc2FtZS5cbiAgICAgKi9cbiAgICBwcm90ZWN0ZWQgX2xpc3RlbmVycz86IExpc3RlbmVyPFQ+W107XG5cbiAgICAvKipcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBjYWxsLiBUaGUgdGhpcyBhcmd1bWVudCBvZiB0aGUgZnVuY3Rpb24gd2lsbCBiZSB0aGlzIG9iamVjdC5cbiAgICAgKiBAcmV0dXJucyBmdW5jdGlvbiB5b3UgY2FuIHVzZSBmb3IgZGV0YWNoaW5nIGZyb20gdGhlIGV2ZW50LCBpbnN0ZWFkIG9mIGNhbGxpbmcgZGV0YWNoKClcbiAgICAgKi9cbiAgICBwdWJsaWMgYXR0YWNoKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZDtcbiAgICAvKipcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlclxuICAgICAqIEBwYXJhbSBib3VuZFRvIFRoZSB0aGlzIGFyZ3VtZW50IG9mIHRoZSBoYW5kbGVyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuXG4gICAgICogQHJldHVybnMgZnVuY3Rpb24geW91IGNhbiB1c2UgZm9yIGRldGFjaGluZyBmcm9tIHRoZSBldmVudCwgaW5zdGVhZCBvZiBjYWxsaW5nIGRldGFjaCgpXG4gICAgICovXG4gICAgcHVibGljIGF0dGFjaChib3VuZFRvOiBPYmplY3QsIGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZDtcbiAgICAvKipcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgZGlyZWN0bHlcbiAgICAgKiBAcGFyYW0gZXZlbnQgVGhlIGV2ZW50IHRvIGJlIHBvc3RlZFxuICAgICAqIEByZXR1cm5zIGZ1bmN0aW9uIHlvdSBjYW4gdXNlIGZvciBkZXRhY2hpbmcgZnJvbSB0aGUgZXZlbnQsIGluc3RlYWQgb2YgY2FsbGluZyBkZXRhY2goKVxuICAgICAqL1xuICAgIHB1YmxpYyBhdHRhY2goZXZlbnQ6IFBvc3RhYmxlPFQ+KTogKCkgPT4gdm9pZDtcbiAgICAvKipcbiAgICAgKiBBdHRhY2ggaW1wbGVtZW50YXRpb25cbiAgICAgKi9cbiAgICBwdWJsaWMgYXR0YWNoKGE6ICgoZGF0YTogVCkgPT4gdm9pZCkgfCBPYmplY3QgfCBQb3N0YWJsZTxUPiwgYj86IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdHRhY2goYSwgYiwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGFjaCBhbiBldmVudCBoYW5kbGVyIHdoaWNoIGF1dG9tYXRpY2FsbHkgZ2V0cyByZW1vdmVkIGFmdGVyIHRoZSBmaXJzdCBjYWxsXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuIFRoZSB0aGlzIGFyZ3VtZW50IG9mIHRoZSBmdW5jdGlvbiB3aWxsIGJlIHRoaXMgb2JqZWN0LlxuICAgICAqIEByZXR1cm5zIGZ1bmN0aW9uIHlvdSBjYW4gdXNlIGZvciBkZXRhY2hpbmcgZnJvbSB0aGUgZXZlbnQsIGluc3RlYWQgb2YgY2FsbGluZyBkZXRhY2goKVxuICAgICAqL1xuICAgIHB1YmxpYyBvbmNlKGhhbmRsZXI6IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZDtcbiAgICAvKipcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlciB3aGljaCBhdXRvbWF0aWNhbGx5IGdldHMgcmVtb3ZlZCBhZnRlciB0aGUgZmlyc3QgY2FsbFxuICAgICAqIEBwYXJhbSBib3VuZFRvIFRoZSB0aGlzIGFyZ3VtZW50IG9mIHRoZSBoYW5kbGVyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuXG4gICAgICogQHJldHVybnMgZnVuY3Rpb24geW91IGNhbiB1c2UgZm9yIGRldGFjaGluZyBmcm9tIHRoZSBldmVudCwgaW5zdGVhZCBvZiBjYWxsaW5nIGRldGFjaCgpXG4gICAgICovXG4gICAgcHVibGljIG9uY2UoYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XG4gICAgLyoqXG4gICAgICogQXR0YWNoIGFuIGV2ZW50IGRpcmVjdGx5IGFuZCBkZS1hdHRhY2ggYWZ0ZXIgdGhlIGZpcnN0IGNhbGxcbiAgICAgKiBAcGFyYW0gZXZlbnQgVGhlIGV2ZW50IHRvIGJlIHBvc3RlZFxuICAgICAqIEByZXR1cm5zIGZ1bmN0aW9uIHlvdSBjYW4gdXNlIGZvciBkZXRhY2hpbmcgZnJvbSB0aGUgZXZlbnQsIGluc3RlYWQgb2YgY2FsbGluZyBkZXRhY2goKVxuICAgICAqL1xuICAgIHB1YmxpYyBvbmNlKGV2ZW50OiBQb3N0YWJsZTxUPik6ICgpID0+IHZvaWQ7XG4gICAgLyoqXG4gICAgICogT25jZSBpbXBsZW1lbnRhdGlvblxuICAgICAqL1xuICAgIHB1YmxpYyBvbmNlKGE6ICgoZGF0YTogVCkgPT4gdm9pZCkgfCBPYmplY3QgfCBQb3N0YWJsZTxUPiwgYj86IChkYXRhOiBUKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdHRhY2goYSwgYiwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0YWNoIC8gb25jZSBpbXBsZW1lbnRhdGlvblxuICAgICAqIEBwYXJhbSBhXG4gICAgICogQHBhcmFtIGJcbiAgICAgKiBAcGFyYW0gb25jZVxuICAgICAqIEByZXR1cm5zIGZ1bmN0aW9uIHlvdSBjYW4gdXNlIGZvciBkZXRhY2hpbmcgZnJvbSB0aGUgZXZlbnQsIGluc3RlYWQgb2YgY2FsbGluZyBkZXRhY2goKVxuICAgICAqL1xuICAgIHByb3RlY3RlZCBfYXR0YWNoKGE6ICgoZGF0YTogVCkgPT4gdm9pZCkgfCBPYmplY3QgfCBQb3N0YWJsZTxUPiwgYjogKChkYXRhOiBUKSA9PiB2b2lkKSB8IHVuZGVmaW5lZCwgb25jZTogYm9vbGVhbik6ICgpID0+IHZvaWQge1xuICAgICAgICBsZXQgYm91bmRUbzogT2JqZWN0IHwgdW5kZWZpbmVkO1xuICAgICAgICBsZXQgaGFuZGxlcjogKChkYXRhOiBUKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IGV2ZW50OiBQb3N0YWJsZTxUPiB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IHJlc3VsdDogKCkgPT4gdm9pZDtcbiAgICAgICAgaWYgKHR5cGVvZiBhID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBoYW5kbGVyID0gYSBhcyAoKGRhdGE6IFQpID0+IHZvaWQpO1xuICAgICAgICAgICAgcmVzdWx0ID0gKCkgPT4gdGhpcy5kZXRhY2goaGFuZGxlciEpO1xuICAgICAgICB9IGVsc2UgaWYgKCFiICYmIHR5cGVvZiAoYSBhcyBQb3N0YWJsZTxUPikucG9zdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgZXZlbnQgPSBhIGFzIFBvc3RhYmxlPFQ+O1xuICAgICAgICAgICAgcmVzdWx0ID0gKCkgPT4gdGhpcy5kZXRhY2goZXZlbnQhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYSAhPT0gJ29iamVjdCcgfHwgYSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3QgYSBmdW5jdGlvbiBvciBvYmplY3QgYXMgZmlyc3QgYXJndW1lbnQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2YgYiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0IGEgZnVuY3Rpb24gYXMgc2Vjb25kIGFyZ3VtZW50Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBib3VuZFRvID0gYTtcbiAgICAgICAgICAgIGhhbmRsZXIgPSBiO1xuICAgICAgICAgICAgcmVzdWx0ID0gKCkgPT4gdGhpcy5kZXRhY2goYm91bmRUbyEsIGhhbmRsZXIhKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycykge1xuICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gW107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYXJyYXkgc28gZXZlbnRzIHRoYXQgYXJlIHVuZGVyd2F5IGhhdmUgYSBzdGFibGUgbG9jYWwgY29weVxuICAgICAgICAgICAgLy8gb2YgdGhlIGxpc3RlbmVycyBhcnJheSBhdCB0aGUgdGltZSBvZiBwb3N0KClcbiAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycy5zbGljZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2xpc3RlbmVycy5wdXNoKHtcbiAgICAgICAgICAgIGRlbGV0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgYm91bmRUbyxcbiAgICAgICAgICAgIGhhbmRsZXIsXG4gICAgICAgICAgICBldmVudCxcbiAgICAgICAgICAgIG9uY2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGV0YWNoIGFsbCBsaXN0ZW5lcnMgd2l0aCB0aGUgZ2l2ZW4gaGFuZGxlciBmdW5jdGlvblxuICAgICAqL1xuICAgIHB1YmxpYyBkZXRhY2goaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xuICAgIC8qKlxuICAgICAqIERldGFjaCBhbGwgbGlzdGVuZXJzIHdpdGggdGhlIGdpdmVuIGhhbmRsZXIgZnVuY3Rpb24gYW5kIGJvdW5kVG8gb2JqZWN0LlxuICAgICAqL1xuICAgIHB1YmxpYyBkZXRhY2goYm91bmRUbzogT2JqZWN0LCBoYW5kbGVyOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQ7XG4gICAgLyoqXG4gICAgICogRGV0YWNoIGFsbCBsaXN0ZW5lcnMgdGhhdCB3ZXJlIGF0dGFjaGVkIHdpdGggdGhlIGdpdmVuIGJvdW5kVG8gb2JqZWN0LlxuICAgICAqL1xuICAgIHB1YmxpYyBkZXRhY2goYm91bmRUbzogT2JqZWN0KTogdm9pZDtcbiAgICAvKipcbiAgICAgKiBEZXRhY2ggdGhlIGdpdmVuIGV2ZW50LlxuICAgICAqL1xuICAgIHB1YmxpYyBkZXRhY2goZXZlbnQ6IFBvc3RhYmxlPFQ+KTogdm9pZDtcbiAgICAvKipcbiAgICAgKiBEZXRhY2ggYWxsIGxpc3RlbmVyc1xuICAgICAqL1xuICAgIHB1YmxpYyBkZXRhY2goKTogdm9pZDtcbiAgICAvKipcbiAgICAgKiBEZXRhY2ggaW1wbGVtZW50YXRpb24uIFNlZSB0aGUgb3ZlcmxvYWRzIGZvciBkZXNjcmlwdGlvbi5cbiAgICAgKi9cbiAgICBwdWJsaWMgZGV0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG4gICAgICAgIHRoaXMuX2RldGFjaCguLi5hcmdzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRhY2ggaW1wbGVtZW50YXRpb25cbiAgICAgKiBAcGFyYW0gYXJnc1xuICAgICAqL1xuICAgIHByb3RlY3RlZCBfZGV0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzIHx8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgYm91bmRUbzogT2JqZWN0O1xuICAgICAgICBsZXQgaGFuZGxlcjogKGRhdGE6IFQpID0+IHZvaWQ7XG4gICAgICAgIGxldCBldmVudDogUG9zdGFibGU8VD47XG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA+PSAxKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIChhcmdzWzBdKSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzBdO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhcmdzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgYXJnc1swXS5wb3N0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQgPSBhcmdzWzBdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBib3VuZFRvID0gYXJnc1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoYXJncy5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgbGlzdGVuZXJzIEFORCBtYXJrIHRoZW0gYXMgZGVsZXRlZCBzbyBzdWJjbGFzc2VzIGRvbid0IHNlbmQgYW55IG1vcmUgZXZlbnRzIHRvIHRoZW1cbiAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzLmZpbHRlcigobGlzdGVuZXI6IExpc3RlbmVyPFQ+KTogYm9vbGVhbiA9PiB7XG4gICAgICAgICAgICBpZiAoKHR5cGVvZiBoYW5kbGVyID09PSAndW5kZWZpbmVkJyB8fCBsaXN0ZW5lci5oYW5kbGVyID09PSBoYW5kbGVyKVxuICAgICAgICAgICAgICAgICYmICh0eXBlb2YgZXZlbnQgPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmV2ZW50ID09PSBldmVudClcbiAgICAgICAgICAgICAgICAmJiAodHlwZW9mIGJvdW5kVG8gPT09ICd1bmRlZmluZWQnIHx8IGxpc3RlbmVyLmJvdW5kVG8gPT09IGJvdW5kVG8pKSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuZGVsZXRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICh0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGlzdGVuZXJzO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWJzdHJhY3QgcG9zdCgpIG1ldGhvZCB0byBiZSBhYmxlIHRvIGNvbm5lY3QgYW55IHR5cGUgb2YgZXZlbnQgdG8gYW55IG90aGVyIGRpcmVjdGx5XG4gICAgICogQGFic3RyYWN0XG4gICAgICovXG4gICAgcHVibGljIHBvc3QoZGF0YTogVCk6IHZvaWQge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2Fic3RyYWN0Jyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG51bWJlciBvZiBhdHRhY2hlZCBsaXN0ZW5lcnNcbiAgICAgKi9cbiAgICBwdWJsaWMgbGlzdGVuZXJDb3VudCgpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gKHRoaXMuX2xpc3RlbmVycyA/IHRoaXMuX2xpc3RlbmVycy5sZW5ndGggOiAwKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsIHRoZSBnaXZlbiBsaXN0ZW5lciwgaWYgaXQgaXMgbm90IG1hcmtlZCBhcyAnZGVsZXRlZCdcbiAgICAgKiBAcGFyYW0gbGlzdGVuZXIgVGhlIGxpc3RlbmVyIHRvIGNhbGxcbiAgICAgKiBAcGFyYW0gYXJncyBUaGUgYXJndW1lbnRzIHRvIHRoZSBoYW5kbGVyXG4gICAgICovXG4gICAgcHJvdGVjdGVkIF9jYWxsKGxpc3RlbmVyOiBMaXN0ZW5lcjxUPiwgYXJnczogYW55W10pOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWxpc3RlbmVyLmRlbGV0ZWQpIHtcbiAgICAgICAgICAgIGlmIChsaXN0ZW5lci5vbmNlKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVycyBBTkQgbWFyayBhcyBkZWxldGVkIHNvIHN1YmNsYXNzZXMgZG9uJ3Qgc2VuZCBhbnkgbW9yZSBldmVudHMgdG8gdGhlbVxuICAgICAgICAgICAgICAgIGxpc3RlbmVyLmRlbGV0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycy5maWx0ZXIoKGw6IExpc3RlbmVyPFQ+KTogYm9vbGVhbiA9PiBsICE9PSBsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVycztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGlzdGVuZXIuZXZlbnQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5ldmVudC5wb3N0LmFwcGx5KGxpc3RlbmVyLmV2ZW50LCBhcmdzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobGlzdGVuZXIuaGFuZGxlcikge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyLmhhbmRsZXIuYXBwbHkoKHR5cGVvZiBsaXN0ZW5lci5ib3VuZFRvID09PSAnb2JqZWN0JyA/IGxpc3RlbmVyLmJvdW5kVG8gOiB0aGlzKSwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbn1cbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XG4vLyBMaWNlbnNlOiBJU0NcblxuJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnQgZnVuY3Rpb24gc2hhbGxvd0VxdWFscyhhOiBhbnksIGI6IGFueSk6IGJvb2xlYW4ge1xuICAgIGlmIChhID09PSBiKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGEgIT09IHR5cGVvZiBiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgc3dpdGNoICh0eXBlb2YgYSkge1xuICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgICBjYXNlICdzeW1ib2wnOlxuICAgICAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgICAgICAgLy8gYWxyZWFkeSBkaWQgPT09IGNvbXBhcmVcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgIGlmIChhID09PSBudWxsIHx8IGIgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7IC8vIGFscmVhZHkgY29tcGFyZWQgPT09XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhKSB8fCBBcnJheS5pc0FycmF5KGIpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGEpIHx8ICFBcnJheS5pc0FycmF5KGIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbmFtZXNBOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgbmFtZXNCOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIGEpIHtcbiAgICAgICAgICAgICAgICBpZiAoYS5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBuYW1lc0EucHVzaChuYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gYikge1xuICAgICAgICAgICAgICAgIGlmIChiLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWVzQi5wdXNoKG5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5hbWVzQS5zb3J0KCk7XG4gICAgICAgICAgICBuYW1lc0Iuc29ydCgpO1xuICAgICAgICAgICAgaWYgKG5hbWVzQS5qb2luKCcsJykgIT09IG5hbWVzQi5qb2luKCcsJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5hbWVzQS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIGlmIChhW25hbWVzQVtpXV0gIT09IGJbbmFtZXNBW2ldXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuIiwiLy8gQ29weXJpZ2h0IMKpIDIwMTUgUm9naWVyIFNjaG91dGVuPGdpdGh1YkB3b3JraW5nY29kZS5uaW5qYT5cbi8vIExpY2Vuc2U6IElTQ1xuXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCB7QmFzZUV2ZW50LCBQb3N0YWJsZSwgTGlzdGVuZXJ9IGZyb20gJy4vYmFzZS1ldmVudCc7XG5pbXBvcnQge2RlZmF1bHQgYXMgRXZlbnRRdWV1ZX0gZnJvbSAnLi9FdmVudFF1ZXVlJztcbmltcG9ydCB7Vm9pZFN5bmNFdmVudH0gZnJvbSAnLi9zeW5jLWV2ZW50JztcblxuLyoqXG4gKiBPcHRpb25zIGZvciB0aGUgUXVldWVkRXZlbnQgY29uc3RydWN0b3JcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBRdWV1ZWRFdmVudE9wdHMge1xuICAgIC8qKlxuICAgICAqIENvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZS5cbiAgICAgKi9cbiAgICBjb25kZW5zZWQ/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFNwZWNpZmljIGV2ZW50IHF1ZXVlIHRvIHVzZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgZ2xvYmFsIGluc3RhbmNlIGlzIHVzZWQuXG4gICAgICovXG4gICAgcXVldWU/OiBFdmVudFF1ZXVlO1xufVxuXG4vKipcbiAqIEV2ZW50IHRoYXQgc3RheXMgaW4gYSBxdWV1ZSB1bnRpbCB5b3UgcHJvY2VzcyB0aGUgcXVldWUuIEFsbG93cyBmaW5lLWdyYWluZWRcbiAqIGNvbnRyb2wgb3ZlciB3aGVuIGV2ZW50cyBoYXBwZW4uXG4gKiAtIE9wdGlvbmFsbHkgY29uZGVuc2VzIG11bHRpcGxlIHBvc3QoKSBjYWxscyBpbnRvIG9uZS5cbiAqIC0gSGFuZGxlcnMgYXJlIGNhbGxlZCBvbmx5IGZvciBldmVudHMgcG9zdGVkIGFmdGVyIHRoZXkgd2VyZSBhdHRhY2hlZC5cbiAqIC0gSGFuZGxlcnMgYXJlIG5vdCBjYWxsZWQgYW55bW9yZSB3aGVuIHRoZXkgYXJlIGRldGFjaGVkLCBldmVuIGlmIGEgcG9zdCgpIGlzIGluIHByb2dyZXNzXG4gKi9cbmV4cG9ydCBjbGFzcyBRdWV1ZWRFdmVudDxUPiBleHRlbmRzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcbiAgICAvKipcbiAgICAgKiBTZW50IHdoZW4gc29tZW9uZSBhdHRhY2hlcyBvciBkZXRhY2hlc1xuICAgICAqL1xuICAgIHB1YmxpYyBnZXQgZXZ0TGlzdGVuZXJzQ2hhbmdlZCgpOiBWb2lkU3luY0V2ZW50IHtcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnNDaGFuZ2VkKSB7XG4gICAgICAgICAgICAvLyBuZWVkIHRvIGRlbGF5LWxvYWQgdG8gYXZvaWQgc3RhY2sgb3ZlcmZsb3cgaW4gY29uc3RydWN0b3JcbiAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc0NoYW5nZWQgPSBuZXcgVm9pZFN5bmNFdmVudCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9saXN0ZW5lcnNDaGFuZ2VkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV2ZW50IGZvciBsaXN0ZW5pbmcgdG8gbGlzdGVuZXIgY291bnRcbiAgICAgKi9cbiAgICBwcml2YXRlIF9saXN0ZW5lcnNDaGFuZ2VkPzogVm9pZFN5bmNFdmVudDtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgaW50ZXJuYWxseSAtIHRoZSBleGFjdCBvcHRpb25zIG9iamVjdCBnaXZlbiB0byBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIHB1YmxpYyBvcHRpb25zOiBRdWV1ZWRFdmVudE9wdHM7XG5cbiAgICBwcml2YXRlIF9jb25kZW5zZWQ6IGJvb2xlYW47XG4gICAgcHJpdmF0ZSBfcXVldWU6IEV2ZW50UXVldWU7XG4gICAgcHJpdmF0ZSBfcXVldWVkOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBfcXVldWVkTGlzdGVuZXJzOiBMaXN0ZW5lcjxUPltdO1xuICAgIHByaXZhdGUgX3F1ZXVlZERhdGE6IGFueVtdO1xuXG4gICAgLyoqXG4gICAgICogQ29uc3RydWN0b3JcbiAgICAgKiBAcGFyYW0gb3B0cyBPcHRpb25hbCwgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBtZW1iZXJzOlxuICAgICAqICAgICAgICAgICAgIC0gY29uZGVuc2VkOiBhIEJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRvIGNvbmRlbnNlIG11bHRpcGxlIGNhbGxzIHRvIHBvc3QoKSBpbnRvIG9uZSAoZGVmYXVsdCBmYWxzZSlcbiAgICAgKiAgICAgICAgICAgICAtIHF1ZXVlOiBhIHNwZWNpZmljIGV2ZW50IHF1ZXVlIHRvIHVzZS4gVGhlIGdsb2JhbCBFdmVudFF1ZXVlIGluc3RhbmNlIGlzIHVzZWQgaWYgbm90IGdpdmVuLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9wdHM6IFF1ZXVlZEV2ZW50T3B0cyA9IHt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdHM7XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0cy5jb25kZW5zZWQgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgdGhpcy5fY29uZGVuc2VkID0gb3B0cy5jb25kZW5zZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb25kZW5zZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIG9wdHMucXVldWUgPT09ICdvYmplY3QnICYmIG9wdHMucXVldWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX3F1ZXVlID0gb3B0cy5xdWV1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICogU2VuZCB0aGUgZXZlbnQuIEV2ZW50cyBhcmUgcXVldWVkIGluIHRoZSBldmVudCBxdWV1ZSB1bnRpbCBmbHVzaGVkIG91dC5cbiAgICAqIElmIHRoZSAnY29uZGVuc2VkJyBvcHRpb24gd2FzIGdpdmVuIGluIHRoZSBjb25zdHJ1Y3RvciwgbXVsdGlwbGUgcG9zdHMoKVxuICAgICogYmV0d2VlbiBxdWV1ZSBmbHVzaGVzIGFyZSBjb25kZW5zZWQgaW50byBvbmUgY2FsbCB3aXRoIHRoZSBkYXRhIGZyb20gdGhlXG4gICAgKiBsYXN0IHBvc3QoKSBjYWxsLlxuICAgICovXG4gICAgcHVibGljIHBvc3QoZGF0YTogVCk6IHZvaWQ7XG4gICAgcHVibGljIHBvc3QoLi4uYXJnczogYW55W10pOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHF1ZXVlID0gKHRoaXMuX3F1ZXVlID8gdGhpcy5fcXVldWUgOiBFdmVudFF1ZXVlLmdsb2JhbCgpKTtcbiAgICAgICAgaWYgKHRoaXMuX2NvbmRlbnNlZCkge1xuICAgICAgICAgICAgdGhpcy5fcXVldWVkRGF0YSA9IGFyZ3M7XG4gICAgICAgICAgICB0aGlzLl9xdWV1ZWRMaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG4gICAgICAgICAgICBpZiAodGhpcy5fcXVldWVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9xdWV1ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHF1ZXVlLmFkZCgoKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGltbWVkaWF0ZWx5IG1hcmsgbm9uLXF1ZXVlZCB0byBhbGxvdyBuZXcgQXN5bmNFdmVudCB0byBoYXBwZW4gYXMgcmVzdWx0XG4gICAgICAgICAgICAgICAgICAgIC8vIG9mIGNhbGxpbmcgaGFuZGxlcnNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcXVldWVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNhY2hlIGxpc3RlbmVycyBhbmQgZGF0YSBiZWNhdXNlIHRoZXkgbWlnaHQgY2hhbmdlIHdoaWxlIGNhbGxpbmcgZXZlbnQgaGFuZGxlcnNcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuX3F1ZXVlZERhdGE7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX3F1ZXVlZExpc3RlbmVycztcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHsgLy8gbm90IGNvbmRlbnNlZFxuICAgICAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgICAgICAgICAgcXVldWUuYWRkKCgpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RlbmVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbChsaXN0ZW5lciwgYXJncyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQGluaGVyaXRkb2MgKi9cbiAgICBwcm90ZWN0ZWQgX2F0dGFjaChhOiAoKGRhdGE6IFQpID0+IHZvaWQpIHwgT2JqZWN0IHwgUG9zdGFibGU8VD4sIGI6ICgoZGF0YTogVCkgPT4gdm9pZCkgfCB1bmRlZmluZWQsIG9uY2U6IGJvb2xlYW4pOiAoKSA9PiB2b2lkIHtcbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLl9saXN0ZW5lcnM/Lmxlbmd0aCA/PyAwO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fYXR0YWNoKGEsIGIsIG9uY2UpO1xuICAgICAgICBpZiAodGhpcy5ldnRMaXN0ZW5lcnNDaGFuZ2VkICYmIGNvdW50ICE9PSAodGhpcy5fbGlzdGVuZXJzPy5sZW5ndGggPz8gMCkpIHtcbiAgICAgICAgICAgIHRoaXMuZXZ0TGlzdGVuZXJzQ2hhbmdlZC5wb3N0KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKiogQGluaGVyaXRkb2MgKi9cbiAgICBwcm90ZWN0ZWQgX2RldGFjaCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMuX2xpc3RlbmVycz8ubGVuZ3RoID8/IDA7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl9kZXRhY2goLi4uYXJncyk7XG4gICAgICAgIGlmICh0aGlzLmV2dExpc3RlbmVyc0NoYW5nZWQgJiYgY291bnQgIT09ICh0aGlzLl9saXN0ZW5lcnM/Lmxlbmd0aCA/PyAwKSkge1xuICAgICAgICAgICAgdGhpcy5ldnRMaXN0ZW5lcnNDaGFuZ2VkLnBvc3QoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuLyoqXG4gKiBDb252ZW5pZW5jZSBjbGFzcyBmb3IgZXZlbnRzIHdpdGhvdXQgZGF0YVxuICovXG5leHBvcnQgY2xhc3MgVm9pZFF1ZXVlZEV2ZW50IGV4dGVuZHMgUXVldWVkRXZlbnQ8dm9pZD4ge1xuXG4gICAgLyoqXG4gICAgICogU2VuZCB0aGUgZXZlbnQuXG4gICAgICovXG4gICAgcHVibGljIHBvc3QoKTogdm9pZCB7XG4gICAgICAgIHN1cGVyLnBvc3QodW5kZWZpbmVkKTtcbiAgICB9XG59XG5cblxuLyoqXG4gKiBTaW1pbGFyIHRvICdlcnJvcicgZXZlbnQgb24gRXZlbnRFbWl0dGVyOiB0aHJvd3Mgd2hlbiBhIHBvc3QoKSBvY2N1cnMgd2hpbGUgbm8gaGFuZGxlcnMgc2V0LlxuICovXG5leHBvcnQgY2xhc3MgRXJyb3JRdWV1ZWRFdmVudCBleHRlbmRzIFF1ZXVlZEV2ZW50PEVycm9yPiB7XG5cbiAgICBwdWJsaWMgcG9zdChkYXRhOiBFcnJvcik6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGVycm9yIGV2ZW50IHBvc3RlZCB3aGlsZSBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuIEVycm9yOiAke2RhdGEubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBzdXBlci5wb3N0KGRhdGEpO1xuICAgIH1cbn1cbiIsIi8vIENvcHlyaWdodCDCqSAyMDE1IFJvZ2llciBTY2hvdXRlbjxnaXRodWJAd29ya2luZ2NvZGUubmluamE+XG4vLyBMaWNlbnNlOiBJU0NcblxuJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQge0Jhc2VFdmVudCwgUG9zdGFibGV9IGZyb20gJy4vYmFzZS1ldmVudCc7XG5cbi8qKlxuICogVGhpcyBpcyBhIHRydWUgRXZlbnRFbWl0dGVyIHJlcGxhY2VtZW50OiB0aGUgaGFuZGxlcnMgYXJlIGNhbGxlZCBzeW5jaHJvbm91c2x5IHdoZW5cbiAqIHlvdSBwb3N0IHRoZSBldmVudC5cbiAqIC0gQWxsb3dzIGJldHRlciBlcnJvciBoYW5kbGluZyBieSBhZ2dyZWdhdGluZyBhbnkgZXJyb3JzIHRocm93biBieSBoYW5kbGVycy5cbiAqIC0gUHJldmVudHMgbGl2ZWxvY2sgYnkgdGhyb3dpbmcgYW4gZXJyb3Igd2hlbiByZWN1cnNpb24gZGVwdGggaXMgYWJvdmUgYSBtYXhpbXVtLlxuICogLSBIYW5kbGVycyBhcmUgY2FsbGVkIG9ubHkgZm9yIGV2ZW50cyBwb3N0ZWQgYWZ0ZXIgdGhleSB3ZXJlIGF0dGFjaGVkLlxuICogLSBIYW5kbGVycyBhcmUgbm90IGNhbGxlZCBhbnltb3JlIHdoZW4gdGhleSBhcmUgZGV0YWNoZWQsIGV2ZW4gaWYgYSBwb3N0KCkgaXMgaW4gcHJvZ3Jlc3NcbiAqL1xuZXhwb3J0IGNsYXNzIFN5bmNFdmVudDxUPiBleHRlbmRzIEJhc2VFdmVudDxUPiBpbXBsZW1lbnRzIFBvc3RhYmxlPFQ+IHtcbiAgICAvKipcbiAgICAgKiBTZW50IHdoZW4gc29tZW9uZSBhdHRhY2hlcyBvciBkZXRhY2hlc1xuICAgICAqL1xuICAgIHB1YmxpYyBnZXQgZXZ0TGlzdGVuZXJzQ2hhbmdlZCgpOiBWb2lkU3luY0V2ZW50IHtcbiAgICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnNDaGFuZ2VkKSB7XG4gICAgICAgICAgICAvLyBuZWVkIHRvIGRlbGF5LWxvYWQgdG8gYXZvaWQgc3RhY2sgb3ZlcmZsb3cgaW4gY29uc3RydWN0b3JcbiAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc0NoYW5nZWQgPSBuZXcgVm9pZFN5bmNFdmVudCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9saXN0ZW5lcnNDaGFuZ2VkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV2ZW50IGZvciBsaXN0ZW5pbmcgdG8gbGlzdGVuZXIgY291bnRcbiAgICAgKi9cbiAgICBwcml2YXRlIF9saXN0ZW5lcnNDaGFuZ2VkPzogVm9pZFN5bmNFdmVudDtcblxuICAgIC8qKlxuICAgICAqIE1heGltdW0gbnVtYmVyIG9mIHRpbWVzIHRoYXQgYW4gZXZlbnQgaGFuZGxlciBtYXkgY2F1c2UgdGhlIHNhbWUgZXZlbnRcbiAgICAgKiByZWN1cnNpdmVseS5cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIE1BWF9SRUNVUlNJT05fREVQVEg/OiBudW1iZXIgfCBudWxsID0gMTA7XG5cbiAgICAvKipcbiAgICAgKiBSZWN1cnNpdmUgcG9zdCgpIGludm9jYXRpb25zXG4gICAgICovXG4gICAgcHJpdmF0ZSBfcmVjdXJzaW9uOiBudW1iZXIgPSAwO1xuXG4gICAgLyoqXG4gICAgICogU2VuZCB0aGUgZXZlbnQuIEhhbmRsZXJzIGFyZSBjYWxsZWQgaW1tZWRpYXRlbHkgYW5kIHN5bmNocm9ub3VzbHkuXG4gICAgICogSWYgYW4gZXJyb3IgaXMgdGhyb3duIGJ5IGEgaGFuZGxlciwgdGhlIHJlbWFpbmluZyBoYW5kbGVycyBhcmUgc3RpbGwgY2FsbGVkLlxuICAgICAqIEFmdGVyd2FyZCwgYW4gQWdncmVnYXRlRXJyb3IgaXMgdGhyb3duIHdpdGggdGhlIG9yaWdpbmFsIGVycm9yKHMpIGluIGl0cyAnY2F1c2VzJyBwcm9wZXJ0eS5cbiAgICAgKi9cbiAgICBwdWJsaWMgcG9zdChkYXRhOiBUKTogdm9pZDtcbiAgICBwdWJsaWMgcG9zdCguLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycyB8fCB0aGlzLl9saXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVjdXJzaW9uKys7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIHR5cGVvZiBTeW5jRXZlbnQuTUFYX1JFQ1VSU0lPTl9ERVBUSCA9PT0gJ251bWJlcidcbiAgICAgICAgICAgICYmIE51bWJlci5pc0ludGVnZXIoU3luY0V2ZW50Lk1BWF9SRUNVUlNJT05fREVQVEgpXG4gICAgICAgICAgICAmJiBTeW5jRXZlbnQuTUFYX1JFQ1VSU0lPTl9ERVBUSCA+IDBcbiAgICAgICAgICAgICYmIHRoaXMuX3JlY3Vyc2lvbiA+IFN5bmNFdmVudC5NQVhfUkVDVVJTSU9OX0RFUFRIXG4gICAgICAgICkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdldmVudCBmaXJlZCByZWN1cnNpdmVseScpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvcHkgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGJlY2F1c2UgdGhpcy5fbGlzdGVuZXJzIG1pZ2h0IGJlIHJlcGxhY2VkIGR1cmluZ1xuICAgICAgICAvLyB0aGUgaGFuZGxlciBjYWxsc1xuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcbiAgICAgICAgICAgIHRoaXMuX2NhbGwobGlzdGVuZXIsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3JlY3Vyc2lvbi0tO1xuICAgIH1cblxuICAgIC8qKiBAaW5oZXJpdGRvYyAqL1xuICAgIHByb3RlY3RlZCBfYXR0YWNoKGE6ICgoZGF0YTogVCkgPT4gdm9pZCkgfCBPYmplY3QgfCBQb3N0YWJsZTxUPiwgYjogKChkYXRhOiBUKSA9PiB2b2lkKSB8IHVuZGVmaW5lZCwgb25jZTogYm9vbGVhbik6ICgpID0+IHZvaWQge1xuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMuX2xpc3RlbmVycz8ubGVuZ3RoID8/IDA7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl9hdHRhY2goYSwgYiwgb25jZSk7XG4gICAgICAgIGlmICh0aGlzLmV2dExpc3RlbmVyc0NoYW5nZWQgJiYgY291bnQgIT09ICh0aGlzLl9saXN0ZW5lcnM/Lmxlbmd0aCA/PyAwKSkge1xuICAgICAgICAgICAgdGhpcy5ldnRMaXN0ZW5lcnNDaGFuZ2VkLnBvc3QoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKiBAaW5oZXJpdGRvYyAqL1xuICAgIHByb3RlY3RlZCBfZGV0YWNoKC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fbGlzdGVuZXJzPy5sZW5ndGggPz8gMDtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX2RldGFjaCguLi5hcmdzKTtcbiAgICAgICAgaWYgKHRoaXMuZXZ0TGlzdGVuZXJzQ2hhbmdlZCAmJiBjb3VudCAhPT0gKHRoaXMuX2xpc3RlbmVycz8ubGVuZ3RoID8/IDApKSB7XG4gICAgICAgICAgICB0aGlzLmV2dExpc3RlbmVyc0NoYW5nZWQucG9zdCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuXG4vKipcbiAqIENvbnZlbmllbmNlIGNsYXNzIGZvciBldmVudHMgd2l0aG91dCBkYXRhXG4gKi9cbmV4cG9ydCBjbGFzcyBWb2lkU3luY0V2ZW50IGV4dGVuZHMgU3luY0V2ZW50PHZvaWQ+IHtcblxuICAgIC8qKlxuICAgICAqIFNlbmQgdGhlIGV2ZW50LlxuICAgICAqL1xuICAgIHB1YmxpYyBwb3N0KCk6IHZvaWQge1xuICAgICAgICBzdXBlci5wb3N0KHVuZGVmaW5lZCk7XG4gICAgfVxufVxuXG4vKipcbiAqIFNpbWlsYXIgdG8gJ2Vycm9yJyBldmVudCBvbiBFdmVudEVtaXR0ZXI6IHRocm93cyB3aGVuIGEgcG9zdCgpIG9jY3VycyB3aGlsZSBubyBoYW5kbGVycyBzZXQuXG4gKi9cbmV4cG9ydCBjbGFzcyBFcnJvclN5bmNFdmVudCBleHRlbmRzIFN5bmNFdmVudDxFcnJvcj4ge1xuXG4gICAgcHVibGljIHBvc3QoZGF0YTogRXJyb3IpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgpID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGVycm9yIGV2ZW50IHBvc3RlZCB3aGlsZSBubyBsaXN0ZW5lcnMgYXR0YWNoZWQuIEVycm9yOiAke2RhdGEubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBzdXBlci5wb3N0KGRhdGEpO1xuICAgIH1cbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJ2YXIgbmV4dFRpY2sgPSByZXF1aXJlKCdwcm9jZXNzL2Jyb3dzZXIuanMnKS5uZXh0VGljaztcbnZhciBhcHBseSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseTtcbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbnZhciBpbW1lZGlhdGVJZHMgPSB7fTtcbnZhciBuZXh0SW1tZWRpYXRlSWQgPSAwO1xuXG4vLyBET00gQVBJcywgZm9yIGNvbXBsZXRlbmVzc1xuXG5leHBvcnRzLnNldFRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBUaW1lb3V0KGFwcGx5LmNhbGwoc2V0VGltZW91dCwgd2luZG93LCBhcmd1bWVudHMpLCBjbGVhclRpbWVvdXQpO1xufTtcbmV4cG9ydHMuc2V0SW50ZXJ2YWwgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBUaW1lb3V0KGFwcGx5LmNhbGwoc2V0SW50ZXJ2YWwsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJJbnRlcnZhbCk7XG59O1xuZXhwb3J0cy5jbGVhclRpbWVvdXQgPVxuZXhwb3J0cy5jbGVhckludGVydmFsID0gZnVuY3Rpb24odGltZW91dCkgeyB0aW1lb3V0LmNsb3NlKCk7IH07XG5cbmZ1bmN0aW9uIFRpbWVvdXQoaWQsIGNsZWFyRm4pIHtcbiAgdGhpcy5faWQgPSBpZDtcbiAgdGhpcy5fY2xlYXJGbiA9IGNsZWFyRm47XG59XG5UaW1lb3V0LnByb3RvdHlwZS51bnJlZiA9IFRpbWVvdXQucHJvdG90eXBlLnJlZiA9IGZ1bmN0aW9uKCkge307XG5UaW1lb3V0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9jbGVhckZuLmNhbGwod2luZG93LCB0aGlzLl9pZCk7XG59O1xuXG4vLyBEb2VzIG5vdCBzdGFydCB0aGUgdGltZSwganVzdCBzZXRzIHVwIHRoZSBtZW1iZXJzIG5lZWRlZC5cbmV4cG9ydHMuZW5yb2xsID0gZnVuY3Rpb24oaXRlbSwgbXNlY3MpIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuICBpdGVtLl9pZGxlVGltZW91dCA9IG1zZWNzO1xufTtcblxuZXhwb3J0cy51bmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuICBpdGVtLl9pZGxlVGltZW91dCA9IC0xO1xufTtcblxuZXhwb3J0cy5fdW5yZWZBY3RpdmUgPSBleHBvcnRzLmFjdGl2ZSA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgY2xlYXJUaW1lb3V0KGl0ZW0uX2lkbGVUaW1lb3V0SWQpO1xuXG4gIHZhciBtc2VjcyA9IGl0ZW0uX2lkbGVUaW1lb3V0O1xuICBpZiAobXNlY3MgPj0gMCkge1xuICAgIGl0ZW0uX2lkbGVUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uIG9uVGltZW91dCgpIHtcbiAgICAgIGlmIChpdGVtLl9vblRpbWVvdXQpXG4gICAgICAgIGl0ZW0uX29uVGltZW91dCgpO1xuICAgIH0sIG1zZWNzKTtcbiAgfVxufTtcblxuLy8gVGhhdCdzIG5vdCBob3cgbm9kZS5qcyBpbXBsZW1lbnRzIGl0IGJ1dCB0aGUgZXhwb3NlZCBhcGkgaXMgdGhlIHNhbWUuXG5leHBvcnRzLnNldEltbWVkaWF0ZSA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHNldEltbWVkaWF0ZSA6IGZ1bmN0aW9uKGZuKSB7XG4gIHZhciBpZCA9IG5leHRJbW1lZGlhdGVJZCsrO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cy5sZW5ndGggPCAyID8gZmFsc2UgOiBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgaW1tZWRpYXRlSWRzW2lkXSA9IHRydWU7XG5cbiAgbmV4dFRpY2soZnVuY3Rpb24gb25OZXh0VGljaygpIHtcbiAgICBpZiAoaW1tZWRpYXRlSWRzW2lkXSkge1xuICAgICAgLy8gZm4uY2FsbCgpIGlzIGZhc3RlciBzbyB3ZSBvcHRpbWl6ZSBmb3IgdGhlIGNvbW1vbiB1c2UtY2FzZVxuICAgICAgLy8gQHNlZSBodHRwOi8vanNwZXJmLmNvbS9jYWxsLWFwcGx5LXNlZ3VcbiAgICAgIGlmIChhcmdzKSB7XG4gICAgICAgIGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm4uY2FsbChudWxsKTtcbiAgICAgIH1cbiAgICAgIC8vIFByZXZlbnQgaWRzIGZyb20gbGVha2luZ1xuICAgICAgZXhwb3J0cy5jbGVhckltbWVkaWF0ZShpZCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaWQ7XG59O1xuXG5leHBvcnRzLmNsZWFySW1tZWRpYXRlID0gdHlwZW9mIGNsZWFySW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBjbGVhckltbWVkaWF0ZSA6IGZ1bmN0aW9uKGlkKSB7XG4gIGRlbGV0ZSBpbW1lZGlhdGVJZHNbaWRdO1xufTsiLCIvLyBDb3B5cmlnaHQgwqkgMjAxNSBSb2dpZXIgU2Nob3V0ZW48Z2l0aHViQHdvcmtpbmdjb2RlLm5pbmphPlxuLy8gTGljZW5zZTogSVNDXG5cbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0ICogZnJvbSAnLi9iYXNlLWV2ZW50JztcbmV4cG9ydCAqIGZyb20gJy4vc3luYy1ldmVudCc7XG5leHBvcnQgKiBmcm9tICcuL3F1ZXVlZC1ldmVudCc7XG5leHBvcnQgKiBmcm9tICcuL2FzeW5jLWV2ZW50JztcbmV4cG9ydCAqIGZyb20gJy4vYW55LWV2ZW50JztcblxuaW1wb3J0IHtkZWZhdWx0IGFzIEV2ZW50UXVldWV9IGZyb20gJy4vRXZlbnRRdWV1ZSc7XG5leHBvcnQge2RlZmF1bHQgYXMgRXZlbnRRdWV1ZX0gZnJvbSAnLi9FdmVudFF1ZXVlJztcblxuLyoqXG4gKiBUaGUgZ2xvYmFsIGV2ZW50IHF1ZXVlIGZvciBRdWV1ZWRFdmVudHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1ZXVlKCk6IEV2ZW50UXVldWUge1xuICAgIHJldHVybiBFdmVudFF1ZXVlLmdsb2JhbCgpO1xufVxuXG4vKipcbiAqIENvbnZlbmllbmNlIGZ1bmN0aW9uLCBzYW1lIGFzIEV2ZW50UXVldWUuZ2xvYmFsKCkuZmx1c2hPbmNlKCkuXG4gKiBGbHVzaGVzIHRoZSBRdWV1ZWRFdmVudHMsIGNhbGxpbmcgYWxsIGV2ZW50cyBjdXJyZW50bHkgaW4gdGhlIHF1ZXVlIGJ1dCBub3RcbiAqIGFueSBldmVudHMgcHV0IGludG8gdGhlIHF1ZXVlIGFzIGEgcmVzdWx0IG9mIHRoZSBmbHVzaC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZsdXNoT25jZSgpOiB2b2lkIHtcbiAgICBFdmVudFF1ZXVlLmdsb2JhbCgpLmZsdXNoT25jZSgpO1xufVxuXG4vKipcbiAqIENvbnZlbmllbmNlIGZ1bmN0aW9uLCBzYW1lIGFzIEV2ZW50UXVldWUuZ2xvYmFsKCkuZmx1c2goKS5cbiAqIEZsdXNoZXMgdGhlIFF1ZXVlZEV2ZW50cywgY2FsbGluZyBhbGwgaGFuZGxlcnMgY3VycmVudGx5IGluIHRoZSBxdWV1ZSBhbmQgdGhvc2VcbiAqIHB1dCBpbnRvIHRoZSBxdWV1ZSBhcyBhIHJlc3VsdCBvZiB0aGUgZmx1c2guXG4gKiBAcGFyYW0gbWF4Um91bmRzIE9wdGlvbmFsLCBkZWZhdWx0IDEwLiBOdW1iZXIgb2YgaXRlcmF0aW9ucyBhZnRlciB3aGljaCB0byB0aHJvdyBhbiBlcnJvciBiZWNhdXNlXG4gKiAgICAgICAgICAgICAgICAgIHRoZSBxdWV1ZSBrZWVwcyBmaWxsaW5nIHVwLiBTZXQgdG8gdW5kZWZpbmVkIG9yIG51bGwgdG8gZGlzYWJsZSB0aGlzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZmx1c2gobWF4Um91bmRzOiBudW1iZXIgfCBudWxsID0gMTApOiB2b2lkIHtcbiAgICBFdmVudFF1ZXVlLmdsb2JhbCgpLmZsdXNoKG1heFJvdW5kcyk7XG59XG4iXX0=
return require('ts-events');
});