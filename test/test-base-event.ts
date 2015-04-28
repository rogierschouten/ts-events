// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../typings/test.d.ts"/>

import assert = require("assert");
import chai = require("chai");
import expect = chai.expect;

import baseEvent = require("../lib/base-event");
import Listener = baseEvent.Listener;
import BaseEvent = baseEvent.BaseEvent;

import tsevent = require("../index");
import SyncEvent = tsevent.SyncEvent;
import AsyncEvent = tsevent.AsyncEvent;
import QueuedEvent = tsevent.QueuedEvent;

class ListenerSub extends BaseEvent<string> {

    public content(): Listener<string>[] {
        return this._copyListeners();
    }
}

describe("BaseEvent", (): void => {

    var l: ListenerSub;

    beforeEach((): void => {
        l = new ListenerSub();
    });

    describe("attach()", (): void => {
        it("should take a handler", (): void => {
            var f = (s: string): void => {
                // nothing
            };
            l.attach(f);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: f, deleted: false, event: undefined }]);
        });
        it("should take a boundTo and a handler", (): void => {
            var t = {};
            var f = (s: string): void => {
                // nothing
            };
            l.attach(t, f);
            expect(l.content()).to.deep.equal([{ boundTo: t, handler: f, deleted: false, event: undefined }]);
        });
        it("should take a SyncEvent", (): void => {
            var e = new SyncEvent<string>();
            l.attach(e);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: undefined, deleted: false, event: e }]);
        });
        it("should take an AsyncEvent", (): void => {
            var e = new AsyncEvent<string>();
            l.attach(e);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: undefined, deleted: false, event: e }]);
        });
        it("should take a QueuedEvent", (): void => {
            var e = new QueuedEvent<string>();
            l.attach(e);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: undefined, deleted: false, event: e }]);
        });
    });

    describe("detach()", (): void => {
        var t = {};
        var f = (s: string): void => {
            // nothing
        };
        var g = (s: string): void => {
            // nothing
        };
        var e = new SyncEvent<string>();

        beforeEach((): void => {
            l.attach(f);
            l.attach(t, f);
            l.attach(g);
            l.attach(t, g);
            l.attach(e);
        });

        it("should delete by handler", (): void => {
            l.detach(f);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: g, deleted: false, event: undefined },
                { boundTo: t, handler: g, deleted: false, event: undefined },
                { boundTo: undefined, handler: undefined, deleted: false, event: e }
            ]);
        });
        it("should delete by boundTo", (): void => {
            l.detach(t);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false, event: undefined },
                { boundTo: undefined, handler: g, deleted: false, event: undefined },
                { boundTo: undefined, handler: undefined, deleted: false, event: e }
            ]);
        });
        it("should delete by boundTo and handler", (): void => {
            l.detach(t, f);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false, event: undefined },
                { boundTo: undefined, handler: g, deleted: false, event: undefined },
                { boundTo: t, handler: g, deleted: false, event: undefined },
                { boundTo: undefined, handler: undefined, deleted: false, event: e }
            ]);
        });
        it("should delete by event", (): void => {
            l.detach(e);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false, event: undefined },
                { boundTo: t, handler: f, deleted: false, event: undefined },
                { boundTo: undefined, handler: g, deleted: false, event: undefined },
                { boundTo: t, handler: g, deleted: false, event: undefined }
            ]);
        });
        it("should delete all", (): void => {
            l.detach();
            expect(l.content()).to.deep.equal([]);
        });
        it("should be ok if no handlers", (): void => {
            l = new ListenerSub();
            assert.doesNotThrow((): void => {
                l.detach();
                l.detach({});
            });
        });
    });

});
