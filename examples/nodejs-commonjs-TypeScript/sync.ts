// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>

'use strict';

import tsEvents = require('ts-events');
import SyncEvent = tsEvents.SyncEvent;

class Counter {

    /**
     * This event is called whenever the counter changes
     */
    public evtChanged: SyncEvent<number> = new SyncEvent<number>();

    /**
     * The counter value
     */
    public n: number = 0;

    /**
     * Increment counter by 1
     */
    public inc(): void {
        this.n++;
        this.evtChanged.post(this.n);
    }
}



const ctr = new Counter();

ctr.evtChanged.attach((n: number): void => {
    console.log('The counter changed to: ' + n.toString(10));
});

ctr.inc();
// Here, the event handler is already called and you see a log line on the console
