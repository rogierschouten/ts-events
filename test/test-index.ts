// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../typings/test.d.ts"/>

import assert = require("assert");
import chai = require("chai");
import expect = chai.expect;

import tsevents = require("../index");

describe("index", (): void => {

    var eq: tsevents.EventQueue;

    beforeEach((): void => {
        tsevents.EventQueue.resetGlobal();
        eq = tsevents.EventQueue.global();
    });


    describe("flushOnce()", (): void => {
        it("should call a handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            tsevents.flushOnce();
            expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            tsevents.flushOnce();
            tsevents.flushOnce();
            expect(callCount).to.equal(1);
        });
        it("should not call a recursively inserted handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                eq.add((): void => {
                    callCount++;
                });
            });
            tsevents.flushOnce();
            expect(callCount).to.equal(0);
            tsevents.flushOnce();
            expect(callCount).to.equal(1);
        });
    });

    describe("flushEmpty()", (): void => {
        it("should call a handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            tsevents.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            tsevents.flushEmpty();
            tsevents.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should call a recursively inserted handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                eq.add((): void => {
                    callCount++;
                });
            });
            tsevents.flushEmpty();
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
                tsevents.flushEmpty();
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
                tsevents.flushEmpty(5);
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
                tsevents.flushEmpty(5);
            });

            callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flushEmpty();
            expect(callCount).to.equal(1);
        });
        it("should not throw for endless loop when set to null", (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                if (callCount < 100) {
                    eq.add(f);
                }
            };
            eq.add(f);
            assert.doesNotThrow((): void => {
                tsevents.flushEmpty(null);
            });
            expect(callCount).to.equal(100);
        });
    });
});
