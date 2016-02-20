[![NPM version](https://badge.fury.io/js/ts-events.svg)](http://badge.fury.io/js/ts-events)
![license](http://img.shields.io/npm/l/ts-events.svg)

[![NPM](https://nodei.co/npm/ts-events.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/ts-events/)
[![NPM](https://nodei.co/npm-dl/ts-events.png?months=9&height=3)](https://nodei.co/npm/ts-events/)


# ts-events

A library for sending spontaneous events similar to Qt signal/slot or C# events. It replaces EventEmitter, and instead makes each event into a member which is its own little emitter.
Implemented in TypeScript (typings file included) and usable with JavaScript as well.

## TL;DR

Synchronous events:

```javascript
var tsevents = require("../index");
var SyncEvent = tsevents.SyncEvent;

var evtChange = new SyncEvent();
evtChange.attach(function(s) {
    console.log(s);
});
evtChange.post("hi!");
// at this point, "hi!" was already printed on the console
```

A-synchronous events:

```javascript
var tsevents = require("../index");
var AsyncEvent = tsevents.AsyncEvent;

var evtChange = new AsyncEvent();
evtChange.attach(function(s) {
    console.log(s);
});
evtChange.post("hi!");
// "hi!" will be printed to the console in the next Node.JS cycle
```

Queued events for fine-grained control:

```javascript
var tsevents = require("../index");
var QueuedEvent = tsevents.QueuedEvent;

var evtChange = new QueuedEvent();
evtChange.attach(function(s) {
    console.log(s);
});
evtChange.post("hi!");
// the event is still in a global queue

tsevents.flush();
// now, "hi!" has been written to the console
```

Different ways of attaching:

```javascript

// attach a function
evtChange.attach(function(s) {
    console.log(s);
});

// attach a function bound to an object
evtChange.attach(this, this.onChange);

// directly attach another event
evtChange.attach(this.evtChange);

```

Versatile events, let the subscriber choose:

```javascript
var tsevents = require("../index");
var AnyEvent = tsevents.AnyEvent;

var evtChange = new AnyEvent();
evtChange.attach(function(s) {
    console.log(s + " this is synchronous.");
});
evtChange.attachAsync(function(s) {
    console.log(s + " this is a-synchronous.");
});
evtChange.attachQueued(function(s) {
    console.log(s + " this is queued.");
});
evtChange.post("hi!");
tsevents.flush(); // only needed for queued

```


## Features

* Each event is a member, and its own little event emitter. Because of this, you have a place for comments to document them. And adding handlers is no longer on string basis.
* For TypeScript users: made in TypeScript and type-safe. Typings are in ts-events.d.ts
* Synchronous, a-synchronous and queued events
* For a-synchronous events, you decide whether to use setImmediate(), setTimeout(, 0) or process.nextTick()
* Recursion-safe: sending events from event handlers is possible, endless loops are detected
* Attaching and detaching event handlers has clear semantics
* Attach handlers bound to a certain object, i.e. no need for .bind(this)
* Detach one handler, all handlers, or all handlers bound to a certain object
* Decide on sync/a-sync/queued either in the publisher or in the subscriber

## Installation

```sh
cd your-package
npm install --save ts-events
```

Then, include the library using:
```javascript
var tsevents = require('ts-events');
```

If you're programming in TypeScript, you can include it like this:
```javascript
import * as tsevents from 'ts-events';
```

## Usage

### Event types

ts-event supports three event types: Synchronous, A-synchronous and Queued. Here is a comparison:

|Event Type|Handler Invocation|Condensable?|
| ------------- | ------------- | ------------- |
|Synchronous|directly, within the call to post()| no |
|A-synchronous|in the next Node.JS cycle| yes |
|Queued|when you flush the queue manually| yes |

In the table above, "condensable" means that you can choose to condense multiple sent events into one: e.g. for an a-synchronous event, you can opt that if it is sent more than once in a Node.JS cycle, the event handlers are invoked only once.

There is a fourth event called AnyEvent, which can act as a Sync/Async/Queued event depending on how you attach listeners.

### Synchronous Events

If you want EventEmitter-style events, then use SyncEvent. The handlers of SyncEvents are called directly when you emit the event.


```javascript
var tsevents = require("../index");
var SyncEvent = tsevents.SyncEvent;

var myEvent = new SyncEvent();

myEvent.attach(function(s) {
    console.log(s);
});

myEvent.post("hi!");
// at this point, "hi!" was already printed on the console

```

Typically you use events as members in a class, instead of extending EventEmitter:

```javascript
var tsevents = require("../index");
var SyncEvent = tsevents.SyncEvent;

function Counter() {
    /**
     * This event is called whenever the counter changes
     * @param n The counter value
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

var ctr = new Counter();

// Attach a handler to the event
// Do this instead of ctr.on("changed", ...)
ctr.evtChanged.attach(function (n) {
    console.log("The counter changed to: " + n.toString(10));
});

ctr.inc();
// Here, the event handler is already called and you see a log line on the console
```

As you can see, each event is its own little emitter.


For TypeScript users:

```javascript
class Counter {
    /**
     * This event is called whenever the counter changes
     * @param n The counter value
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

var ctr = new Counter();

ctr.evtChanged.attach((n: number): void => {
    console.log("The counter changed to: " + n.toString(10));
});

ctr.inc();
// Here, the event handler is already called and you see a log line on the console
```

#### Recursion protection

Suppose that the handler for an event - directly or indirectly - causes the same event to be sent. For synchronous events, this would mean an infinite loop. SyncEvents have protection built-in: if a handler causes the same event to get posted 10 times recursively, an error is thrown. You can change or disable this behaviour with the static variable SyncEvent.MAX_RECURSION_DEPTH. Set it to null to disable or to a number greater than 0 to trigger the error sooner or later.


### A-synchronous events

Synchronous events (like Node.JS EventEmitter events) have the nasty habit of invoking handlers when they don't expect it.
Therefore we also have a-synchronous events: when you post an a-synchronous event, the handlers are called in the next Node.JS cycle. To use, simply use AsyncEvent instead of SyncEvent in the example above.

By default, AsyncEvent uses setImmediate() to defer a call to the next Node.JS cycle. You can change that by calling the static function AsyncEvent.setScheduler().

```javascript
var tsevents = require("../index");
var AsyncEvent = tsevents.AsyncEvent;

// Replace the default setImmediate() call by a setTimeout(, 0) call
AsyncEvent.setScheduler(function(callback) {
    setTimeout(callback, 0);
})
```

### Queued events

For  fine-grained control, use a QueuedEvent instead of an AsyncEvent. All queued events remain in one queue until you flush it.


```javascript
var tsevents = require("../index");
var QueuedEvent = tsevents.QueuedEvent;

function Counter() {
    /**
     * This event is called whenever the counter changes
     * @param n The counter value
     */
    this.evtChanged = new QueuedEvent();
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

var ctr = new Counter();

// Attach a handler to the event
// Do this instead of ctr.on("changed", ...)
ctr.evtChanged.attach(function (n) {
    console.log("The counter changed to: " + n.toString(10));
});

ctr.inc();
// Here, the event handler is not called yet

// Flush the event queue
tsevent.flush();
// Here, the handler is called

```

#### Creating your own event queues

You can put different events in different queues. By default, all events go into one global queue. To assign a specific queue to an event, do this:

```javascript

var tsevents = require("../index");
var EventQueue = tsevents.EventQueue;
var QueuedEvent = tsevents.QueuedEvent;


var myQueue = new EventQueue();
var myEvent = new QueuedEvent({ queue: myQueue });
myEvent.post("hi!");

// flush only my own queue
myQueue.flush();
```

#### flushOnce() vs flush()

Event queues have two flush functions:
* flushOnce() calls all the events that are in the queue at the time of the call.
* flush() keeps clearing the queue until it remains empty, i.e. events added by event handlers are also called.

The flush() function has a safeguard: by default, if it needs more than 10 iterations to clear the queue, it throws an error saying there is an endless recursion going on. You can give it a different limit if you like. Simply call e.g. flush(100) to set the limit to 100.

### evtFilled and evtDrained

Event queues have two synchronous events themselves that fire when the queue becomes empty (evtDrained) or non-empty (evtFilled). The Filled event only occurs when an event is added to an empty queue OUTSIDE of a flush operation. The Drained event occurs at the end of a flush operation if the queue is flushed empty.
To check whether the queue is empty, use the empty() method.

### Condensing events

For a-synchronous events and for queued events, you can opt to condense multiple post() calls into one. If multiple post() calls happen before the handlers are called, the handlers are invoked only once, with the argument from the last post() call.

```javascript

var tsevents = require("../index");
var AsyncEvent = tsevents.AsyncEvent;

// create a condensed event
var myEvent = new AsyncEvent({ condensed: true });
myEvent.attach(function(s) {
    console.log(s);
});
myEvent.post("hi!");
myEvent.post("bye!");

// after a cycle, only 'bye!' is logged to the console

```

### Binding to objects

There is no need to use .bind(this) when attaching a handler. Simply call myEvent.attach(this, myFunc);

### Attaching and Detaching

There are clear semantics for the effect of attach() and detach(). These semantics were chosen to prevent surprises, however there is no reason why we should not support different semantics in the future. Please submit an issue if you need a different implementation.

* Attaching a handler to an event guarantees that the handler is called only for events posted after the call to attach(). Events that are already underway will not invoke the handler.
* Detaching a handler from an event guarantees that it is not called anymore, even if there are events still queued.

Attaching has the following forms:

```javascript
var obj = {};
var handler = function() {
};
var myOtherEvent = new AsyncEvent();

myEvent.attach(handler); // will call handler with this === myEvent
myEvent.attach(obj, handler); // will call handler with this === obj
myEvent.attach(myOtherEvent); // will post myOtherEvent
```

Detaching has the following forms:

```javascript
var obj = {};
var handler = function() {
};
var myOtherEvent = new AsyncEvent();

myEvent.detach(handler); // detaches all instances of the given handler
myEvent.detach(obj); // detaches all handlers bound to the given object
myEvent.detach(obj, handler); // detaches only the given handler bound to the given object
myEvent.detach(myOtherEvent); // detaches only myOtherEvent
myEvent.detach(); // detaches all handlers
```

Note that when you attach an AsyncEvent to another AsyncEvent, the handlers of both events are called in the very next cycle, i.e. it does not take 2 cycles to call all handlers. This is 'decoupled enough' for most purposes and reduces latency.

### Error events

EventEmitter treats "error" events differently. If you emit them at a time when there are no listeners attached, then an error is thrown. You can get the same behaviour by using an ErrorSyncEvent, ErrorAsyncEvent or ErrorQueuedEvent.

```javascript

var myEvent = new ErrorSyncEvent();

// this throws: "error event posted while no listeners attached. Error: foo"
myEvent.post(new Error("foo"));

myEvent.attach(function(e){});

// this simply calls the event handler with the given error
myEvent.post(new Error("foo"));
```

### AnyEvent

The AnyEvent class lets you choose between sync/async/queued in the attach() function. For instance:

```javascript
var tsevents = require("../index");
var AnyEvent = tsevents.AnyEvent;

var evtChange = new AnyEvent();
evtChange.attach(function(s) {
    console.log(s + " this is synchronous.");
});
evtChange.attachAsync(function(s) {
    console.log(s + " this is a-synchronous and condensed.");
}, { condensed: true });
evtChange.attachAsync(function(s) {
    console.log(s + " this is a-synchronous and not condensed.");
});
evtChange.attachQueued(function(s) {
    console.log(s + " this is queued.");
});
evtChange.post("hi!");
tsevents.flush(); // only needed for queued

```

### For TypeScript users

This section is for using this module with TypeScript.

#### Typings

A typings file is delivered with the module, so no need for DefinitelyTyped. Simply use:

```javascript
/// <reference path="node_modules/ts-event/ts-event.d.ts">
```

#### Single argument

We chose to make this module type-safe. Due to the limitations of template parameters in TypeScript, this causes you to be limited to one argument in your event handlers. In practice, this is not much of a problem because you can always make the argument an interface with multiple members.

#### No arguments

Another TypeScript annoyance: when you create an event with a void argument, TypeScript forces you to pass 'undefined' to post(). To overcome this, we added VoidSyncEvent,  VoidAsyncEvent and VoidQueuedEvent classes.

```javascript
var myEvent = new SyncEvent<void>();

// annoying: have to pass undefined to post() to make it compile
myEvent.post(undefined)

// Solution:
var myEvent = new VoidSyncEvent();
myEvent.post(); // no need to pass 'undefined'
```

## Changelog

v2.1.0 (2016-02-20)
- Update whole module to 2016 standards (thanks to Tomasz Ciborski)

v2.0.0
- Breaking change: removed AnyEvent#attach() and replaced it with attachSync() to force users of AnyEvents to think about how to attach.

v1.1.0 (2015-05-25):
- Add events to the EventQueue to detect when it becomes empty/non-empty to facilitate intelligent flushing.
- Add a new type of event called AnyEvent where the choice of sync/async/queued is left to the subscriber rather than the publisher.

v1.0.0 (2015-04-30):
- Ready for production use.

v0.0.6 (2015-04-29):
- Performance improvements

v0.0.5 (2015-04-29):
- Fix NPM warning about package.json repository field

v0.0.4 (2015-04-29):
- Fix missing ts-events.d.ts in published module

v0.0.3 (2015-04-28):
- Feature: allow to attach any event to any other event directly
- Feature: allow to disable recursion protection mechanism for SyncEvents
- Breaking change: renamed flushEmpty() to flush()
- Documentation updates
- Various build system improvements

v0.0.2 (2015-04-27):
- Documentation update

v0.0.1 (2015-04-27):
- Initial version

## License

Copyright (c) 2015 Rogier Schouten <github@workingcode.ninja>
ISC (see LICENSE file in repository root).
