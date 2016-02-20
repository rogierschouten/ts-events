// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path='../../typings/tsd.d.ts'/>

import assert = require('assert');
import {expect} from 'chai';

import {AnyEvent, AsyncEvent, SyncEvent} from '../index';
import * as tsevents from '../index';

function wait(callback: () => void): void {
    if (typeof window === 'undefined') {
        setImmediate(callback);
    } else {
        setTimeout(callback, 0);
    }
}

describe('AnyEvent', (): void => {

    describe('Sync use', (): void => {
        var defaultRecursionDepth = SyncEvent.MAX_RECURSION_DEPTH;

        afterEach((): void => {
            SyncEvent.MAX_RECURSION_DEPTH = defaultRecursionDepth;
        });

        it('should send events', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachSync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should use the Event as this parameter by default', (): void => {
            var e = new AnyEvent<string>();
            e.attachSync(function(s: string): void {
                expect(this).to.equal(e);
            });
            e.post('A');
        });
        it('should use a given object as this parameter when given', (): void => {
            var e = new AnyEvent<string>();
            var t = {};
            e.attachSync(t, function(s: string): void {
                expect(this).to.equal(t);
            });
            e.post('A');
        });
        it('should send events only to handlers attached at the time of posting', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.post('A');
            e.attachSync((s: string): void => {
                calledWith.push(s);
            });
            e.post('B');
            expect(calledWith).to.deep.equal(['B']);
        });
        it('should not send events at all to detached event handlers', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachSync((s: string): void => {
                calledWith.push(s);
            });
            e.detach();
            e.post('A');
            expect(calledWith).to.deep.equal([]);
        });
        it('should allow attaching event handlers within handlers', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachSync((s: string): void => {
                e.attachSync((s: string): void => {
                    calledWith.push(s);
                });
            });
            e.post('A');
            e.post('B');
            expect(calledWith).to.deep.equal(['B']);
        });
        it('should allow detaching event handlers within handlers', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            var f = (s: string): void => {
                calledWith.push(s);
                e.detach(f);
            };
            e.attachSync(f);
            e.post('A');
            e.post('B');
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should protect against recursion', (): void => {
            var e = new AnyEvent<string>();
            var callCount: number = 0;
            var f = (s: string): void => {
                callCount++;
                e.post('A');
            };
            e.attachSync(f);
            assert.throws((): void => {
                e.post('A');
            });
            expect(callCount).to.equal(SyncEvent.MAX_RECURSION_DEPTH);
        });
        it('should allow disabling recursion protection', (): void => {
            SyncEvent.MAX_RECURSION_DEPTH = null;
            var e = new AnyEvent<string>();
            var callCount: number = 0;
            var f = (s: string): void => {
                callCount++;
                if (callCount < 100) {
                    e.post('A');
                }
            };
            e.attachSync(f);
            assert.doesNotThrow((): void => {
                e.post('A');
            });
            expect(callCount).to.equal(100);
        });
        it('should allow attaching another event', (): void => {
            var e = new AnyEvent<string>();
            var f = new AnyEvent<string>();
            var calledWith: string[] = [];
            var g = (s: string): void => {
                calledWith.push(s);
            };
            e.attachSync(f);
            f.attachSync(g);
            e.post('A');
            e.post('B');
            expect(calledWith).to.deep.equal(['A', 'B']);
        });
    });

    describe('Async use', (): void => {
        beforeEach((): void => {
            AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
        });

        afterEach((): void => {
            AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
        });

        it('should not send events in the same cycle', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            expect(calledWith).to.deep.equal([]);
        });
        it('should send events in the next cycle', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            wait((): void => {
                expect(calledWith).to.deep.equal(['A']);
                done();
            });
        });
        it('should not condense events by default', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            e.post('B');
            wait((): void => {
                expect(calledWith).to.deep.equal(['A', 'B']);
                done();
            });
        });
        it('should condense events when asked', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith.push(s);
            }, { condensed: true });
            e.post('A');
            e.post('B');
            wait((): void => {
                expect(calledWith).to.deep.equal(['B']);
                done();
            });
        });
        it('should allow both condensed and uncondensed listener', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith.push(s);
            }, { condensed: true });
            var calledWith2: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith2.push(s);
            }, { condensed: false });
            var calledWith3: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith3.push(s);
            });
            e.post('A');
            e.post('B');
            wait((): void => {
                expect(calledWith).to.deep.equal(['B']);
                expect(calledWith2).to.deep.equal(['A', 'B']);
                expect(calledWith3).to.deep.equal(['A', 'B']);
                done();
            });
        });
        it('should use the Event as this parameter by default', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            e.attachAsync(function(s: string): void {
                expect(this).to.equal(e);
                done();
            });
            e.post('A');
        });
        it('should use a given object as this parameter when given', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var t = {};
            e.attachAsync(t, function(s: string): void {
                expect(this).to.equal(t);
                done();
            });
            e.post('A');
        });
        it('should send events only to handlers attachAsynced at the time of posting', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.post('A');
            e.attachAsync((s: string): void => {
                calledWith.push(s);
            });
            e.post('B');
            wait((): void => {
                expect(calledWith).to.deep.equal(['B']);
                done();
            });
        });
        it('should not send events at all to detached event handlers', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            e.detach();
            e.post('B');
            wait((): void => {
                expect(calledWith).to.deep.equal([]);
                done();
            });
        });
        it('should allow attachAsyncing event handlers within handlers', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachAsync((s: string): void => {
                e.attachAsync((s: string): void => {
                    calledWith.push(s);
                });
            });
            e.post('A');
            e.post('B');
            wait((): void => {
                e.post('C');
                wait((): void => {
                    expect(calledWith).to.deep.equal(['C', 'C']);
                    done();
                });
            });
        });
        it('should allow detaching event handlers within handlers', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            var f = (s: string): void => {
                calledWith.push(s);
                e.detach(f);
            };
            e.attachAsync(f);
            e.post('A');
            e.post('B');
            wait((): void => {
                expect(calledWith).to.deep.equal(['A']);
                done();
            });
        });
        it('should allow setting different scheduler', (done: MochaDone): void => {
            AsyncEvent.setScheduler((callback: () => void): void => {
                done();
            });
            var e = new AnyEvent<string>();
            var f = (s: string): void => {
                // nothing
            };
            e.attachAsync(f);
            e.post('A');
        });
        it('should allow attachAsyncing another event', (done: MochaDone): void => {
            var e = new AnyEvent<string>();
            var f = new AnyEvent<string>();
            var calledWith: string[] = [];
            var g = (s: string): void => {
                calledWith.push(s);
            };
            e.attachAsync(f);
            f.attachAsync(g);
            e.post('A');
            e.post('B');
            expect(calledWith).to.deep.equal([]);
            wait((): void => {
                wait((): void => {
                    expect(calledWith).to.deep.equal(['A', 'B']);
                    done();
                });
            });
        });
    });

    describe('Queued use', (): void => {
        it('should send events through the global event queue', (): void => {
            var e = new AnyEvent<string>();
            var callCount = 0;
            var calledWith: string[] = [];
            e.attachQueued((s: string): void => {
                callCount++;
                calledWith.push(s);
            });
            e.post('A');
            expect(callCount).to.equal(0);
            tsevents.flushOnce();
            expect(callCount).to.equal(1);
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should send events through a given event queue', (): void => {
            var q = new tsevents.EventQueue();
            var e = new AnyEvent<string>();
            var callCount = 0;
            var calledWith: string[] = [];
            e.attachQueued((s: string): void => {
                callCount++;
                calledWith.push(s);
            }, { queue: q });
            e.post('A');
            expect(callCount).to.equal(0);
            tsevents.flushOnce();
            expect(callCount).to.equal(0);
            q.flushOnce();
            expect(callCount).to.equal(1);
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should not condense events by default', (): void => {
            var e = new AnyEvent<string>();
            var callCount = 0;
            var calledWith: string[] = [];
            e.attachQueued((s: string): void => {
                callCount++;
                calledWith.push(s);
            });
            e.post('A');
            e.post('B');
            tsevents.flushOnce();
            expect(callCount).to.equal(2);
            expect(calledWith).to.deep.equal(['A', 'B']);
        });
        it('should condense events when asked', (): void => {
            var e = new AnyEvent<string>();
            var callCount = 0;
            var calledWith: string[] = [];
            e.attachQueued((s: string): void => {
                callCount++;
                calledWith.push(s);
            }, { condensed: true });
            e.post('A');
            e.post('B');
            tsevents.flushOnce();
            expect(callCount).to.equal(1);
            expect(calledWith).to.deep.equal(['B']);
        });
        it('should use the Event as this parameter by default', (): void => {
            var e = new AnyEvent<string>();
            e.attachQueued(function(s: string): void {
                expect(this).to.equal(e);
            });
            e.post('A');
            tsevents.flushOnce();
        });
        it('should use a given object as this parameter when given', (): void => {
            var e = new AnyEvent<string>();
            var t = {};
            e.attachQueued(t, function(s: string): void {
                expect(this).to.equal(t);
            });
            e.post('A');
            tsevents.flushOnce();
        });
        it('should send events only to handlers attachQueueded at the time of posting', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.post('A');
            e.attachQueued((s: string): void => {
                calledWith.push(s);
            });
            e.post('B');
            tsevents.flushOnce();
            expect(calledWith).to.deep.equal(['B']);
        });
        it('should not send events at all to detached event handlers', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachQueued((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            e.detach();
            e.post('B');
            tsevents.flushOnce();
            expect(calledWith).to.deep.equal([]);
        });
        it('should allow attachQueueding event handlers within handlers', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            e.attachQueued((s: string): void => {
                e.attachQueued((s: string): void => {
                    calledWith.push(s);
                });
            });
            e.post('A');
            e.post('B');
            tsevents.flushOnce();
            e.post('C');
            tsevents.flushOnce();
            expect(calledWith).to.deep.equal(['C', 'C']);
        });
        it('should allow detaching event handlers within handlers', (): void => {
            var e = new AnyEvent<string>();
            var calledWith: string[] = [];
            var f = (s: string): void => {
                calledWith.push(s);
                e.detach(f);
            };
            e.attachQueued(f);
            e.post('A');
            e.post('B');
            tsevents.flushOnce();
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should allow attachQueueding another event', (): void => {
            var e = new AnyEvent<string>();
            var f = new AnyEvent<string>();
            var calledWith: string[] = [];
            var g = (s: string): void => {
                calledWith.push(s);
            };
            e.attachQueued(f);
            f.attachQueued(g);
            e.post('A');
            e.post('B');
            tsevents.flush();
            expect(calledWith).to.deep.equal(['A', 'B']);
        });
    });


});

describe('VoidAnyEvent', (): void => {
    it('should allow sending event without parameters', (done: MochaDone): void => {
        var e = new tsevents.VoidAnyEvent();
        var callCount = 0;
        e.attachSync((): void => {
            callCount++;
        });
        e.post();
        expect(callCount).to.equal(1);
        done();
    });
});

describe('ErrorAnyEvent', (): void => {
    it('should throw on posting without handlers', (): void => {
        var e = new tsevents.ErrorAnyEvent();
        assert.throws((): void => {
            e.post(new Error('test error'));
        });
    });
    it('should not throw on posting with handlers', (): void => {
        var e = new tsevents.ErrorAnyEvent();
        e.attachSync((error: Error): void => {
            // nothing
        });
        assert.doesNotThrow((): void => {
            e.post(new Error('test error'));
        });
    });
});
