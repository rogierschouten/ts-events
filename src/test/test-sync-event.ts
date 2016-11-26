// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

import assert = require('assert');
import {expect} from 'chai';

import {SyncEvent} from '../lib/index';
import * as tsevents from '../lib/index';

require('source-map-support').install();

describe('SyncEvent', (): void => {

    const defaultRecursionDepth = SyncEvent.MAX_RECURSION_DEPTH;

    afterEach((): void => {
        SyncEvent.MAX_RECURSION_DEPTH = defaultRecursionDepth;
    });

    it('should send events', (): void => {
        const e = new SyncEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post('A');
        expect(calledWith).to.deep.equal(['A']);
    });
    it('should use the Event as this parameter by default', (): void => {
        const e = new SyncEvent<string>();
        e.attach(function(s: string): void {
            expect(this).to.equal(e);
        });
        e.post('A');
    });
    it('should use a given object as this parameter when given', (): void => {
        const e = new SyncEvent<string>();
        const t = {};
        e.attach(t, function(s: string): void {
            expect(this).to.equal(t);
        });
        e.post('A');
    });
    it('should send events only to handlers attached at the time of posting', (): void => {
        const e = new SyncEvent<string>();
        const calledWith: string[] = [];
        e.post('A');
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.post('B');
        expect(calledWith).to.deep.equal(['B']);
    });
    it('should not send events at all to detached event handlers', (): void => {
        const e = new SyncEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            calledWith.push(s);
        });
        e.detach();
        e.post('A');
        expect(calledWith).to.deep.equal([]);
    });
    it('should allow attaching event handlers within handlers', (): void => {
        const e = new SyncEvent<string>();
        const calledWith: string[] = [];
        e.attach((s: string): void => {
            e.attach((s: string): void => {
                calledWith.push(s);
            });
        });
        e.post('A');
        e.post('B');
        expect(calledWith).to.deep.equal(['B']);
    });
    it('should allow detaching event handlers within handlers', (): void => {
        const e = new SyncEvent<string>();
        const calledWith: string[] = [];
        const f = (s: string): void => {
            calledWith.push(s);
            e.detach(f);
        };
        e.attach(f);
        e.post('A');
        e.post('B');
        expect(calledWith).to.deep.equal(['A']);
    });
    it('should protect against recursion', (): void => {
        const e = new SyncEvent<string>();
        let callCount: number = 0;
        const f = (s: string): void => {
            callCount++;
            e.post('A');
        };
        e.attach(f);
        assert.throws((): void => {
            e.post('A');
        });
        expect(callCount).to.equal(SyncEvent.MAX_RECURSION_DEPTH);
    });
    it('should allow disabling recursion protection', (): void => {
        SyncEvent.MAX_RECURSION_DEPTH = null;
        const e = new SyncEvent<string>();
        let callCount: number = 0;
        const f = (s: string): void => {
            callCount++;
            if (callCount < 100) {
                e.post('A');
            }
        };
        e.attach(f);
        assert.doesNotThrow((): void => {
            e.post('A');
        });
        expect(callCount).to.equal(100);
    });
    it('should allow attaching another event', (): void => {
        const e = new SyncEvent<string>();
        const f = new SyncEvent<string>();
        const calledWith: string[] = [];
        const g = (s: string): void => {
            calledWith.push(s);
        };
        e.attach(f);
        f.attach(g);
        e.post('A');
        e.post('B');
        expect(calledWith).to.deep.equal(['A', 'B']);
    });
});

describe('VoidSyncEvent', (): void => {
    it('should allow sending event without parameters', (): void => {
        const e = new tsevents.VoidSyncEvent();
        let callCount = 0;
        e.attach((): void => {
            callCount++;
        });
        e.post();
        expect(callCount).to.equal(1);
    });
});

describe('ErrorSyncEvent', (): void => {
    it('should throw on posting without handlers', (): void => {
        const e = new tsevents.ErrorSyncEvent();
        assert.throws((): void => {
            e.post(new Error('test error'));
        });
    });
    it('should not throw on posting with handlers', (): void => {
        const e = new tsevents.ErrorSyncEvent();
        e.attach((error: Error): void => {
            // nothing
        });
        assert.doesNotThrow((): void => {
            e.post(new Error('test error'));
        });
    });
});
