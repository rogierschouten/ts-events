// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../../typings/tsd.d.ts"/>

import assert = require("assert");
import {expect} from "chai";

import {SyncEvent} from '../index';
import * as tsevents from '../index';

require("source-map-support").install();

describe("SyncEvent", (): void => {

    var defaultRecursionDepth = SyncEvent.MAX_RECURSION_DEPTH;

    afterEach((): void => {
        SyncEvent.MAX_RECURSION_DEPTH = defaultRecursionDepth;
    });

    it("should send events", (): void => {
        var e = new SyncEvent<string>();
        var calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post("A");
        expect(calledWith).to.deep.equal(["A"]);
    });
    it("should use the Event as this parameter by default", (): void => {
        var e = new SyncEvent<string>();
        e.attach(function(s: string): void {
            expect(this).to.equal(e);
        });
        e.post("A");
    });
    it("should use a given object as this parameter when given", (): void => {
        var e = new SyncEvent<string>();
        var t = {};
        e.attach(t, function(s: string): void {
            expect(this).to.equal(t);
        });
        e.post("A");
    });
    it("should send events only to handlers attached at the time of posting", (): void => {
        var e = new SyncEvent<string>();
        var calledWith: string[] = [];
        e.post("A");
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post("B");
        expect(calledWith).to.deep.equal(["B"]);
    });
    it("should not send events at all to detached event handlers", (): void => {
        var e = new SyncEvent<string>();
        var calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.detach();
        e.post("A");
        expect(calledWith).to.deep.equal([]);
    });
    it("should allow attaching event handlers within handlers", (): void => {
        var e = new SyncEvent<string>();
        var calledWith: string[] = [];
        e.attach((s: string): void => {
            e.attach((s: string): void => {
                calledWith.push(s);
            });
        });
        e.post("A");
        e.post("B");
        expect(calledWith).to.deep.equal(["B"]);
    });
    it("should allow detaching event handlers within handlers", (): void => {
        var e = new SyncEvent<string>();
        var calledWith: string[] = [];
        var f = (s: string): void => {
            calledWith.push(s);
            e.detach(f);
        };
        e.attach(f);
        e.post("A");
        e.post("B");
        expect(calledWith).to.deep.equal(["A"]);
    });
    it("should protect against recursion", (): void => {
        var e = new SyncEvent<string>();
        var callCount: number = 0;
        var f = (s: string): void => {
            callCount++;
            e.post("A");
        };
        e.attach(f);
        assert.throws((): void => {
            e.post("A");
        });
        expect(callCount).to.equal(SyncEvent.MAX_RECURSION_DEPTH);
    });
    it("should allow disabling recursion protection", (): void => {
        SyncEvent.MAX_RECURSION_DEPTH = null;
        var e = new SyncEvent<string>();
        var callCount: number = 0;
        var f = (s: string): void => {
            callCount++;
            if (callCount < 100) {
                e.post("A");
            }
        };
        e.attach(f);
        assert.doesNotThrow((): void => {
            e.post("A");
        });
        expect(callCount).to.equal(100);
    });
    it("should allow attaching another event", (): void => {
        var e = new SyncEvent<string>();
        var f = new SyncEvent<string>();
        var calledWith: string[] = [];
        var g = (s: string): void => {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
        e.post("A");
        e.post("B");
        expect(calledWith).to.deep.equal(["A", "B"]);
    });
});

describe("VoidSyncEvent", (): void => {
    it("should allow sending event without parameters", (): void => {
        var e = new tsevents.VoidSyncEvent();
        var callCount = 0;
        e.attach((): void => {
            callCount++;
        });
        e.post();
        expect(callCount).to.equal(1);
    });
});

describe("ErrorSyncEvent", (): void => {
    it("should throw on posting without handlers", (): void => {
        var e = new tsevents.ErrorSyncEvent();
        assert.throws((): void => {
            e.post(new Error("test error"));
        });
    });
    it("should not throw on posting with handlers", (): void => {
        var e = new tsevents.ErrorSyncEvent();
        e.attach((error: Error): void => {
            // nothing
        });
        assert.doesNotThrow((): void => {
            e.post(new Error("test error"));
        });
    });
});
