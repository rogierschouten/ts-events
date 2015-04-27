// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../typings/test.d.ts"/>

import assert = require("assert");
import chai = require("chai");
import expect = chai.expect;

import EventQueue = require("../lib/EventQueue");

describe("EventQueue", (): void => {

    var eq: EventQueue;

    beforeEach((): void => {
        eq = new EventQueue();
    });

    describe("global()", (): void => {
        it("should create a global instance", (): void => {
            var g1 = EventQueue.global();
            var g2 = EventQueue.global();
            expect(g1 instanceof EventQueue).to.equal(true);
        });
        it("should return the same instance every time", (): void => {
            var g1 = EventQueue.global();
            var g2 = EventQueue.global();
            expect(g1).to.equal(g2);
        });
    });

    describe("add()", (): void => {
        it("should not call a handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            expect(callCount).to.equal(0);
        })
    });

    describe("flushOnce()", (): void => {
        it("should call a handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flushOnce();
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });
        it("should not call a recursively inserted handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                eq.add((): void => {
                    callCount++;
                });
            });
            eq.flushOnce();
            expect(callCount).to.equal(0);
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });
    });

    describe("flushEmpty()", (): void => {
        it("should call a handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flushEmpty();
            eq.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should call a recursively inserted handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                eq.add((): void => {
                    callCount++;
                });
            });
            eq.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should throw for endless loop after 10 times by default", (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws((): void => {
                eq.flushEmpty();
            });
            expect(callCount).to.equal(10);
        });
        it("should throw for endless loop after given # times", (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws((): void => {
                eq.flushEmpty(5);
            });
            expect(callCount).to.equal(5);
        });
        it("should function after throwing", (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws((): void => {
                eq.flushEmpty(5);
            });

            callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should not throw for endless loop when set to undefined", (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                if (callCount < 100) {
                    eq.add(f);
                }
            };
            eq.add(f);
            assert.doesNotThrow((): void => {
                eq.flushEmpty(null);
            });
            expect(callCount).to.equal(100);
        });
    });
});
