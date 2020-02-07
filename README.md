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
import {SyncEvent} from 'ts-events';

const evtChange = new SyncEvent<string>();
evtChange.attach(function(s) {
    console.log(s);
});
evtChange.post('hi!');
// at this point, 'hi!' was already printed on the console
```

A-synchronous events:

```javascript
import {AsyncEvent} from 'ts-events';

const evtChange = new AsyncEvent<string>();
evtChange.attach(function(s) {
    console.log(s);
});
evtChange.post('hi!');
// 'hi!' will be printed to the console in the next Node.JS cycle
```

Queued events for fine-grained control:

```javascript
import {QueuedEvent} from 'ts-events';
import * as tsEvents from 'ts-events';

const evtChange = new QueuedEvent<string>();
evtChange.attach(function(s) {
    console.log(s);
});
evtChange.post('hi!');
// the event is still in a global queue

tsEvents.flush();
// now, 'hi!' has been written to the console
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

// like EventEmitter.once(), add a handler which is automatically detached after being called
evtChange.once(function(s) {
    console.log(s);
});

```

Versatile events, let the subscriber choose:

```javascript
import {AnyEvent} from 'ts-events';
import * as tsEvents from 'ts-events';

const evtChange = new AnyEvent<string>();
evtChange.attachSync(function(s) {
    console.log(s + ' this is synchronous.');
});
evtChange.attachAsync(function(s) {
    console.log(s + ' this is a-synchronous.');
});
evtChange.attachQueued(function(s) {
    console.log(s + ' this is queued.');
});
evtChange.post('hi!');
tsEvents.flush(); // only needed for queued

evtChange.onceAsync(function(s) {
    console.log(s + ' after this event, I will be detached and print no more');
});
// similar functions onceSync() and onceQueued() exist.


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

### Node.JS

Install using: `npm install ts-events` or `yarn install ts-events`.

Then require the module in your code:

```javascript
// JavaScript
var tc = require("ts-events");

// TypeScript
import * as tsEvents from "ts-events";
```

### Browser

There are two options:
* Browserify your Node.JS code
* Use one of the ready-made UMD-wrapped browser bundles: [ts-events.js](dist/ts-events.js) or [ts-events.min.js](dist/ts-events.min.js). You can find an example of ts-events and RequireJS in the [examples](examples/) directory

## Usage

### Event types

ts-events supports three event types: Synchronous, A-synchronous and Queued. Here is a comparison:

|Event Type|Handler Invocation|Condensable?|
| ------------- | ------------- | ------------- |
|Synchronous|directly, within the call to post()| no |
|A-synchronous|in the next Node.JS cycle| yes |
|Queued|when you flush the queue manually| yes |

In the table above, 'condensable' means that you can choose to condense multiple sent events into one: e.g. for an a-synchronous event, you can opt that if it is sent more than once in a Node.JS cycle, the event handlers are invoked only once.

There is a fourth event called AnyEvent, which can act as a Sync/Async/Queued event depending on how you attach listeners.

### Synchronous Events

If you want EventEmitter-style events, then use SyncEvent. The handlers of SyncEvents are called directly when you emit the event.


```javascript
import {SyncEvent} from 'ts-events';

const myEvent = new SyncEvent();

myEvent.attach(function(s) {
    console.log(s);
});

myEvent.post('hi!');
// at this point, 'hi!' was already printed on the console

```

Typically you use events as members in a class, instead of extending EventEmitter:

```javascript
import {SyncEvent} from 'ts-events';

export class Counter {
    /**
     * This event is called whenever the counter changes
     * @param n The counter value
     */
    public evtChanged: SyncEvent<number> = new SyncEvent<number>();

    /**
     * The counter value
     */
    private _n = 0;

    public inc(): void {
        this._n++;
        this.evtChanged.post(this._n);
    }
};

const ctr = new Counter();

// Attach a handler to the event
// Do this instead of ctr.on('changed', ...)
ctr.evtChanged.attach((n: number): void => {
    console.log('The counter changed to: ' + n.toString(10));
});

ctr.inc();
// Here, the event handler is already called and you see a log line on the console
```

As you can see, each event is its own little emitter.

#### Recursion protection

Suppose that the handler for an event - directly or indirectly - causes the same event to be sent. For synchronous events, this would mean an infinite loop. SyncEvents have protection built-in: if a handler causes the same event to get posted 10 times recursively, an error is thrown. You can change or disable this behaviour with the static variable SyncEvent.MAX_RECURSION_DEPTH. Set it to undefined or null to disable or to a number greater than 0 to trigger the error sooner or later.


### A-synchronous events

Synchronous events (like Node.JS EventEmitter events) have the nasty habit of invoking handlers when they don't expect it.
Therefore we also have a-synchronous events: when you post an a-synchronous event, the handlers are called in the next Node.JS cycle. To use, simply use AsyncEvent instead of SyncEvent in the example above.

By default, AsyncEvent uses setImmediate() to defer a call to the next Node.JS cycle. You can change that by calling the static function AsyncEvent.setScheduler().

