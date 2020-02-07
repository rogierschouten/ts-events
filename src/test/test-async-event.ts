// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>

import assert = require('assert');
import {expect} from 'chai';

import {AsyncEvent} from '../lib/index';
import * as tsevents from '../lib/index';

function wait(callback: () => void): void {
    if (typeof window === 'undefined') {
        setImmediate(callback);
    } else {
        setTimeout(callback, 0);
    }
}

describe('AsyncEvent', (): void => {

    beforeEach((): void => {
        AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
    });

    afterEach((): void => {
        AsyncEvent.setScheduler(AsyncEvent.defaultScheduler);
    });

    it('should not send events in the same cycle', (): void => {
        const e = new AsyncEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post('A');
        expect(calledWith).to.deep.equal([]);
    });
    it('should send events in the next cycle', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post('A');
        wait((): void => {
            expect(calledWith).to.deep.equal(['A']);
            done();
        });
    });
    it('should not condense events by default', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
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
        const e = new AsyncEvent<string>({ condensed: true });
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post('A');
        e.post('B');
        wait((): void => {
            expect(calledWith).to.deep.equal(['B']);
            done();
        });
    });
    it('should use the Event as this parameter by default', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        e.attach(function(s: string): void {
            expect(this).to.equal(e);
            done();
        });
        e.post('A');
    });
    it('should use a given object as this parameter when given', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        const t = {};
        e.attach(t, function(s: string): void {
            expect(this).to.equal(t);
            done();
        });
        e.post('A');
    });
    it('should send events only to handlers attached at the time of posting', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        const calledWith: string[] = [];
        e.post('A');
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post('B');
        wait((): void => {
            expect(calledWith).to.deep.equal(['B']);
            done();
        });
    });
    it('should not send events at all to detached event handlers', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
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
    it('should allow attaching event handlers within handlers', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            e.attach((s: string): void => {
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
        const e = new AsyncEvent<string>();
        const calledWith: string[] = [];
        const f = (s: string): void => {
            calledWith.push(s);
            e.detach(f);
        };
        e.attach(f);
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
        const e = new AsyncEvent<string>();
        const f = (s: string): void => {
            // nothing
        };
        e.attach(f);
        e.post('A');
    });
    it('should allow attaching another event', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        const f = new AsyncEvent<string>();
        const calledWith: string[] = [];
        const g = (s: string): void => {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
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
    it('should condense attached async events into the same cycle', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        const f = new AsyncEvent<string>();
        const calledWith: string[] = [];
        const g = (s: string): void => {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
        e.post('A');
        e.post('B');
        wait((): void => {
            expect(calledWith).to.deep.equal(['A', 'B']);
            done();
        });
    });
    it('should detach once() handlers after calling them', (done: MochaDone): void => {
        const e = new AsyncEvent<string>();
        const calledWith: string[] = [];
        e.once((s: string): void => {
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

    it('should notify of changed listener count', (): void => {
        const e = new AsyncEvent<string>();
        let callCount: number = 0;
        e.evtListenersChanged.attach(() => callCount++);
        e.once(() => undefined);
        expect(callCount).to.equal(1);
        e.attach(() => undefined);
        expect(callCount).to.equal(2);
        e.detach();
        expect(callCount).to.equal(3);
    });
});

describe('VoidAsyncEvent', (): void => {
    it('should allow sending event without parameters', (done: MochaDone): void => {
        const e = new tsevents.VoidAsyncEvent();
        let callCount = 0;
        e.attach((): void => {
            callCount++;
        });
        e.post();
        wait((): void => {
            expect(callCount).to.equal(1);
            done();
        });
    });
});

describe('ErrorAsyncEvent', (): void => {
    it('should throw on posting without handlers', (): void => {
        const e = new tsevents.ErrorAsyncEvent();
        assert.throws((): void => {
            e.post(new Error('test error'));
        });
    });
    it('should not throw on posting with handlers', (): void => {
        const e = new tsevents.ErrorAsyncEvent();
        e.attach((error: Error): void => {
            // nothing
        });
        assert.doesNotThrow((): void => {
            e.post(new Error('test error'));
        });
    });
});
