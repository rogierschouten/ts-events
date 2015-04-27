// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="../typings/test.d.ts"/>
var assert = require("assert");
var chai = require("chai");
var expect = chai.expect;
var listenable = require("../lib/listenable");
var Listenable = listenable.Listenable;
var ListenerSub = (function (_super) {
    __extends(ListenerSub, _super);
    function ListenerSub() {
        _super.apply(this, arguments);
    }
    ListenerSub.prototype.content = function () {
        return this._copyListeners();
    };
    return ListenerSub;
})(Listenable);
describe("Listenable", function () {
    var l;
    beforeEach(function () {
        l = new ListenerSub();
    });
    describe("attach()", function () {
        it("should take a handler", function () {
            var f = function (s) {
                // nothing
            };
            l.attach(f);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: f, deleted: false }]);
        });
        it("should take a boundTo and a handler", function () {
            var t = {};
            var f = function (s) {
                // nothing
            };
            l.attach(t, f);
            expect(l.content()).to.deep.equal([{ boundTo: t, handler: f, deleted: false }]);
        });
    });
    describe("detach()", function () {
        var t = {};
        var f = function (s) {
            // nothing
        };
        var g = function (s) {
            // nothing
        };
        beforeEach(function () {
            l.attach(f);
            l.attach(t, f);
            l.attach(g);
            l.attach(t, g);
        });
        it("should delete by handler", function () {
            l.detach(f);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: g, deleted: false },
                { boundTo: t, handler: g, deleted: false }
            ]);
        });
        it("should delete by boundTo", function () {
            l.detach(t);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false },
                { boundTo: undefined, handler: g, deleted: false }
            ]);
        });
        it("should delete by boundTo and handler", function () {
            l.detach(t, f);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false },
                { boundTo: undefined, handler: g, deleted: false },
                { boundTo: t, handler: g, deleted: false }
            ]);
        });
        it("should delete all", function () {
            l.detach();
            expect(l.content()).to.deep.equal([]);
        });
        it("should be ok if no handlers", function () {
            l = new ListenerSub();
            assert.doesNotThrow(function () {
                l.detach();
                l.detach({});
            });
        });
    });
});
//# sourceMappingURL=test-listenable.js.map