```javascript
import {AsyncEvent} from 'ts-events';

// Replace the default setImmediate() call by a setTimeout(, 0) call
AsyncEvent.setScheduler(function(callback) {
    setTimeout(callback, 0);
})
```

### Queued events

For  fine-grained control, use a QueuedEvent instead of an AsyncEvent. All queued events remain in one queue until you flush it.


```javascript
import {QueuedEvent} from 'ts-events';
import * as tsEvents from 'ts-events';

export class Counter {
    /**
     * This event is called whenever the counter changes
     * @param n The counter value
     */
    public evtChanged: QueuedEvent<number> = new QueuedEvent<number>();

    /**
     * The counter value
     */
    private _n = 0;

    public inc(): void {
        this._n++;
        this.evtChanged.post(this._n);
    }
};

const ctr = new Counter();

// Attach a handler to the event
// Do this instead of ctr.on('changed', ...)
ctr.evtChanged.attach((n: number): void => {
    console.log('The counter changed to: ' + n.toString(10));
});

ctr.inc();
// Here, the event handler is not called yet

// Flush the event queue
tsEvents.flush();
// Here, the handler is called

```

#### Creating your own event queues

You can put different events in different queues. By default, all events go into one global queue. To assign a specific queue to an event, do this:

```javascript
import {QueuedEvent, EventQueue} from 'ts-events';

const myQueue = new EventQueue();
const myEvent = new QueuedEvent({ queue: myQueue });
myEvent.post('hi!');

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
import {AsyncEvent} from 'ts-events';

// create a condensed event
const myEvent = new AsyncEvent<string>({ condensed: true });
myEvent.attach(function(s) {
    console.log(s);
});
myEvent.post('hi!');
myEvent.post('bye!');

// after a cycle, only 'bye!' is logged to the console

```

### Binding to objects

There is no need to use .bind(this) when attaching a handler. Simply call myEvent.attach(this, myFunc);

### Attaching and Detaching

There are clear semantics for the effect of attach() and detach(). These semantics were chosen to prevent surprises, however there is no reason why we should not support different semantics in the future. Please submit an issue if you need a different implementation.

* Attaching a handler to an event guarantees that the handler is called only for events posted after the call to attach(). Events that are already underway will not invoke the handler.
* Detaching a handler from an event guarantees that it is not called anymore, even if there are events still queued.
* You can use the once() method to attach a handler that is automatically removed when it is called.

Attaching has the following forms:

```javascript
const obj = {};
const handler = function() {
};
const myEvent = new AsyncEvent<string>();
const myOtherEvent = new AsyncEvent<string>();

myEvent.attach(handler); // will call handler with this === myEvent
myEvent.attach(obj, handler); // will call handler with this === obj
myEvent.attach(myOtherEvent); // will post myOtherEvent
```

Detaching has the following forms:

```javascript
const obj = {};
const handler = function() {
};
const myEvent = new AsyncEvent<string>();
const myOtherEvent = new AsyncEvent<string>();

myEvent.detach(handler); // detaches all instances of the given handler
myEvent.detach(obj); // detaches all handlers bound to the given object
myEvent.detach(obj, handler); // detaches only the given handler bound to the given object
myEvent.detach(myOtherEvent); // detaches only myOtherEvent
myEvent.detach(); // detaches all handlers


// returned detacher function
const detacher = myEvent.attach(handler);
detacher(); // detachers `handler`
```

Note that when you attach an AsyncEvent to another AsyncEvent, the handlers of both events are called in the very next cycle, i.e. it does not take 2 cycles to call all handlers. This is 'decoupled enough' for most purposes and reduces latency.


### Error events

The old EventEmitter treats 'error' events different from events with other names. If you emit them at a time when there are no listeners attached, then an error is thrown. You can get the same behaviour by using an ErrorSyncEvent, ErrorAsyncEvent or ErrorQueuedEvent.

```javascript

const myEvent = new ErrorSyncEvent();

// this throws: 'error event posted while no listeners attached. Error: foo'
myEvent.post(new Error('foo'));

myEvent.attach((e: Error): void => {});

// this simply calls the event handler with the given error
myEvent.post(new Error('foo'));
```

### AnyEvent

The AnyEvent class lets you choose between sync/async/queued in the attach() function. For instance:

