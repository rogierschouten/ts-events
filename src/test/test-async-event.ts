// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../../typings/tsd.d.ts"/>

import assert = require("assert");
import {expect} from "chai";

import {AsyncEvent} from '../index';
import * as tsevents from '../index';

describe("AsyncEvent", (): void => {

    beforeEach((): void => {
        AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
    });

    afterEach((): void => {
        AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
    });

    it("should not send events in the same cycle", (): void => {
        var e = new AsyncEvent<string>();
        var calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post("A");
        expect(calledWith).to.deep.equal([]);
    });
    it("should send events in the next cycle", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        var calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post("A");
        setImmediate((): void => {
            expect(calledWith).to.deep.equal(["A"]);
            done();
        });
    });
    it("should not condense events by default", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        var calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post("A");
        e.post("B");
        setImmediate((): void => {
            expect(calledWith).to.deep.equal(["A", "B"]);
            done();
        });
    });
    it("should condense events when asked", (done: MochaDone): void => {
        var e = new AsyncEvent<string>({ condensed: true });
        var calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post("A");
        e.post("B");
        setImmediate((): void => {
            expect(calledWith).to.deep.equal(["B"]);
            done();
        });
    });
    it("should use the Event as this parameter by default", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        e.attach(function(s: string): void {
            expect(this).to.equal(e);
            done();
        });
        e.post("A");
    });
    it("should use a given object as this parameter when given", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        var t = {};
        e.attach(t, function(s: string): void {
            expect(this).to.equal(t);
            done();
        });
        e.post("A");
    });
    it("should send events only to handlers attached at the time of posting", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        var calledWith: string[] = [];
        e.post("A");
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post("B");
        setImmediate((): void => {
            expect(calledWith).to.deep.equal(["B"]);
            done();
        });
    });
    it("should not send events at all to detached event handlers", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        var calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post("A");
        e.detach();
        e.post("B");
        setImmediate((): void => {
            expect(calledWith).to.deep.equal([]);
            done();
        });
    });
    it("should allow attaching event handlers within handlers", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        var calledWith: string[] = [];
        e.attach((s: string): void => {
            e.attach((s: string): void => {
                calledWith.push(s);
            });
        });
        e.post("A");
        e.post("B");
        setImmediate((): void => {
            e.post("C");
            setImmediate((): void => {
                expect(calledWith).to.deep.equal(["C", "C"]);
                done();
            });
        });
    });
    it("should allow detaching event handlers within handlers", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        var calledWith: string[] = [];
        var f = (s: string): void => {
            calledWith.push(s);
            e.detach(f);
        };
        e.attach(f);
        e.post("A");
        e.post("B");
        setImmediate((): void => {
            expect(calledWith).to.deep.equal(["A"]);
            done();
        });
    });
    it("should allow setting different scheduler", (done: MochaDone): void => {
        AsyncEvent.setScheduler((callback: () => void): void => {
            setTimeout(callback, 0);
        });
        var e = new AsyncEvent<string>();
        var calledWith: string[] = [];
        var f = (s: string): void => {
            calledWith.push(s);
        };
        e.attach(f);
        e.post("A");
        setImmediate((): void => {
            expect(calledWith).to.deep.equal([]);
        });
        setTimeout((): void => {
            expect(calledWith).to.deep.equal(["A"]);
            done();
        }, 0);
    });
    it("should allow attaching another event", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        var f = new AsyncEvent<string>();
        var calledWith: string[] = [];
        var g = (s: string): void => {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
        e.post("A");
        e.post("B");
        expect(calledWith).to.deep.equal([]);
        setImmediate((): void => {
            setImmediate((): void => {
                expect(calledWith).to.deep.equal(["A", "B"]);
                done();
            });
        });
    });
    it("should condense attached async events into the same cycle", (done: MochaDone): void => {
        var e = new AsyncEvent<string>();
        var f = new AsyncEvent<string>();
        var calledWith: string[] = [];
        var g = (s: string): void => {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
        e.post("A");
        e.post("B");
        setImmediate((): void => {
            expect(calledWith).to.deep.equal(["A", "B"]);
            done();
        });
    });

});

describe("VoidAsyncEvent", (): void => {
    it("should allow sending event without parameters", (done: MochaDone): void => {
        var e = new tsevents.VoidAsyncEvent();
        var callCount = 0;
        e.attach((): void => {
            callCount++;
        });
        e.post();
        setImmediate((): void => {
            expect(callCount).to.equal(1);
            done();
        });
    });
});

describe("ErrorAsyncEvent", (): void => {
    it("should throw on posting without handlers", (): void => {
        var e = new tsevents.ErrorAsyncEvent();
        assert.throws((): void => {
            e.post(new Error("test error"));
        });
    });
    it("should not throw on posting with handlers", (): void => {
        var e = new tsevents.ErrorAsyncEvent();
        e.attach((error: Error): void => {
            // nothing
        });
        assert.doesNotThrow((): void => {
            e.post(new Error("test error"));
        });
    });
});
