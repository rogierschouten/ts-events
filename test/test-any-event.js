// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/tsd.d.ts"/>
var assert = require("assert");
var chai_1 = require("chai");
var tsevents = require("../index");
var AnyEvent = tsevents.AnyEvent;
var AsyncEvent = tsevents.AsyncEvent;
var SyncEvent = tsevents.SyncEvent;
describe("AnyEvent", function () {
    describe("Sync use", function () {
        var defaultRecursionDepth = SyncEvent.MAX_RECURSION_DEPTH;
        afterEach(function () {
            SyncEvent.MAX_RECURSION_DEPTH = defaultRecursionDepth;
        });
        it("should send events", function () {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachSync(function (s) {
                calledWith.push(s);
            });
            e.post("A");
            chai_1.expect(calledWith).to.deep.equal(["A"]);
        });
        it("should use the Event as this parameter by default", function () {
            var e = new AnyEvent();
            e.attachSync(function (s) {
                chai_1.expect(this).to.equal(e);
            });
            e.post("A");
        });
        it("should use a given object as this parameter when given", function () {
            var e = new AnyEvent();
            var t = {};
            e.attachSync(t, function (s) {
                chai_1.expect(this).to.equal(t);
            });
            e.post("A");
        });
        it("should send events only to handlers attached at the time of posting", function () {
            var e = new AnyEvent();
            var calledWith = [];
            e.post("A");
            e.attachSync(function (s) {
                calledWith.push(s);
            });
            e.post("B");
            chai_1.expect(calledWith).to.deep.equal(["B"]);
        });
        it("should not send events at all to detached event handlers", function () {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachSync(function (s) {
                calledWith.push(s);
            });
            e.detach();
            e.post("A");
            chai_1.expect(calledWith).to.deep.equal([]);
        });
        it("should allow attaching event handlers within handlers", function () {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachSync(function (s) {
                e.attachSync(function (s) {
                    calledWith.push(s);
                });
            });
            e.post("A");
            e.post("B");
            chai_1.expect(calledWith).to.deep.equal(["B"]);
        });
        it("should allow detaching event handlers within handlers", function () {
            var e = new AnyEvent();
            var calledWith = [];
            var f = function (s) {
                calledWith.push(s);
                e.detach(f);
            };
            e.attachSync(f);
            e.post("A");
            e.post("B");
            chai_1.expect(calledWith).to.deep.equal(["A"]);
        });
        it("should protect against recursion", function () {
            var e = new AnyEvent();
            var callCount = 0;
            var f = function (s) {
                callCount++;
                e.post("A");
            };
            e.attachSync(f);
            assert.throws(function () {
                e.post("A");
            });
            chai_1.expect(callCount).to.equal(SyncEvent.MAX_RECURSION_DEPTH);
        });
        it("should allow disabling recursion protection", function () {
            SyncEvent.MAX_RECURSION_DEPTH = null;
            var e = new AnyEvent();
            var callCount = 0;
            var f = function (s) {
                callCount++;
                if (callCount < 100) {
                    e.post("A");
                }
            };
            e.attachSync(f);
            assert.doesNotThrow(function () {
                e.post("A");
            });
            chai_1.expect(callCount).to.equal(100);
        });
        it("should allow attaching another event", function () {
            var e = new AnyEvent();
            var f = new AnyEvent();
            var calledWith = [];
            var g = function (s) {
                calledWith.push(s);
            };
            e.attachSync(f);
            f.attachSync(g);
            e.post("A");
            e.post("B");
            chai_1.expect(calledWith).to.deep.equal(["A", "B"]);
        });
    });
    describe("Async use", function () {
        beforeEach(function () {
            AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
        });
        afterEach(function () {
            AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
        });
        it("should not send events in the same cycle", function () {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachAsync(function (s) {
                calledWith.push(s);
            });
            e.post("A");
            chai_1.expect(calledWith).to.deep.equal([]);
        });
        it("should send events in the next cycle", function (done) {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachAsync(function (s) {
                calledWith.push(s);
            });
            e.post("A");
            setImmediate(function () {
                chai_1.expect(calledWith).to.deep.equal(["A"]);
                done();
            });
        });
        it("should not condense events by default", function (done) {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachAsync(function (s) {
                calledWith.push(s);
            });
            e.post("A");
            e.post("B");
            setImmediate(function () {
                chai_1.expect(calledWith).to.deep.equal(["A", "B"]);
                done();
            });
        });
        it("should condense events when asked", function (done) {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachAsync(function (s) {
                calledWith.push(s);
            }, { condensed: true });
            e.post("A");
            e.post("B");
            setImmediate(function () {
                chai_1.expect(calledWith).to.deep.equal(["B"]);
                done();
            });
        });
        it("should allow both condensed and uncondensed listener", function (done) {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachAsync(function (s) {
                calledWith.push(s);
            }, { condensed: true });
            var calledWith2 = [];
            e.attachAsync(function (s) {
                calledWith2.push(s);
            }, { condensed: false });
            var calledWith3 = [];
            e.attachAsync(function (s) {
                calledWith3.push(s);
            });
            e.post("A");
            e.post("B");
            setImmediate(function () {
                chai_1.expect(calledWith).to.deep.equal(["B"]);
                chai_1.expect(calledWith2).to.deep.equal(["A", "B"]);
                chai_1.expect(calledWith3).to.deep.equal(["A", "B"]);
                done();
            });
        });
        it("should use the Event as this parameter by default", function (done) {
            var e = new AnyEvent();
            e.attachAsync(function (s) {
                chai_1.expect(this).to.equal(e);
                done();
            });
            e.post("A");
        });
        it("should use a given object as this parameter when given", function (done) {
            var e = new AnyEvent();
            var t = {};
            e.attachAsync(t, function (s) {
                chai_1.expect(this).to.equal(t);
                done();
            });
            e.post("A");
        });
        it("should send events only to handlers attachAsynced at the time of posting", function (done) {
            var e = new AnyEvent();
            var calledWith = [];
            e.post("A");
            e.attachAsync(function (s) {
                calledWith.push(s);
            });
            e.post("B");
            setImmediate(function () {
                chai_1.expect(calledWith).to.deep.equal(["B"]);
                done();
            });
        });
        it("should not send events at all to detached event handlers", function (done) {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachAsync(function (s) {
                calledWith.push(s);
            });
            e.post("A");
            e.detach();
            e.post("B");
            setImmediate(function () {
                chai_1.expect(calledWith).to.deep.equal([]);
                done();
            });
        });
        it("should allow attachAsyncing event handlers within handlers", function (done) {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachAsync(function (s) {
                e.attachAsync(function (s) {
                    calledWith.push(s);
                });
            });
            e.post("A");
            e.post("B");
            setImmediate(function () {
                e.post("C");
                setImmediate(function () {
                    chai_1.expect(calledWith).to.deep.equal(["C", "C"]);
                    done();
                });
            });
        });
        it("should allow detaching event handlers within handlers", function (done) {
            var e = new AnyEvent();
            var calledWith = [];
            var f = function (s) {
                calledWith.push(s);
                e.detach(f);
            };
            e.attachAsync(f);
            e.post("A");
            e.post("B");
            setImmediate(function () {
                chai_1.expect(calledWith).to.deep.equal(["A"]);
                done();
            });
        });
        it("should allow setting different scheduler", function (done) {
            AsyncEvent.setScheduler(function (callback) {
                setTimeout(callback, 0);
            });
            var e = new AnyEvent();
            var calledWith = [];
            var f = function (s) {
                calledWith.push(s);
            };
            e.attachAsync(f);
            e.post("A");
            setImmediate(function () {
                chai_1.expect(calledWith).to.deep.equal([]);
            });
            setTimeout(function () {
                chai_1.expect(calledWith).to.deep.equal(["A"]);
                done();
            }, 0);
        });
        it("should allow attachAsyncing another event", function (done) {
            var e = new AnyEvent();
            var f = new AnyEvent();
            var calledWith = [];
            var g = function (s) {
                calledWith.push(s);
            };
            e.attachAsync(f);
            f.attachAsync(g);
            e.post("A");
            e.post("B");
            chai_1.expect(calledWith).to.deep.equal([]);
            setImmediate(function () {
                setImmediate(function () {
                    chai_1.expect(calledWith).to.deep.equal(["A", "B"]);
                    done();
                });
            });
        });
    });
    describe("Queued use", function () {
        it("should send events through the global event queue", function () {
            var e = new AnyEvent();
            var callCount = 0;
            var calledWith = [];
            e.attachQueued(function (s) {
                callCount++;
                calledWith.push(s);
            });
            e.post("A");
            chai_1.expect(callCount).to.equal(0);
            tsevents.flushOnce();
            chai_1.expect(callCount).to.equal(1);
            chai_1.expect(calledWith).to.deep.equal(["A"]);
        });
        it("should send events through a given event queue", function () {
            var q = new tsevents.EventQueue();
            var e = new AnyEvent();
            var callCount = 0;
            var calledWith = [];
            e.attachQueued(function (s) {
                callCount++;
                calledWith.push(s);
            }, { queue: q });
            e.post("A");
            chai_1.expect(callCount).to.equal(0);
            tsevents.flushOnce();
            chai_1.expect(callCount).to.equal(0);
            q.flushOnce();
            chai_1.expect(callCount).to.equal(1);
            chai_1.expect(calledWith).to.deep.equal(["A"]);
        });
        it("should not condense events by default", function () {
            var e = new AnyEvent();
            var callCount = 0;
            var calledWith = [];
            e.attachQueued(function (s) {
                callCount++;
                calledWith.push(s);
            });
            e.post("A");
            e.post("B");
            tsevents.flushOnce();
            chai_1.expect(callCount).to.equal(2);
            chai_1.expect(calledWith).to.deep.equal(["A", "B"]);
        });
        it("should condense events when asked", function () {
            var e = new AnyEvent();
            var callCount = 0;
            var calledWith = [];
            e.attachQueued(function (s) {
                callCount++;
                calledWith.push(s);
            }, { condensed: true });
            e.post("A");
            e.post("B");
            tsevents.flushOnce();
            chai_1.expect(callCount).to.equal(1);
            chai_1.expect(calledWith).to.deep.equal(["B"]);
        });
        it("should use the Event as this parameter by default", function () {
            var e = new AnyEvent();
            e.attachQueued(function (s) {
                chai_1.expect(this).to.equal(e);
            });
            e.post("A");
            tsevents.flushOnce();
        });
        it("should use a given object as this parameter when given", function () {
            var e = new AnyEvent();
            var t = {};
            e.attachQueued(t, function (s) {
                chai_1.expect(this).to.equal(t);
            });
            e.post("A");
            tsevents.flushOnce();
        });
        it("should send events only to handlers attachQueueded at the time of posting", function () {
            var e = new AnyEvent();
            var calledWith = [];
            e.post("A");
            e.attachQueued(function (s) {
                calledWith.push(s);
            });
            e.post("B");
            tsevents.flushOnce();
            chai_1.expect(calledWith).to.deep.equal(["B"]);
        });
        it("should not send events at all to detached event handlers", function () {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachQueued(function (s) {
                calledWith.push(s);
            });
            e.post("A");
            e.detach();
            e.post("B");
            tsevents.flushOnce();
            chai_1.expect(calledWith).to.deep.equal([]);
        });
        it("should allow attachQueueding event handlers within handlers", function () {
            var e = new AnyEvent();
            var calledWith = [];
            e.attachQueued(function (s) {
                e.attachQueued(function (s) {
                    calledWith.push(s);
                });
            });
            e.post("A");
            e.post("B");
            tsevents.flushOnce();
            e.post("C");
            tsevents.flushOnce();
            chai_1.expect(calledWith).to.deep.equal(["C", "C"]);
        });
        it("should allow detaching event handlers within handlers", function () {
            var e = new AnyEvent();
            var calledWith = [];
            var f = function (s) {
                calledWith.push(s);
                e.detach(f);
            };
            e.attachQueued(f);
            e.post("A");
            e.post("B");
            tsevents.flushOnce();
            chai_1.expect(calledWith).to.deep.equal(["A"]);
        });
        it("should allow attachQueueding another event", function () {
            var e = new AnyEvent();
            var f = new AnyEvent();
            var calledWith = [];
            var g = function (s) {
                calledWith.push(s);
            };
            e.attachQueued(f);
            f.attachQueued(g);
            e.post("A");
            e.post("B");
            tsevents.flush();
            chai_1.expect(calledWith).to.deep.equal(["A", "B"]);
        });
    });
});
describe("VoidAnyEvent", function () {
    it("should allow sending event without parameters", function (done) {
        var e = new tsevents.VoidAnyEvent();
        var callCount = 0;
        e.attachSync(function () {
            callCount++;
        });
        e.post();
        chai_1.expect(callCount).to.equal(1);
        done();
    });
});
describe("ErrorAnyEvent", function () {
    it("should throw on posting without handlers", function () {
        var e = new tsevents.ErrorAnyEvent();
        assert.throws(function () {
            e.post(new Error("test error"));
        });
    });
    it("should not throw on posting with handlers", function () {
        var e = new tsevents.ErrorAnyEvent();
        e.attachSync(function (error) {
            // nothing
        });
        assert.doesNotThrow(function () {
            e.post(new Error("test error"));
        });
    });
});
//# sourceMappingURL=test-any-event.js.map