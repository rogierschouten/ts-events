// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/test.d.ts"/>
require("source-map-support").install();
var assert = require("assert");
var chai = require("chai");
var expect = chai.expect;
var tsevents = require("../index");
var SyncEvent = tsevents.SyncEvent;
describe("SyncEvent", function () {
    var defaultRecursionDepth = SyncEvent.MAX_RECURSION_DEPTH;
    afterEach(function () {
        SyncEvent.MAX_RECURSION_DEPTH = defaultRecursionDepth;
    });
    it("should send events", function () {
        var e = new SyncEvent();
        var calledWith = [];
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("A");
        expect(calledWith).to.deep.equal(["A"]);
    });
    it("should use the Event as this parameter by default", function () {
        var e = new SyncEvent();
        e.attach(function (s) {
            expect(this).to.equal(e);
        });
        e.post("A");
    });
    it("should use a given object as this parameter when given", function () {
        var e = new SyncEvent();
        var t = {};
        e.attach(t, function (s) {
            expect(this).to.equal(t);
        });
        e.post("A");
    });
    it("should send events only to handlers attached at the time of posting", function () {
        var e = new SyncEvent();
        var calledWith = [];
        e.post("A");
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("B");
        expect(calledWith).to.deep.equal(["B"]);
    });
    it("should not send events at all to detached event handlers", function () {
        var e = new SyncEvent();
        var calledWith = [];
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.detach();
        e.post("A");
        expect(calledWith).to.deep.equal([]);
    });
    it("should allow attaching event handlers within handlers", function () {
        var e = new SyncEvent();
        var calledWith = [];
        e.attach(function (s) {
            e.attach(function (s) {
                calledWith.push(s);
            });
        });
        e.post("A");
        e.post("B");
        expect(calledWith).to.deep.equal(["B"]);
    });
    it("should allow detaching event handlers within handlers", function () {
        var e = new SyncEvent();
        var calledWith = [];
        var f = function (s) {
            calledWith.push(s);
            e.detach(f);
        };
        e.attach(f);
        e.post("A");
        e.post("B");
        expect(calledWith).to.deep.equal(["A"]);
    });
    it("should protect against recursion", function () {
        var e = new SyncEvent();
        var callCount = 0;
        var f = function (s) {
            callCount++;
            e.post("A");
        };
        e.attach(f);
        assert.throws(function () {
            e.post("A");
        });
        expect(callCount).to.equal(SyncEvent.MAX_RECURSION_DEPTH);
    });
    it("should allow disabling recursion protection", function () {
        SyncEvent.MAX_RECURSION_DEPTH = null;
        var e = new SyncEvent();
        var callCount = 0;
        var f = function (s) {
            callCount++;
            if (callCount < 100) {
                e.post("A");
            }
        };
        e.attach(f);
        assert.doesNotThrow(function () {
            e.post("A");
        });
        expect(callCount).to.equal(100);
    });
    it("should allow attaching another event", function () {
        var e = new SyncEvent();
        var f = new SyncEvent();
        var calledWith = [];
        var g = function (s) {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
        e.post("A");
        e.post("B");
        expect(calledWith).to.deep.equal(["A", "B"]);
    });
});
describe("VoidSyncEvent", function () {
    it("should allow sending event without parameters", function () {
        var e = new tsevents.VoidSyncEvent();
        var callCount = 0;
        e.attach(function () {
            callCount++;
        });
        e.post();
        expect(callCount).to.equal(1);
    });
});
describe("ErrorSyncEvent", function () {
    it("should throw on posting without handlers", function () {
        var e = new tsevents.ErrorSyncEvent();
        assert.throws(function () {
            e.post(new Error("test error"));
        });
    });
    it("should not throw on posting with handlers", function () {
        var e = new tsevents.ErrorSyncEvent();
        e.attach(function (error) {
            // nothing
        });
        assert.doesNotThrow(function () {
            e.post(new Error("test error"));
        });
    });
});
//# sourceMappingURL=test-sync-event.js.map