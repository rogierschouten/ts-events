// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../typings/test.d.ts"/>

import assert = require("assert");
import chai = require("chai");
import expect = chai.expect;

import listenable = require("../lib/listenable");
import Listener = listenable.Listener;
import Listenable = listenable.Listenable;


class ListenerSub extends Listenable<string> {

    public content(): Listener<string>[] {
        return this._copyListeners();
    }
}

describe("Listenable", (): void => {

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
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: f, deleted: false }]);
        });
        it("should take a boundTo and a handler", (): void => {
            var t = {};
            var f = (s: string): void => {
                // nothing
            };
            l.attach(t, f);
            expect(l.content()).to.deep.equal([{ boundTo: t, handler: f, deleted: false }]);
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

        beforeEach((): void => {
            l.attach(f);
            l.attach(t, f);
            l.attach(g);
            l.attach(t, g);
        });

        it("should delete by handler", (): void => {
            l.detach(f);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: g, deleted: false },
                { boundTo: t, handler: g, deleted: false }
            ]);
        });
        it("should delete by boundTo", (): void => {
            l.detach(t);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false },
                { boundTo: undefined, handler: g, deleted: false }
            ]);
        });
        it("should delete by boundTo and handler", (): void => {
            l.detach(t, f);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false },
                { boundTo: undefined, handler: g, deleted: false },
                { boundTo: t, handler: g, deleted: false }
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
