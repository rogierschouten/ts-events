// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/index.d.ts"/>
"use strict";
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var util = require("util");
var listenable = require("./listenable");
var Listenable = listenable.Listenable;
var Event = (function (_super) {
    __extends(Event, _super);
    function Event() {
        _super.apply(this, arguments);
        this._recursion = 0;
    }
    Event.prototype.post = function (data) {
        this._recursion++;
        if (this._recursion > Event.MAX_RECURSION_DEPTH) {
            throw new Error("event fired recursively");
        }
        var listeners = this._copyListeners();
        for (var i = 0; i < listeners.length; ++i) {
            var listener = listeners[i];
            if (!listener.deleted) {
                listener.handler.call((typeof listener.boundTo === "object" ? listener.boundTo : this), data);
            }
        }
        this._recursion--;
    };
    Event.MAX_RECURSION_DEPTH = 10;
    return Event;
})(Listenable);
exports.Event = Event;
var VoidEvent = (function (_super) {
    __extends(VoidEvent, _super);
    function VoidEvent() {
        _super.apply(this, arguments);
    }
    VoidEvent.prototype.post = function () {
        _super.prototype.post.call(this, undefined);
    };
    return VoidEvent;
})(Event);
exports.VoidEvent = VoidEvent;
var ErrorEvent = (function (_super) {
    __extends(ErrorEvent, _super);
    function ErrorEvent() {
        _super.apply(this, arguments);
    }
    ErrorEvent.prototype.post = function (data) {
        if (this.listenerCount() === 0) {
            throw new Error(util.format("error event posted while no listeners attached. Error: ", data));
        }
        _super.prototype.post.call(this, data);
    };
    return ErrorEvent;
})(Event);
exports.ErrorEvent = ErrorEvent;
