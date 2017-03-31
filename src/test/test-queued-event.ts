// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>

import assert = require('assert');
import {expect} from 'chai';

import {QueuedEvent} from '../lib/index';
import * as tsevents from '../lib/index';

describe('QueuedEvent', (): void => {
    it('should send events through the global event queue', (): void => {
        const e = new QueuedEvent<string>();
        let callCount = 0;
        const calledWith: string[] = [];
        e.attach((s: string): void => {
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
        const e = new QueuedEvent<string>({ queue: q });
        let callCount = 0;
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            callCount++;
            calledWith.push(s);
        });
        e.post('A');
        expect(callCount).to.equal(0);
        tsevents.flushOnce();
        expect(callCount).to.equal(0);
        q.flushOnce();
        expect(callCount).to.equal(1);
        expect(calledWith).to.deep.equal(['A']);
    });
    it('should not condense events by default', (): void => {
        const e = new QueuedEvent<string>();
        let callCount = 0;
        const calledWith: string[] = [];
        e.attach((s: string): void => {
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
        const e = new QueuedEvent<string>({ condensed: true });
        let callCount = 0;
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            callCount++;
            calledWith.push(s);
        });
        e.post('A');
        e.post('B');
        tsevents.flushOnce();
        expect(callCount).to.equal(1);
        expect(calledWith).to.deep.equal(['B']);
    });
    it('should use the Event as this parameter by default', (): void => {
        const e = new QueuedEvent<string>();
        e.attach(function(s: string): void {
            expect(this).to.equal(e);
        });
        e.post('A');
        tsevents.flushOnce();
    });
    it('should use a given object as this parameter when given', (): void => {
        const e = new QueuedEvent<string>();
        const t = {};
        e.attach(t, function(s: string): void {
            expect(this).to.equal(t);
        });
        e.post('A');
        tsevents.flushOnce();
    });
    it('should send events only to handlers attached at the time of posting', (): void => {
        const e = new QueuedEvent<string>();
        const calledWith: string[] = [];
        e.post('A');
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post('B');
        tsevents.flushOnce();
        expect(calledWith).to.deep.equal(['B']);
    });
    it('should not send events at all to detached event handlers', (): void => {
        const e = new QueuedEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post('A');
        e.detach();
        e.post('B');
        tsevents.flushOnce();
        expect(calledWith).to.deep.equal([]);
    });
    it('should allow attaching event handlers within handlers', (): void => {
        const e = new QueuedEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            e.attach((s: string): void => {
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
        const e = new QueuedEvent<string>();
        const calledWith: string[] = [];
        const f = (s: string): void => {
            calledWith.push(s);
            e.detach(f);
        };
        e.attach(f);
        e.post('A');
        e.post('B');
        tsevents.flushOnce();
        expect(calledWith).to.deep.equal(['A']);
    });
    it('should allow attaching another event', (): void => {
        const e = new QueuedEvent<string>();
        const f = new QueuedEvent<string>();
        const calledWith: string[] = [];
        const g = (s: string): void => {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
        e.post('A');
        e.post('B');
        tsevents.flush();
        expect(calledWith).to.deep.equal(['A', 'B']);
    });
    it('should detach once() handlers', (): void => {
        const e = new QueuedEvent<string>();
        let callCount = 0;
        const calledWith: string[] = [];
        e.once((s: string): void => {
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

describe('VoidQueuedEvent', (): void => {
    it('should allow sending event without parameters', (): void => {
        const e = new tsevents.VoidQueuedEvent();
        let callCount = 0;
        e.attach((): void => {
            callCount++;
        });
        e.post();
        tsevents.flushOnce();
        expect(callCount).to.equal(1);
    });
});

describe('ErrorQueuedEvent', (): void => {
    it('should throw on posting without handlers', (): void => {
        const e = new tsevents.ErrorQueuedEvent();
        assert.throws((): void => {
            e.post(new Error('test error'));
        });
    });
    it('should not throw on posting with handlers', (): void => {
        const e = new tsevents.ErrorQueuedEvent();
        e.attach((error: Error): void => {
            // nothing
        });
        assert.doesNotThrow((): void => {
            e.post(new Error('test error'));
        });
    });
});
