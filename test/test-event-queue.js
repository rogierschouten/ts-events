// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/tsd.d.ts"/>
var assert = require("assert");
var chai_1 = require("chai");
var EventQueue = require("../lib/EventQueue");
describe("EventQueue", function () {
    var eq;
    beforeEach(function () {
        eq = new EventQueue();
    });
    describe("global()", function () {
        it("should create a global instance", function () {
            var g1 = EventQueue.global();
            var g2 = EventQueue.global();
            chai_1.expect(g1 instanceof EventQueue).to.equal(true);
        });
        it("should return the same instance every time", function () {
            var g1 = EventQueue.global();
            var g2 = EventQueue.global();
            chai_1.expect(g1).to.equal(g2);
        });
    });
    describe("add()", function () {
        it("should not call a handler", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            chai_1.expect(callCount).to.equal(0);
        });
    });
    describe("flushOnce()", function () {
        it("should call a handler", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flushOnce();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flushOnce();
            eq.flushOnce();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should not call a recursively inserted handler", function () {
            var callCount = 0;
            eq.add(function () {
                eq.add(function () {
                    callCount++;
                });
            });
            eq.flushOnce();
            chai_1.expect(callCount).to.equal(0);
            eq.flushOnce();
            chai_1.expect(callCount).to.equal(1);
        });
    });
    describe("flush()", function () {
        it("should call a handler", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flush();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flush();
            eq.flush();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should call a recursively inserted handler", function () {
            var callCount = 0;
            eq.add(function () {
                eq.add(function () {
                    callCount++;
                });
            });
            eq.flush();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should throw for endless loop after 10 times by default", function () {
            var callCount = 0;
            var f = function () {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws(function () {
                eq.flush();
            });
            chai_1.expect(callCount).to.equal(10);
        });
        it("should throw for endless loop after given # times", function () {
            var callCount = 0;
            var f = function () {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws(function () {
                eq.flush(5);
            });
            chai_1.expect(callCount).to.equal(5);
        });
        it("should function after throwing", function () {
            var callCount = 0;
            var f = function () {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws(function () {
                eq.flush(5);
            });
            callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flush();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should not throw for endless loop when set to undefined", function () {
            var callCount = 0;
            var f = function () {
                callCount++;
                if (callCount < 100) {
                    eq.add(f);
                }
            };
            eq.add(f);
            assert.doesNotThrow(function () {
                eq.flush(null);
            });
            chai_1.expect(callCount).to.equal(100);
        });
    });
    describe("empty()", function () {
        it("should be true when empty", function () {
            chai_1.expect(eq.empty()).to.equal(true);
        });
        it("should be false when non-empty", function () {
            eq.add(function () { });
            chai_1.expect(eq.empty()).to.equal(false);
        });
        it("should be true when flushed empty", function () {
            eq.add(function () { });
            eq.flush();
            chai_1.expect(eq.empty()).to.equal(true);
        });
    });
    describe("evtFilled", function () {
        var callCount;
        beforeEach(function () {
            callCount = 0;
            eq.evtFilled.attach(function (p) {
                chai_1.expect(p).to.equal(eq);
                callCount++;
            });
        });
        it("should be triggered for first added event", function () {
            eq.add(function () { });
            chai_1.expect(callCount).to.equal(1);
        });
        it("should not be triggered for second added event", function () {
            eq.add(function () { });
            eq.add(function () { });
            chai_1.expect(callCount).to.equal(1);
        });
        it("should not be triggered when adding after flush", function () {
            eq.add(function () { });
            chai_1.expect(callCount).to.equal(1);
            eq.flush();
            eq.add(function () { });
            chai_1.expect(callCount).to.equal(2);
        });
        it("should not be triggered when adding after flushOnce", function () {
            eq.add(function () { });
            chai_1.expect(callCount).to.equal(1);
            eq.flushOnce();
            eq.add(function () { });
            chai_1.expect(callCount).to.equal(2);
        });
        it("should not be triggered when temporarily empty during flush", function () {
            eq.add(function () {
                eq.add(function () { });
            });
            chai_1.expect(callCount).to.equal(1);
            eq.flush();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should not be triggered when adding after flushOnce did not clear the queue", function () {
            eq.add(function () {
                eq.add(function () { });
            });
            chai_1.expect(callCount).to.equal(1);
            eq.flushOnce();
            eq.add(function () { });
            chai_1.expect(callCount).to.equal(1);
        });
    });
    describe("evtDrained", function () {
        var callCount;
        beforeEach(function () {
            callCount = 0;
            eq.evtDrained.attach(function (p) {
                chai_1.expect(p).to.equal(eq);
                callCount++;
            });
        });
        it("should be triggered after flush()", function () {
            eq.add(function () {
                chai_1.expect(callCount).to.equal(0);
            });
            eq.flush();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should be triggered after flush() if it needs multiple iterations", function () {
            eq.add(function () {
                eq.add(function () {
                    chai_1.expect(callCount).to.equal(0);
                });
                chai_1.expect(callCount).to.equal(0);
            });
            eq.flush();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should be triggered after flushOnce() if it empties the queue", function () {
            eq.add(function () {
                chai_1.expect(callCount).to.equal(0);
            });
            eq.flushOnce();
            chai_1.expect(callCount).to.equal(1);
        });
        it("should not be triggered after flushOnce() if it does not empty the queue", function () {
            eq.add(function () {
                eq.add(function () { });
            });
            eq.flushOnce();
            chai_1.expect(callCount).to.equal(0);
        });
        it("should not be triggered when temporarily empty during flush", function () {
            eq.add(function () {
                chai_1.expect(callCount).to.equal(0);
                eq.add(function () { });
            });
            eq.flush();
        });
    });
});
//# sourceMappingURL=test-event-queue.js.map