```javascript
import {AnyEvent, EventType} from 'ts-events';
import * as tsEvents from 'ts-events';

const evtChange = new AnyEvent();
evtChange.attach(function(s) {
    console.log(s + ' this is synchronous.');
});
evtChange.attach(EventType.Sync, function(s) {
    console.log(s + ' this is synchronous.');
});
evtChange.attach(EventType.Async, function(s) {
    console.log(s + ' this is a-synchronous.');
});
evtChange.attach(EventType.Queued, function(s) {
    console.log(s + ' this is queued.');
});

evtChange.once(function(s) {
    console.log(s + ' this is synchronous and will be called only once.');
});
evtChange.once(EventType.Sync, function(s) {
    console.log(s + ' this is synchronous and will be called only once.');
});
evtChange.once(EventType.Async, function(s) {
    console.log(s + ' this is a-synchronous and will be called only once.');
});
evtChange.once(EventType.Queued, function(s) {
    console.log(s + ' this is queued and will be called only once.');
});

// convenience functions:
evtChange.attachSync(function(s) {
    console.log(s + ' this is conveniently synchronous.');
});
evtChange.attachAsync(function(s) {
    console.log(s + ' this is conveniently a-synchronous and condensed.');
}, { condensed: true });
evtChange.attachAsync(function(s) {
    console.log(s + ' this is conveniently a-synchronous and not condensed.');
});
evtChange.attachQueued(function(s) {
    console.log(s + ' this is conveniently queued.');
});

// convenience functions:
evtChange.onceSync(function(s) {
    console.log(s + ' this is conveniently synchronous and will be called only once.');
});
evtChange.onceAsync(function(s) {
    console.log(s + ' this is conveniently a-synchronous and condensed and will be called only once.');
}, { condensed: true });
evtChange.onceAsync(function(s) {
    console.log(s + ' this is conveniently a-synchronous and not condensed and will be called only once.');
});
evtChange.onceQueued(function(s) {
    console.log(s + ' this is conveniently queued and will be called only once.');
});

evtChange.post('hi!');
tsEvents.flush(); // only needed for queued

```

#### No arguments

A TypeScript annoyance: when you create an event with a void argument, TypeScript forces you to pass 'undefined' to post(). To overcome this, we added VoidSyncEvent,  VoidAsyncEvent and VoidQueuedEvent classes.

```javascript
const myEvent = new SyncEvent<void>();

// annoying: have to pass undefined to post() to make it compile
myEvent.post(undefined)

// Solution:
const myEvent = new VoidSyncEvent();
myEvent.post(); // no need to pass 'undefined'
```

### Listening to the listeners

Each type of event has a member `evtListenersChanged: VoidSyncEvent` to notify you when someone attaches or detaches event handlers.

## Changelog

v3.4.0 (2020-02-07)

* Add evtListenersChanged event to all types of events
* Update dependencies

v3.3.1 (2019-06-04)

* Remove .git directory from published module

v3.3.0 (2019-06-02)

* Return a detacher function from `attach()` and `once()` methods.

v3.2.1 (2019-02-01)

* Update dependencies to resolve vulnerabilities reported by npm audit.

v3.2.0 (2017-03-31)

* Added once(), onceSync(), onceAsync() and onceQueued() methods to attach a handler that is automatically removed when called.

v3.1.5 (2017-01-11)

* Moved node typings from dependencies to devDependencies

v3.1.4 (2016-11-26)

* Use new @types typings
* Upgrade NPM packages
* Fix new TSLint errors

v3.1.3 (2016-10-28)

* Inlined sourcemaps since the .map files were not published to npm

v3.1.2 (2016-10-27)

* Inlined sourcemaps since the .map files were not published to npm

v3.1.1 (2016-02-27)

* Removed dependency on util and assert

v3.1.0 (2016-02-27)

* Add UMD browser bundles

v3.0.1

* Bugfix in published NPM module

v3.0.0

* Update whole module to 2016 standards (thanks to Tomasz Ciborski)
* Ensure that ts-events works in browsers as well without setting another a-sync scheduler
* Add generic way of attaching to an AnyEvent
* Add evtFirstAttached and evtLastDetached events to AnyEvent

v2.4.0

* Revert releases 2.0.1 * 2.3.0 because they don't work

v2.3.0 (2016-02-20)

* Add evtFirstAttached and evtLastDetached events to AnyEvent

v2.2.0 (2016-02-20)

* Add generic way of attaching to an AnyEvent

v2.1.1 (2016-02-20)

* Ensure that ts-events works in browsers as well without setting another a-sync scheduler

v2.1.0 (2016-02-20)

* Update whole module to 2016 standards (thanks to Tomasz Ciborski)

v2.0.0

* Breaking change: removed AnyEvent#attach() and replaced it with attachSync() to force users of AnyEvents to think about how to attach.

v1.1.0 (2015-05-25):

* Add events to the EventQueue to detect when it becomes empty/non-empty to facilitate intelligent flushing.
* Add a new type of event called AnyEvent where the choice of sync/async/queued is left to the subscriber rather than the publisher.

v1.0.0 (2015-04-30):

* Ready for production use.

v0.0.6 (2015-04-29):

* Performance improvements

v0.0.5 (2015-04-29):

* Fix NPM warning about package.json repository field

v0.0.4 (2015-04-29):

* Fix missing ts-events.d.ts in published module

v0.0.3 (2015-04-28):

* Feature: allow to attach any event to any other event directly
* Feature: allow to disable recursion protection mechanism for SyncEvents
* Breaking change: renamed flushEmpty() to flush()
* Documentation updates
* Various build system improvements

v0.0.2 (2015-04-27):

* Documentation update

v0.0.1 (2015-04-27):

* Initial version

## License

Copyright � 2015 Rogier Schouten <github@workingcode.ninja>
ISC (see LICENSE file in repository root).
