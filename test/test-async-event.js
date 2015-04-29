// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/test.d.ts"/>
var assert = require("assert");
var chai = require("chai");
var expect = chai.expect;
var tsevents = require("../index");
var AsyncEvent = tsevents.AsyncEvent;
describe("AsyncEvent", function () {
    beforeEach(function () {
        AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
    });
    afterEach(function () {
        AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
    });
    it("should not send events in the same cycle", function () {
        var e = new AsyncEvent();
        var calledWith = [];
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("A");
        expect(calledWith).to.deep.equal([]);
    });
    it("should send events in the next cycle", function (done) {
        var e = new AsyncEvent();
        var calledWith = [];
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("A");
        setImmediate(function () {
            expect(calledWith).to.deep.equal(["A"]);
            done();
        });
    });
    it("should not condense events by default", function (done) {
        var e = new AsyncEvent();
        var calledWith = [];
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("A");
        e.post("B");
        setImmediate(function () {
            expect(calledWith).to.deep.equal(["A", "B"]);
            done();
        });
    });
    it("should condense events when asked", function (done) {
        var e = new AsyncEvent({ condensed: true });
        var calledWith = [];
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("A");
        e.post("B");
        setImmediate(function () {
            expect(calledWith).to.deep.equal(["B"]);
            done();
        });
    });
    it("should use the Event as this parameter by default", function (done) {
        var e = new AsyncEvent();
        e.attach(function (s) {
            expect(this).to.equal(e);
            done();
        });
        e.post("A");
    });
    it("should use a given object as this parameter when given", function (done) {
        var e = new AsyncEvent();
        var t = {};
        e.attach(t, function (s) {
            expect(this).to.equal(t);
            done();
        });
        e.post("A");
    });
    it("should send events only to handlers attached at the time of posting", function (done) {
        var e = new AsyncEvent();
        var calledWith = [];
        e.post("A");
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("B");
        setImmediate(function () {
            expect(calledWith).to.deep.equal(["B"]);
            done();
        });
    });
    it("should not send events at all to detached event handlers", function (done) {
        var e = new AsyncEvent();
        var calledWith = [];
        e.attach(function (s) {
            calledWith.push(s);
        });
        e.post("A");
        e.detach();
        e.post("B");
        setImmediate(function () {
            expect(calledWith).to.deep.equal([]);
            done();
        });
    });
    it("should allow attaching event handlers within handlers", function (done) {
        var e = new AsyncEvent();
        var calledWith = [];
        e.attach(function (s) {
            e.attach(function (s) {
                calledWith.push(s);
            });
        });
        e.post("A");
        e.post("B");
        setImmediate(function () {
            e.post("C");
            setImmediate(function () {
                expect(calledWith).to.deep.equal(["C", "C"]);
                done();
            });
        });
    });
    it("should allow detaching event handlers within handlers", function (done) {
        var e = new AsyncEvent();
        var calledWith = [];
        var f = function (s) {
            calledWith.push(s);
            e.detach(f);
        };
        e.attach(f);
        e.post("A");
        e.post("B");
        setImmediate(function () {
            expect(calledWith).to.deep.equal(["A"]);
            done();
        });
    });
    it("should allow setting different scheduler", function (done) {
        AsyncEvent.setScheduler(function (callback) {
            setTimeout(callback, 0);
        });
        var e = new AsyncEvent();
        var calledWith = [];
        var f = function (s) {
            calledWith.push(s);
        };
        e.attach(f);
        e.post("A");
        setImmediate(function () {
            expect(calledWith).to.deep.equal([]);
        });
        setTimeout(function () {
            expect(calledWith).to.deep.equal(["A"]);
            done();
        }, 0);
    });
    it("should allow attaching another event", function () {
        var e = new AsyncEvent();
        var f = new AsyncEvent();
        var calledWith = [];
        var g = function (s) {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
        e.post("A");
        e.post("B");
        expect(calledWith).to.deep.equal([]);
        setImmediate(function () {
            setImmediate(function () {
                expect(calledWith).to.deep.equal(["A", "B"]);
            });
        });
    });
    it("should condense attached async events into the same cycle", function () {
        var e = new AsyncEvent();
        var f = new AsyncEvent();
        var calledWith = [];
        var g = function (s) {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
        e.post("A");
        e.post("B");
        setImmediate(function () {
            expect(calledWith).to.deep.equal(["A", "B"]);
        });
    });
});
describe("VoidAsyncEvent", function () {
    it("should allow sending event without parameters", function (done) {
        var e = new tsevents.VoidAsyncEvent();
        var callCount = 0;
        e.attach(function () {
            callCount++;
        });
        e.post();
        setImmediate(function () {
            expect(callCount).to.equal(1);
            done();
        });
    });
});
describe("ErrorAsyncEvent", function () {
    it("should throw on posting without handlers", function () {
        var e = new tsevents.ErrorAsyncEvent();
        assert.throws(function () {
            e.post(new Error("test error"));
        });
    });
    it("should not throw on posting with handlers", function () {
        var e = new tsevents.ErrorAsyncEvent();
        e.attach(function (error) {
            // nothing
        });
        assert.doesNotThrow(function () {
            e.post(new Error("test error"));
        });
    });
});
//# sourceMappingURL=test-async-event.js.map