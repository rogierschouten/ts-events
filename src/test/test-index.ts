// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path='../../typings/tsd.d.ts'/>

import assert = require('assert');
import {expect} from 'chai';

import * as tsevents from '../index';

describe('index', (): void => {

    var eq: tsevents.EventQueue;

    beforeEach((): void => {
        tsevents.EventQueue.resetGlobal();
        eq = tsevents.EventQueue.global();
    });

    describe('queue()', (): void => {
        it('should return the global event queue', (): void => {
            expect(tsevents.queue()).to.equal(tsevents.EventQueue.global());
        });
    });

    describe('flushOnce()', (): void => {
        it('should call a handler', (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            tsevents.flushOnce();
            expect(callCount).to.equal(1);
        });
        it('should not call a handler twice', (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            tsevents.flushOnce();
            tsevents.flushOnce();
            expect(callCount).to.equal(1);
        });
        it('should not call a recursively inserted handler', (): void => {
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

    describe('flush()', (): void => {
        it('should call a handler', (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            tsevents.flush();
            expect(callCount).to.equal(1);
        });
        it('should not call a handler twice', (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            tsevents.flush();
            tsevents.flush();
            expect(callCount).to.equal(1);
        });
        it('should call a recursively inserted handler', (): void => {
            var callCount = 0;
            eq.add((): void => {
                eq.add((): void => {
                    callCount++;
                });
            });
            tsevents.flush();
            expect(callCount).to.equal(1);
        });
        it('should throw for endless loop after 10 times by default', (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws((): void => {
                tsevents.flush();
            });
            expect(callCount).to.equal(10);
        });
        it('should throw for endless loop after given # times', (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws((): void => {
                tsevents.flush(5);
            });
            expect(callCount).to.equal(5);
        });
        it('should function after throwing', (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws((): void => {
                tsevents.flush(5);
            });

            callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flush();
            expect(callCount).to.equal(1);
        });
        it('should not throw for endless loop when set to null', (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                if (callCount < 100) {
                    eq.add(f);
                }
            };
            eq.add(f);
            assert.doesNotThrow((): void => {
                tsevents.flush(null);
            });
            expect(callCount).to.equal(100);
        });
    });
});
