// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../typings/tsd.d.ts"/>

import assert = require("assert");
import {expect} from "chai";

import objects = require("../lib/objects");

describe("objects", (): void => {
    describe("shallowEquals()", (): void => {
        it("should compare basic types", (): void => {
            expect(objects.shallowEquals(true, false)).to.equal(false);
            expect(objects.shallowEquals(true, true)).to.equal(true);
            expect(objects.shallowEquals(0, false)).to.equal(false);
            expect(objects.shallowEquals(0, 0)).to.equal(true);
            expect(objects.shallowEquals(0, 1)).to.equal(false);
            expect(objects.shallowEquals("A", "B")).to.equal(false);
            expect(objects.shallowEquals("A", "A")).to.equal(true);
        });
        it("should compare null", (): void => {
            expect(objects.shallowEquals(null, 0)).to.equal(false);
            expect(objects.shallowEquals(null, null)).to.equal(true);
            expect(objects.shallowEquals(null, {})).to.equal(false);
        });
        it("should compare objects", (): void => {
            expect(objects.shallowEquals({ condensed: true }, { condensed: false })).to.equal(false);
            expect(objects.shallowEquals({ condensed: true }, { condensed: true, b: "a" })).to.equal(false);
            expect(objects.shallowEquals({ condensed: true }, { condensed: true })).to.equal(true);
        });
        it("should compare arrays", (): void => {
            expect(objects.shallowEquals([1, 2], [2, 3])).to.equal(false);
            expect(objects.shallowEquals([1, 2], [2])).to.equal(false);
            expect(objects.shallowEquals([1, 2], { 1: true, 2: true })).to.equal(false);
            expect(objects.shallowEquals([1, 2], [1, 2])).to.equal(true);
        });
    });
});
