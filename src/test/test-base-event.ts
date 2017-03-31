// Copyright © 2015 Rogier Schouten<github@workingcode.ninja>

import assert = require('assert');
import {expect} from 'chai';

import {BaseEvent, Listener, AsyncEvent, QueuedEvent, SyncEvent} from '../lib/index';
import * as tsevents from '../lib/index';

class ListenerSub extends BaseEvent<string> {

    public content(): Listener<string>[] {
        return this._listeners ? this._listeners : [];
    }
}

describe('BaseEvent', (): void => {

    let l: ListenerSub;

    beforeEach((): void => {
        l = new ListenerSub();
    });

    describe('attach()', (): void => {
        it('should take a handler', (): void => {
            const f = (s: string): void => {
                // nothing
            };
            l.attach(f);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: f, deleted: false, event: undefined, once: false }]);
        });
        it('should take a boundTo and a handler', (): void => {
            const t = {};
            const f = (s: string): void => {
                // nothing
            };
            l.attach(t, f);
            expect(l.content()).to.deep.equal([{ boundTo: t, handler: f, deleted: false, event: undefined, once: false }]);
        });
        it('should take a SyncEvent', (): void => {
            const e = new SyncEvent<string>();
            l.attach(e);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: undefined, deleted: false, event: e, once: false }]);
        });
        it('should take an AsyncEvent', (): void => {
            const e = new AsyncEvent<string>();
            l.attach(e);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: undefined, deleted: false, event: e, once: false }]);
        });
        it('should take a QueuedEvent', (): void => {
            const e = new QueuedEvent<string>();
            l.attach(e);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: undefined, deleted: false, event: e, once: false }]);
        });
    });

    describe('once()', (): void => {
        it('should take a handler', (): void => {
            const f = (s: string): void => {
                // nothing
            };
            l.once(f);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: f, deleted: false, event: undefined, once: true }]);
        });
        it('should take a boundTo and a handler', (): void => {
            const t = {};
            const f = (s: string): void => {
                // nothing
            };
            l.once(t, f);
            expect(l.content()).to.deep.equal([{ boundTo: t, handler: f, deleted: false, event: undefined, once: true }]);
        });
        it('should take a SyncEvent', (): void => {
            const e = new SyncEvent<string>();
            l.once(e);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: undefined, deleted: false, event: e, once: true }]);
        });
        it('should take an AsyncEvent', (): void => {
            const e = new AsyncEvent<string>();
            l.once(e);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: undefined, deleted: false, event: e, once: true }]);
        });
        it('should take a QueuedEvent', (): void => {
            const e = new QueuedEvent<string>();
            l.once(e);
            expect(l.content()).to.deep.equal([{ boundTo: undefined, handler: undefined, deleted: false, event: e, once: true }]);
        });
    });

    describe('detach()', (): void => {
        const t = {};
        const f = (s: string): void => {
            // nothing
        };
        const g = (s: string): void => {
            // nothing
        };
        const e = new SyncEvent<string>();

        beforeEach((): void => {
            l.attach(f);
            l.attach(t, f);
            l.attach(g);
            l.attach(t, g);
            l.attach(e);
        });

        it('should delete by handler', (): void => {
            l.detach(f);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: g, deleted: false, event: undefined, once: false },
                { boundTo: t, handler: g, deleted: false, event: undefined, once: false },
                { boundTo: undefined, handler: undefined, deleted: false, event: e, once: false }
            ]);
        });
        it('should delete by boundTo', (): void => {
            l.detach(t);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false, event: undefined, once: false },
                { boundTo: undefined, handler: g, deleted: false, event: undefined, once: false },
                { boundTo: undefined, handler: undefined, deleted: false, event: e, once: false }
            ]);
        });
        it('should delete by boundTo and handler', (): void => {
            l.detach(t, f);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false, event: undefined, once: false },
                { boundTo: undefined, handler: g, deleted: false, event: undefined, once: false },
                { boundTo: t, handler: g, deleted: false, event: undefined, once: false },
                { boundTo: undefined, handler: undefined, deleted: false, event: e, once: false }
            ]);
        });
        it('should delete by event', (): void => {
            l.detach(e);
            expect(l.content()).to.deep.equal([
                { boundTo: undefined, handler: f, deleted: false, event: undefined, once: false },
                { boundTo: t, handler: f, deleted: false, event: undefined, once: false },
                { boundTo: undefined, handler: g, deleted: false, event: undefined, once: false },
                { boundTo: t, handler: g, deleted: false, event: undefined, once: false }
            ]);
        });
        it('should delete all', (): void => {
            l.detach();
            expect(l.content()).to.deep.equal([]);
        });
        it('should be ok if no handlers', (): void => {
            l = new ListenerSub();
            assert.doesNotThrow((): void => {
                l.detach();
                l.detach({});
            });
        });
    });

});
