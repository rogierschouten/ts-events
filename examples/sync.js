// Copyright (c) 2015 Rogier Schouten<github@workingcode.ninja>
/// <reference path="../typings/tsd.d.ts"/>
"use strict";
var tsevents = require("../index");
var SyncEvent = tsevents.SyncEvent;
var Counter = (function () {
    function Counter() {
        /**
         * This event is called whenever the counter changes
         */
        this.evtChanged = new SyncEvent();
        /**
         * The counter value
         */
        this.n = 0;
    }
    /**
     * Increment counter by 1
     */
    Counter.prototype.inc = function () {
        this.n++;
        this.evtChanged.post(this.n);
    };
    return Counter;
})();
var ctr = new Counter();
ctr.evtChanged.attach(function (n) {
    console.log("The counter changed to: " + n.toString(10));
});
ctr.inc();
// Here, the event handler is already called and you see a log line on the console
//# sourceMappingURL=sync.js.map