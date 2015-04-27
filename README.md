# ts-events

A library for sending spontaneous events similar to Qt signal/slot or C# events. It replaces EventEmitter, and instead makes each event into a member which is its own little emitter.

# Features

* Each event is a member, and its own little event emitter. Because of this, you have a place for comments to document them. And adding handlers is no longer on string basis.
* For TypeScript users: made in TypeScript and type-safe. Typings are in ts-events.d.ts
* Synchronous, a-synchronous and queued events
* For a-synchronous events, you decide whether to use setImmediate(), setTimeout(, 0) or process.nextTick()
* Recursion-safe: sending events from event handlers is possible, endless loops are detected
* Attaching and detaching event handlers has clear semantics
* Attach handlers bound to a certain object, i.e. no need for .bind(this)
* Detach one handler, all handlers, or all handlers bound to a certain object

# Documentation

For class documentation, see ./doc/index.html

# Usage

## Event types

ts-event supports three event types: Synchronous, A-synchronous and Queued. Here is a comparison:

|Event Type|Handler Invocation|Condensable?|Comment|
| ------------- | ------------- | ------------- |
|Synchronous|directly, within the call to post()| no |
|A-synchronous|in the next Node.JS cycle| yes |
|Queued|when you flush the queue manually| yes |

In the table above, "condensable" means that you can choose to condense multiple sent events into one: e.g. for an a-synchronous event, you can opt that if it is sent more than once in a Node.JS cycle, the event handlers are invoked only once.

## Replacing EventEmitter

If you want EventEmitter-style events, then use SyncEvent. The handlers of SyncEvents are called directly when you emit the event.

JavaScript:

```javascript
var tsevents = require("../index");
var SyncEvent = tsevents.SyncEvent;

var Counter = (function () {
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
    return Counter;
})();

var ctr = new Counter();

// Attach a handler to the event
// Do this instead of ctr.on("changed", ...)
ctr.evtChanged.attach(function (n) {
    console.log("The counter changed to: " + n.toString(10));
});

ctr.inc();
// Here, the event handler is already called and you see a log line on the console
```

TypeScript:
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

## A-synchronous events

Synchronous events (like Node.JS EventEmitter events) have the nasty habit of invoking handlers when they don't expect it.
Therefore we also have a-synchronous events: when you post an a-synchronous event, the handlers are called in the next Node.JS cycle. To use, simply use AsyncEvent instead of SyncEvent in the example above.

By default, AsyncEvent uses setImmediate() to defer a call to the next Node.JS cycle. You can change that by calling the static function AsyncEvent.setScheduler().

```javascript
var tsevents = require("../index");
var ASyncEvent = tsevents.ASyncEvent;

// Replace the default setImmediate() call by a setTimeout(, 0) call
AsyncEvent.setScheduler(function(callback) {
    setTimeout(callback, 0);
})
```

## Queued events

For  fine-grained control, use a QueuedEvent instead of an AsyncEvent. All queued events remain in one queue until you flush it.


```javascript
var tsevents = require("../index");
var QueuedEvent = tsevents.QueuedEvent;

var Counter = (function () {
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
    return Counter;
})();

var ctr = new Counter();

// Attach a handler to the event
// Do this instead of ctr.on("changed", ...)
ctr.evtChanged.attach(function (n) {
    console.log("The counter changed to: " + n.toString(10));
});

ctr.inc();
// Here, the event handler is not called yet

// Flush the event queue
tsevent.flushEmpty();
// Here, the handler is called

```

### Creating your own event queues

You can put different events in different queues. By default, all events go into one global queue. To assign a specific queue to an event, do this:

```javascript

var tsevents = require("../index");
var EventQueue = tsevents.EventQueue;
var QueuedEvent = tsevents.QueuedEvent;


var myQueue = new EventQueue();
var myEvent = new QueuedEvent({ queue: myQueue });
myEvent.post("hi!");

// flush only my own queue
myQueue.flushEmpty();
```

### flushOnce() vs flushEmpty()

Event queues have two flush functions:
* flushOne() calls all the events that are in the queue at the time of the call.
* flushEmpty() keeps clearing the queue until it remains empty, i.e. events added by event handlers are also called.

The flushEmpty() function has a safeguard: by default, if it needs more than 10 iterations to clear the queue, it throws an error saying there is an endless recursion going on. You can give it a different limit if you like. Simply call e.g. flushEmpty(100) to set the limit to 100.

## Condensing events

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

## Binding to objects

There is no need to use .bind(this) when attaching a handler. Simply call myEvent.attach(this, myFunc);

## Attaching and Detaching

There are clear semantics for the effect of attach() and detach(). These semantics were chosen to prevent surprises, however there is no reason why we should not support different semantics in the future. Please submit an issue if you need a different implementation.

* Attaching a handler to an event guarantees that the handler is called only for events posted after the call to attach(). Events that are already underway will not invoke the handler.
* Detaching a handler from an event guarantees that it is not called anymore, even if there are events still queued.

Attaching has two forms:

```javascript
var obj = {};
var handler = function() {
};
myEvent.attach(handler); // will call handler with this === myEvent
myEvent.attach(obj, handler); // will call handler with this === obj
```

Detaching has three forms:

```javascript
var obj = {};
var handler = function() {
};
myEvent.detach(handler); // detaches all instances of the given handler
myEvent.detach(obj); // detaches all handlers bound to the given object
myEvent.detach(obj, handler); // detaches only the given handler bound to the given object
myEvent.detach(); // detaches all handlers
```

## Error events

EventEmitter treats "error" events differently. If you emit them at a time when there are no listeners attached, then an error is thrown. You can get the same behaviour by using an ErrorSyncEvent, ErrorAsyncEvent or ErrorQueuedEvent.

```javascript

var myEvent = new ErrorSyncEvent();

// this throws: "error event posted while no listeners attached. Error: foo"
myEvent.post(new Error("foo"));

myEvent.attach(function(e){});

// this simply calls the event handler with the given error
myEvent.post(new Error("foo"));
```

## For TypeScript users

This section is for using this module with TypeScript.

### Typings

A typings file is delivered with the module, so no need for DefinitelyTyped. Simply use:

```javascript
/// <reference path="node_modules/ts-event/ts-event.d.ts">
```

### Single argument

We chose to make this module type-safe. Due to the limitations of template parameters in TypeScript, this causes you to be limited to one argument in your event handlers. In practice, this is not much of a problem because you can always make the argument an interface with multiple members.

## No arguments

Another TypeScript annoyance: when you create an event with a void argument, TypeScript forces you to pass 'undefined' to post(). To overcome this, we added VoidSyncEvent,  VoidAsyncEvent and VoidQueuedEvent classes.

```javascript
var myEvent = new SyncEvent<void>();

// annoying: have to pass undefined to post() to make it compile
myEvent.post(undefined)

// Solution:
var myEvent = new VoidSyncEvent();
myEvent.post(); // no need to pass 'undefined'
```

# License

Copyright (c) 2015 Rogier Schouten <github@workingcode.ninja>
ISC (see LICENSE file in repository root).
