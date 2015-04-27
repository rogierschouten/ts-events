// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/test.d.ts"/>
var assert = require("assert");
var chai = require("chai");
var expect = chai.expect;
var tsevents = require("../index");
var QueuedEvent = tsevents.QueuedEvent;
describe("QueuedEvent", function () {
    it("should send events through the global event queue", function () {
        var e = new QueuedEvent();
        var callCount = 0;
        var calledWith = [];
        e.attach(function (s) {
            callCount++;
            calledWith.push(s);
        });
        e.post("A");
        expect(callCount).to.equal(0);
        tsevents.flushOnce();
        expect(callCount).to.equal(1);
        expect(calledWith).to.deep.equal(["A"]);
    });
    it("should send events through a given event queue", function () {
        var q = new tsevents.EventQueue();
        var e = new QueuedEvent({ queue: q });
        var callCount = 0;
        var calledWith = [];
        e.attach(function (s) {
            callCount++;
            calledWith.push(s);
        });
        e.post("A");
        expect(callCount).to.equal(0);
        tsevents.flushOnce();
        expect(callCount).to.equal(0);
        q.flushOnce();
        expect(callCount).to.equal(1);
        expect(calledWith).to.deep.equal(["A"]);
    });
    it("should not condense events by default", function () {
        var e = new QueuedEvent();
        var callCount = 0;
        var calledWith = [];
        e.attach(function (s) {
            callCount++;
            calledWith.push(s);
        });
        e.post("A");
        e.post("B");
        tsevents.flushOnce();
        expect(callCount).to.equal(2);
        expect(calledWith).to.deep.equal(["A", "B"]);
    });
    it("should condense events when asked", function () {
        var e = new QueuedEvent({ condensed: true });
        var callCount = 0;
        var calledWith = [];
        e.attach(function (s) {
            callCount++;
            calledWith.push(s);
        });
        e.post("A");
        e.post("B");
        tsevents.flushOnce();
        expect(callCount).to.equal(1);
        expect(calledWith).to.deep.equal(["B"]);
    });
    it("should use the Event as this parameter by default", function () {
        var e = new QueuedEvent();
        e.attach(function (s) {
            expect(this).to.equal(e);
        });
        e.post("A");
        tsevents.flushOnce();
    });
    it("should use a given object as this parameter when given", function () {
        var e = new QueuedEvent();
        var t = {};
        e.attach(t, function (s) {
            expect(this).to.equal(t);
        });
        e.post("A");
        tsevents.flushOnce();
    });
    it("should send events only to handlers attached at the time of posting", function () {
        var e = new QueuedEvent();
        var calledWith = [];
        e.post("A");
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("B");
        tsevents.flushOnce();
        expect(calledWith).to.deep.equal(["B"]);
    });
    it("should not send events at all to detached event handlers", function () {
        var e = new QueuedEvent();
        var calledWith = [];
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("A");
        e.detach();
        e.post("B");
        tsevents.flushOnce();
        expect(calledWith).to.deep.equal([]);
    });
    it("should allow attaching event handlers within handlers", function () {
        var e = new QueuedEvent();
        var calledWith = [];
        e.attach(function (s) {
            e.attach(function (s) {
                calledWith.push(s);
            });
        });
        e.post("A");
        e.post("B");
        tsevents.flushOnce();
        e.post("C");
        tsevents.flushOnce();
        expect(calledWith).to.deep.equal(["C", "C"]);
    });
    it("should allow detaching event handlers within handlers", function () {
        var e = new QueuedEvent();
        var calledWith = [];
        var f = function (s) {
            calledWith.push(s);
            e.detach(f);
        };
        e.attach(f);
        e.post("A");
        e.post("B");
        tsevents.flushOnce();
        expect(calledWith).to.deep.equal(["A"]);
    });
});
describe("VoidQueuedEvent", function () {
    it("should allow sending event without parameters", function () {
        var e = new tsevents.VoidQueuedEvent();
        var callCount = 0;
        e.attach(function () {
            callCount++;
        });
        e.post();
        tsevents.flushOnce();
        expect(callCount).to.equal(1);
    });
});
describe("ErrorQueuedEvent", function () {
    it("should throw on posting without handlers", function () {
        var e = new tsevents.ErrorQueuedEvent();
        assert.throws(function () {
            e.post(new Error("test error"));
        });
    });
    it("should not throw on posting with handlers", function () {
        var e = new tsevents.ErrorQueuedEvent();
        e.attach(function (error) {
            // nothing
        });
        assert.doesNotThrow(function () {
            e.post(new Error("test error"));
        });
    });
});
//# sourceMappingURL=test-queued-event.js.map