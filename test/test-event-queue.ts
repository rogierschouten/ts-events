// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

/// <reference path="../typings/tsd.d.ts"/>

import assert = require("assert");
import {expect} from "chai";

import EventQueue = require("../lib/EventQueue");

describe("EventQueue", (): void => {

    var eq: EventQueue;

    beforeEach((): void => {
        eq = new EventQueue();
    });

    describe("global()", (): void => {
        it("should create a global instance", (): void => {
            var g1 = EventQueue.global();
            var g2 = EventQueue.global();
            expect(g1 instanceof EventQueue).to.equal(true);
        });
        it("should return the same instance every time", (): void => {
            var g1 = EventQueue.global();
            var g2 = EventQueue.global();
            expect(g1).to.equal(g2);
        });
    });

    describe("add()", (): void => {
        it("should not call a handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            expect(callCount).to.equal(0);
        })
    });

    describe("flushOnce()", (): void => {
        it("should call a handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flushOnce();
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });
        it("should not call a recursively inserted handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                eq.add((): void => {
                    callCount++;
                });
            });
            eq.flushOnce();
            expect(callCount).to.equal(0);
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });
    });

    describe("flush()", (): void => {
        it("should call a handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flush();
            expect(callCount).to.equal(1);
        });
        it("should not call a handler twice", (): void => {
            var callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flush();
            eq.flush();
            expect(callCount).to.equal(1);
        });
        it("should call a recursively inserted handler", (): void => {
            var callCount = 0;
            eq.add((): void => {
                eq.add((): void => {
                    callCount++;
                });
            });
            eq.flush();
            expect(callCount).to.equal(1);
        });
        it("should throw for endless loop after 10 times by default", (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws((): void => {
                eq.flush();
            });
            expect(callCount).to.equal(10);
        });
        it("should throw for endless loop after given # times", (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws((): void => {
                eq.flush(5);
            });
            expect(callCount).to.equal(5);
        });
        it("should function after throwing", (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                eq.add(f);
            };
            eq.add(f);
            assert.throws((): void => {
                eq.flush(5);
            });

            callCount = 0;
            eq.add((): void => {
                callCount++;
            });
            eq.flush();
            expect(callCount).to.equal(1);
        });
        it("should not throw for endless loop when set to undefined", (): void => {
            var callCount = 0;
            var f = (): void => {
                callCount++;
                if (callCount < 100) {
                    eq.add(f);
                }
            };
            eq.add(f);
            assert.doesNotThrow((): void => {
                eq.flush(null);
            });
            expect(callCount).to.equal(100);
        });
    });

    describe("empty()", (): void => {
        it("should be true when empty", (): void => {
            expect(eq.empty()).to.equal(true);
        });
        it("should be false when non-empty", (): void => {
            eq.add((): void => {});
            expect(eq.empty()).to.equal(false);
        });
        it("should be true when flushed empty", (): void => {
            eq.add((): void => {});
            eq.flush();
            expect(eq.empty()).to.equal(true);
        });
    });

    describe("evtFilled", (): void => {
        var callCount: number;

        beforeEach((): void => {
            callCount = 0;
            eq.evtFilled.attach((p: EventQueue): void => {
                expect(p).to.equal(eq);
                callCount++;
            });
        });

        it("should be triggered for first added event", (): void => {
            eq.add((): void => {});
            expect(callCount).to.equal(1);
        });

        it("should not be triggered for second added event", (): void => {
            eq.add((): void => {});
            eq.add((): void => {});
            expect(callCount).to.equal(1);
        });

        it("should not be triggered when adding after flush", (): void => {
            eq.add((): void => {});
            expect(callCount).to.equal(1);
            eq.flush();
            eq.add((): void => {});
            expect(callCount).to.equal(2);
        });

        it("should not be triggered when adding after flushOnce", (): void => {
            eq.add((): void => {});
            expect(callCount).to.equal(1);
            eq.flushOnce();
            eq.add((): void => {});
            expect(callCount).to.equal(2);
        });

        it("should not be triggered when temporarily empty during flush", (): void => {
            eq.add((): void => {
                eq.add((): void => {});
            });
            expect(callCount).to.equal(1);
            eq.flush();
            expect(callCount).to.equal(1);
        });

        it("should not be triggered when adding after flushOnce did not clear the queue", (): void => {
            eq.add((): void => {
                eq.add((): void => {});
            });
            expect(callCount).to.equal(1);
            eq.flushOnce();
            eq.add((): void => {});
            expect(callCount).to.equal(1);
        });
    });

    describe("evtDrained", (): void => {
        var callCount: number;

        beforeEach((): void => {
            callCount = 0;
            eq.evtDrained.attach((p: EventQueue): void => {
                expect(p).to.equal(eq);
                callCount++;
            });
        });

        it("should be triggered after flush()", (): void => {
            eq.add((): void => {
                expect(callCount).to.equal(0);
            });
            eq.flush();
            expect(callCount).to.equal(1);
        });

        it("should be triggered after flush() if it needs multiple iterations", (): void => {
            eq.add((): void => {
                eq.add((): void => {
                    expect(callCount).to.equal(0);
                });
                expect(callCount).to.equal(0);
            });
            eq.flush();
            expect(callCount).to.equal(1);
        });

        it("should be triggered after flushOnce() if it empties the queue", (): void => {
            eq.add((): void => {
                expect(callCount).to.equal(0);
            });
            eq.flushOnce();
            expect(callCount).to.equal(1);
        });

        it("should not be triggered after flushOnce() if it does not empty the queue", (): void => {
            eq.add((): void => {
                eq.add((): void => {});
            });
            eq.flushOnce();
            expect(callCount).to.equal(0);
        });

        it("should not be triggered when temporarily empty during flush", (): void => {
            eq.add((): void => {
                expect(callCount).to.equal(0);
                eq.add((): void => {});
            });
            eq.flush();
        });
    });

});
