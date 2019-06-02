// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>

import assert = require('assert');
import {expect} from 'chai';

import {EventType, AnyEvent, AsyncEvent, SyncEvent, VoidAnyEvent} from '../lib/index';
import * as tsevents from '../lib/index';

function wait(callback: () => void): void {
    if (typeof window === 'undefined') {
        setImmediate(callback);
    } else {
        setTimeout(callback, 0);
    }
}

describe('AnyEvent', (): void => {

    describe('evtFirstAttached', (): void => {
        it('should not be present unless constructor option specified', (): void => {
            const e = new VoidAnyEvent();
            expect(!!e.evtFirstAttached).to.equal(false);
        });
        it('should be called on first attach', (): void => {
            const e = new VoidAnyEvent({ monitorAttach: true });
            let callCount = 0;
            e.evtFirstAttached.attach((): void => {
                callCount++;
            });
            e.attach((): void => {
                // nothing
            });
            expect(callCount).to.equal(1);
        });
        it('should NOT be called on second attach', (): void => {
            const e = new VoidAnyEvent({ monitorAttach: true });
            let callCount = 0;
            e.evtFirstAttached.attach((): void => {
                callCount++;
            });
            e.attach((): void => {
                // nothing
            });
            e.attach((): void => {
                // nothing
            });
            expect(callCount).to.equal(1);
        });
        it('should be called on first attach after all detached', (): void => {
            const e = new VoidAnyEvent({ monitorAttach: true });
            let callCount = 0;
            e.evtFirstAttached.attach((): void => {
                callCount++;
            });
            e.attach((): void => {
                // nothing
            });
            e.detach();
            e.attach((): void => {
                // nothing
            });
            expect(callCount).to.equal(2);
        });
    });

    describe('evtLastDetached', (): void => {
        it('should not be present unless constructor option specified', (): void => {
            const e = new VoidAnyEvent();
            expect(!!e.evtLastDetached).to.equal(false);
        });
        it('should be called on last detach', (): void => {
            const e = new VoidAnyEvent({ monitorAttach: true });
            let callCount = 0;
            e.evtLastDetached.attach((): void => {
                callCount++;
            });
            e.attach((): void => {
                // nothing
            });
            e.detach();
            expect(callCount).to.equal(1);
        });
        it('should be called on last returned detach function', (): void => {
            const e = new VoidAnyEvent({ monitorAttach: true });
            let callCount = 0;
            e.evtLastDetached.attach((): void => {
                callCount++;
            });
            const f = e.attach((): void => {
                // nothing
            });
            f();
            expect(callCount).to.equal(1);
        });
        it('should NOT be called on second-last detach', (): void => {
            const e = new VoidAnyEvent({ monitorAttach: true });
            let callCount = 0;
            e.evtLastDetached.attach((): void => {
                callCount++;
            });
            const f1 = (): void => {
                // nothing
            };
            const f2 = (): void => {
                // nothing
            };
            e.attach(f1);
            e.attach(f2);
            e.detach(f2);
            expect(callCount).to.equal(0);
        });
        it('should be called on detach after attach-detach-attach', (): void => {
            const e = new VoidAnyEvent({ monitorAttach: true });
            let callCount = 0;
            e.evtLastDetached.attach((): void => {
                callCount++;
            });
            const f1 = (): void => {
                // nothing
            };
            e.attach(f1);
            e.detach(f1);
            e.attach(f1);
            e.detach(f1);
            expect(callCount).to.equal(2);
        });
    });

    describe('Sync use', (): void => {
        const defaultRecursionDepth = SyncEvent.MAX_RECURSION_DEPTH;

        afterEach((): void => {
            SyncEvent.MAX_RECURSION_DEPTH = defaultRecursionDepth;
        });

        it('should send events', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.attachSync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should allow generic attach', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.attach(EventType.Sync, (s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should allow generic attach without mode', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.attach((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should use the Event as this parameter by default', (): void => {
            const e = new AnyEvent<string>();
            e.attachSync(function(s: string): void {
                expect(this).to.equal(e);
            });
            e.post('A');
        });
        it('should use a given object as this parameter when given', (): void => {
            const e = new AnyEvent<string>();
            const t = {};
            e.attachSync(t, function(s: string): void {
                expect(this).to.equal(t);
            });
            e.post('A');
        });
        it('should send events only to handlers attached at the time of posting', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.post('A');
            e.attachSync((s: string): void => {
                calledWith.push(s);
            });
            e.post('B');
            expect(calledWith).to.deep.equal(['B']);
        });
        it('should not send events at all to detached event handlers', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.attachSync((s: string): void => {
                calledWith.push(s);
            });
            e.detach();
            e.post('A');
            expect(calledWith).to.deep.equal([]);
        });
        it('should allow attaching event handlers within handlers', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            const f = (s: string): void => {
                calledWith.push(s);
                e.detach(f);
            };
            e.attachSync(f);
            e.post('A');
            e.post('B');
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should protect against recursion', (): void => {
            const e = new AnyEvent<string>();
            let callCount: number = 0;
            const f = (s: string): void => {
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
            const e = new AnyEvent<string>();
            let callCount: number = 0;
            const f = (s: string): void => {
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
            const e = new AnyEvent<string>();
            const f = new AnyEvent<string>();
            const calledWith: string[] = [];
            const g = (s: string): void => {
                calledWith.push(s);
            };
            e.attachSync(f);
            f.attachSync(g);
            e.post('A');
            e.post('B');
            expect(calledWith).to.deep.equal(['A', 'B']);
        });
        it('should detach once() handlers', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.onceSync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            e.post('B');
            expect(calledWith).to.deep.equal(['A']);
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
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            expect(calledWith).to.deep.equal([]);
        });
        it('should allow generic attach', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.attach(EventType.Async, (s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            expect(calledWith).to.deep.equal([]);
        });
        it('should send events in the next cycle', (done: MochaDone): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith.push(s);
            }, { condensed: true });
            const calledWith2: string[] = [];
            e.attachAsync((s: string): void => {
                calledWith2.push(s);
            }, { condensed: false });
            const calledWith3: string[] = [];
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
            const e = new AnyEvent<string>();
            e.attachAsync(function(s: string): void {
                expect(this).to.equal(e);
                done();
            });
            e.post('A');
        });
        it('should use a given object as this parameter when given', (done: MochaDone): void => {
            const e = new AnyEvent<string>();
            const t = {};
            e.attachAsync(t, function(s: string): void {
                expect(this).to.equal(t);
                done();
            });
            e.post('A');
        });
        it('should send events only to handlers attachAsynced at the time of posting', (done: MochaDone): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
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
        it('should not send events at all to detached event handlers (returned function)', (done: MochaDone): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            const detacher = e.attachAsync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            detacher();
            e.post('B');
            wait((): void => {
                expect(calledWith).to.deep.equal([]);
                done();
            });
        });
        it('should allow attachAsyncing event handlers within handlers', (done: MochaDone): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            const f = (s: string): void => {
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
        it('should allow detaching event handlers within handlers (returned function)', (done: MochaDone): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            let detacher: () => void;
            const f = (s: string): void => {
                calledWith.push(s);
                detacher();
            };
            detacher = e.attachAsync(f);
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
            const e = new AnyEvent<string>();
            const f = (s: string): void => {
                // nothing
            };
            e.attachAsync(f);
            e.post('A');
        });
        it('should allow attachAsyncing another event', (done: MochaDone): void => {
            const e = new AnyEvent<string>();
            const f = new AnyEvent<string>();
            const calledWith: string[] = [];
            const g = (s: string): void => {
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
        it('should detach once() handlers', (done: MochaDone): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.onceAsync((s: string): void => {
                calledWith.push(s);
            });
            e.post('A');
            e.post('B');
            wait((): void => {
                expect(calledWith).to.deep.equal(['A']);
                wait((): void => {
                    expect(calledWith).to.deep.equal(['A']);
                    done();
                });
            });
        });
    });

    describe('Queued use', (): void => {
        it('should send events through the global event queue', (): void => {
            const e = new AnyEvent<string>();
            let callCount = 0;
            const calledWith: string[] = [];
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
        it('should allow generic attach', (): void => {
            const e = new AnyEvent<string>();
            let callCount = 0;
            const calledWith: string[] = [];
            e.attach(EventType.Queued, (s: string): void => {
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
            const q = new tsevents.EventQueue();
            const e = new AnyEvent<string>();
            let callCount = 0;
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            let callCount = 0;
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            let callCount = 0;
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            e.attachQueued(function(s: string): void {
                expect(this).to.equal(e);
            });
            e.post('A');
            tsevents.flushOnce();
        });
        it('should use a given object as this parameter when given', (): void => {
            const e = new AnyEvent<string>();
            const t = {};
            e.attachQueued(t, function(s: string): void {
                expect(this).to.equal(t);
            });
            e.post('A');
            tsevents.flushOnce();
        });
        it('should send events only to handlers attachQueueded at the time of posting', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            e.post('A');
            e.attachQueued((s: string): void => {
                calledWith.push(s);
            });
            e.post('B');
            tsevents.flushOnce();
            expect(calledWith).to.deep.equal(['B']);
        });
        it('should not send events at all to detached event handlers', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
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
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            const f = (s: string): void => {
                calledWith.push(s);
                e.detach(f);
            };
            e.attachQueued(f);
            e.post('A');
            e.post('B');
            tsevents.flushOnce();
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should allow detaching event handlers within handlers (returned function)', (): void => {
            const e = new AnyEvent<string>();
            const calledWith: string[] = [];
            let detacher: () => void;
            const f = (s: string): void => {
                calledWith.push(s);
                detacher();
            };
            detacher = e.attachQueued(f);
            e.post('A');
            e.post('B');
            tsevents.flushOnce();
            expect(calledWith).to.deep.equal(['A']);
        });
        it('should allow attachQueueding another event', (): void => {
            const e = new AnyEvent<string>();
            const f = new AnyEvent<string>();
            const calledWith: string[] = [];
            const g = (s: string): void => {
                calledWith.push(s);
            };
            e.attachQueued(f);
            f.attachQueued(g);
            e.post('A');
            e.post('B');
            tsevents.flush();
            expect(calledWith).to.deep.equal(['A', 'B']);
        });
        it('should detach once() event handlers', (): void => {
            const e = new AnyEvent<string>();
            let callCount = 0;
            const calledWith: string[] = [];
            e.onceQueued((s: string): void => {
                callCount++;
                calledWith.push(s);
            });
            e.post('A');
            e.post('B');
            expect(callCount).to.equal(0);
            tsevents.flushOnce();
            expect(callCount).to.equal(1);
            expect(calledWith).to.deep.equal(['A']);
            tsevents.flushOnce();
            expect(callCount).to.equal(1);
            expect(calledWith).to.deep.equal(['A']);
        });
    });


});

describe('VoidAnyEvent', (): void => {
    it('should allow sending event without parameters', (done: MochaDone): void => {
        const e = new tsevents.VoidAnyEvent();
        let callCount = 0;
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
        const e = new tsevents.ErrorAnyEvent();
        assert.throws((): void => {
            e.post(new Error('test error'));
        });
    });
    it('should not throw on posting with handlers', (): void => {
        const e = new tsevents.ErrorAnyEvent();
        e.attachSync((error: Error): void => {
            // nothing
        });
        assert.doesNotThrow((): void => {
            e.post(new Error('test error'));
        });
    });
});
