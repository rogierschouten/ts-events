// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/test.d.ts"/>
var assert = require("assert");
var chai = require("chai");
var expect = chai.expect;
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
            expect(g1 instanceof EventQueue).to.equal(true);
        });
        it("should return the same instance every time", function () {
            var g1 = EventQueue.global();
            var g2 = EventQueue.global();
            expect(g1).to.equal(g2);
        });
    });
    describe("add()", function () {
        it("should not call a handler", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            expect(callCount).to.equal(0);
        });
    });
    describe("flushOnce()", function () {
        it("should call a handler", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flushOnce();
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });
        it("should not call a recursively inserted handler", function () {
            var callCount = 0;
            eq.add(function () {
                eq.add(function () {
                    callCount++;
                });
            });
            eq.flushOnce();
            expect(callCount).to.equal(0);
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });
    });
    describe("flushEmpty()", function () {
        it("should call a handler", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", function () {
            var callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flushEmpty();
            eq.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should call a recursively inserted handler", function () {
            var callCount = 0;
            eq.add(function () {
                eq.add(function () {
                    callCount++;
                });
            });
            eq.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should throw for endless loop after 10 times by default", function () {
            var callCount = 0;
            var f = function () {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws(function () {
                eq.flushEmpty();
            });
            expect(callCount).to.equal(10);
        });
        it("should throw for endless loop after given # times", function () {
            var callCount = 0;
            var f = function () {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws(function () {
                eq.flushEmpty(5);
            });
            expect(callCount).to.equal(5);
        });
        it("should function after throwing", function () {
            var callCount = 0;
            var f = function () {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws(function () {
                eq.flushEmpty(5);
            });
            callCount = 0;
            eq.add(function () {
                callCount++;
            });
            eq.flushEmpty();
            expect(callCount).to.equal(1);
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
                eq.flushEmpty(null);
            });
            expect(callCount).to.equal(100);
        });
    });
});
//# sourceMappingURL=test-event-queue.js.map