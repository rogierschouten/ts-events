// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
// License: ISC
/// <reference path="../../typings/tsd.d.ts"/>
"use strict";
function shallowEquals(a, b) {
    if (a === b) {
        return true;
    }
    if (typeof a !== typeof b) {
        return false;
    }
    switch (typeof a) {
        case "boolean":
        case "number":
        case "string":
        case "function":
        case "symbol":
        case "undefined":
            // already did === compare
            return false;
        case "object":
            if (a === null || b === null) {
                return false; // already compared ===
            }
            if (Array.isArray(a) || Array.isArray(b)) {
                if (!Array.isArray(a) || !Array.isArray(b)) {
                    return false;
                }
                if (a.length !== b.length) {
                    return false;
                }
                for (var i = 0; i < a.length; ++i) {
                    if (a[i] !== b[i]) {
                        return false;
                    }
                }
                return true;
            }
            var name;
            var namesA = [];
            var namesB = [];
            for (name in a) {
                if (a.hasOwnProperty(name)) {
                    namesA.push(name);
                }
            }
            for (name in b) {
                if (b.hasOwnProperty(name)) {
                    namesB.push(name);
                }
            }
            namesA.sort();
            namesB.sort();
            if (namesA.join(",") !== namesB.join(",")) {
                return false;
            }
            for (i = 0; i < namesA.length; ++i) {
                if (a[namesA[i]] !== b[namesA[i]]) {
                    return false;
                }
            }
            return true;
        default:
            return false;
    }
}
exports.shallowEquals = shallowEquals;
//# sourceMappingURL=objects.js.map