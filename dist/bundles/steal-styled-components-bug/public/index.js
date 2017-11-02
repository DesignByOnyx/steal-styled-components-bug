/*[production-config]*/
steal = ((typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) ? self : window).steal || {};
steal.stealBundled = true;
steal.loadBundles = true;
steal.baseURL = './';
steal.configMain = "package.json!npm";
steal.main = "steal-styled-components-bug@1.0.0#public/index";
/*steal*/
!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.Promise=e():"undefined"!=typeof global?global.Promise=e():"undefined"!=typeof self&&(self.Promise=e())}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

/**
 * ES6 global Promise shim
 */
var unhandledRejections = require('../lib/decorators/unhandledRejection');
var PromiseConstructor = unhandledRejections(require('../lib/Promise'));

module.exports = typeof global != 'undefined' ? (global.Promise = PromiseConstructor)
	           : typeof self   != 'undefined' ? (self.Promise   = PromiseConstructor)
	           : PromiseConstructor;

},{"../lib/Promise":2,"../lib/decorators/unhandledRejection":4}],2:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function (require) {

	var makePromise = require('./makePromise');
	var Scheduler = require('./Scheduler');
	var async = require('./env').asap;

	return makePromise({
		scheduler: new Scheduler(async)
	});

});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });

},{"./Scheduler":3,"./env":5,"./makePromise":7}],3:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	// Credit to Twisol (https://github.com/Twisol) for suggesting
	// this type of extensible queue + trampoline approach for next-tick conflation.

	/**
	 * Async task scheduler
	 * @param {function} async function to schedule a single async function
	 * @constructor
	 */
	function Scheduler(async) {
		this._async = async;
		this._running = false;

		this._queue = this;
		this._queueLen = 0;
		this._afterQueue = {};
		this._afterQueueLen = 0;

		var self = this;
		this.drain = function() {
			self._drain();
		};
	}

	/**
	 * Enqueue a task
	 * @param {{ run:function }} task
	 */
	Scheduler.prototype.enqueue = function(task) {
		this._queue[this._queueLen++] = task;
		this.run();
	};

	/**
	 * Enqueue a task to run after the main task queue
	 * @param {{ run:function }} task
	 */
	Scheduler.prototype.afterQueue = function(task) {
		this._afterQueue[this._afterQueueLen++] = task;
		this.run();
	};

	Scheduler.prototype.run = function() {
		if (!this._running) {
			this._running = true;
			this._async(this.drain);
		}
	};

	/**
	 * Drain the handler queue entirely, and then the after queue
	 */
	Scheduler.prototype._drain = function() {
		var i = 0;
		for (; i < this._queueLen; ++i) {
			this._queue[i].run();
			this._queue[i] = void 0;
		}

		this._queueLen = 0;
		this._running = false;

		for (i = 0; i < this._afterQueueLen; ++i) {
			this._afterQueue[i].run();
			this._afterQueue[i] = void 0;
		}

		this._afterQueueLen = 0;
	};

	return Scheduler;

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],4:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var setTimer = require('../env').setTimer;
	var format = require('../format');

	return function unhandledRejection(Promise) {

		var logError = noop;
		var logInfo = noop;
		var localConsole;

		if(typeof console !== 'undefined') {
			// Alias console to prevent things like uglify's drop_console option from
			// removing console.log/error. Unhandled rejections fall into the same
			// category as uncaught exceptions, and build tools shouldn't silence them.
			localConsole = console;
			logError = typeof localConsole.error !== 'undefined'
				? function (e) { localConsole.error(e); }
				: function (e) { localConsole.log(e); };

			logInfo = typeof localConsole.info !== 'undefined'
				? function (e) { localConsole.info(e); }
				: function (e) { localConsole.log(e); };
		}

		Promise.onPotentiallyUnhandledRejection = function(rejection) {
			enqueue(report, rejection);
		};

		Promise.onPotentiallyUnhandledRejectionHandled = function(rejection) {
			enqueue(unreport, rejection);
		};

		Promise.onFatalRejection = function(rejection) {
			enqueue(throwit, rejection.value);
		};

		var tasks = [];
		var reported = [];
		var running = null;

		function report(r) {
			if(!r.handled) {
				reported.push(r);
				logError('Potentially unhandled rejection [' + r.id + '] ' + format.formatError(r.value));
			}
		}

		function unreport(r) {
			var i = reported.indexOf(r);
			if(i >= 0) {
				reported.splice(i, 1);
				logInfo('Handled previous rejection [' + r.id + '] ' + format.formatObject(r.value));
			}
		}

		function enqueue(f, x) {
			tasks.push(f, x);
			if(running === null) {
				running = setTimer(flush, 0);
			}
		}

		function flush() {
			running = null;
			while(tasks.length > 0) {
				tasks.shift()(tasks.shift());
			}
		}

		return Promise;
	};

	function throwit(e) {
		throw e;
	}

	function noop() {}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../env":5,"../format":6}],5:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

/*global process,document,setTimeout,clearTimeout,MutationObserver,WebKitMutationObserver*/
(function(define) { 'use strict';
define(function(require) {
	/*jshint maxcomplexity:6*/

	// Sniff "best" async scheduling option
	// Prefer process.nextTick or MutationObserver, then check for
	// setTimeout, and finally vertx, since its the only env that doesn't
	// have setTimeout

	var MutationObs;
	var capturedSetTimeout = typeof setTimeout !== 'undefined' && setTimeout;

	// Default env
	var setTimer = function(f, ms) { return setTimeout(f, ms); };
	var clearTimer = function(t) { return clearTimeout(t); };
	var asap = function (f) { return capturedSetTimeout(f, 0); };

	// Detect specific env
	if (isNode()) { // Node
		asap = function (f) { return process.nextTick(f); };

	} else if (MutationObs = hasMutationObserver()) { // Modern browser
		asap = initMutationObserver(MutationObs);

	} else if (!capturedSetTimeout) { // vert.x
		var vertxRequire = require;
		var vertx = vertxRequire('vertx');
		setTimer = function (f, ms) { return vertx.setTimer(ms, f); };
		clearTimer = vertx.cancelTimer;
		asap = vertx.runOnLoop || vertx.runOnContext;
	}

	return {
		setTimer: setTimer,
		clearTimer: clearTimer,
		asap: asap
	};

	function isNode () {
		return typeof process !== 'undefined' &&
			Object.prototype.toString.call(process) === '[object process]';
	}

	function hasMutationObserver () {
		return (typeof MutationObserver === 'function' && MutationObserver) ||
			(typeof WebKitMutationObserver === 'function' && WebKitMutationObserver);
	}

	function initMutationObserver(MutationObserver) {
		var scheduled;
		var node = document.createTextNode('');
		var o = new MutationObserver(run);
		o.observe(node, { characterData: true });

		function run() {
			var f = scheduled;
			scheduled = void 0;
			f();
		}

		var i = 0;
		return function (f) {
			scheduled = f;
			node.data = (i ^= 1);
		};
	}
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{}],6:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return {
		formatError: formatError,
		formatObject: formatObject,
		tryStringify: tryStringify
	};

	/**
	 * Format an error into a string.  If e is an Error and has a stack property,
	 * it's returned.  Otherwise, e is formatted using formatObject, with a
	 * warning added about e not being a proper Error.
	 * @param {*} e
	 * @returns {String} formatted string, suitable for output to developers
	 */
	function formatError(e) {
		var s = typeof e === 'object' && e !== null && (e.stack || e.message) ? e.stack || e.message : formatObject(e);
		return e instanceof Error ? s : s + ' (WARNING: non-Error used)';
	}

	/**
	 * Format an object, detecting "plain" objects and running them through
	 * JSON.stringify if possible.
	 * @param {Object} o
	 * @returns {string}
	 */
	function formatObject(o) {
		var s = String(o);
		if(s === '[object Object]' && typeof JSON !== 'undefined') {
			s = tryStringify(o, s);
		}
		return s;
	}

	/**
	 * Try to return the result of JSON.stringify(x).  If that fails, return
	 * defaultValue
	 * @param {*} x
	 * @param {*} defaultValue
	 * @returns {String|*} JSON.stringify(x) or defaultValue
	 */
	function tryStringify(x, defaultValue) {
		try {
			return JSON.stringify(x);
		} catch(e) {
			return defaultValue;
		}
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],7:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function makePromise(environment) {

		var tasks = environment.scheduler;
		var emitRejection = initEmitRejection();

		var objectCreate = Object.create ||
			function(proto) {
				function Child() {}
				Child.prototype = proto;
				return new Child();
			};

		/**
		 * Create a promise whose fate is determined by resolver
		 * @constructor
		 * @returns {Promise} promise
		 * @name Promise
		 */
		function Promise(resolver, handler) {
			this._handler = resolver === Handler ? handler : init(resolver);
		}

		/**
		 * Run the supplied resolver
		 * @param resolver
		 * @returns {Pending}
		 */
		function init(resolver) {
			var handler = new Pending();

			try {
				resolver(promiseResolve, promiseReject, promiseNotify);
			} catch (e) {
				promiseReject(e);
			}

			return handler;

			/**
			 * Transition from pre-resolution state to post-resolution state, notifying
			 * all listeners of the ultimate fulfillment or rejection
			 * @param {*} x resolution value
			 */
			function promiseResolve (x) {
				handler.resolve(x);
			}
			/**
			 * Reject this promise with reason, which will be used verbatim
			 * @param {Error|*} reason rejection reason, strongly suggested
			 *   to be an Error type
			 */
			function promiseReject (reason) {
				handler.reject(reason);
			}

			/**
			 * @deprecated
			 * Issue a progress event, notifying all progress listeners
			 * @param {*} x progress event payload to pass to all listeners
			 */
			function promiseNotify (x) {
				handler.notify(x);
			}
		}

		// Creation

		Promise.resolve = resolve;
		Promise.reject = reject;
		Promise.never = never;

		Promise._defer = defer;
		Promise._handler = getHandler;

		/**
		 * Returns a trusted promise. If x is already a trusted promise, it is
		 * returned, otherwise returns a new trusted Promise which follows x.
		 * @param  {*} x
		 * @return {Promise} promise
		 */
		function resolve(x) {
			return isPromise(x) ? x
				: new Promise(Handler, new Async(getHandler(x)));
		}

		/**
		 * Return a reject promise with x as its reason (x is used verbatim)
		 * @param {*} x
		 * @returns {Promise} rejected promise
		 */
		function reject(x) {
			return new Promise(Handler, new Async(new Rejected(x)));
		}

		/**
		 * Return a promise that remains pending forever
		 * @returns {Promise} forever-pending promise.
		 */
		function never() {
			return foreverPendingPromise; // Should be frozen
		}

		/**
		 * Creates an internal {promise, resolver} pair
		 * @private
		 * @returns {Promise}
		 */
		function defer() {
			return new Promise(Handler, new Pending());
		}

		// Transformation and flow control

		/**
		 * Transform this promise's fulfillment value, returning a new Promise
		 * for the transformed result.  If the promise cannot be fulfilled, onRejected
		 * is called with the reason.  onProgress *may* be called with updates toward
		 * this promise's fulfillment.
		 * @param {function=} onFulfilled fulfillment handler
		 * @param {function=} onRejected rejection handler
		 * @param {function=} onProgress @deprecated progress handler
		 * @return {Promise} new promise
		 */
		Promise.prototype.then = function(onFulfilled, onRejected, onProgress) {
			var parent = this._handler;
			var state = parent.join().state();

			if ((typeof onFulfilled !== 'function' && state > 0) ||
				(typeof onRejected !== 'function' && state < 0)) {
				// Short circuit: value will not change, simply share handler
				return new this.constructor(Handler, parent);
			}

			var p = this._beget();
			var child = p._handler;

			parent.chain(child, parent.receiver, onFulfilled, onRejected, onProgress);

			return p;
		};

		/**
		 * If this promise cannot be fulfilled due to an error, call onRejected to
		 * handle the error. Shortcut for .then(undefined, onRejected)
		 * @param {function?} onRejected
		 * @return {Promise}
		 */
		Promise.prototype['catch'] = function(onRejected) {
			return this.then(void 0, onRejected);
		};

		/**
		 * Creates a new, pending promise of the same type as this promise
		 * @private
		 * @returns {Promise}
		 */
		Promise.prototype._beget = function() {
			return begetFrom(this._handler, this.constructor);
		};

		function begetFrom(parent, Promise) {
			var child = new Pending(parent.receiver, parent.join().context);
			return new Promise(Handler, child);
		}

		// Array combinators

		Promise.all = all;
		Promise.race = race;
		Promise._traverse = traverse;

		/**
		 * Return a promise that will fulfill when all promises in the
		 * input array have fulfilled, or will reject when one of the
		 * promises rejects.
		 * @param {array} promises array of promises
		 * @returns {Promise} promise for array of fulfillment values
		 */
		function all(promises) {
			return traverseWith(snd, null, promises);
		}

		/**
		 * Array<Promise<X>> -> Promise<Array<f(X)>>
		 * @private
		 * @param {function} f function to apply to each promise's value
		 * @param {Array} promises array of promises
		 * @returns {Promise} promise for transformed values
		 */
		function traverse(f, promises) {
			return traverseWith(tryCatch2, f, promises);
		}

		function traverseWith(tryMap, f, promises) {
			var handler = typeof f === 'function' ? mapAt : settleAt;

			var resolver = new Pending();
			var pending = promises.length >>> 0;
			var results = new Array(pending);

			for (var i = 0, x; i < promises.length && !resolver.resolved; ++i) {
				x = promises[i];

				if (x === void 0 && !(i in promises)) {
					--pending;
					continue;
				}

				traverseAt(promises, handler, i, x, resolver);
			}

			if(pending === 0) {
				resolver.become(new Fulfilled(results));
			}

			return new Promise(Handler, resolver);

			function mapAt(i, x, resolver) {
				if(!resolver.resolved) {
					traverseAt(promises, settleAt, i, tryMap(f, x, i), resolver);
				}
			}

			function settleAt(i, x, resolver) {
				results[i] = x;
				if(--pending === 0) {
					resolver.become(new Fulfilled(results));
				}
			}
		}

		function traverseAt(promises, handler, i, x, resolver) {
			if (maybeThenable(x)) {
				var h = getHandlerMaybeThenable(x);
				var s = h.state();

				if (s === 0) {
					h.fold(handler, i, void 0, resolver);
				} else if (s > 0) {
					handler(i, h.value, resolver);
				} else {
					resolver.become(h);
					visitRemaining(promises, i+1, h);
				}
			} else {
				handler(i, x, resolver);
			}
		}

		Promise._visitRemaining = visitRemaining;
		function visitRemaining(promises, start, handler) {
			for(var i=start; i<promises.length; ++i) {
				markAsHandled(getHandler(promises[i]), handler);
			}
		}

		function markAsHandled(h, handler) {
			if(h === handler) {
				return;
			}

			var s = h.state();
			if(s === 0) {
				h.visit(h, void 0, h._unreport);
			} else if(s < 0) {
				h._unreport();
			}
		}

		/**
		 * Fulfill-reject competitive race. Return a promise that will settle
		 * to the same state as the earliest input promise to settle.
		 *
		 * WARNING: The ES6 Promise spec requires that race()ing an empty array
		 * must return a promise that is pending forever.  This implementation
		 * returns a singleton forever-pending promise, the same singleton that is
		 * returned by Promise.never(), thus can be checked with ===
		 *
		 * @param {array} promises array of promises to race
		 * @returns {Promise} if input is non-empty, a promise that will settle
		 * to the same outcome as the earliest input promise to settle. if empty
		 * is empty, returns a promise that will never settle.
		 */
		function race(promises) {
			if(typeof promises !== 'object' || promises === null) {
				return reject(new TypeError('non-iterable passed to race()'));
			}

			// Sigh, race([]) is untestable unless we return *something*
			// that is recognizable without calling .then() on it.
			return promises.length === 0 ? never()
				 : promises.length === 1 ? resolve(promises[0])
				 : runRace(promises);
		}

		function runRace(promises) {
			var resolver = new Pending();
			var i, x, h;
			for(i=0; i<promises.length; ++i) {
				x = promises[i];
				if (x === void 0 && !(i in promises)) {
					continue;
				}

				h = getHandler(x);
				if(h.state() !== 0) {
					resolver.become(h);
					visitRemaining(promises, i+1, h);
					break;
				} else {
					h.visit(resolver, resolver.resolve, resolver.reject);
				}
			}
			return new Promise(Handler, resolver);
		}

		// Promise internals
		// Below this, everything is @private

		/**
		 * Get an appropriate handler for x, without checking for cycles
		 * @param {*} x
		 * @returns {object} handler
		 */
		function getHandler(x) {
			if(isPromise(x)) {
				return x._handler.join();
			}
			return maybeThenable(x) ? getHandlerUntrusted(x) : new Fulfilled(x);
		}

		/**
		 * Get a handler for thenable x.
		 * NOTE: You must only call this if maybeThenable(x) == true
		 * @param {object|function|Promise} x
		 * @returns {object} handler
		 */
		function getHandlerMaybeThenable(x) {
			return isPromise(x) ? x._handler.join() : getHandlerUntrusted(x);
		}

		/**
		 * Get a handler for potentially untrusted thenable x
		 * @param {*} x
		 * @returns {object} handler
		 */
		function getHandlerUntrusted(x) {
			try {
				var untrustedThen = x.then;
				return typeof untrustedThen === 'function'
					? new Thenable(untrustedThen, x)
					: new Fulfilled(x);
			} catch(e) {
				return new Rejected(e);
			}
		}

		/**
		 * Handler for a promise that is pending forever
		 * @constructor
		 */
		function Handler() {}

		Handler.prototype.when
			= Handler.prototype.become
			= Handler.prototype.notify // deprecated
			= Handler.prototype.fail
			= Handler.prototype._unreport
			= Handler.prototype._report
			= noop;

		Handler.prototype._state = 0;

		Handler.prototype.state = function() {
			return this._state;
		};

		/**
		 * Recursively collapse handler chain to find the handler
		 * nearest to the fully resolved value.
		 * @returns {object} handler nearest the fully resolved value
		 */
		Handler.prototype.join = function() {
			var h = this;
			while(h.handler !== void 0) {
				h = h.handler;
			}
			return h;
		};

		Handler.prototype.chain = function(to, receiver, fulfilled, rejected, progress) {
			this.when({
				resolver: to,
				receiver: receiver,
				fulfilled: fulfilled,
				rejected: rejected,
				progress: progress
			});
		};

		Handler.prototype.visit = function(receiver, fulfilled, rejected, progress) {
			this.chain(failIfRejected, receiver, fulfilled, rejected, progress);
		};

		Handler.prototype.fold = function(f, z, c, to) {
			this.when(new Fold(f, z, c, to));
		};

		/**
		 * Handler that invokes fail() on any handler it becomes
		 * @constructor
		 */
		function FailIfRejected() {}

		inherit(Handler, FailIfRejected);

		FailIfRejected.prototype.become = function(h) {
			h.fail();
		};

		var failIfRejected = new FailIfRejected();

		/**
		 * Handler that manages a queue of consumers waiting on a pending promise
		 * @constructor
		 */
		function Pending(receiver, inheritedContext) {
			Promise.createContext(this, inheritedContext);

			this.consumers = void 0;
			this.receiver = receiver;
			this.handler = void 0;
			this.resolved = false;
		}

		inherit(Handler, Pending);

		Pending.prototype._state = 0;

		Pending.prototype.resolve = function(x) {
			this.become(getHandler(x));
		};

		Pending.prototype.reject = function(x) {
			if(this.resolved) {
				return;
			}

			this.become(new Rejected(x));
		};

		Pending.prototype.join = function() {
			if (!this.resolved) {
				return this;
			}

			var h = this;

			while (h.handler !== void 0) {
				h = h.handler;
				if (h === this) {
					return this.handler = cycle();
				}
			}

			return h;
		};

		Pending.prototype.run = function() {
			var q = this.consumers;
			var handler = this.handler;
			this.handler = this.handler.join();
			this.consumers = void 0;

			for (var i = 0; i < q.length; ++i) {
				handler.when(q[i]);
			}
		};

		Pending.prototype.become = function(handler) {
			if(this.resolved) {
				return;
			}

			this.resolved = true;
			this.handler = handler;
			if(this.consumers !== void 0) {
				tasks.enqueue(this);
			}

			if(this.context !== void 0) {
				handler._report(this.context);
			}
		};

		Pending.prototype.when = function(continuation) {
			if(this.resolved) {
				tasks.enqueue(new ContinuationTask(continuation, this.handler));
			} else {
				if(this.consumers === void 0) {
					this.consumers = [continuation];
				} else {
					this.consumers.push(continuation);
				}
			}
		};

		/**
		 * @deprecated
		 */
		Pending.prototype.notify = function(x) {
			if(!this.resolved) {
				tasks.enqueue(new ProgressTask(x, this));
			}
		};

		Pending.prototype.fail = function(context) {
			var c = typeof context === 'undefined' ? this.context : context;
			this.resolved && this.handler.join().fail(c);
		};

		Pending.prototype._report = function(context) {
			this.resolved && this.handler.join()._report(context);
		};

		Pending.prototype._unreport = function() {
			this.resolved && this.handler.join()._unreport();
		};

		/**
		 * Wrap another handler and force it into a future stack
		 * @param {object} handler
		 * @constructor
		 */
		function Async(handler) {
			this.handler = handler;
		}

		inherit(Handler, Async);

		Async.prototype.when = function(continuation) {
			tasks.enqueue(new ContinuationTask(continuation, this));
		};

		Async.prototype._report = function(context) {
			this.join()._report(context);
		};

		Async.prototype._unreport = function() {
			this.join()._unreport();
		};

		/**
		 * Handler that wraps an untrusted thenable and assimilates it in a future stack
		 * @param {function} then
		 * @param {{then: function}} thenable
		 * @constructor
		 */
		function Thenable(then, thenable) {
			Pending.call(this);
			tasks.enqueue(new AssimilateTask(then, thenable, this));
		}

		inherit(Pending, Thenable);

		/**
		 * Handler for a fulfilled promise
		 * @param {*} x fulfillment value
		 * @constructor
		 */
		function Fulfilled(x) {
			Promise.createContext(this);
			this.value = x;
		}

		inherit(Handler, Fulfilled);

		Fulfilled.prototype._state = 1;

		Fulfilled.prototype.fold = function(f, z, c, to) {
			runContinuation3(f, z, this, c, to);
		};

		Fulfilled.prototype.when = function(cont) {
			runContinuation1(cont.fulfilled, this, cont.receiver, cont.resolver);
		};

		var errorId = 0;

		/**
		 * Handler for a rejected promise
		 * @param {*} x rejection reason
		 * @constructor
		 */
		function Rejected(x) {
			Promise.createContext(this);

			this.id = ++errorId;
			this.value = x;
			this.handled = false;
			this.reported = false;

			this._report();
		}

		inherit(Handler, Rejected);

		Rejected.prototype._state = -1;

		Rejected.prototype.fold = function(f, z, c, to) {
			to.become(this);
		};

		Rejected.prototype.when = function(cont) {
			if(typeof cont.rejected === 'function') {
				this._unreport();
			}
			runContinuation1(cont.rejected, this, cont.receiver, cont.resolver);
		};

		Rejected.prototype._report = function(context) {
			tasks.afterQueue(new ReportTask(this, context));
		};

		Rejected.prototype._unreport = function() {
			if(this.handled) {
				return;
			}
			this.handled = true;
			tasks.afterQueue(new UnreportTask(this));
		};

		Rejected.prototype.fail = function(context) {
			this.reported = true;
			emitRejection('unhandledRejection', this);
			Promise.onFatalRejection(this, context === void 0 ? this.context : context);
		};

		function ReportTask(rejection, context) {
			this.rejection = rejection;
			this.context = context;
		}

		ReportTask.prototype.run = function() {
			if(!this.rejection.handled && !this.rejection.reported) {
				this.rejection.reported = true;
				emitRejection('unhandledRejection', this.rejection) ||
					Promise.onPotentiallyUnhandledRejection(this.rejection, this.context);
			}
		};

		function UnreportTask(rejection) {
			this.rejection = rejection;
		}

		UnreportTask.prototype.run = function() {
			if(this.rejection.reported) {
				emitRejection('rejectionHandled', this.rejection) ||
					Promise.onPotentiallyUnhandledRejectionHandled(this.rejection);
			}
		};

		// Unhandled rejection hooks
		// By default, everything is a noop

		Promise.createContext
			= Promise.enterContext
			= Promise.exitContext
			= Promise.onPotentiallyUnhandledRejection
			= Promise.onPotentiallyUnhandledRejectionHandled
			= Promise.onFatalRejection
			= noop;

		// Errors and singletons

		var foreverPendingHandler = new Handler();
		var foreverPendingPromise = new Promise(Handler, foreverPendingHandler);

		function cycle() {
			return new Rejected(new TypeError('Promise cycle'));
		}

		// Task runners

		/**
		 * Run a single consumer
		 * @constructor
		 */
		function ContinuationTask(continuation, handler) {
			this.continuation = continuation;
			this.handler = handler;
		}

		ContinuationTask.prototype.run = function() {
			this.handler.join().when(this.continuation);
		};

		/**
		 * Run a queue of progress handlers
		 * @constructor
		 */
		function ProgressTask(value, handler) {
			this.handler = handler;
			this.value = value;
		}

		ProgressTask.prototype.run = function() {
			var q = this.handler.consumers;
			if(q === void 0) {
				return;
			}

			for (var c, i = 0; i < q.length; ++i) {
				c = q[i];
				runNotify(c.progress, this.value, this.handler, c.receiver, c.resolver);
			}
		};

		/**
		 * Assimilate a thenable, sending it's value to resolver
		 * @param {function} then
		 * @param {object|function} thenable
		 * @param {object} resolver
		 * @constructor
		 */
		function AssimilateTask(then, thenable, resolver) {
			this._then = then;
			this.thenable = thenable;
			this.resolver = resolver;
		}

		AssimilateTask.prototype.run = function() {
			var h = this.resolver;
			tryAssimilate(this._then, this.thenable, _resolve, _reject, _notify);

			function _resolve(x) { h.resolve(x); }
			function _reject(x)  { h.reject(x); }
			function _notify(x)  { h.notify(x); }
		};

		function tryAssimilate(then, thenable, resolve, reject, notify) {
			try {
				then.call(thenable, resolve, reject, notify);
			} catch (e) {
				reject(e);
			}
		}

		/**
		 * Fold a handler value with z
		 * @constructor
		 */
		function Fold(f, z, c, to) {
			this.f = f; this.z = z; this.c = c; this.to = to;
			this.resolver = failIfRejected;
			this.receiver = this;
		}

		Fold.prototype.fulfilled = function(x) {
			this.f.call(this.c, this.z, x, this.to);
		};

		Fold.prototype.rejected = function(x) {
			this.to.reject(x);
		};

		Fold.prototype.progress = function(x) {
			this.to.notify(x);
		};

		// Other helpers

		/**
		 * @param {*} x
		 * @returns {boolean} true iff x is a trusted Promise
		 */
		function isPromise(x) {
			return x instanceof Promise;
		}

		/**
		 * Test just enough to rule out primitives, in order to take faster
		 * paths in some code
		 * @param {*} x
		 * @returns {boolean} false iff x is guaranteed *not* to be a thenable
		 */
		function maybeThenable(x) {
			return (typeof x === 'object' || typeof x === 'function') && x !== null;
		}

		function runContinuation1(f, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.become(h);
			}

			Promise.enterContext(h);
			tryCatchReject(f, h.value, receiver, next);
			Promise.exitContext();
		}

		function runContinuation3(f, x, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.become(h);
			}

			Promise.enterContext(h);
			tryCatchReject3(f, x, h.value, receiver, next);
			Promise.exitContext();
		}

		/**
		 * @deprecated
		 */
		function runNotify(f, x, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.notify(x);
			}

			Promise.enterContext(h);
			tryCatchReturn(f, x, receiver, next);
			Promise.exitContext();
		}

		function tryCatch2(f, a, b) {
			try {
				return f(a, b);
			} catch(e) {
				return reject(e);
			}
		}

		/**
		 * Return f.call(thisArg, x), or if it throws return a rejected promise for
		 * the thrown exception
		 */
		function tryCatchReject(f, x, thisArg, next) {
			try {
				next.become(getHandler(f.call(thisArg, x)));
			} catch(e) {
				next.become(new Rejected(e));
			}
		}

		/**
		 * Same as above, but includes the extra argument parameter.
		 */
		function tryCatchReject3(f, x, y, thisArg, next) {
			try {
				f.call(thisArg, x, y, next);
			} catch(e) {
				next.become(new Rejected(e));
			}
		}

		/**
		 * @deprecated
		 * Return f.call(thisArg, x), or if it throws, *return* the exception
		 */
		function tryCatchReturn(f, x, thisArg, next) {
			try {
				next.notify(f.call(thisArg, x));
			} catch(e) {
				next.notify(e);
			}
		}

		function inherit(Parent, Child) {
			Child.prototype = objectCreate(Parent.prototype);
			Child.prototype.constructor = Child;
		}

		function snd(x, y) {
			return y;
		}

		function noop() {}

		function initEmitRejection() {
			/*global process, self, CustomEvent*/
			if(typeof process !== 'undefined' && process !== null
				&& typeof process.emit === 'function') {
				// Returning falsy here means to call the default
				// onPotentiallyUnhandledRejection API.  This is safe even in
				// browserify since process.emit always returns falsy in browserify:
				// https://github.com/defunctzombie/node-process/blob/master/browser.js#L40-L46
				return function(type, rejection) {
					return type === 'unhandledRejection'
						? process.emit(type, rejection.value, rejection)
						: process.emit(type, rejection);
				};
			} else if(typeof self !== 'undefined' && typeof CustomEvent === 'function') {
				return (function(noop, self, CustomEvent) {
					var hasCustomEvent = false;
					try {
						var ev = new CustomEvent('unhandledRejection');
						hasCustomEvent = ev instanceof CustomEvent;
					} catch (e) {}

					return !hasCustomEvent ? noop : function(type, rejection) {
						var ev = new CustomEvent(type, {
							detail: {
								reason: rejection.value,
								key: rejection
							},
							bubbles: false,
							cancelable: true
						});

						return !self.dispatchEvent(ev);
					};
				}(noop, self, CustomEvent));
			}

			return noop;
		}

		return Promise;
	};
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}]},{},[1])
(1)
});
;
(function(__global) {

__global.$__Object$getPrototypeOf = Object.getPrototypeOf || function(obj) {
  return obj.__proto__;
};

var $__Object$defineProperty;
(function () {
  try {
    if (!!Object.defineProperty({}, 'a', {})) {
      $__Object$defineProperty = Object.defineProperty;
    }
  } catch (e) {
    $__Object$defineProperty = function (obj, prop, opt) {
      try {
        obj[prop] = opt.value || opt.get.call(obj);
      }
      catch(e) {}
    }
  }
}());

__global.$__Object$create = Object.create || function(o, props) {
  function F() {}
  F.prototype = o;

  if (typeof(props) === "object") {
    for (prop in props) {
      if (props.hasOwnProperty((prop))) {
        F[prop] = props[prop];
      }
    }
  }
  return new F();
};

/*
*********************************************************************************************

  Dynamic Module Loader Polyfill

    - Implemented exactly to the former 2014-08-24 ES6 Specification Draft Rev 27, Section 15
      http://wiki.ecmascript.org/doku.php?id=harmony:specification_drafts#august_24_2014_draft_rev_27

    - Functions are commented with their spec numbers, with spec differences commented.

    - Spec bugs are commented in this code with links.

    - Abstract functions have been combined where possible, and their associated functions
      commented.

    - Realm implementation is entirely omitted.

*********************************************************************************************
*/

// Some Helpers

// logs a linkset snapshot for debugging
/* function snapshot(loader) {
  console.log('---Snapshot---');
  for (var i = 0; i < loader.loads.length; i++) {
    var load = loader.loads[i];
    var linkSetLog = '  ' + load.name + ' (' + load.status + '): ';

    for (var j = 0; j < load.linkSets.length; j++) {
      linkSetLog += '{' + logloads(load.linkSets[j].loads) + '} ';
    }
    console.log(linkSetLog);
  }
  console.log('');
}
function logloads(loads) {
  var log = '';
  for (var k = 0; k < loads.length; k++)
    log += loads[k].name + (k != loads.length - 1 ? ' ' : '');
  return log;
} */


/* function checkInvariants() {
  // see https://bugs.ecmascript.org/show_bug.cgi?id=2603#c1

  var loads = System._loader.loads;
  var linkSets = [];

  for (var i = 0; i < loads.length; i++) {
    var load = loads[i];
    console.assert(load.status == 'loading' || load.status == 'loaded', 'Each load is loading or loaded');

    for (var j = 0; j < load.linkSets.length; j++) {
      var linkSet = load.linkSets[j];

      for (var k = 0; k < linkSet.loads.length; k++)
        console.assert(loads.indexOf(linkSet.loads[k]) != -1, 'linkSet loads are a subset of loader loads');

      if (linkSets.indexOf(linkSet) == -1)
        linkSets.push(linkSet);
    }
  }

  for (var i = 0; i < loads.length; i++) {
    var load = loads[i];
    for (var j = 0; j < linkSets.length; j++) {
      var linkSet = linkSets[j];

      if (linkSet.loads.indexOf(load) != -1)
        console.assert(load.linkSets.indexOf(linkSet) != -1, 'linkSet contains load -> load contains linkSet');

      if (load.linkSets.indexOf(linkSet) != -1)
        console.assert(linkSet.loads.indexOf(load) != -1, 'load contains linkSet -> linkSet contains load');
    }
  }

  for (var i = 0; i < linkSets.length; i++) {
    var linkSet = linkSets[i];
    for (var j = 0; j < linkSet.loads.length; j++) {
      var load = linkSet.loads[j];

      for (var k = 0; k < load.dependencies.length; k++) {
        var depName = load.dependencies[k].value;
        var depLoad;
        for (var l = 0; l < loads.length; l++) {
          if (loads[l].name != depName)
            continue;
          depLoad = loads[l];
          break;
        }

        // loading records are allowed not to have their dependencies yet
        // if (load.status != 'loading')
        //  console.assert(depLoad, 'depLoad found');

        // console.assert(linkSet.loads.indexOf(depLoad) != -1, 'linkset contains all dependencies');
      }
    }
  }
} */


(function() {
  var Promise = __global.Promise || require('when/es6-shim/Promise');
  var console;
  if (__global.console) {
    console = __global.console;
    console.assert = console.assert || function() {};
  } else {
    console = { assert: function() {} };
  }

  // IE8 support
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, thisLen = this.length; i < thisLen; i++) {
      if (this[i] === item) {
        return i;
      }
    }
    return -1;
  };
  var defineProperty = $__Object$defineProperty;

  // 15.2.3 - Runtime Semantics: Loader State

  // 15.2.3.11
  function createLoaderLoad(object) {
    return {
      // modules is an object for ES5 implementation
      modules: {},
      loads: [],
      loaderObj: object
    };
  }

  // 15.2.3.2 Load Records and LoadRequest Objects

  // 15.2.3.2.1
  function createLoad(name) {
    return {
      status: 'loading',
      name: name,
      linkSets: [],
      dependencies: [],
      metadata: {}
    };
  }

  // 15.2.3.2.2 createLoadRequestObject, absorbed into calling functions

  // 15.2.4

  // 15.2.4.1
  function loadModule(loader, name, options) {
    return new Promise(asyncStartLoadPartwayThrough({
      step: options.address ? 'fetch' : 'locate',
      loader: loader,
      moduleName: name,
      // allow metadata for import https://bugs.ecmascript.org/show_bug.cgi?id=3091
      moduleMetadata: options && options.metadata || {},
      moduleSource: options.source,
      moduleAddress: options.address
    }));
  }

  // 15.2.4.2
  function requestLoad(loader, request, refererName, refererAddress) {
    // 15.2.4.2.1 CallNormalize
    return new Promise(function(resolve, reject) {
      resolve(loader.loaderObj.normalize(request, refererName, refererAddress));
    })
    // 15.2.4.2.2 GetOrCreateLoad
    .then(function(name) {
      var load;
      if (loader.modules[name]) {
        load = createLoad(name);
        load.status = 'linked';
        // https://bugs.ecmascript.org/show_bug.cgi?id=2795
        load.module = loader.modules[name];
        return load;
      }

      for (var i = 0, l = loader.loads.length; i < l; i++) {
        load = loader.loads[i];
        if (load.name != name)
          continue;
        console.assert(load.status == 'loading' || load.status == 'loaded', 'loading or loaded');
        return load;
      }

      load = createLoad(name);
      loader.loads.push(load);

      proceedToLocate(loader, load);

      return load;
    });
  }

  // 15.2.4.3
  function proceedToLocate(loader, load) {
    proceedToFetch(loader, load,
      Promise.resolve()
      // 15.2.4.3.1 CallLocate
      .then(function() {
        return loader.loaderObj.locate({ name: load.name, metadata: load.metadata });
      })
    );
  }

  // 15.2.4.4
  function proceedToFetch(loader, load, p) {
    proceedToTranslate(loader, load,
      p
      // 15.2.4.4.1 CallFetch
      .then(function(address) {
        // adjusted, see https://bugs.ecmascript.org/show_bug.cgi?id=2602
        if (load.status != 'loading')
          return;
        load.address = address;

        return loader.loaderObj.fetch({ name: load.name, metadata: load.metadata, address: address });
      })
    );
  }

  var anonCnt = 0;

  // 15.2.4.5
  function proceedToTranslate(loader, load, p) {
    p
    // 15.2.4.5.1 CallTranslate
    .then(function(source) {
      if (load.status != 'loading')
        return;

      return Promise.resolve(loader.loaderObj.translate({ name: load.name, metadata: load.metadata, address: load.address, source: source }))

      // 15.2.4.5.2 CallInstantiate
      .then(function(source) {
        if(load.status != 'loading') {
          return;
        }
        load.source = source;
        return loader.loaderObj.instantiate({ name: load.name, metadata: load.metadata, address: load.address, source: source });
      })

      // 15.2.4.5.3 InstantiateSucceeded
      .then(function(instantiateResult) {
        if(load.status != 'loading') {
          return;
        }
        if (instantiateResult === undefined) {
          load.address = load.address || '<Anonymous Module ' + ++anonCnt + '>';

          // instead of load.kind, use load.isDeclarative
          load.isDeclarative = true;
          return loader.loaderObj.transpile(load)
          .then(function(transpiled) {
            // Hijack System.register to set declare function
            var curSystem = __global.System;
            var curRegister = curSystem.register;
            curSystem.register = function(name, regDeps, regDeclare) {
              var declare = regDeclare;
              var deps = regDeps;
              if (typeof name != 'string') {
                declare = deps;
                deps = name;
              }
              // store the registered declaration as load.declare
              // store the deps as load.deps
              load.declare = declare;
              load.depsList = deps;
            };
            __eval(transpiled, __global, load);
            curSystem.register = curRegister;
          });
        }
        else if (typeof instantiateResult == 'object') {
          load.depsList = instantiateResult.deps || [];
          load.execute = instantiateResult.execute;
          load.isDeclarative = false;
        }
        else
          throw TypeError('Invalid instantiate return value');
      })
      // 15.2.4.6 ProcessLoadDependencies
      .then(function() {
        if(load.status != 'loading') {
          return;
        }
        load.dependencies = [];
        var depsList = load.depsList;

        var loadPromises = [];
        for (var i = 0, l = depsList.length; i < l; i++) (function(request, index) {
          loadPromises.push(
            requestLoad(loader, request, load.name, load.address)

            // 15.2.4.6.1 AddDependencyLoad (load is parentLoad)
            .then(function(depLoad) {

              // adjusted from spec to maintain dependency order
              // this is due to the System.register internal implementation needs
              load.dependencies[index] = {
                key: request,
                value: depLoad.name
              };

              if (depLoad.status != 'linked') {
                var linkSets = load.linkSets.concat([]);
                for (var i = 0, l = linkSets.length; i < l; i++)
                  addLoadToLinkSet(linkSets[i], depLoad);
              }

              // console.log('AddDependencyLoad ' + depLoad.name + ' for ' + load.name);
              // snapshot(loader);
            })
          );
        })(depsList[i], i);

        return Promise.all(loadPromises);
      })

      // 15.2.4.6.2 LoadSucceeded
      .then(function() {
        // console.log('LoadSucceeded ' + load.name);
        // snapshot(loader);
        if(load.status != 'loading') {
          return;
        }

        console.assert(load.status == 'loading', 'is loading');

        load.status = 'loaded';

        var linkSets = load.linkSets.concat([]);
        for (var i = 0, l = linkSets.length; i < l; i++)
          updateLinkSetOnLoad(linkSets[i], load);
      });
    })
    // 15.2.4.5.4 LoadFailed
    ['catch'](function(exc) {
      load.status = 'failed';
      load.exception = exc;

      var linkSets = load.linkSets.concat([]);
      for (var i = 0, l = linkSets.length; i < l; i++) {
        linkSetFailed(linkSets[i], load, exc);
      }

      console.assert(load.linkSets.length == 0, 'linkSets not removed');
    });
  }

  // 15.2.4.7 PromiseOfStartLoadPartwayThrough absorbed into calling functions

  // 15.2.4.7.1
  function asyncStartLoadPartwayThrough(stepState) {
    return function(resolve, reject) {
      var loader = stepState.loader;
      var name = stepState.moduleName;
      var step = stepState.step;
      var importingModuleName = stepState.moduleMetadata.importingModuleName;

      if (loader.modules[name])
        throw new TypeError('"' + name + '" already exists in the module table');

      // adjusted to pick up existing loads
      var existingLoad, firstLinkSet;
      for (var i = 0, l = loader.loads.length; i < l; i++) {
        if (loader.loads[i].name == name) {
          existingLoad = loader.loads[i];

          if(step == 'translate' && !existingLoad.source) {
            existingLoad.address = stepState.moduleAddress;
            proceedToTranslate(loader, existingLoad, Promise.resolve(stepState.moduleSource));
          }

          // If the module importing this is part of the same linkSet, create
          // a new one for this import.
          firstLinkSet = existingLoad.linkSets[0];
          if(importingModuleName && firstLinkSet.loads[importingModuleName]) {
            continue;
          }

          return firstLinkSet.done.then(function() {
            resolve(existingLoad);
          });
        }
      }

      var load;
      if(existingLoad) {
        load = existingLoad;
      } else {
        load = createLoad(name);
        load.metadata = stepState.moduleMetadata;
      }

      var linkSet = createLinkSet(loader, load);

      if(!existingLoad) {
        loader.loads.push(load);
      }

      resolve(linkSet.done);

      if (step == 'locate')
        proceedToLocate(loader, load);

      else if (step == 'fetch')
        proceedToFetch(loader, load, Promise.resolve(stepState.moduleAddress));

      else {
        console.assert(step == 'translate', 'translate step');
        load.address = stepState.moduleAddress;
        proceedToTranslate(loader, load, Promise.resolve(stepState.moduleSource));
      }
    }
  }

  // Declarative linking functions run through alternative implementation:
  // 15.2.5.1.1 CreateModuleLinkageRecord not implemented
  // 15.2.5.1.2 LookupExport not implemented
  // 15.2.5.1.3 LookupModuleDependency not implemented

  // 15.2.5.2.1
  function createLinkSet(loader, startingLoad) {
    var linkSet = {
      loader: loader,
      loads: [],
      startingLoad: startingLoad, // added see spec bug https://bugs.ecmascript.org/show_bug.cgi?id=2995
      loadingCount: 0
    };
    linkSet.done = new Promise(function(resolve, reject) {
      linkSet.resolve = resolve;
      linkSet.reject = reject;
    });
    addLoadToLinkSet(linkSet, startingLoad);
    return linkSet;
  }
  // 15.2.5.2.2
  function addLoadToLinkSet(linkSet, load) {
    console.assert(load.status == 'loading' || load.status == 'loaded', 'loading or loaded on link set');

    for (var i = 0, l = linkSet.loads.length; i < l; i++)
      if (linkSet.loads[i] == load)
        return;

    linkSet.loads.push(load);
    linkSet.loads[load.name] = true;
    load.linkSets.push(linkSet);

    // adjustment, see https://bugs.ecmascript.org/show_bug.cgi?id=2603
    if (load.status != 'loaded') {
      linkSet.loadingCount++;
    }

    var loader = linkSet.loader;

    for (var i = 0, l = load.dependencies.length; i < l; i++) {
      var name = load.dependencies[i].value;

      if (loader.modules[name])
        continue;

      for (var j = 0, d = loader.loads.length; j < d; j++) {
        if (loader.loads[j].name != name)
          continue;

        addLoadToLinkSet(linkSet, loader.loads[j]);
        break;
      }
    }
    // console.log('add to linkset ' + load.name);
    // snapshot(linkSet.loader);
  }

  // linking errors can be generic or load-specific
  // this is necessary for debugging info
  function doLink(linkSet) {
    var error = false;
    try {
      link(linkSet, function(load, exc) {
        linkSetFailed(linkSet, load, exc);
        error = true;
      });
    }
    catch(e) {
      linkSetFailed(linkSet, null, e);
      error = true;
    }
    return error;
  }

  // 15.2.5.2.3
  function updateLinkSetOnLoad(linkSet, load) {
    // console.log('update linkset on load ' + load.name);
    // snapshot(linkSet.loader);

    console.assert(load.status == 'loaded' || load.status == 'linked', 'loaded or linked');

    linkSet.loadingCount--;

    if (linkSet.loadingCount > 0)
      return;

    // adjusted for spec bug https://bugs.ecmascript.org/show_bug.cgi?id=2995
    var startingLoad = linkSet.startingLoad;

    // non-executing link variation for loader tracing
    // on the server. Not in spec.
    /***/
    if (linkSet.loader.loaderObj.execute === false) {
      var loads = [].concat(linkSet.loads);
      for (var i = 0, l = loads.length; i < l; i++) {
        var load = loads[i];
        load.module = !load.isDeclarative ? {
          module: _newModule({})
        } : {
          name: load.name,
          module: _newModule({}),
          evaluated: true
        };
        load.status = 'linked';
        finishLoad(linkSet.loader, load);
      }
      return linkSet.resolve(startingLoad);
    }
    /***/

    var abrupt = doLink(linkSet);

    if (abrupt)
      return;

    console.assert(linkSet.loads.length == 0, 'loads cleared');

    linkSet.resolve(startingLoad);
  }

  // 15.2.5.2.4
  function linkSetFailed(linkSet, load, linkExc) {
    var loader = linkSet.loader;
    var exc = linkExc;

    if (linkSet.loads[0].name != load.name)
      exc = addToError(exc, 'Error loading "' + load.name + '" from "' + linkSet.loads[0].name + '" at ' + (linkSet.loads[0].address || '<unknown>') + '\n');

    exc = addToError(exc, 'Error loading "' + load.name + '" at ' + (load.address || '<unknown>') + '\n');

    var loads = linkSet.loads.concat([]);
    for (var i = 0, l = loads.length; i < l; i++) {
      var load = loads[i];

      // store all failed load records
      loader.loaderObj.failed = loader.loaderObj.failed || [];
      if (indexOf.call(loader.loaderObj.failed, load) == -1)
        loader.loaderObj.failed.push(load);

      var linkIndex = indexOf.call(load.linkSets, linkSet);
      console.assert(linkIndex != -1, 'link not present');
      load.linkSets.splice(linkIndex, 1);
      if (load.linkSets.length == 0) {
        var globalLoadsIndex = indexOf.call(linkSet.loader.loads, load);
        if (globalLoadsIndex != -1)
          linkSet.loader.loads.splice(globalLoadsIndex, 1);
      }
    }
    linkSet.reject(exc);
  }

  // 15.2.5.2.5
  function finishLoad(loader, load) {
    // add to global trace if tracing
    if (loader.loaderObj.trace) {
      if (!loader.loaderObj.loads)
        loader.loaderObj.loads = {};
      var depMap = {};
      load.dependencies.forEach(function(dep) {
        depMap[dep.key] = dep.value;
      });
      loader.loaderObj.loads[load.name] = {
        name: load.name,
        deps: load.dependencies.map(function(dep){ return dep.key }),
        depMap: depMap,
        address: load.address,
        metadata: load.metadata,
        source: load.source,
        kind: load.isDeclarative ? 'declarative' : 'dynamic'
      };
    }
    // if not anonymous, add to the module table
    if (load.name) {
      console.assert(!loader.modules[load.name], 'load not in module table');
      loader.modules[load.name] = load.module;
    }
    var loadIndex = indexOf.call(loader.loads, load);
    if (loadIndex != -1)
      loader.loads.splice(loadIndex, 1);
    for (var i = 0, l = load.linkSets.length; i < l; i++) {
      loadIndex = indexOf.call(load.linkSets[i].loads, load);
      if (loadIndex != -1)
        load.linkSets[i].loads.splice(loadIndex, 1);
    }
    load.linkSets.splice(0, load.linkSets.length);
  }

  // 15.2.5.3 Module Linking Groups

  // 15.2.5.3.2 BuildLinkageGroups alternative implementation
  // Adjustments (also see https://bugs.ecmascript.org/show_bug.cgi?id=2755)
  // 1. groups is an already-interleaved array of group kinds
  // 2. load.groupIndex is set when this function runs
  // 3. load.groupIndex is the interleaved index ie 0 declarative, 1 dynamic, 2 declarative, ... (or starting with dynamic)
  function buildLinkageGroups(load, loads, groups) {
    groups[load.groupIndex] = groups[load.groupIndex] || [];

    // if the load already has a group index and its in its group, its already been done
    // this logic naturally handles cycles
    if (indexOf.call(groups[load.groupIndex], load) != -1)
      return;

    // now add it to the group to indicate its been seen
    groups[load.groupIndex].push(load);

    for (var i = 0, l = loads.length; i < l; i++) {
      var loadDep = loads[i];

      // dependencies not found are already linked
      for (var j = 0; j < load.dependencies.length; j++) {
        if (loadDep.name == load.dependencies[j].value) {
          // by definition all loads in linkset are loaded, not linked
          console.assert(loadDep.status == 'loaded', 'Load in linkSet not loaded!');

          // if it is a group transition, the index of the dependency has gone up
          // otherwise it is the same as the parent
          var loadDepGroupIndex = load.groupIndex + (loadDep.isDeclarative != load.isDeclarative);

          // the group index of an entry is always the maximum
          if (loadDep.groupIndex === undefined || loadDep.groupIndex < loadDepGroupIndex) {

            // if already in a group, remove from the old group
            if (loadDep.groupIndex !== undefined) {
              groups[loadDep.groupIndex].splice(indexOf.call(groups[loadDep.groupIndex], loadDep), 1);

              // if the old group is empty, then we have a mixed depndency cycle
              if (groups[loadDep.groupIndex].length == 0)
                throw new TypeError("Mixed dependency cycle detected");
            }

            loadDep.groupIndex = loadDepGroupIndex;
          }

          buildLinkageGroups(loadDep, loads, groups);
        }
      }
    }
  }

  function doDynamicExecute(linkSet, load, linkError) {
    try {
      var module = load.execute();
    }
    catch(e) {
      linkError(load, e);
      return;
    }
    if (!module || !(module instanceof Module))
      linkError(load, new TypeError('Execution must define a Module instance'));
    else
      return module;
  }

  // 15.2.5.4
  function link(linkSet, linkError) {

    var loader = linkSet.loader;

    if (!linkSet.loads.length)
      return;

    // console.log('linking {' + logloads(linkSet.loads) + '}');
    // snapshot(loader);

    // 15.2.5.3.1 LinkageGroups alternative implementation

    // build all the groups
    // because the first load represents the top of the tree
    // for a given linkset, we can work down from there
    var groups = [];
    var startingLoad = linkSet.loads[0];
    startingLoad.groupIndex = 0;
    buildLinkageGroups(startingLoad, linkSet.loads, groups);

    // determine the kind of the bottom group
    var curGroupDeclarative = startingLoad.isDeclarative == groups.length % 2;

    // run through the groups from bottom to top
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var load = group[j];

        // 15.2.5.5 LinkDeclarativeModules adjusted
        if (curGroupDeclarative) {
          linkDeclarativeModule(load, linkSet.loads, loader);
        }
        // 15.2.5.6 LinkDynamicModules adjusted
        else {
          var module = doDynamicExecute(linkSet, load, linkError);
          if (!module)
            return;
          load.module = {
            name: load.name,
            module: module
          };
          load.status = 'linked';
        }
        finishLoad(loader, load);
      }

      // alternative current kind for next loop
      curGroupDeclarative = !curGroupDeclarative;
    }
  }


  // custom module records for binding graph
  // store linking module records in a separate table
  function getOrCreateModuleRecord(name, loader) {
    var moduleRecords = loader.moduleRecords;
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      module: new Module(), // start from an empty module and extend
      importers: []
    });
  }

  // custom declarative linking function
  function linkDeclarativeModule(load, loads, loader) {
    if (load.module)
      return;

    var module = load.module = getOrCreateModuleRecord(load.name, loader);
    var moduleObj = load.module.module;

    var registryEntry = load.declare.call(__global, function(name, value) {
      // NB This should be an Object.defineProperty, but that is very slow.
      //    By disaling this module write-protection we gain performance.
      //    It could be useful to allow an option to enable or disable this.
      module.locked = true;
      if(typeof name === 'object') {
        for(var p in name) {
          moduleObj[p] = name[p];
        }
      } else {
        moduleObj[name] = value;
      }

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          var importerIndex = indexOf.call(importerModule.dependencies, module);
          importerModule.setters[importerIndex](moduleObj);
        }
      }

      module.locked = false;
      return value;
    });

    // setup our setters and execution function
    module.setters = registryEntry.setters;
    module.execute = registryEntry.execute;

    // now link all the module dependencies
    // amending the depMap as we go
    for (var i = 0, l = load.dependencies.length; i < l; i++) {
      var depName = load.dependencies[i].value;
      var depModule = loader.modules[depName];

      // if dependency not already in the module registry
      // then try and link it now
      if (!depModule) {
        // get the dependency load record
        for (var j = 0; j < loads.length; j++) {
          if (loads[j].name != depName)
            continue;

          // only link if already not already started linking (stops at circular / dynamic)
          if (!loads[j].module) {
            linkDeclarativeModule(loads[j], loads, loader);
            depModule = loads[j].module;
          }
          // if circular, create the module record
          else {
            depModule = getOrCreateModuleRecord(depName, loader);
          }
        }
      }

      // only declarative modules have dynamic bindings
      if (depModule.importers) {
        module.dependencies.push(depModule);
        depModule.importers.push(module);
      }
      else {
        // track dynamic records as null module records as already linked
        module.dependencies.push(null);
      }

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depModule.module);
    }

    load.status = 'linked';
  }



  // 15.2.5.5.1 LinkImports not implemented
  // 15.2.5.7 ResolveExportEntries not implemented
  // 15.2.5.8 ResolveExports not implemented
  // 15.2.5.9 ResolveExport not implemented
  // 15.2.5.10 ResolveImportEntries not implemented

  // 15.2.6.1
  function evaluateLoadedModule(loader, load) {
    console.assert(load.status == 'linked', 'is linked ' + load.name);

    doEnsureEvaluated(load.module, [], loader);
    return load.module.module;
  }

  /*
   * Module Object non-exotic for ES5:
   *
   * module.module        bound module object
   * module.execute       execution function for module
   * module.dependencies  list of module objects for dependencies
   * See getOrCreateModuleRecord for all properties
   *
   */
  function doExecute(module) {
    try {
      module.execute.call(__global);
    }
    catch(e) {
      return e;
    }
  }

  // propogate execution errors
  // see https://bugs.ecmascript.org/show_bug.cgi?id=2993
  function doEnsureEvaluated(module, seen, loader) {
    var err = ensureEvaluated(module, seen, loader);
    if (err)
      throw err;
  }
  // 15.2.6.2 EnsureEvaluated adjusted
  function ensureEvaluated(module, seen, loader) {
    if (module.evaluated || !module.dependencies)
      return;

    seen.push(module);

    var deps = module.dependencies;
    var err;

    for (var i = 0, l = deps.length; i < l; i++) {
      var dep = deps[i];
      // dynamic dependencies are empty in module.dependencies
      // as they are already linked
      if (!dep)
        continue;
      if (indexOf.call(seen, dep) == -1) {
        err = ensureEvaluated(dep, seen, loader);
        // stop on error, see https://bugs.ecmascript.org/show_bug.cgi?id=2996
        if (err) {
          err = addToError(err, 'Error evaluating ' + dep.name + '\n');
          return err;
        }
      }
    }

    if (module.failed)
      return new Error('Module failed execution.');

    if (module.evaluated)
      return;

    module.evaluated = true;
    err = doExecute(module);
    if (err) {
      module.failed = true;
    }
    else if (Object.preventExtensions) {
      // spec variation
      // we don't create a new module here because it was created and ammended
      // we just disable further extensions instead
      Object.preventExtensions(module.module);
    }

    module.execute = undefined;
    return err;
  }

  function addToError(error, msg) {
    var err = error;
    if (err instanceof Error)
      err.message = msg + err.message;
    else
      err = msg + err;
    return err;
  }

  // 26.3 Loader

  // 26.3.1.1
  function Loader(options) {
    if (typeof options != 'object')
      throw new TypeError('Options must be an object');

    if (options.normalize)
      this.normalize = options.normalize;
    if (options.locate)
      this.locate = options.locate;
    if (options.fetch)
      this.fetch = options.fetch;
    if (options.translate)
      this.translate = options.translate;
    if (options.instantiate)
      this.instantiate = options.instantiate;

    this._loader = {
      loaderObj: this,
      loads: [],
      modules: {},
      importPromises: {},
      moduleRecords: {}
    };

    // 26.3.3.6
    defineProperty(this, 'global', {
      get: function() {
        return __global;
      }
    });

    // 26.3.3.13 realm not implemented
  }

  function Module() {}

  // importPromises adds ability to import a module twice without error - https://bugs.ecmascript.org/show_bug.cgi?id=2601
  function createImportPromise(loader, name, promise) {
    var importPromises = loader._loader.importPromises;
    return importPromises[name] = promise.then(function(m) {
      importPromises[name] = undefined;
      return m;
    }, function(e) {
      importPromises[name] = undefined;
      throw e;
    });
  }

  Loader.prototype = {
    // 26.3.3.1
    constructor: Loader,
    // 26.3.3.2
    define: function(name, source, options) {
      // check if already defined
      if (this._loader.importPromises[name])
        throw new TypeError('Module is already loading.');
      return createImportPromise(this, name, new Promise(asyncStartLoadPartwayThrough({
        step: 'translate',
        loader: this._loader,
        moduleName: name,
        moduleMetadata: options && options.metadata || {},
        moduleSource: source,
        moduleAddress: options && options.address
      })));
    },
    // 26.3.3.3
    'delete': function(name) {
      var loader = this._loader;
      delete loader.importPromises[name];
      delete loader.moduleRecords[name];
      return loader.modules[name] ? delete loader.modules[name] : false;
    },
    // 26.3.3.4 entries not implemented
    // 26.3.3.5
    get: function(key) {
      if (!this._loader.modules[key])
        return;
      doEnsureEvaluated(this._loader.modules[key], [], this);
      return this._loader.modules[key].module;
    },
    // 26.3.3.7
    has: function(name) {
      return !!this._loader.modules[name];
    },
    // 26.3.3.8
    'import': function(name, options) {
      // run normalize first
      var loaderObj = this;

      // added, see https://bugs.ecmascript.org/show_bug.cgi?id=2659
      return Promise.resolve(loaderObj.normalize(name, options && options.name, options && options.address))
      .then(function(name) {
        var loader = loaderObj._loader;

        if (loader.modules[name]) {
          doEnsureEvaluated(loader.modules[name], [], loader._loader);
          return loader.modules[name].module;
        }

        return loader.importPromises[name] || createImportPromise(loaderObj, name,
          loadModule(loader, name, options || {})
          .then(function(load) {
            delete loader.importPromises[name];
            return evaluateLoadedModule(loader, load);
          }, function(err){
            if(loaderObj.defined) {
              loaderObj.defined[name] = undefined;
            }
            return Promise.reject(err);
          }));
      });
    },
    // 26.3.3.9 keys not implemented
    // 26.3.3.10
    load: function(name, options) {
      if (this._loader.modules[name]) {
        doEnsureEvaluated(this._loader.modules[name], [], this._loader);
        return Promise.resolve(this._loader.modules[name].module);
      }
      return this._loader.importPromises[name] || createImportPromise(this, name, loadModule(this._loader, name, {}));
    },
    // 26.3.3.11
    module: function(source, options) {
      var load = createLoad();
      load.address = options && options.address;
      var linkSet = createLinkSet(this._loader, load);
      var sourcePromise = Promise.resolve(source);
      var loader = this._loader;
      var p = linkSet.done.then(function() {
        return evaluateLoadedModule(loader, load);
      });
      proceedToTranslate(loader, load, sourcePromise);
      return p;
    },
    // 26.3.3.12
    newModule: function (obj) {
      if (typeof obj != 'object')
        throw new TypeError('Expected object');

      // we do this to be able to tell if a module is a module privately in ES5
      // by doing m instanceof Module
      var m = new Module();

      var pNames;
      if (Object.getOwnPropertyNames && obj != null) {
        pNames = Object.getOwnPropertyNames(obj);
      }
      else {
        pNames = [];
        for (var key in obj)
          pNames.push(key);
      }

      for (var i = 0; i < pNames.length; i++) (function(key) {
        defineProperty(m, key, {
          configurable: false,
          enumerable: true,
          get: function () {
            return obj[key];
          }
        });
      })(pNames[i]);

      if (Object.preventExtensions)
        Object.preventExtensions(m);

      return m;
    },
    // 26.3.3.14
    set: function(name, module) {
      if (!(module instanceof Module))
        throw new TypeError('Loader.set(' + name + ', module) must be a module');
      this._loader.modules[name] = {
        module: module
      };
    },
    // 26.3.3.15 values not implemented
    // 26.3.3.16 @@iterator not implemented
    // 26.3.3.17 @@toStringTag not implemented

    // 26.3.3.18.1
    normalize: function(name, referrerName, referrerAddress) {
      return name;
    },
    // 26.3.3.18.2
    locate: function(load) {
      return load.name;
    },
    // 26.3.3.18.3
    fetch: function(load) {
      throw new TypeError('Fetch not implemented');
    },
    // 26.3.3.18.4
    translate: function(load) {
      return load.source;
    },
    // 26.3.3.18.5
    instantiate: function(load) {
    }
  };

  var _newModule = Loader.prototype.newModule;

  if (typeof exports === 'object')
    module.exports = Loader;

  __global.Reflect = __global.Reflect || {};
  __global.Reflect.Loader = __global.Reflect.Loader || Loader;
  __global.Reflect.global = __global.Reflect.global || __global;
  __global.LoaderPolyfill = Loader;

})();
/*
 * Traceur and Babel transpile hook for Loader
 */
(function(Loader) {
	var g = __global;

	var isNode = typeof self === "undefined" &&
		typeof process !== "undefined" &&
		{}.toString.call(process) === '[object process]';

	function getTranspilerModule(loader, globalName) {
		return loader.newModule({
			__useDefault: true,
			"default": g[globalName]
		});
	}

	function getTranspilerGlobalName(loadName) {
		return loadName === "babel" ? "Babel" : loadName;
	}

	// Use Babel by default
	Loader.prototype.transpiler = 'babel';

	Loader.prototype.transpile = function(load) {
		var self = this;

		// pick up Transpiler modules from existing globals on first run if set
		if (!self.transpilerHasRun) {
			if (g.traceur && !self.has('traceur')) {
				self.set('traceur', getTranspilerModule(self, 'traceur'));
			}
			if (g.Babel && !self.has("babel")) {
				self.set("babel", getTranspilerModule(self, "Babel"));
			}
			self.transpilerHasRun = true;
		}

		return self['import'](self.transpiler)
			.then(function(transpilerMod) {
				var transpiler = transpilerMod;
				if (transpiler.__useDefault) {
					transpiler = transpiler['default'];
				}

				return (transpiler.Compiler ? traceurTranspile : babelTranspile)
					.call(self, load, transpiler);
			})
			.then(function(code) {
				return 'var __moduleAddress = "' + load.address + '";' + code;
			});
	};

	Loader.prototype.instantiate = function(load) {
		var self = this;
		return Promise.resolve(self.normalize(self.transpiler))
			.then(function(transpilerNormalized) {
				// load transpiler as a global (avoiding System clobbering)
				if (load.name === transpilerNormalized) {
					return {
						deps: [],
						execute: function() {
							var curSystem = g.System;
							var curLoader = g.Reflect.Loader;
							// ensure not detected as CommonJS
							__eval('(function(require,exports,module){' + load.source + '})();', g, load);
							g.System = curSystem;
							g.Reflect.Loader = curLoader;
							return getTranspilerModule(self, getTranspilerGlobalName(load.name));
						}
					};
				}
			});
	};

	function traceurTranspile(load, traceur) {
		var options = this.traceurOptions || {};
		options.modules = 'instantiate';
		options.script = false;
		options.sourceMaps = 'inline';
		options.filename = load.address;
		options.inputSourceMap = load.metadata.sourceMap;
		options.moduleName = false;

		var compiler = new traceur.Compiler(options);
		var source = doTraceurCompile(load.source, compiler, options.filename);

		// add "!eval" to end of Traceur sourceURL
		// I believe this does something?
		source += '!eval';

		return source;
	}
	function doTraceurCompile(source, compiler, filename) {
		try {
			return compiler.compile(source, filename);
		}
		catch(e) {
			// traceur throws an error array
			throw e[0];
		}
	}

	/**
	 * Gets the babel environment name
	 * return {string} The babel environment name
	 */
	function getBabelEnv() {
		var loader = this;
		var defaultEnv = "development";
		var loaderEnv = typeof loader.getEnv === "function" && loader.getEnv();

		if (isNode) {
			return process.env.BABEL_ENV ||
				process.env.NODE_ENV ||
				loaderEnv ||
				defaultEnv;
		}
		else {
			return loaderEnv || defaultEnv;
		}
	}

	/**
	 * Gets the babel preset or plugin name
	 * @param {BabelPreset|BabelPlugin} presetOrPlugin A babel plugin or preset
	 * @return {?string} The preset/plugin name
	 */
	function getPresetOrPluginName(presetOrPlugin) {
		if (includesPresetOrPluginName(presetOrPlugin)) {
			return typeof presetOrPlugin === "string" ? presetOrPlugin : presetOrPlugin[0];
		}
		else {
			return null;
		}
	}

	/**
	 * Whether the babel plugin/preset name was provided
	 *
	 * @param {BabelPreset|BabelPlugin} presetOrPlugin
	 * @return {boolean}
	 */
	function includesPresetOrPluginName(presetOrPlugin) {
		return typeof presetOrPlugin === "string" ||
			presetOrPlugin.length && typeof presetOrPlugin[0] === "string";
	}

	/**
	 * A Babel plugins as defined in `babelOptions.plugins`
	 * @typedef {string|Function|<string, Object>[]|<Function, Object>[]} BabelPlugin
	 */

	var processBabelPlugins = (function() {
		/**
		 * Returns a list of babel plugins to be used during transpilation
		 *
		 * Collects the babel plugins defined in `babelOptions.plugins` plus
		 * the environment dependant plugins.
		 *
		 * @param {Object} babel The babel object exported by babel-standalone
		 * @param {babelOptions} babelOptions The babel configuration object
		 * @return {Promise.<BabelPlugin[]>} Promise that resolves to a list of babel plugins
		 */
		return function processBabelPlugins(babel, babelOptions) {
			var babelEnv = getBabelEnv.call(this);
			var babelEnvConfig = babelOptions.env || {};

			var pluginsPromises = [
				doProcessPlugins.call(this, babel, babelOptions.plugins)
			];

			for (var envName in babelEnvConfig) {
				// do not process plugins if the current environment does not match
				// the environment in which the plugins are set to be used
				if (babelEnv === envName) {
					var plugins = babelEnvConfig[envName].plugins || [];
					pluginsPromises.push(doProcessPlugins.call(this, babel, plugins));
				}
			}

			return Promise.all(pluginsPromises)
				.then(function(results) {
					var plugins = [];

					// results is an array of arrays, flatten it out!
					results.forEach(function(processedPlugins) {
						plugins = plugins.concat(processedPlugins);
					});

					return plugins;
				});
		}

		/**
		 * Collects builtin plugin names and non builtins functions
		 *
		 * @param {Object} babel The babel object exported by babel-standalone
		 * @param {BabelPlugin[]} babelPlugins A list of babel plugins
		 * @return {Promise.<BabelPlugin[]>} A promise that resolves to a list
		 *		of babel-standalone builtin plugin names and non-builtin plugin
		 *		functions
		 */
		function doProcessPlugins(babel, babelPlugins) {
			var promises = [];

			var plugins = babelPlugins || [];

			plugins.forEach(function(plugin) {
				var name = getPresetOrPluginName(plugin);

				if (!includesPresetOrPluginName(plugin) || isBuiltinPlugin(babel, name)) {
					promises.push(plugin);
				}
				else if (!isBuiltinPlugin(babel, name)) {
					var parent = this.configMain || "package.json!npm";
					var npmPluginNameOrPath = getNpmPluginNameOrPath(name);

					// import the plugin!
					promises.push(this["import"](npmPluginNameOrPath, { name: parent })
						.then(function(mod) {
							var exported = mod.__esModule ? mod["default"] : mod;

							if (typeof plugin === "string") {
								return exported;
							}
							// assume the array form was provided
							else {
								// [ pluginFunction, pluginOptions ]
								return [exported, plugin[1]];
							}
						}));
				}
			}, this);

			return Promise.all(promises);
		}

		/**
		 * Whether the plugin is built in babel-standalone
		 *
		 * @param {Object} babel The babel object exported by babel-standalone
		 * @param {string} pluginName The plugin name to be checked
		 * @return {boolean}
		 */
		function isBuiltinPlugin(babel, pluginName) {
			var isNpmPluginName = /^(?:babel-plugin-)/;
			var availablePlugins = babel.availablePlugins || {};

			// babel-standalone registers its bundled plugins using the shorthand name
			var shorthand = isNpmPluginName.test(pluginName) ?
				pluginName.replace("babel-plugin-", "") :
				pluginName;

			return !!availablePlugins[shorthand];
		}

		/**
		 * Returns babel full plugin name if shorthand was used or the path provided
		 *
		 * @param {string} name The entry in the plugin array
		 * @return {string} Relative/absolute path to plugin or babel npm plugin name
		 *
		 * If a babel plugin is on npm, it can be set in the `plugins` array using
		 * one of the following forms:
		 *
		 * 1) full plugin name, e.g `"plugins": ["babel-plugin-myPlugin"]`
		 * 2) relative/absolute path, e.g: `"plugins": ["./node_modules/asdf/plugin"]`
		 * 3) using a shorthand, e.g: `"plugins": ["myPlugin"]`
		 *
		 * Since plugins are loaded through steal, we need to make sure the full
		 * plugin name is passed to `steal.import` so the npm extension can locate
		 * the babel plugin. Relative/absolute paths should be loaded as any other
		 * module.
		 */
		function getNpmPluginNameOrPath(name) {
			var isPath = /\//;
			var isBabelPluginName = /^(?:babel-plugin-)/;

			return isPath.test(name) || isBabelPluginName.test(name) ?
				name : "babel-plugin-" + name;
		}
	}());

	function getBabelPlugins(current) {
		var plugins = current || [];
		var required = "transform-es2015-modules-systemjs";

		if (plugins.indexOf(required) === -1) {
			plugins.unshift(required);
		}

		return plugins;
	}

	function getBabelPresets(current) {
		var presets = current || [];
		var required = ["es2015-no-commonjs"];

		if (presets.length) {
			for (var i = required.length - 1; i >=0; i -= 1) {
				var preset = required[i];

				if (presets.indexOf(preset) === -1) {
					presets.unshift(preset);
				}
			}
		}
		else {
			presets = ["es2015-no-commonjs", "react", "stage-0"];
		}

		return presets;
	}

	/**
	 * Returns the babel version
	 * @param {Object} babel The babel object
	 * @return {number} The babel version
	 */
	function getBabelVersion(babel) {
		var babelVersion = babel.version ? +babel.version.split(".")[0] : 6;

		return babelVersion || 6;
	}

	function getBabelOptions(load, babel) {
		var options = this.babelOptions || {};

		options.sourceMap = 'inline';
		options.filename = load.address;
		options.code = true;
		options.ast = false;

		if (getBabelVersion(babel) >= 6) {
			// delete the old babel options if they are present in config
			delete options.optional;
			delete options.whitelist;
			delete options.blacklist;

			// make sure presents and plugins needed for Steal to work
			// correctly are set
			options.presets = getBabelPresets(options.presets);
			options.plugins = getBabelPlugins(options.plugins);
		}
		else {
			options.modules = 'system';

			if (!options.blacklist) {
				options.blacklist = ['react'];
			}
		}

		return options;
	}

	/**presets
	 * A Babel preset as defined in `babelOptions.presets`
	 * @typedef {string|Function|Object|<string, Object>[]|<Function, Object>[]|<Object, Object>} BabelPreset
	 */

	var processBabelPresets = (function() {
		/**
		 * Returns a list of babel presets to be used during transpilation
		 *
		 * Collects the babel presets defined in `babelOptions.presets` plus
		 * the environment dependant presets.
		 *
		 * @param {Object} babel The babel object exported by babel-standalone
		 * @param {babelOptions} babelOptions The babel configuration object
		 * @return {Promise.<BabelPreset[]>} Promise that resolves to a list of babel presets
		 */
		return function processBabelPresets(babel, babelOptions) {
			var babelEnv = getBabelEnv.call(this);
			var babelEnvConfig = babelOptions.env || {};

			var presetsPromises = [
				doProcessPresets.call(this, babel, babelOptions.presets)
			];

			for (var envName in babelEnvConfig) {
				// do not process presets if the current environment does not match
				// the environment in which the presets are set to be used
				if (babelEnv === envName) {
					var presets = babelEnvConfig[envName].presets || [];
					presetsPromises.push(doProcessPresets.call(this, babel, presets));
				}
			}

			return Promise.all(presetsPromises)
				.then(function(results) {
					var presets = [];

					// results is an array of arrays, flatten it out!
					results.forEach(function(processedPresets) {
						presets = presets.concat(processedPresets);
					});

					return presets;
				});
		};

		/**
		 * Collects builtin presets names and non builtins objects/functions
		 *
		 * @param {Object} babel The babel object exported by babel-standalone
		 * @param {BabelPreset[]} babelPresets A list of babel presets
		 * @return {Promise.<BabelPreset[]>} A promise that resolves to a list
		 *		of babel-standalone builtin preset names and non-builtin preset
		 *		definitions (object or function).
		 */
		function doProcessPresets(babel, babelPresets) {
			var promises = [];
			var presets = babelPresets || [];

			presets.forEach(function(preset) {
				var name = getPresetOrPluginName(preset);

				if (!includesPresetOrPluginName(preset) || isBuiltinPreset(babel, name)) {
					promises.push(preset);
				}
				else if (!isBuiltinPreset(babel, name)) {
					var parent = this.configMain || "package.json!npm";
					var npmPresetNameOrPath = getNpmPresetNameOrPath(name);

					// import the preset!
					promises.push(this["import"](npmPresetNameOrPath, { name: parent })
						.then(function(mod) {
							var exported = mod.__esModule ? mod["default"] : mod;

							if (typeof preset === "string") {
								return exported;
							}
							// assume the array form was provided
							else {
								// [ presetDefinition, presetOptions ]
								return [exported, preset[1]];
							}
						}));
				}
			}, this);

			return Promise.all(promises);
		}

		/**
		 * Whether the preset is built in babel-standalone
		 * @param {Object} babel The babel object exported by babel-standalone
		 * @param {string} pluginName The plugin name to be checked
		 * @return {boolean}
		 */
		function isBuiltinPreset(babel, presetName) {
			var isNpmPresetName = /^(?:babel-preset-)/;
			var availablePresets = babel.availablePresets || {};

			// babel-standalone registers its builtin presets using the shorthand name
			var shorthand = isNpmPresetName.test(presetName) ?
				presetName.replace("babel-preset-", "") :
				presetName;

			return !!availablePresets[shorthand];
		}

		function getNpmPresetNameOrPath(name) {
			var isPath = /\//;
			var isNpmPresetName = /^(?:babel-preset-)/;

			if (!isPath.test(name) && !isNpmPresetName.test(name)) {
				return "babel-preset-" + name;
			}

			return name;
		}
	}());

	/**
	 * Babel plugin that sets `__esModule` to true
	 *
	 * This flag is needed to interop the SystemJS format used by steal on the
	 * browser in development with the CJS format used for built modules.
	 *
	 * With dev bundles is possible to load a part of the app already built while
	 * other modules are being transpiled on the fly, with this flag, transpiled
	 * amd modules will be able to load the modules transpiled on the browser.
	 */
	function addESModuleFlagPlugin(babel) {
		var t = babel.types;

		return {
			visitor: {
				Program: function(path, state) {
					path.unshiftContainer("body", [
						t.exportNamedDeclaration(null, [
							t.exportSpecifier(t.identifier("true"),
								t.identifier("__esModule"))
						])
					]);
				}
			}
		};
	}

	function babelTranspile(load, babelMod) {
		var babel = babelMod.Babel || babelMod.babel || babelMod;

		var babelVersion = getBabelVersion(babel);
		var options = getBabelOptions.call(this, load, babel);

		return Promise.all([
			processBabelPlugins.call(this, babel, options),
			processBabelPresets.call(this, babel, options)
		])
		.then(function(results) {
			// might be running on an old babel that throws if there is a
			// plugins array in the options object
			if (babelVersion >= 6) {
				options.plugins = [addESModuleFlagPlugin].concat(results[0]);
				options.presets = results[1];
			}

			var source = babel.transform(load.source, options).code;

			// add "!eval" to end of Babel sourceURL
			// I believe this does something?
			return source + '\n//# sourceURL=' + load.address + '!eval';
		});
	}

})(__global.LoaderPolyfill);
/*
*********************************************************************************************

  System Loader Implementation

    - Implemented to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js

*********************************************************************************************
*/



(function() {
  var isWorker = typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
  var isBrowser = typeof window != 'undefined' && !isWorker;
  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);
  var Promise = __global.Promise || require('when/es6-shim/Promise');

  // Helpers
  // Absolute URL parsing, from https://gist.github.com/Yaffle/1088850
  function parseURI(url) {
    var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@\/?#]*(?::[^:@\/?#]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
    // authority = '//' + user + ':' + pass '@' + hostname + ':' port
    return (m ? {
      href     : m[0] || '',
      protocol : m[1] || '',
      authority: m[2] || '',
      host     : m[3] || '',
      hostname : m[4] || '',
      port     : m[5] || '',
      pathname : m[6] || '',
      search   : m[7] || '',
      hash     : m[8] || ''
    } : null);
  }

  function removeDotSegments(input) {
    var output = [];
    input.replace(/^(\.\.?(\/|$))+/, '')
      .replace(/\/(\.(\/|$))+/g, '/')
      .replace(/\/\.\.$/, '/../')
      .replace(/\/?[^\/]*/g, function (p) {
        if (p === '/..')
          output.pop();
        else
          output.push(p);
    });
    return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
  }

  function toAbsoluteURL(inBase, inHref) {
    var href = inHref;
    var base = inBase

    if (isWindows)
      href = href.replace(/\\/g, '/');

    href = parseURI(href || '');
    base = parseURI(base || '');

    return !href || !base ? null : (href.protocol || base.protocol) +
      (href.protocol || href.authority ? href.authority : base.authority) +
      removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
      (href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
      href.hash;
  }

  var fetchTextFromURL;

  if (typeof XMLHttpRequest != 'undefined') {
    fetchTextFromURL = function(url, fulfill, reject) {
      var xhr = new XMLHttpRequest();
      var sameDomain = true;
      var doTimeout = false;
      if (!('withCredentials' in xhr)) {
        // check if same domain
        var domainCheck = /^(\w+:)?\/\/([^\/]+)/.exec(url);
        if (domainCheck) {
          sameDomain = domainCheck[2] === window.location.host;
          if (domainCheck[1])
            sameDomain &= domainCheck[1] === window.location.protocol;
        }
      }
      if (!sameDomain && typeof XDomainRequest != 'undefined') {
        xhr = new XDomainRequest();
        xhr.onload = load;
        xhr.onerror = error;
        xhr.ontimeout = error;
        xhr.onprogress = function() {};
        xhr.timeout = 0;
        doTimeout = true;
      }
      function load() {
        fulfill(xhr.responseText);
      }
      function error() {
        var msg = xhr.statusText + ': ' + url || 'XHR error';
        var err = new Error(msg);
        err.statusCode = xhr.status;
        reject(err);
      }

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || (xhr.status == 0 && xhr.responseText)) {
            load();
          } else {
            error();
          }
        }
      };
      xhr.open("GET", url, true);

      if (doTimeout)
        setTimeout(function() {
          xhr.send();
        }, 0);

      xhr.send(null);
    }
  }
  else if (typeof require != 'undefined') {
    var fs, fourOhFourFS = /ENOENT/;
    fetchTextFromURL = function(rawUrl, fulfill, reject) {
      if (rawUrl.substr(0, 5) != 'file:')
        throw 'Only file URLs of the form file: allowed running in Node.';
      fs = fs || require('fs');
      var url = rawUrl.substr(5);
      if (isWindows)
        url = url.replace(/\//g, '\\');
      return fs.readFile(url, function(err, data) {
        if (err) {
          // Mark this error as a 404, so that the npm extension
          // will know to retry.
          if(fourOhFourFS.test(err.message)) {
            err.statusCode = 404;
          }

          return reject(err);
        } else {
          fulfill(data + '');
        }
      });
    }
  }
  else if(typeof fetch === 'function') {
    fetchTextFromURL = function(url, fulfill, reject) {
      fetch(url).then(function(resp){
        return resp.text();
      }).then(function(text){
        fulfill(text);
      }).then(null, function(err){
        reject(err);
      });
    }
  }
  else {
    throw new TypeError('No environment fetch API available.');
  }

  var SystemLoader = function($__super) {
    function SystemLoader(options) {
      $__super.call(this, options || {});

      // Set default baseURL and paths
      if (typeof location != 'undefined' && location.href) {
        var href = __global.location.href.split('#')[0].split('?')[0];
        this.baseURL = href.substring(0, href.lastIndexOf('/') + 1);
      }
      else if (typeof process != 'undefined' && process.cwd) {
        this.baseURL = 'file:' + process.cwd() + '/';
        if (isWindows)
          this.baseURL = this.baseURL.replace(/\\/g, '/');
      }
      else {
        throw new TypeError('No environment baseURL');
      }
      this.paths = { '*': '*.js' };
    }

    SystemLoader.__proto__ = ($__super !== null ? $__super : Function.prototype);
    SystemLoader.prototype = $__Object$create(($__super !== null ? $__super.prototype : null));

    $__Object$defineProperty(SystemLoader.prototype, "constructor", {
      value: SystemLoader
    });

    $__Object$defineProperty(SystemLoader.prototype, "global", {
      get: function() {
        return isBrowser ? window : (isWorker ? self : __global);
      },

      enumerable: false
    });

    $__Object$defineProperty(SystemLoader.prototype, "strict", {
      get: function() { return true; },
      enumerable: false
    });

    $__Object$defineProperty(SystemLoader.prototype, "normalize", {
      value: function(name, parentName, parentAddress) {
        if (typeof name != 'string')
          throw new TypeError('Module name must be a string');

        var segments = name.split('/');

        if (segments.length == 0)
          throw new TypeError('No module name provided');

        // current segment
        var i = 0;
        // is the module name relative
        var rel = false;
        // number of backtracking segments
        var dotdots = 0;
        if (segments[0] == '.') {
          i++;
          if (i == segments.length)
            throw new TypeError('Illegal module name "' + name + '"');
          rel = true;
        }
        else {
          while (segments[i] == '..') {
            i++;
            if (i == segments.length)
              throw new TypeError('Illegal module name "' + name + '"');
          }
          if (i)
            rel = true;
          dotdots = i;
        }

        for (var j = i; j < segments.length; j++) {
          var segment = segments[j];
          if (segment == '' || segment == '.' || segment == '..')
            throw new TypeError('Illegal module name "' + name + '"');
        }

        if (!rel)
          return name;

        // build the full module name
        var normalizedParts = [];
        var parentParts = (parentName || '').split('/');
        var normalizedLen = parentParts.length - 1 - dotdots;

        normalizedParts = normalizedParts.concat(parentParts.splice(0, parentParts.length - 1 - dotdots));
        normalizedParts = normalizedParts.concat(segments.splice(i, segments.length - i));

        return normalizedParts.join('/');
      },

      enumerable: false,
      writable: true
    });

    $__Object$defineProperty(SystemLoader.prototype, "locate", {
      value: function(load) {
        var name = load.name;

        // NB no specification provided for System.paths, used ideas discussed in https://github.com/jorendorff/js-loaders/issues/25

        // most specific (longest) match wins
        var pathMatch = '', wildcard;

        // check to see if we have a paths entry
        for (var p in this.paths) {
          var pathParts = p.split('*');
          if (pathParts.length > 2)
            throw new TypeError('Only one wildcard in a path is permitted');

          // exact path match
          if (pathParts.length == 1) {
            if (name == p && p.length > pathMatch.length) {
              pathMatch = p;
              break;
            }
          }

          // wildcard path match
          else {
            if (name.substr(0, pathParts[0].length) == pathParts[0] && name.substr(name.length - pathParts[1].length) == pathParts[1]) {
              pathMatch = p;
              wildcard = name.substr(pathParts[0].length, name.length - pathParts[1].length - pathParts[0].length);
            }
          }
        }

        var outPath = this.paths[pathMatch];
        if (wildcard)
          outPath = outPath.replace('*', wildcard);

        // percent encode just '#' in module names
        // according to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js#L238
        // we should encode everything, but it breaks for servers that don't expect it
        // like in (https://github.com/systemjs/systemjs/issues/168)
        if (isBrowser)
          outPath = outPath.replace(/#/g, '%23');

        return toAbsoluteURL(this.baseURL, outPath);
      },

      enumerable: false,
      writable: true
    });

    $__Object$defineProperty(SystemLoader.prototype, "fetch", {
      value: function(load) {
        var self = this;
        return new Promise(function(resolve, reject) {
          fetchTextFromURL(toAbsoluteURL(self.baseURL, load.address), function(source) {
            resolve(source);
          }, reject);
        });
      },

      enumerable: false,
      writable: true
    });

    return SystemLoader;
  }(__global.LoaderPolyfill);

  var System = new SystemLoader();

  // note we have to export before runing "init" below
  if (typeof exports === 'object')
    module.exports = System;

  __global.System = System;
})();


// Define our eval outside of the scope of any other reference defined in this
// file to avoid adding those references to the evaluation scope.
function __eval(__source, __global, __load) {
  try {
    eval('(function() { var __moduleName = "' + (__load.name || '').replace('"', '\"') + '"; ' + __source + ' \n }).call(__global);');
  }
  catch(e) {
    if (e.name == 'SyntaxError' || e.name == 'TypeError')
      e.message = 'Evaluating ' + (__load.name || load.address) + '\n\t' + e.message;
    throw e;
  }
}

})(typeof window != 'undefined' ? window : (typeof WorkerGlobalScope != 'undefined' ?
                                           self : global));

/*
 * StealJS base extension
 *
 * **src/base/base.js** is an autogenerated file; any change should be
 * made to the source files in **src/base/lib/*.js**
 */


(function($__global) {

$__global.upgradeSystemLoader = function() {
  $__global.upgradeSystemLoader = undefined;

  // indexOf polyfill for IE
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);

  // Absolute URL parsing, from https://gist.github.com/Yaffle/1088850
  function parseURI(url) {
    var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@\/?#]*(?::[^:@\/?#]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
    // authority = '//' + user + ':' + pass '@' + hostname + ':' port
    return (m ? {
      href     : m[0] || '',
      protocol : m[1] || '',
      authority: m[2] || '',
      host     : m[3] || '',
      hostname : m[4] || '',
      port     : m[5] || '',
      pathname : m[6] || '',
      search   : m[7] || '',
      hash     : m[8] || ''
    } : null);
  }
  function toAbsoluteURL(inBase, inHref) {
	var base = inBase;
	var href = inHref;
    function removeDotSegments(input) {
      var output = [];
      input.replace(/^(\.\.?(\/|$))+/, '')
        .replace(/\/(\.(\/|$))+/g, '/')
        .replace(/\/\.\.$/, '/../')
        .replace(/\/?[^\/]*/g, function (p) {
          if (p === '/..')
            output.pop();
          else
            output.push(p);
      });
      return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
    }

    if (isWindows)
      href = href.replace(/\\/g, '/');

    href = parseURI(href || '');
    base = parseURI(base || '');

    return !href || !base ? null : (href.protocol || base.protocol) +
      (href.protocol || href.authority ? href.authority : base.authority) +
      removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
      (href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
      href.hash;
  }

  // clone the original System loader
  var System;
  (function() {
    var originalSystem = $__global.System;
    System = $__global.System = new LoaderPolyfill(originalSystem);
    System.baseURL = originalSystem.baseURL;
    System.paths = { '*': '*.js' };
    System.originalSystem = originalSystem;
  })();

  System.noConflict = function() {
    $__global.SystemJS = System;
    $__global.System = System.originalSystem;
  }

var getOwnPropertyDescriptor = true;
try {
  Object.getOwnPropertyDescriptor({ a: 0 }, 'a');
}
catch(e) {
  getOwnPropertyDescriptor = false;
}

var defineProperty;
(function () {
  try {
    if (!!Object.defineProperty({}, 'a', {}))
      defineProperty = Object.defineProperty;
  }
  catch (e) {
    defineProperty = function(obj, prop, opt) {
      try {
        obj[prop] = opt.value || opt.get.call(obj);
      }
      catch(e) {}
    }
  }
})();

// converts any module.exports object into an object ready for SystemJS.newModule
function getESModule(exports) {
  var esModule = {};
  // don't trigger getters/setters in environments that support them
  if ((typeof exports == 'object' || typeof exports == 'function') && exports !== $__global) {
      if (getOwnPropertyDescriptor) {
        for (var p in exports) {
          // The default property is copied to esModule later on
          if (p === 'default')
            continue;
          defineOrCopyProperty(esModule, exports, p);
        }
      }
      else {
        extend(esModule, exports);
      }
  }
  esModule['default'] = exports;
  defineProperty(esModule, '__useDefault', {
    value: true
  });
  return esModule;
}

function defineOrCopyProperty(targetObj, sourceObj, propName) {
  try {
    var d;
    if (d = Object.getOwnPropertyDescriptor(sourceObj, propName))
      defineProperty(targetObj, propName, d);
  }
  catch (ex) {
    // Object.getOwnPropertyDescriptor threw an exception, fall back to normal set property
    // we dont need hasOwnProperty here because getOwnPropertyDescriptor would have returned undefined above
    targetObj[propName] = sourceObj[propName];
    return false;
  }
}

function extend(a, b, prepend) {
  var hasOwnProperty = b && b.hasOwnProperty;
  for (var p in b) {
    if (hasOwnProperty && !b.hasOwnProperty(p))
      continue;
    if (!prepend || !(p in a))
      a[p] = b[p];
  }
  return a;
}

/*
 * SystemJS Core
 * Code should be vaguely readable
 * 
 */
var originalSystem = $__global.System.originalSystem;
function core(loader) {
  /*
    __useDefault
    
    When a module object looks like:
    newModule(
      __useDefault: true,
      default: 'some-module'
    })

    Then importing that module provides the 'some-module'
    result directly instead of the full module.

    Useful for eg module.exports = function() {}
  */
  var loaderImport = loader['import'];
  loader['import'] = function(name, options) {
    return loaderImport.call(this, name, options).then(function(module) {
      return module.__useDefault ? module['default'] : module;
    });
  };

  // support the empty module, as a concept
  loader.set('@empty', loader.newModule({}));

  // include the node require since we're overriding it
  if (typeof require != 'undefined')
    loader._nodeRequire = require;

  /*
    Config
    Extends config merging one deep only

    loader.config({
      some: 'random',
      config: 'here',
      deep: {
        config: { too: 'too' }
      }
    });

    <=>

    loader.some = 'random';
    loader.config = 'here'
    loader.deep = loader.deep || {};
    loader.deep.config = { too: 'too' };
  */
  loader.config = function(cfg) {
    for (var c in cfg) {
      var v = cfg[c];
      if (typeof v == 'object' && !(v instanceof Array)) {
        this[c] = this[c] || {};
        for (var p in v)
          this[c][p] = v[p];
      }
      else
        this[c] = v;
    }
  };

  // override locate to allow baseURL to be document-relative
  var baseURI;
  if (typeof window == 'undefined' &&
      typeof WorkerGlobalScope == 'undefined') {
    baseURI = 'file:' + process.cwd() + '/';
    if (isWindows)
      baseURI = baseURI.replace(/\\/g, '/');
  }
  // Inside of a Web Worker
  else if(typeof window == 'undefined') {
    baseURI = loader.global.location.href;
  }
  else {
    baseURI = document.baseURI;
    if (!baseURI) {
      var bases = document.getElementsByTagName('base');
      baseURI = bases[0] && bases[0].href || window.location.href;
    }
  }

  var loaderLocate = loader.locate;
  var normalizedBaseURL;
  loader.locate = function(load) {
    if (this.baseURL != normalizedBaseURL) {
      normalizedBaseURL = toAbsoluteURL(baseURI, this.baseURL);

      if (normalizedBaseURL.substr(normalizedBaseURL.length - 1, 1) != '/')
        normalizedBaseURL += '/';
      this.baseURL = normalizedBaseURL;
    }

    return Promise.resolve(loaderLocate.call(this, load));
  };

  function applyExtensions(extensions, loader) {
    loader._extensions = [];
    for(var i = 0, len = extensions.length; i < len; i++) {
      extensions[i](loader);
    }
  }

  loader._extensions = loader._extensions || [];
  loader._extensions.push(core);

  loader.clone = function() {
    var originalLoader = this;
    var loader = new LoaderPolyfill(originalSystem);
    loader.baseURL = originalLoader.baseURL;
    loader.paths = { '*': '*.js' };
    applyExtensions(originalLoader._extensions, loader);
    return loader;
  };
}

/*
 * Meta Extension
 *
 * Sets default metadata on a load record (load.metadata) from
 * loader.meta[moduleName].
 * Also provides an inline meta syntax for module meta in source.
 *
 * Eg:
 *
 * loader.meta['my/module'] = { some: 'meta' };
 *
 * load.metadata.some = 'meta' will now be set on the load record.
 *
 * The same meta could be set with a my/module.js file containing:
 * 
 * my/module.js
 *   "some meta"; 
 *   "another meta";
 *   console.log('this is my/module');
 *
 * The benefit of inline meta is that coniguration doesn't need
 * to be known in advance, which is useful for modularising
 * configuration and avoiding the need for configuration injection.
 *
 *
 * Example
 * -------
 *
 * The simplest meta example is setting the module format:
 *
 * System.meta['my/module'] = { format: 'amd' };
 *
 * or inside 'my/module.js':
 *
 * "format amd";
 * define(...);
 * 
 */

function meta(loader) {
  var metaRegEx = /^(\s*\/\*.*\*\/|\s*\/\/[^\n]*|\s*"[^"]+"\s*;?|\s*'[^']+'\s*;?)+/;
  var metaPartRegEx = /\/\*.*\*\/|\/\/[^\n]*|"[^"]+"\s*;?|'[^']+'\s*;?/g;

  loader.meta = {};
  loader._extensions = loader._extensions || [];
  loader._extensions.push(meta);

  function setConfigMeta(loader, load) {
    var meta = loader.meta && loader.meta[load.name];
    if (meta) {
      for (var p in meta)
        load.metadata[p] = load.metadata[p] || meta[p];
    }
  }

  var loaderLocate = loader.locate;
  loader.locate = function(load) {
    setConfigMeta(this, load);
    return loaderLocate.call(this, load);
  }

  var loaderTranslate = loader.translate;
  loader.translate = function(load) {
    // detect any meta header syntax
    var meta = load.source.match(metaRegEx);
    if (meta) {
      var metaParts = meta[0].match(metaPartRegEx);
      for (var i = 0; i < metaParts.length; i++) {
        var len = metaParts[i].length;

        var firstChar = metaParts[i].substr(0, 1);
        if (metaParts[i].substr(len - 1, 1) == ';')
          len--;
      
        if (firstChar != '"' && firstChar != "'")
          continue;

        var metaString = metaParts[i].substr(1, metaParts[i].length - 3);

        var metaName = metaString.substr(0, metaString.indexOf(' '));
        if (metaName) {
          var metaValue = metaString.substr(metaName.length + 1, metaString.length - metaName.length - 1);

          if (load.metadata[metaName] instanceof Array)
            load.metadata[metaName].push(metaValue);
          else if (!load.metadata[metaName])
            load.metadata[metaName] = metaValue;
        }
      }
    }
    // config meta overrides
    setConfigMeta(this, load);
    
    return loaderTranslate.call(this, load);
  }
}

/*
 * Instantiate registry extension
 *
 * Supports Traceur System.register 'instantiate' output for loading ES6 as ES5.
 *
 * - Creates the loader.register function
 * - Also supports metadata.format = 'register' in instantiate for anonymous register modules
 * - Also supports metadata.deps, metadata.execute and metadata.executingRequire
 *     for handling dynamic modules alongside register-transformed ES6 modules
 *
 * Works as a standalone extension, but benefits from having a more
 * advanced __eval defined like in SystemJS polyfill-wrapper-end.js
 *
 * The code here replicates the ES6 linking groups algorithm to ensure that
 * circular ES6 compiled into System.register can work alongside circular AMD
 * and CommonJS, identically to the actual ES6 loader.
 *
 */
function register(loader) {
  if (typeof indexOf == 'undefined')
    indexOf = Array.prototype.indexOf;
  if (typeof __eval == 'undefined' || typeof document != 'undefined' && !document.addEventListener)
    __eval = 0 || eval; // uglify breaks without the 0 ||

  loader._extensions = loader._extensions || [];
  loader._extensions.push(register);

  // define exec for easy evaluation of a load record (load.name, load.source, load.address)
  // main feature is source maps support handling
  var curSystem;
  function exec(load, execContext) {
    var loader = this;
    var context = execContext;
    // support sourceMappingURL (efficiently)
    var sourceMappingURL;
    var lastLineIndex = load.source.lastIndexOf('\n');
    if (lastLineIndex != -1) {
      if (load.source.substr(lastLineIndex + 1, 21) == '//# sourceMappingURL=') {
        sourceMappingURL = load.source.substr(lastLineIndex + 22, load.source.length - lastLineIndex - 22);
        if (typeof toAbsoluteURL != 'undefined')
          sourceMappingURL = toAbsoluteURL(load.address, sourceMappingURL);
      }
    }

    var evalType = load.metadata && load.metadata.eval;
    context = context || loader.global;
    __eval(load.source, load.address, context, sourceMappingURL, evalType);
  }
  loader.__exec = exec;

  function dedupe(deps) {
    var newDeps = [];
    for (var i = 0, l = deps.length; i < l; i++)
      if (indexOf.call(newDeps, deps[i]) == -1)
        newDeps.push(deps[i])
    return newDeps;
  }

  /*
   * There are two variations of System.register:
   * 1. System.register for ES6 conversion (2-3 params) - System.register([name, ]deps, declare)
   *    see https://github.com/ModuleLoader/es6-module-loader/wiki/System.register-Explained
   *
   * 2. System.register for dynamic modules (3-4 params) - System.register([name, ]deps, executingRequire, execute)
   * the true or false statement
   *
   * this extension implements the linking algorithm for the two variations identical to the spec
   * allowing compiled ES6 circular references to work alongside AMD and CJS circular references.
   *
   */
  // loader.register sets loader.defined for declarative modules
  var anonRegister;
  var calledRegister;
  function registerModule(regName, regDeps, regDeclare, regExecute) {
    var name = regName;
    var deps = regDeps;
    var declare = regDeclare;
    var execute = regExecute;
    if (typeof name != 'string') {
      execute = declare;
      declare = deps;
      deps = name;
      name = null;
    }

    calledRegister = true;

    var register;

    // dynamic
    if (typeof declare == 'boolean') {
      register = {
        declarative: false,
        deps: deps,
        execute: execute,
        executingRequire: declare
      };
    }
    else {
      // ES6 declarative
      register = {
        declarative: true,
        deps: deps,
        declare: declare
      };
    }

    // named register
    if (name) {
      register.name = name;
      // we never overwrite an existing define
      if (!(name in loader.defined))
        loader.defined[name] = register;
    }
    // anonymous register
    else if (register.declarative) {
      if (anonRegister)
        throw new TypeError('Multiple anonymous System.register calls in the same module file.');
      anonRegister = register;
    }
  }
  /*
   * Registry side table - loader.defined
   * Registry Entry Contains:
   *    - name
   *    - deps
   *    - declare for declarative modules
   *    - execute for dynamic modules, different to declarative execute on module
   *    - executingRequire indicates require drives execution for circularity of dynamic modules
   *    - declarative optional boolean indicating which of the above
   *
   * Can preload modules directly on System.defined['my/module'] = { deps, execute, executingRequire }
   *
   * Then the entry gets populated with derived information during processing:
   *    - normalizedDeps derived from deps, created in instantiate
   *    - groupIndex used by group linking algorithm
   *    - evaluated indicating whether evaluation has happend
   *    - module the module record object, containing:
   *      - exports actual module exports
   *
   *    Then for declarative only we track dynamic bindings with the records:
   *      - name
   *      - setters declarative setter functions
   *      - exports actual module values
   *      - dependencies, module records of dependencies
   *      - importers, module records of dependents
   *
   * After linked and evaluated, entries are removed, declarative module records remain in separate
   * module binding table
   *
   */

  function defineRegister(loader) {
    if (loader.register)
      return;

    loader.register = registerModule;

    if (!loader.defined)
      loader.defined = {};

    // script injection mode calls this function synchronously on load
    var onScriptLoad = loader.onScriptLoad;
    loader.onScriptLoad = function(load) {
      onScriptLoad(load);
      // anonymous define
      if (anonRegister)
        load.metadata.entry = anonRegister;

      if (calledRegister) {
        load.metadata.format = load.metadata.format || 'register';
        load.metadata.registered = true;
      }
    }
  }

  defineRegister(loader);

  function buildGroups(entry, loader, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = loader.defined[depName];

      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;

      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {

        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, loader, groups);
    }
  }

  function link(name, loader) {
    var startEntry = loader.defined[name];

    // skip if already linked
    if (startEntry.module)
      return;

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, loader, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry, loader);
        else
          linkDynamicModule(entry, loader);
      }
      curGroupDeclarative = !curGroupDeclarative;
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry, loader) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(loader.global, function(name, value) {
      module.locked = true;
      exports[name] = value;

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          var importerIndex = indexOf.call(importerModule.dependencies, module);
          importerModule.setters[importerIndex](exports);
        }
      }

      module.locked = false;
      return value;
    });

    module.setters = declaration.setters;
    module.execute = declaration.execute;

    if (!module.setters || !module.execute) {
      throw new TypeError('Invalid System.register form for ' + entry.name);
    }

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = loader.defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      // dynamic, already linked in our registry
      else if (depEntry && !depEntry.declarative) {
        if (depEntry.module.exports && depEntry.module.exports.__esModule)
          depExports = depEntry.module.exports;
        else
          depExports = depEntry.esModule;
          //depExports = { 'default': depEntry.module.exports, '__useDefault': true };
      }
      // in the loader registry
      else if (!depEntry) {
        depExports = loader.get(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry, loader);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else {
        module.dependencies.push(null);
      }

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name, loader) {
    var exports;
    var entry = loader.defined[name];

    if (!entry) {
      exports = loader.get(name);
      if (!exports)
        throw new Error('Unable to load dependency ' + name + '.');
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, [], loader);

      else if (!entry.evaluated)
        linkDynamicModule(entry, loader);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry, loader) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = loader.defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry, loader);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(loader.global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i], loader);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);

    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;

    // __esModule flag treats as already-named
    if (exports && (exports.__esModule || exports instanceof Module))
      entry.esModule = exports;
    // set module as 'default' export, then fake named exports by iterating properties
    else if (entry.esmExports && exports !== loader.global)
      entry.esModule = getESModule(exports);
    // just use the 'default' export
    else
      entry.esModule = { 'default': exports };
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen, loader) {
    var entry = loader.defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!loader.defined[depName])
          loader.get(depName);
        else
          ensureEvaluated(depName, seen, loader);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(loader.global);
  }

  var Module = loader.newModule({}).constructor;

  var registerRegEx = /System\.register/;

  var loaderFetch = loader.fetch;
  loader.fetch = function(load) {
    var loader = this;
    defineRegister(loader);
    if (loader.defined[load.name]) {
      load.metadata.format = 'defined';
      return '';
    }
    anonRegister = null;
    calledRegister = false;
    // the above get picked up by onScriptLoad
    return loaderFetch.call(loader, load);
  }

  var loaderTranslate = loader.translate;
  loader.translate = function(load) {
    this.register = registerModule;

    this.__exec = exec;

    load.metadata.deps = load.metadata.deps || [];

    // we run the meta detection here (register is after meta)
    return Promise.resolve(loaderTranslate.call(this, load)).then(function(source) {

      // dont run format detection for globals shimmed
      // ideally this should be in the global extension, but there is
      // currently no neat way to separate it
      if (load.metadata.init || load.metadata.exports)
        load.metadata.format = load.metadata.format || 'global';

      // run detection for register format
      if (load.metadata.format == 'register' || !load.metadata.format && load.source.match(registerRegEx))
        load.metadata.format = 'register';
      return source;
    });
  }


  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this;

    var entry;

    // first we check if this module has already been defined in the registry
    if (loader.defined[load.name]) {
      entry = loader.defined[load.name];
      entry.deps = entry.deps.concat(load.metadata.deps);
    }

    // picked up already by a script injection
    else if (load.metadata.entry)
      entry = load.metadata.entry;

    // otherwise check if it is dynamic
    else if (load.metadata.execute) {
      entry = {
        declarative: false,
        deps: load.metadata.deps || [],
        esModule: null,
        execute: load.metadata.execute,
        executingRequire: load.metadata.executingRequire // NodeJS-style requires or not
      };
    }

    // Contains System.register calls
    else if (load.metadata.format == 'register') {
      anonRegister = null;
      calledRegister = false;

      var curSystem = loader.global.System;

      loader.global.System = loader;

      loader.__exec(load);

      loader.global.System = curSystem;

      if (anonRegister)
        entry = anonRegister;

      if (!entry && System.defined[load.name])
        entry = System.defined[load.name];

      if (!calledRegister && !load.metadata.registered)
        throw new TypeError(load.name + ' detected as System.register but didn\'t execute.');
    }

    // named bundles are just an empty module
    if (!entry && load.metadata.format != 'es6')
      return {
        deps: load.metadata.deps,
        execute: function() {
          return loader.newModule({});
        }
      };

    // place this module onto defined for circular references
    if (entry)
      loader.defined[load.name] = entry;

    // no entry -> treat as ES6
    else
      return loaderInstantiate.call(this, load);

    entry.deps = dedupe(entry.deps);
    entry.name = load.name;
    entry.esmExports = load.metadata.esmExports !== false;

    // first, normalize all dependencies
    var normalizePromises = [];
    for (var i = 0, l = entry.deps.length; i < l; i++)
      normalizePromises.push(Promise.resolve(loader.normalize(entry.deps[i], load.name)));

    return Promise.all(normalizePromises).then(function(normalizedDeps) {

      entry.normalizedDeps = normalizedDeps;

      return {
        deps: entry.deps,
        execute: function() {
          // recursively ensure that the module and all its
          // dependencies are linked (with dependency group handling)
          link(load.name, loader);

          // now handle dependency execution in correct order
          ensureEvaluated(load.name, [], loader);

          // remove from the registry
          loader.defined[load.name] = undefined;

          var module = entry.module.exports;

          if(!entry.declarative)
            module = entry.esModule;

          // return the defined module object
          return loader.newModule(module);
        }
      };
    });
  }
}

/*
 * Extension to detect ES6 and auto-load Traceur or Babel for processing
 */
function es6(loader) {
  loader._extensions.push(es6);

  // good enough ES6 detection regex - format detections not designed to be accurate, but to handle the 99% use case
  var es6RegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;

  var traceurRuntimeRegEx = /\$traceurRuntime\s*\./;
  var babelHelpersRegEx = /babelHelpers\s*\./;

  var transpilerNormalized, transpilerRuntimeNormalized;

  var firstLoad = true;

  var nodeResolver = typeof process != 'undefined' && typeof require != 'undefined' && require.resolve;

  function setConfig(loader, module, nodeModule) {
    loader.meta[module] = {format: 'global'};
    if (nodeResolver && !loader.paths[module]) {
      try {
        loader.paths[module] = require.resolve(nodeModule || module);
      }
      catch(e) {}
    }
  }

  var loaderLocate = loader.locate;
  loader.locate = function(load) {
    var self = this;
    if (firstLoad) {
      if (self.transpiler == 'traceur') {
        setConfig(self, 'traceur', 'traceur/bin/traceur.js');
        self.meta['traceur'].exports = 'traceur';
        setConfig(self, 'traceur-runtime', 'traceur/bin/traceur-runtime.js');
      }
      else if (self.transpiler == 'babel') {
        setConfig(self, 'babel', 'babel-standalone/babel.js');
      }
      firstLoad = false;
    }
    return loaderLocate.call(self, load);
  };

  var loaderTranslate = loader.translate;
  loader.translate = function(load) {
    var loader = this;

    return loaderTranslate.call(loader, load)
    .then(function(source) {

      // detect ES6
      if (load.metadata.format == 'es6' || !load.metadata.format && source.match(es6RegEx)) {
        load.metadata.format = 'es6';
        return source;
      }

      if (load.metadata.format == 'register') {
        if (!loader.global.$traceurRuntime && load.source.match(traceurRuntimeRegEx)) {
          return loader['import']('traceur-runtime').then(function() {
            return source;
          });
        }
        if (!loader.global.babelHelpers && load.source.match(babelHelpersRegEx)) {
          return loader['import']('babel/external-helpers').then(function() {
            return source;
          });
        }
      }

      // ensure Traceur doesn't clobber the System global
      if (loader.transpiler == 'traceur')
        return Promise.all([
          transpilerNormalized || (transpilerNormalized = loader.normalize(loader.transpiler)),
          transpilerRuntimeNormalized || (transpilerRuntimeNormalized = loader.normalize(loader.transpiler + '-runtime'))
        ])
        .then(function(normalized) {
          if (load.name == normalized[0] || load.name == normalized[1])
            return '(function() { var curSystem = System; ' + source + '\nSystem = curSystem; })();';

          return source;
        });

      return source;
    });

  };

}

/*
  SystemJS Global Format

  Supports
    metadata.deps
    metadata.init
    metadata.exports

  Also detects writes to the global object avoiding global collisions.
  See the SystemJS readme global support section for further information.
*/
function global(loader) {

  loader._extensions.push(global);

  function readGlobalProperty(p, propValue) {
    var pParts = p.split('.');
    var value = propValue;
    while (pParts.length)
      value = value[pParts.shift()];
    return value;
  }

  function createHelpers(loader) {
    if (loader.has('@@global-helpers'))
      return;

    var hasOwnProperty = loader.global.hasOwnProperty;
    var moduleGlobals = {};

    var curGlobalObj;
    var ignoredGlobalProps;

    function makeLookupObject(arr) {
      var out = {};
      for(var i = 0, len = arr.length; i < len; i++) {
        out[arr[i]] = true;
      }
      return out;
    }

    loader.set('@@global-helpers', loader.newModule({
      prepareGlobal: function(globalModuleName, globalDeps, globalExportName) {
        var globals;
        var require;
        var moduleName = globalModuleName;
        var deps = globalDeps;
        var exportName = globalExportName;

        // handle function signature when an object is passed instead of
        // individual arguments
        if (typeof moduleName === "object") {
          var options = moduleName;

          deps = options.deps;
          globals = options.globals;
          exportName = options.exportName;
          moduleName = options.moduleName;
          require = options.require;
        }

        // first, we add all the dependency modules to the global
        if (deps) {
          for (var i = 0; i < deps.length; i++) {
            var moduleGlobal = moduleGlobals[deps[i]];
            if (moduleGlobal)
              for (var m in moduleGlobal)
                loader.global[m] = moduleGlobal[m];
          }
        }

        if (globals && require) {
          for (var j in globals) {
            loader.global[j] = require(globals[j]);
          }
        }

        // If an exportName is defined there is no need to perform the next
        // expensive operation.
        if(exportName || exportName === false || loader.inferGlobals === false) {
          return;
        }

        // now store a complete copy of the global object
        // in order to detect changes
        curGlobalObj = {};
        ignoredGlobalProps = makeLookupObject(['indexedDB', 'sessionStorage', 'localStorage',
          'clipboardData', 'frames', 'webkitStorageInfo', 'toolbar', 'statusbar',
          'scrollbars', 'personalbar', 'menubar', 'locationbar', 'webkitIndexedDB',
          'screenTop', 'screenLeft'
        ]);
        for (var g in loader.global) {
          if (ignoredGlobalProps[g]) { continue; }
          if (!hasOwnProperty || loader.global.hasOwnProperty(g)) {
            try {
              curGlobalObj[g] = loader.global[g];
            } catch (e) {
              ignoredGlobalProps[g] = true;
            }
          }
        }
      },
      retrieveGlobal: function(moduleName, exportName, init) {
        var singleGlobal;
        var multipleExports;
        var exports = {};

        // run init
        if (init)
          singleGlobal = init.call(loader.global);

        // check for global changes, creating the globalObject for the module
        // if many globals, then a module object for those is created
        // if one global, then that is the module directly
        else if (exportName) {
          var firstPart = exportName.split('.')[0];
          singleGlobal = readGlobalProperty(exportName, loader.global);
          exports[firstPart] = loader.global[firstPart];
        }

        else if(exportName !== false && loader.inferGlobals !== false) {
          for (var g in loader.global) {
            if (ignoredGlobalProps[g])
              continue;
            if ((!hasOwnProperty || loader.global.hasOwnProperty(g)) && g != loader.global && curGlobalObj[g] != loader.global[g]) {
              exports[g] = loader.global[g];
              if (singleGlobal) {
                if (singleGlobal !== loader.global[g])
                  multipleExports = true;
              }
              else if (singleGlobal === undefined) {
                singleGlobal = loader.global[g];
              }
            }
          }
        }

        moduleGlobals[moduleName] = exports;

        return multipleExports ? exports : singleGlobal;
      }
    }));
  }

  createHelpers(loader);

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this;

    createHelpers(loader);

    var exportName = load.metadata.exports;

    if (!load.metadata.format)
      load.metadata.format = 'global';

    // add globals as dependencies
    if (load.metadata.globals) {
      for (var g in load.metadata.globals) {
        load.metadata.deps.push(load.metadata.globals[g]);
      }
    }

    // global is a fallback module format
    if (load.metadata.format == 'global') {
      load.metadata.execute = function(require, exports, module) {
        loader.get('@@global-helpers').prepareGlobal({
          require: require,
          moduleName: module.id,
          exportName: exportName,
          deps: load.metadata.deps,
          globals: load.metadata.globals
        });

        if (exportName)
          load.source += '\nthis["' + exportName + '"] = ' + exportName + ';';

        // disable module detection
        var define = loader.global.define;
        var require = loader.global.require;

        loader.global.define = undefined;
        loader.global.module = undefined;
        loader.global.exports = undefined;

        loader.__exec(load, loader.global);

        loader.global.require = require;
        loader.global.define = define;

        return loader.get('@@global-helpers').retrieveGlobal(module.id, exportName, load.metadata.init);
      }
    }
    return loaderInstantiate.call(loader, load);
  }
}

/*
  SystemJS CommonJS Format
*/
function cjs(loader) {
  loader._extensions.push(cjs);

  // CJS Module Format
  // require('...') || exports[''] = ... || exports.asd = ... || module.exports = ... || Object.defineProperty(module, "exports" ...
  var cjsExportsRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])(exports\s*(\[['"]|\.)|module(\.exports|\['exports'\]|\["exports"\])\s*(\[['"]|[=,\.])|Object.defineProperty\(\s*module\s*,\s*(?:'|")exports(?:'|"))/;
  // RegEx adjusted from https://github.com/jbrantly/yabble/blob/master/lib/yabble.js#L339
  var cjsRequireRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF."'])require\s*\(\s*("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')\s*\)/g;
  var commentRegEx = /(^|[^\\])(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;

  var stringRegEx = /("[^"\\\n\r]*(\\.[^"\\\n\r]*)*"|'[^'\\\n\r]*(\\.[^'\\\n\r]*)*')/g;

  function getCJSDeps(source) {
    cjsRequireRegEx.lastIndex = commentRegEx.lastIndex = stringRegEx.lastIndex = 0;

    var deps = [];

    var match;

    // track string and comment locations for unminified source
    var stringLocations = [], commentLocations = [];

    function inLocation(locations, match) {
      for (var i = 0; i < locations.length; i++)
        if (locations[i][0] < match.index && locations[i][1] > match.index)
          return true;
      return false;
    }

    if (source.length / source.split('\n').length < 200) {
      while (match = stringRegEx.exec(source))
        stringLocations.push([match.index, match.index + match[0].length]);

      while (match = commentRegEx.exec(source)) {
        // only track comments not starting in strings
        if (!inLocation(stringLocations, match))
          commentLocations.push([match.index, match.index + match[0].length]);
      }
    }

    while (match = cjsRequireRegEx.exec(source)) {
      // ensure we're not within a string or comment location
      if (!inLocation(stringLocations, match) && !inLocation(commentLocations, match)) {
        var dep = match[1].substr(1, match[1].length - 2);
        // skip cases like require('" + file + "')
        if (dep.match(/"|'/))
          continue;
        deps.push(dep);
      }
    }

    return deps;
  }

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {

    if (!load.metadata.format) {
      cjsExportsRegEx.lastIndex = 0;
      cjsRequireRegEx.lastIndex = 0;
      if (cjsRequireRegEx.exec(load.source) || cjsExportsRegEx.exec(load.source))
        load.metadata.format = 'cjs';
    }

    if (load.metadata.format == 'cjs') {
      load.metadata.deps = load.metadata.deps ? load.metadata.deps.concat(getCJSDeps(load.source)) : getCJSDeps(load.source);

      load.metadata.executingRequire = true;

      load.metadata.execute = function(require, exports, module) {
        var dirname = (load.address || '').split('/');
        dirname.pop();
        dirname = dirname.join('/');

        // if on the server, remove the "file:" part from the dirname
        if (System._nodeRequire)
          dirname = dirname.substr(5);

        var globals = loader.global._g = {
          global: loader.global,
          exports: exports,
          module: module,
          require: require,
          __filename: System._nodeRequire ? load.address.substr(5) : load.address,
          __dirname: dirname
        };


        // disable AMD detection
        var define = loader.global.define;
        loader.global.define = undefined;

        var execLoad = {
          name: load.name,
          source: '(function() {\n(function(global, exports, module, require, __filename, __dirname){\n' + load.source +
                                  '\n}).call(_g.exports, _g.global, _g.exports, _g.module, _g.require, _g.__filename, _g.__dirname);})();',
          address: load.address
        };
        loader.__exec(execLoad);

        loader.global.define = define;

        loader.global._g = undefined;
      }
    }

    return loaderInstantiate.call(this, load);
  };
}

/*
  SystemJS AMD Format
  Provides the AMD module format definition at System.format.amd
  as well as a RequireJS-style require on System.require
*/
function amd(loader) {
  // by default we only enforce AMD noConflict mode in Node
  var isNode = typeof module != 'undefined' && module.exports;

  loader._extensions.push(amd);

  // AMD Module Format Detection RegEx
  // define([.., .., ..], ...)
  // define(varName); || define(function(require, exports) {}); || define({})
  var amdRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])define\s*\(\s*("[^"]+"\s*,\s*|'[^']+'\s*,\s*)?\s*(\[(\s*(("[^"]+"|'[^']+')\s*,|\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*(\s*("[^"]+"|'[^']+')\s*,?)?(\s*(\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*\s*\]|function\s*|{|[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*\))/;

  var strictCommentRegEx = /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm
  var beforeRegEx = /(function|var|let|const|return|export|\"|\'|\(|\=)$/i

  var fnBracketRegEx = /\(([^\)]*)\)/;
  var wsRegEx = /^\s+|\s+$/g;

  var requireRegExs = {};
  var chunkEndCounterpart = {
    "/*": /[\s\S]*?\*\//g,
    "//": /[^\r\n]+(?:\r?\n|$)/g,
    '"': /(?:\\[\s\S]|[^\\])*?"/g,
    "'": /(?:\\[\s\S]|[^\\])*?'/g,
    "`": /(?:\\[\s\S]|[^\\])*?`/g,
    "require": /\s*\(\s*(['"`])((?:\\[\s\S]|(?!\1)[^\\])*?)\1\s*\)/g,
    "/regexp/": /\/(?:(?:\\.|[^\/\r\n])+?)\//g
  };

  /*
    Find CJS Deps in valid javascript
    Loops through the source once by progressivly identifying "chunks"
    Chunks are:
    multi-line comments, single line comments, strings using ", ', or `, regular expressions, and the special case of the requireAlias
    When the start of a chunk is potentially identified, we grab the corresponding 'endRx' and execute it on source at the same spot
    If the endRx matches correctly at that location, we advance the chunk start regex's lastIndex to the end of the chunk and continue.
    If it's the requireAlias that successfully matched, then we pull the string ('./path') out of the match and push as a dep before continuing.
  */
  function getCJSDeps (source, requireIndex) {
    var deps = [];
    // determine the require alias
    var params = source.match(fnBracketRegEx);
    var requireAlias = (params[1].split(',')[requireIndex] || 'require').replace(wsRegEx, '');

    // Create a cache of the chunk start regex based on the require alias
    var chunkStartRegex = requireRegExs[requireAlias] || (requireRegExs[requireAlias] = new RegExp("/\\*|//|\"|'|`|(?:^|\\breturn\\b|[([=,;:?><&|^*%~+-])\\s*(?=\/)|\\b" + requireAlias + "(?=\\s*\\()", "g"));
    // Look for potential chunks from the start of source
    chunkStartRegex.lastIndex = 0;
    // Make sure chunkEndCounterpart object has a key of requireAlias that points to the common 'require' ending rx for later
    chunkEndCounterpart[requireAlias] = chunkEndCounterpart.require;

    var startExec, chunkStartKey, endRx, endExec;
    // Execute our starting regex search on source to identify where chunks start
    while (startExec = chunkStartRegex.exec(source)) {
      // assume the match is a key for our chunkEndCounterpart object
      // This will be strings like "//", "'", "require", etc
      chunkStartKey = startExec[0];
      // and grab that chunk's ending regular expression
      endRx = chunkEndCounterpart[chunkStartKey];

      if (!endRx) {
        // If what we grabbed doesn't have an entry on chunkEndCounterpart, that means we're identified where a regex might be.
        // So just change our key to a common one used when identifying regular expressions in the js source
        chunkStartKey = "/regexp/";
        // and grab the regex-type chunk's ending regular expression
        endRx = chunkEndCounterpart[chunkStartKey];
      }
      // Set the endRx to start looking exactly where our chunkStartRegex loop ended the match
      endRx.lastIndex = chunkStartRegex.lastIndex;
      // and execute it on source
      endExec = endRx.exec(source);

      // if the endRx matched and it matched starting exactly where we told it to start
      if (endExec && endExec.index === chunkStartRegex.lastIndex) {
        // Then we have identified a chunk correctly and we advance our loop of chunkStartRegex to continue after this chunk
        chunkStartRegex.lastIndex = endRx.lastIndex;
        // if we are specifically identifying the requireAlias-type chunk at this point,
        if (endRx === chunkEndCounterpart.require) {
          // then the second capture group of the endRx is what's inside the string, inside the ()'s, after requireAlias,
          // which is the path of a dep that we want to return.
		  if(endExec[2]) {
			  deps.push(endExec[2]);
		  }

        }
      }
    }
    return deps;
  }

  /*
    AMD-compatible require
    To copy RequireJS, set window.require = window.requirejs = loader.amdRequire
  */
  function require(names, callback, errback, referer) {
    // 'this' is bound to the loader
    var loader = this;

    // in amd, first arg can be a config object... we just ignore
    if (typeof names == 'object' && !(names instanceof Array))
      return require.apply(null, Array.prototype.splice.call(arguments, 1, arguments.length - 1));

    // amd require
    if (names instanceof Array)
      Promise.all(names.map(function(name) {
        return loader['import'](name, referer);
      })).then(function(modules) {
        if(callback) {
          callback.apply(null, modules);
        }
      }, errback);

    // commonjs require
    else if (typeof names == 'string') {
      var module = loader.get(names);
      return module.__useDefault ? module['default'] : module;
    }

    else
      throw new TypeError('Invalid require');
  };
  loader.amdRequire = function() {
    return require.apply(this, arguments);
  };

  function makeRequire(parentName, staticRequire, loader) {
    return function(names, callback, errback) {
      if (typeof names == 'string')
        return staticRequire(names);
      return require.call(loader, names, callback, errback, { name: parentName });
    }
  }

  // run once per loader
  function generateDefine(loader) {
    // script injection mode calls this function synchronously on load
    var onScriptLoad = loader.onScriptLoad;
    loader.onScriptLoad = function(load) {
      onScriptLoad(load);
      if (anonDefine || defineBundle) {
        load.metadata.format = 'defined';
        load.metadata.registered = true;
      }

      if (anonDefine) {
        load.metadata.deps = load.metadata.deps ? load.metadata.deps.concat(anonDefine.deps) : anonDefine.deps;
        load.metadata.execute = anonDefine.execute;
      }
    }

    function define(modName, modDeps, modFactory) {
      var name = modName;
      var deps = modDeps;
      var factory = modFactory;
      if (typeof name != 'string') {
        factory = deps;
        deps = name;
        name = null;
      }
      if (!(deps instanceof Array)) {
        factory = deps;
        deps = ['require', 'exports', 'module'];
      }

      if (typeof factory != 'function')
        factory = (function(factory) {
          return function() { return factory; }
        })(factory);

      // in IE8, a trailing comma becomes a trailing undefined entry
      if (deps[deps.length - 1] === undefined)
        deps.pop();

      // remove system dependencies
      var requireIndex, exportsIndex, moduleIndex;

      if ((requireIndex = indexOf.call(deps, 'require')) != -1) {

        deps.splice(requireIndex, 1);

        var factoryText = factory.toString();

        deps = deps.concat(getCJSDeps(factoryText, requireIndex));
      }


      if ((exportsIndex = indexOf.call(deps, 'exports')) != -1)
        deps.splice(exportsIndex, 1);

      if ((moduleIndex = indexOf.call(deps, 'module')) != -1)
        deps.splice(moduleIndex, 1);

      var define = {
        deps: deps,
        execute: function(require, exports, module) {

          var depValues = [];
          for (var i = 0; i < deps.length; i++)
            depValues.push(require(deps[i]));

          module.uri = loader.baseURL + module.id;

          module.config = function() {};

          // add back in system dependencies
          if (moduleIndex != -1)
            depValues.splice(moduleIndex, 0, module);

          if (exportsIndex != -1)
            depValues.splice(exportsIndex, 0, exports);

          if (requireIndex != -1)
            depValues.splice(requireIndex, 0, makeRequire(module.id, require, loader));

          var output = factory.apply(global, depValues);

          if (typeof output == 'undefined' && module)
            output = module.exports;

          if (typeof output != 'undefined')
            return output;
        }
      };

      // anonymous define
      if (!name) {
        // already defined anonymously -> throw
        if (anonDefine)
          throw new TypeError('Multiple defines for anonymous module');
        anonDefine = define;
      }
      // named define
      else {
		var parsedModuleName =
		  currentLoad && currentLoad.metadata && currentLoad.metadata.parsedModuleName;

		// register the full npm name otherwise named modules won't load
		// when the npm extension is used
		if (
		  parsedModuleName &&
		  parsedModuleName.version &&              // verify it is an npm name
		  (parsedModuleName.modulePath === name || // local module
			parsedModuleName.packageName === name) // from a dependency
		) {
		  loader.register(
			parsedModuleName.moduleName,
			define.deps,
			false,
			define.execute
		  );
		}

        // if it has no dependencies and we don't have any other
        // defines, then let this be an anonymous define
        if (deps.length == 0 && !anonDefine && !defineBundle)
          anonDefine = define;

        // otherwise its a bundle only
        else
          anonDefine = null;

        // the above is just to support single modules of the form:
        // define('jquery')
        // still loading anonymously
        // because it is done widely enough to be useful

        // note this is now a bundle
        defineBundle = true;

        // define the module through the register registry
        loader.register(name, define.deps, false, define.execute);
      }
    };
    define.amd = {};
    loader.amdDefine = define;
  }

  var anonDefine;
  // set to true if the current module turns out to be a named define bundle
  var defineBundle;

  // set on the "instantiate" hook (by "createDefine") so it's available in
  // the scope of the "define" function, it's set back to "undefined" after eval
  var currentLoad;

  var oldModule, oldExports, oldDefine;

  // adds define as a global (potentially just temporarily)
  function createDefine(loader, load) {
    if (!loader.amdDefine)
      generateDefine(loader);

    anonDefine = null;
    defineBundle = null;
	currentLoad = load;

    // ensure no NodeJS environment detection
    var global = loader.global;

    oldModule = global.module;
    oldExports = global.exports;
    oldDefine = global.define;

    global.module = undefined;
    global.exports = undefined;

    if (global.define && global.define === loader.amdDefine)
      return;

    global.define = loader.amdDefine;
  }

  function removeDefine(loader) {
    var global = loader.global;
    global.define = oldDefine;
    global.module = oldModule;
    global.exports = oldExports;
	currentLoad = undefined;
  }

  generateDefine(loader);

  if (loader.scriptLoader) {
    var loaderFetch = loader.fetch;
    loader.fetch = function(load) {
      createDefine(this, load);
      return loaderFetch.call(this, load);
    }
  }

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this,
      sourceWithoutComments = load.source.replace(strictCommentRegEx, '$1'),
      match = sourceWithoutComments.match(amdRegEx);

    if (load.metadata.format == 'amd' || !load.metadata.format && match) {

      // make sure that this is really a AMD module
      // get the content from beginning till the matched define block
      var sourceBeforeDefine = sourceWithoutComments.substring(0, sourceWithoutComments.indexOf(match[0])),
        trimmed = sourceBeforeDefine.replace(wsRegEx, "")

      // check if that there is no commen javscript keywork before
      if (!beforeRegEx.test(trimmed)) {
        load.metadata.format = 'amd';

        if (loader.execute !== false) {
          createDefine(loader, load);

          loader.__exec(load);

          removeDefine(loader);

          if (!anonDefine && !defineBundle && !isNode)
            throw new TypeError('AMD module ' + load.name + ' did not define');
        }

        if (anonDefine) {
          load.metadata.deps = load.metadata.deps ? load.metadata.deps.concat(anonDefine.deps) : anonDefine.deps;
          load.metadata.execute = anonDefine.execute;
        }
      }
    }

    return loaderInstantiate.call(loader, load);
  }
}

/*
  SystemJS map support

  Provides map configuration through
    System.map['jquery'] = 'some/module/map'

  As well as contextual map config through
    System.map['bootstrap'] = {
      jquery: 'some/module/map2'
    }

  Note that this applies for subpaths, just like RequireJS

  jquery      -> 'some/module/map'
  jquery/path -> 'some/module/map/path'
  bootstrap   -> 'bootstrap'

  Inside any module name of the form 'bootstrap' or 'bootstrap/*'
    jquery    -> 'some/module/map2'
    jquery/p  -> 'some/module/map2/p'

  Maps are carefully applied from most specific contextual map, to least specific global map
*/
function map(loader) {
  loader.map = loader.map || {};

  loader._extensions.push(map);

  // return if prefix parts (separated by '/') match the name
  // eg prefixMatch('jquery/some/thing', 'jquery') -> true
  //    prefixMatch('jqueryhere/', 'jquery') -> false
  function prefixMatch(name, prefix) {
    if (name.length < prefix.length)
      return false;
    if (name.substr(0, prefix.length) != prefix)
      return false;
    if (name[prefix.length] && name[prefix.length] != '/')
      return false;
    return true;
  }

  // get the depth of a given path
  // eg pathLen('some/name') -> 2
  function pathLen(name) {
    var len = 1;
    for (var i = 0, l = name.length; i < l; i++)
      if (name[i] === '/')
        len++;
    return len;
  }

  function doMap(name, matchLen, map) {
    return map + name.substr(matchLen);
  }

  // given a relative-resolved module name and normalized parent name,
  // apply the map configuration
  function applyMap(name, parentName, loader) {
    var curMatch, curMatchLength = 0;
    var curParent, curParentMatchLength = 0;
    var tmpParentLength, tmpPrefixLength;
    var subPath;
    var nameParts;

    // first find most specific contextual match
    if (parentName) {
      for (var p in loader.map) {
        var curMap = loader.map[p];
        if (typeof curMap != 'object')
          continue;

        // most specific parent match wins first
        if (!prefixMatch(parentName, p))
          continue;

        tmpParentLength = pathLen(p);
        if (tmpParentLength <= curParentMatchLength)
          continue;

        for (var q in curMap) {
          // most specific name match wins
          if (!prefixMatch(name, q))
            continue;
          tmpPrefixLength = pathLen(q);
          if (tmpPrefixLength <= curMatchLength)
            continue;

          curMatch = q;
          curMatchLength = tmpPrefixLength;
          curParent = p;
          curParentMatchLength = tmpParentLength;
        }
      }
    }

    // if we found a contextual match, apply it now
    if (curMatch)
      return doMap(name, curMatch.length, loader.map[curParent][curMatch]);

    // now do the global map
    for (var p in loader.map) {
      var curMap = loader.map[p];
      if (typeof curMap != 'string')
        continue;

      if (!prefixMatch(name, p))
        continue;

      var tmpPrefixLength = pathLen(p);

      if (tmpPrefixLength <= curMatchLength)
        continue;

      curMatch = p;
      curMatchLength = tmpPrefixLength;
    }

    if (curMatch)
      return doMap(name, curMatch.length, loader.map[curMatch]);

    return name;
  }

  var loaderNormalize = loader.normalize;
  loader.normalize = function(identifier, parentName, parentAddress) {
    var loader = this;
    var name = identifier;
    if (!loader.map)
      loader.map = {};

    var isPackage = false;
    if (name.substr(name.length - 1, 1) == '/') {
      isPackage = true;
      name += '#';
    }

    return Promise.resolve(loaderNormalize.call(loader, name, parentName, parentAddress))
    .then(function(normalizedName) {
      var name = applyMap(normalizedName, parentName, loader);

      // Normalize "module/" into "module/module"
      // Convenient for packages
      if (isPackage) {
        var nameParts = name.split('/');
        nameParts.pop();
        var pkgName = nameParts.pop();
        nameParts.push(pkgName);
        nameParts.push(pkgName);
        name = nameParts.join('/');
      }

      return name;
    });
  }
}

/*
  SystemJS Plugin Support

  Supports plugin syntax with "!"

  The plugin name is loaded as a module itself, and can override standard loader hooks
  for the plugin resource. See the plugin section of the systemjs readme.
*/
function plugins(loader) {
  if (typeof indexOf == 'undefined')
    indexOf = Array.prototype.indexOf;

  loader._extensions.push(plugins);

  var loaderNormalize = loader.normalize;
  loader.normalize = function(name, parentModuleName, parentAddress) {
    var loader = this;
    var parentName = parentModuleName;
    // if parent is a plugin, normalize against the parent plugin argument only
    var parentPluginIndex;
    if (parentName && (parentPluginIndex = parentName.indexOf('!')) != -1)
      parentName = parentName.substr(0, parentPluginIndex);

    return Promise.resolve(loaderNormalize.call(loader, name, parentName, parentAddress))
    .then(function(name) {
      // if this is a plugin, normalize the plugin name and the argument
      var pluginIndex = name.lastIndexOf('!');
      if (pluginIndex != -1) {
        var argumentName = name.substr(0, pluginIndex);

        // plugin name is part after "!" or the extension itself
        var pluginName = name.substr(pluginIndex + 1) || argumentName.substr(argumentName.lastIndexOf('.') + 1);

        // normalize the plugin name relative to the same parent
        return new Promise(function(resolve) {
          resolve(loader.normalize(pluginName, parentName, parentAddress));
        })
        // normalize the plugin argument
        .then(function(_pluginName) {
          pluginName = _pluginName;
          return loader.normalize(argumentName, parentName, parentAddress, true);
        })
        .then(function(argumentName) {
          return argumentName + '!' + pluginName;
        });
      }

      // standard normalization
      return name;
    });
  };

  var loaderLocate = loader.locate;
  loader.locate = function(load) {
    var loader = this;

    var name = load.name;

    // only fetch the plugin itself if this name isn't defined
    if (this.defined && this.defined[name])
      return loaderLocate.call(this, load);

    // plugin
    var pluginIndex = name.lastIndexOf('!');
    if (pluginIndex != -1) {
      var pluginName = name.substr(pluginIndex + 1);

      // the name to locate is the plugin argument only
      load.name = name.substr(0, pluginIndex);

      var pluginLoader = loader.pluginLoader || loader;

      // load the plugin module
      // NB ideally should use pluginLoader.load for normalized,
      //    but not currently working for some reason
      return pluginLoader['import'](pluginName, {
        metadata: { importingModuleName: name }
      })
      .then(function() {
        var plugin = pluginLoader.get(pluginName);
        plugin = plugin['default'] || plugin;

        // allow plugins to opt-out of build
        if (plugin.build === false && loader.pluginLoader)
          load.metadata.build = false;

        // store the plugin module itself on the metadata
        load.metadata.plugin = plugin;
        load.metadata.pluginName = pluginName;
        load.metadata.pluginArgument = load.name;
        load.metadata.buildType = plugin.buildType || "js";

        // run plugin locate if given
        if (plugin.locate)
          return plugin.locate.call(loader, load);

        // otherwise use standard locate without '.js' extension adding
        else
          return Promise.resolve(loader.locate(load))
          .then(function(address) {
            return address.replace(/\.js$/, '');
          });
      });
    }

    return loaderLocate.call(this, load);
  };

  var loaderFetch = loader.fetch;
  loader.fetch = function(load) {
    var loader = this;
    // ignore fetching build = false unless in a plugin loader
    if (load.metadata.build === false && loader.pluginLoader)
      return '';
    else if (load.metadata.plugin && load.metadata.plugin.fetch && !load.metadata.pluginFetchCalled) {
      load.metadata.pluginFetchCalled = true;
      return load.metadata.plugin.fetch.call(loader, load, loaderFetch);
    }
    else
      return loaderFetch.call(loader, load);
  };

  var loaderTranslate = loader.translate;
  loader.translate = function(load) {
    var loader = this;
    if (load.metadata.plugin && load.metadata.plugin.translate)
      return Promise.resolve(load.metadata.plugin.translate.call(loader, load)).then(function(result) {
        if (typeof result == 'string')
          load.source = result;
        return loaderTranslate.call(loader, load);
      });
    else
      return loaderTranslate.call(loader, load);
  };

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this;
    if (load.metadata.plugin && load.metadata.plugin.instantiate)
       return Promise.resolve(load.metadata.plugin.instantiate.call(loader, load)).then(function(result) {
        if (result) {
          // load.metadata.format = 'defined';
          // load.metadata.execute = function() {
          //   return result;
          // };
          return result;
        }
        return loaderInstantiate.call(loader, load);
      });
    else if (load.metadata.plugin && load.metadata.plugin.build === false) {
      load.metadata.format = 'defined';
      load.metadata.deps.push(load.metadata.pluginName);
      load.metadata.execute = function() {
        return loader.newModule({});
      };
      return loaderInstantiate.call(loader, load);
    }
    else
      return loaderInstantiate.call(loader, load);
  }

}

/*
  System bundles

  Allows a bundle module to be specified which will be dynamically 
  loaded before trying to load a given module.

  For example:
  System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']

  Will result in a load to "mybundle" whenever a load to "jquery"
  or "bootstrap/js/bootstrap" is made.

  In this way, the bundle becomes the request that provides the module
*/

function bundles(loader) {
  if (typeof indexOf == 'undefined')
    indexOf = Array.prototype.indexOf;

  loader._extensions.push(bundles);

  // bundles support (just like RequireJS)
  // bundle name is module name of bundle itself
  // bundle is array of modules defined by the bundle
  // when a module in the bundle is requested, the bundle is loaded instead
  // of the form System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']
  loader.bundles = loader.bundles || {};

  var loaderFetch = loader.fetch;
  loader.fetch = function(load) {
    var loader = this;
    if (loader.trace)
      return loaderFetch.call(this, load);
    if (!loader.bundles)
      loader.bundles = {};

    // if this module is in a bundle, load the bundle first then
    for (var b in loader.bundles) {
      if (indexOf.call(loader.bundles[b], load.name) == -1)
        continue;
      // we do manual normalization in case the bundle is mapped
      // this is so we can still know the normalized name is a bundle
      return Promise.resolve(loader.normalize(b))
      .then(function(normalized) {
        loader.bundles[normalized] = loader.bundles[normalized] || loader.bundles[b];

        // note this module is a bundle in the meta
        loader.meta = loader.meta || {};
        loader.meta[normalized] = loader.meta[normalized] || {};
        loader.meta[normalized].bundle = true;

        return loader.load(normalized);
      })
      .then(function() {
        return '';
      });
    }
    return loaderFetch.call(this, load);
  }
}

/*
 * Dependency Tree Cache
 * 
 * Allows a build to pre-populate a dependency trace tree on the loader of 
 * the expected dependency tree, to be loaded upfront when requesting the
 * module, avoinding the n round trips latency of module loading, where 
 * n is the dependency tree depth.
 *
 * eg:
 * System.depCache = {
 *  'app': ['normalized', 'deps'],
 *  'normalized': ['another'],
 *  'deps': ['tree']
 * };
 * 
 * System.import('app') 
 * // simultaneously starts loading all of:
 * // 'normalized', 'deps', 'another', 'tree'
 * // before "app" source is even loaded
 */

function depCache(loader) {
  loader.depCache = loader.depCache || {};

  loader._extensions.push(depCache);

  var loaderLocate = loader.locate;
  loader.locate = function(load) {
    var loader = this;

    if (!loader.depCache)
      loader.depCache = {};

    // load direct deps, in turn will pick up their trace trees
    var deps = loader.depCache[load.name];
    if (deps)
      for (var i = 0; i < deps.length; i++)
        loader.load(deps[i]);

    return loaderLocate.call(loader, load);
  }
}
  

core(System);
meta(System);
register(System);
es6(System);
global(System);
cjs(System);
amd(System);
map(System);
plugins(System);
bundles(System);
depCache(System);

};

var $__curScript, __eval;

(function() {

  var doEval;
  var isWorker = typeof window == 'undefined' && typeof self != 'undefined' && typeof importScripts != 'undefined';
  var isBrowser = typeof window != 'undefined' && typeof document != 'undefined';
  var isNode = typeof process === 'object' && {}.toString.call(process) === '[object process]';
  var isNW = !!(isNode && global.nw && global.nw.process);
  var isChromeExtension = isBrowser && !isNW && window.chrome && window.chrome.extension;
  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);
  var scriptEval;

  doEval = function(source, address, context) {
    try {
      new Function(source).call(context);
    }
    catch(e) {
      throw addToError(e, 'Evaluating ' + address);
    }
  };

  if(isWorker) {
    $__global.upgradeSystemLoader();
  } else if ((isBrowser || isNW) && !isChromeExtension) {
    var head;

    var scripts = document.getElementsByTagName('script');
    $__curScript = scripts[scripts.length - 1];

    // globally scoped eval for the browser
    scriptEval = function(source) {
      if (!head)
        head = document.head || document.body || document.documentElement;

      var script = document.createElement('script');
      script.text = source;
      var onerror = window.onerror;
      var e;
      window.onerror = function(_e) {
        e = _e;
      }
      head.appendChild(script);
      head.removeChild(script);
      window.onerror = onerror;
      if (e)
        throw e;
    };

    $__global.upgradeSystemLoader();
  }
  else if(isNode) {
    var es6ModuleLoader = require('./src/loader');
    $__global.System = es6ModuleLoader.System;
    $__global.Loader = es6ModuleLoader.Loader;
    $__global.upgradeSystemLoader();
    module.exports = $__global.System;

    // global scoped eval for node
    var vm = require('vm');
    doEval = function(source) {
      vm.runInThisContext(source);
    }
  }

  var errArgs = new Error(0, '_').fileName == '_';

  function addToError(err, msg) {
    // parse the stack removing loader code lines for simplification
    if (!err.originalErr) {
      var stack = (err.stack || err.message || err).toString().split('\n');
      var newStack = [];
      for (var i = 0; i < stack.length; i++) {
        if (typeof $__curScript == 'undefined' || stack[i].indexOf($__curScript.src) == -1)
          newStack.push(stack[i]);
      }
    }

    var newMsg = (newStack ? newStack.join('\n\t') : err.message) + '\n\t' + msg;

    // Convert file:/// URLs to paths in Node
    if (!isBrowser)
      newMsg = newMsg.replace(isWindows ? /file:\/\/\//g : /file:\/\//g, '');

    var newErr = errArgs ? new Error(newMsg, err.fileName, err.lineNumber) : new Error(newMsg);

    // Node needs stack adjustment for throw to show message
    if (!isBrowser)
      newErr.stack = newMsg;
    // Clearing the stack stops unnecessary loader lines showing
    else
      newErr.stack = null;

    // track the original error
    newErr.originalErr = err.originalErr || err;

    return newErr;
  }

  __eval = function(inSource, address, context, sourceMap, evalType) {
	var source = inSource;
    source += '\n//# sourceURL=' + address + (sourceMap ? '\n//# sourceMappingURL=' + sourceMap : '');


    var useScriptEval = evalType === 'script'
      && typeof scriptEval === 'function';
    if(useScriptEval) {
      scriptEval(source);
    } else {
      doEval(source, address, context);
    }
  };

})();

})(typeof window != 'undefined' ? window : (typeof WorkerGlobalScope != 'undefined' ? self : global));

(function(global){

	// helpers
	var camelize = function(str){
		return str.replace(/-+(.)?/g, function(match, chr){
			return chr ? chr.toUpperCase() : ''
		});
	},
		each = function( o, cb){
			var i, len;

			// weak array detection, but we only use this internally so don't
			// pass it weird stuff
			if ( typeof o.length == 'number' && (o.length - 1) in o) {
				for ( i = 0, len = o.length; i < len; i++ ) {
					cb.call(o[i], o[i], i, o);
				}
			} else {
				for ( i in o ) {
					if(o.hasOwnProperty(i)){
						cb.call(o[i], o[i], i, o);
					}
				}
			}
			return o;
		},
		map = function(o, cb) {
			var arr = [];
			each(o, function(item, i){
				arr[i] = cb(item, i);
			});
			return arr;
		},
		isString = function(o) {
			return typeof o == "string";
		},
		extend = function(d,s){
			each(s, function(v, p){
				d[p] = v;
			});
			return d;
		},
		dir = function(uri){
			var lastSlash = uri.lastIndexOf("/");
			//if no / slashes, check for \ slashes since it might be a windows path
			if(lastSlash === -1)
				lastSlash = uri.lastIndexOf("\\");
			if(lastSlash !== -1) {
				return uri.substr(0, lastSlash);
			} else {
				return uri;
			}
		},
		last = function(arr){
			return arr[arr.length - 1];
		},
		parseURI = function(url) {
			var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@\/]*(?::[^:@\/]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
				// authority = '//' + user + ':' + pass '@' + hostname + ':' port
				return (m ? {
				href     : m[0] || '',
				protocol : m[1] || '',
				authority: m[2] || '',
				host     : m[3] || '',
				hostname : m[4] || '',
				port     : m[5] || '',
				pathname : m[6] || '',
				search   : m[7] || '',
				hash     : m[8] || ''
			} : null);
		},
		joinURIs = function(base, href) {
			function removeDotSegments(input) {
				var output = [];
				input.replace(/^(\.\.?(\/|$))+/, '')
					.replace(/\/(\.(\/|$))+/g, '/')
					.replace(/\/\.\.$/, '/../')
					.replace(/\/?[^\/]*/g, function (p) {
						if (p === '/..') {
							output.pop();
						} else {
							output.push(p);
						}
					});
				return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
			}

			href = parseURI(href || '');
			base = parseURI(base || '');

			return !href || !base ? null : (href.protocol || base.protocol) +
				(href.protocol || href.authority ? href.authority : base.authority) +
				removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
					(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
					href.hash;
		},
		relativeURI = function(base, path) {
			var uriParts = path.split("/"),
				baseParts = base.split("/"),
				result = [];
			while ( uriParts.length && baseParts.length && uriParts[0] == baseParts[0] ) {
				uriParts.shift();
				baseParts.shift();
			}
			for(var i = 0 ; i< baseParts.length-1; i++) {
				result.push("../");
			}
			return "./" + result.join("") + uriParts.join("/");
		},
		fBind = Function.prototype.bind,
		isFunction = function(obj) {
			return !!(obj && obj.constructor && obj.call && obj.apply);
		},
		isWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope,
		isNode = typeof process === "object" && {}.toString.call(process) === "[object process]",
		isBrowserWithWindow = !isNode && typeof window !== "undefined",
		isNW = isNode && (function(){
			try {
				return require("nw.gui") !== "undefined";
			} catch(e) {
				return false;
			}
		})(),
		isElectron = isNode && !!process.versions["electron"],
		isNode = isNode && !isNW && !isElectron,
		warn = typeof console === "object" ?
			fBind.call(console.warn, console) : function(){};

	var filename = function(uri){
		var lastSlash = uri.lastIndexOf("/");
		//if no / slashes, check for \ slashes since it might be a windows path
		if(lastSlash === -1)
			lastSlash = uri.lastIndexOf("\\");
		var matches = ( lastSlash == -1 ? uri : uri.substr(lastSlash+1) ).match(/^[\w-\s\.!]+/);
		return matches ? matches[0] : "";
	};

	var ext = function(uri){
		var fn = filename(uri);
		var dot = fn.lastIndexOf(".");
		if(dot !== -1) {
			return fn.substr(dot+1);
		} else {
			return "";
		}
	};

	var pluginCache = {};

	var normalize = function(unnormalizedName, loader){
		var name = unnormalizedName;

		// Detech if this name contains a plugin part like: app.less!steal/less
		// and catch the plugin name so that when it is normalized we do not perform
		// Steal's normalization against it.
		var pluginIndex = name.lastIndexOf('!');
		var pluginPart = "";
		if (pluginIndex != -1) {
			// argumentName is the part before the !
			var argumentName = name.substr(0, pluginIndex);
			var pluginName = name.substr(pluginIndex + 1);
			pluginPart = "!" + pluginName;

			// Set the name to the argument name so that we can normalize it alone.
			name = argumentName;
		}

		var last = filename(name),
			extension = ext(name);
		// if the name ends with /
		if(	name[name.length -1] === "/" ) {
			return name+filename( name.substr(0, name.length-1) ) + pluginPart;
		} else if(	!/^(\w+(?:s)?:\/\/|\.|file|\/)/.test(name) &&
			// and doesn't end with a dot
			 last.indexOf(".") === -1
			) {
			return name+"/"+last + pluginPart;
		} else {
			if(extension === "js") {
				return name.substr(0, name.lastIndexOf(".")) + pluginPart;
			} else {
				return name + pluginPart;
			}
		}
	};

var cloneSteal = function(System){
	var loader = System || this.System;
	var steal = makeSteal(loader.clone());
	steal.loader.set("@steal", steal.loader.newModule({
		"default": steal,
		__useDefault: true
	}));
	steal.clone = cloneSteal;
	return steal;
};

var makeSteal = function(System){
	var addStealExtension = function (extensionFn) {
		if (typeof System !== "undefined" && isFunction(extensionFn)) {
			if (System._extensions) {
				System._extensions.push(extensionFn);
			}
			extensionFn(System);
		}
	};

	System.set('@loader', System.newModule({
		'default': System,
		__useDefault: true
	}));


	System.set("less", System.newModule({
		__useDefault: true,
		default: {
			fetch: function() {
				throw new Error(
					[
						"steal-less plugin must be installed and configured properly",
						"See https://stealjs.com/docs/steal-less.html"
					].join("\n")
				);
			}
		}
	}));

	System.config({
		map: {
			"@loader/@loader": "@loader",
			"@steal/@steal": "@steal"
		}
	});

	var configPromise,
		devPromise,
		appPromise;

	var steal = function(){
		var args = arguments;
		var afterConfig = function(){
			var imports = [];
			var factory;
			each(args, function(arg){
				if(isString(arg)) {
					imports.push( steal.System['import']( normalize(arg) ) );
				} else if(typeof arg === "function") {
					factory = arg;
				}
			});

			var modules = Promise.all(imports);
			if(factory) {
				return modules.then(function(modules) {
			        return factory && factory.apply(null, modules);
			   });
			} else {
				return modules;
			}
		};
		if(System.isEnv("production")) {
			return afterConfig();
		} else {
			// wait until the config has loaded
			return configPromise.then(afterConfig,afterConfig);
		}

	};

	System.set("@steal", System.newModule({
		"default": steal,
		__useDefault:true
	}));

	var loaderClone = System.clone;
	System.clone = function(){
		var loader = loaderClone.apply(this, arguments);
		loader.set("@loader", loader.newModule({
			"default": loader,
			__useDefault: true
		}));
		loader.set("@steal", loader.newModule({
			"default": steal,
			__useDefault: true
		}));
		return loader;
	};

	// steal.System remains for backwards compat only
	steal.System = steal.loader = System;
	steal.parseURI = parseURI;
	steal.joinURIs = joinURIs;
	steal.normalize = normalize;
	steal.relativeURI = relativeURI;
	steal.addExtension = addStealExtension;

// System-Ext
// This normalize-hook does 2 things.
// 1. with specify a extension in your config
// 		you can use the "!" (bang) operator to load
// 		that file with the extension
// 		System.ext = {bar: "path/to/bar"}
// 		foo.bar! -> foo.bar!path/to/bar
// 2. if you load a javascript file e.g. require("./foo.js")
// 		normalize will remove the ".js" to load the module
addStealExtension(function (loader) {
  loader.ext = {};

  var normalize = loader.normalize,
    endingExtension = /\.(\w+)!?$/;

  loader.normalize = function (name, parentName, parentAddress, pluginNormalize) {
    if (pluginNormalize) {
      return normalize.apply(this, arguments);
    }

    var matches = name.match(endingExtension);
	var outName = name;

    if (matches) {
      var hasBang = name[name.length - 1] === "!",
        ext = matches[1];
      // load js-files nodd-like
      if (parentName && loader.configMain !== name && matches[0] === '.js') {
        outName = name.substr(0, name.lastIndexOf("."));
        // matches ext mapping
      } else if (loader.ext[ext]) {
        outName = name + (hasBang ? "" : "!") + loader.ext[ext];
      }
    }
    return normalize.call(this, outName, parentName, parentAddress);
  };
});

// Steal Locate Extension
// normalize a given path e.g.
// "path/to/folder/" -> "path/to/folder/folder"
addStealExtension(function (loader) {
  var normalize = loader.normalize;
  var npmLike = /@.+#.+/;

  loader.normalize = function (name, parentName, parentAddress, pluginNormalize) {
    var lastPos = name.length - 1,
      secondToLast,
      folderName,
	  newName = name;

    if (name[lastPos] === "/") {
      secondToLast = name.substring(0, lastPos).lastIndexOf("/");
      folderName = name.substring(secondToLast + 1, lastPos);
      if (npmLike.test(folderName)) {
        folderName = folderName.substr(folderName.lastIndexOf("#") + 1);
      }

      newName += folderName;
    }
    return normalize.call(this, newName, parentName, parentAddress, pluginNormalize);
  };
});

// override loader.translate to rewrite 'locate://' & 'pkg://' path schemes found
// in resources loaded by supporting plugins
addStealExtension(function (loader) {
  /**
   * @hide
   * @function normalizeAndLocate
   * @description Run a module identifier through Normalize and Locate hooks.
   * @param {String} moduleName The module to run through normalize and locate.
   * @return {Promise} A promise to resolve when the address is found.
   */
  var normalizeAndLocate = function(moduleName, parentName){
    var loader = this;
    return Promise.resolve(loader.normalize(moduleName, parentName))
      .then(function(name){
        return loader.locate({name: name, metadata: {}});
      }).then(function(address){
		var outAddress = address;
        if(address.substr(address.length - 3) === ".js") {
          outAddress = address.substr(0, address.length - 3);
        }
        return outAddress;
      });
  };

  var relative = function(base, path){
    var uriParts = path.split("/"),
      baseParts = base.split("/"),
      result = [];

    while ( uriParts.length && baseParts.length && uriParts[0] == baseParts[0] ) {
      uriParts.shift();
      baseParts.shift();
    }

    for(var i = 0 ; i< baseParts.length-1; i++) {
      result.push("../");
    }

    return result.join("") + uriParts.join("/");
  };

  var schemePattern = /(locate):\/\/([a-z0-9/._@-]*)/ig,
    parsePathSchemes = function(source, parent) {
      var locations = [];
      source.replace(schemePattern, function(whole, scheme, path, index){
        locations.push({
          start: index,
          end: index+whole.length,
          name: path,
          postLocate: function(address){
            return relative(parent, address);
          }
        });
      });
      return locations;
    };

  var _translate = loader.translate;
  loader.translate = function(load){
    var loader = this;

    // This only applies to plugin resources.
    if(!load.metadata.plugin) {
      return _translate.call(this, load);
    }

    // Use the translator if this file path scheme is supported by the plugin
    var locateSupport = load.metadata.plugin.locateScheme;
    if(!locateSupport) {
      return _translate.call(this, load);
    }

    // Parse array of module names
    var locations = parsePathSchemes(load.source, load.address);

    // no locations found
    if(!locations.length) {
      return _translate.call(this, load);
    }

    // normalize and locate all of the modules found and then replace those instances in the source.
    var promises = [];
    for(var i = 0, len = locations.length; i < len; i++) {
      promises.push(
        normalizeAndLocate.call(this, locations[i].name, load.name)
      );
    }
    return Promise.all(promises).then(function(addresses){
      for(var i = locations.length - 1; i >= 0; i--) {
        load.source = load.source.substr(0, locations[i].start)
          + locations[i].postLocate(addresses[i])
          + load.source.substr(locations[i].end, load.source.length);
      }
      return _translate.call(loader, load);
    });
  };
});

addStealExtension(function (loader) {
  loader._contextualModules = {};

  loader.setContextual = function(moduleName, definer){
    this._contextualModules[moduleName] = definer;
  };

  var normalize = loader.normalize;
  loader.normalize = function(name, parentName){
    var loader = this;
	var pluginLoader = loader.pluginLoader || loader;

    if (parentName) {
      var definer = this._contextualModules[name];

      // See if `name` is a contextual module
      if (definer) {
        var localName = name + '/' + parentName;

        if(!loader.has(localName)) {
          // `definer` could be a function or could be a moduleName
          if (typeof definer === 'string') {
            definer = pluginLoader['import'](definer);
          }

          return Promise.resolve(definer)
            .then(function(modDefiner) {
				var definer = modDefiner;
              if (definer['default']) {
                definer = definer['default'];
              }
              var definePromise = Promise.resolve(
                definer.call(loader, parentName)
              );
              return definePromise;
            })
            .then(function(moduleDef){
              loader.set(localName, loader.newModule(moduleDef));
              return localName;
            });
        }
        return Promise.resolve(localName);
      }
    }

    return normalize.apply(this, arguments);
  };
});

/**
 * Steal Script-Module Extension
 *
 * Add a steal-module script to the page and it will run after Steal has been
 * configured, e.g:
 *
 * <script type="text/steal-module">...</script>
 * <script type="steal-module">...</script>
 */
addStealExtension(function(loader) {
	// taken from https://github.com/ModuleLoader/es6-module-loader/blob/master/src/module-tag.js
	function completed() {
		document.removeEventListener("DOMContentLoaded", completed, false);
		window.removeEventListener("load", completed, false);
		ready();
	}

	function ready() {
		var scripts = document.getElementsByTagName("script");
		for (var i = 0; i < scripts.length; i++) {
			var script = scripts[i];
			if (script.type == "steal-module" || script.type == "text/steal-module") {
				var source = script.innerHTML;
				if (/\S/.test(source)) {
					loader.module(source)["catch"](function(err) {
						setTimeout(function() {
							throw err;
						});
					});
				}
			}
		}
	}

	loader.loadScriptModules = function() {
		if (isBrowserWithWindow) {
			if (document.readyState === "complete") {
				setTimeout(ready);
			} else if (document.addEventListener) {
				document.addEventListener("DOMContentLoaded", completed, false);
				window.addEventListener("load", completed, false);
			}
		}
	};
});

// SystemJS Steal Format
// Provides the Steal module format definition.
addStealExtension(function (loader) {
  // Steal Module Format Detection RegEx
  // steal(module, ...)
  var stealRegEx = /(?:^\s*|[}{\(\);,\n\?\&]\s*)steal\s*\(\s*((?:"[^"]+"\s*,|'[^']+'\s*,\s*)*)/;

  // What we stole.
  var stealInstantiateResult;

  function createSteal(loader) {
    stealInstantiateResult = null;

    // ensure no NodeJS environment detection
    loader.global.module = undefined;
    loader.global.exports = undefined;

    function steal() {
      var deps = [];
      var factory;

      for( var i = 0; i < arguments.length; i++ ) {
        if (typeof arguments[i] === 'string') {
          deps.push( normalize(arguments[i]) );
        } else {
          factory = arguments[i];
        }
      }

      if (typeof factory !== 'function') {
        factory = (function(factory) {
          return function() { return factory; };
        })(factory);
      }

      stealInstantiateResult = {
        deps: deps,
        execute: function(require, exports, moduleName) {

          var depValues = [];
          for (var i = 0; i < deps.length; i++) {
            depValues.push(require(deps[i]));
          }

          var output = factory.apply(loader.global, depValues);

          if (typeof output !== 'undefined') {
            return output;
          }
        }
      };
    }

    loader.global.steal = steal;
  }

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this;

    if (load.metadata.format === 'steal' || !load.metadata.format && load.source.match(stealRegEx)) {
      load.metadata.format = 'steal';

      var oldSteal = loader.global.steal;

      createSteal(loader);

      loader.__exec(load);

      loader.global.steal = oldSteal;

      if (!stealInstantiateResult) {
        throw "Steal module " + load.name + " did not call steal";
      }

      if (stealInstantiateResult) {
        load.metadata.deps = load.metadata.deps ? load.metadata.deps.concat(stealInstantiateResult.deps) : stealInstantiateResult.deps;
        load.metadata.execute = stealInstantiateResult.execute;
      }
    }
    return loaderInstantiate.call(loader, load);
  };
});
/**
 * Extension to warn users when a module is instantiated twice
 *
 * Multiple module instantiation might cause unexpected side effects
 */
addStealExtension(function(loader) {
	var superInstantiate = loader.instantiate;

	var warn = typeof console === "object" ?
		Function.prototype.bind.call(console.warn, console) :
		null;

	if(!loader._instantiatedModules) {
		Object.defineProperty(loader, '_instantiatedModules', {
			value: Object.create(null),
			writable: false
		});
	}

	loader.instantiate = function(load) {
		var loader = this;
		var instantiated = loader._instantiatedModules;

		if (warn && instantiated[load.address]) {
			var loads = (loader._traceData && loader._traceData.loads) || {};
			var map = (loader._traceData && loader._traceData.parentMap) || {};

			var parentMods = instantiated[load.address].concat(load.name);
			var parents = parentMods
				.map(function(moduleName){
					return "\t" + moduleName + "\n" +

					(map[moduleName] ? Object.keys(map[moduleName]) : [])
					.map(function(parent) {
						// module names might confuse people
						return "\t\t - " + loads[parent].address;
					})
					.join("\n");
				})
				.join("\n\n");

			warn([
				"The module with address " + load.address +
					" is being instantiated twice.",
				"This happens when module identifiers normalize to different module names.\n",
				"Modules:\n" + (parents || "") + "\n",
				"HINT: Import the module using the ~/[modulePath] identifier.\n" +
				"Learn more at https://stealjs.com/docs/moduleName.html and " +
					"https://stealjs.com/docs/tilde.html"
			].join("\n"));
		} else {
			instantiated[load.address] = [load.name];
		}

		return superInstantiate.apply(loader, arguments);
	};
});

addStealExtension(function applyTraceExtension(loader) {
	if(loader._extensions) {
		loader._extensions.push(applyTraceExtension);
	}

	loader._traceData = {
		loads: {},
		parentMap: {}
	};

	loader.getDependencies = function(moduleName){
		var load = this.getModuleLoad(moduleName);
		return load ? load.metadata.dependencies : undefined;
	};
	loader.getDependants = function(moduleName){
		var deps = [];
		var pars = this._traceData.parentMap[moduleName] || {};
		eachOf(pars, function(name) { deps.push(name); });
		return deps;
	};
	loader.getModuleLoad = function(moduleName){
		return this._traceData.loads[moduleName];
	};
	loader.getBundles = function(moduleName, argVisited){
		var visited = argVisited || {};
		visited[moduleName] = true;
		var loader = this;
		var parentMap = loader._traceData.parentMap;
		var parents = parentMap[moduleName];
		if(!parents) return [moduleName];

		var bundles = [];
		eachOf(parents, function(parentName, value){
			if(!visited[parentName])
				bundles = bundles.concat(loader.getBundles(parentName, visited));
		});
		return bundles;
	};
	loader._allowModuleExecution = {};
	loader.allowModuleExecution = function(name){
		var loader = this;
		return loader.normalize(name).then(function(name){
			loader._allowModuleExecution[name] = true;
		});
	};

	function eachOf(obj, callback){
		var name, val;
		for(name in obj) {
			callback(name, obj[name]);
		}
	}

	var normalize = loader.normalize;
	loader.normalize = function(name, parentName){
		var normalizePromise = normalize.apply(this, arguments);

		if(parentName) {
			var parentMap = this._traceData.parentMap;
			return normalizePromise.then(function(name){
				if(!parentMap[name]) {
					parentMap[name] = {};
				}
				parentMap[name][parentName] = true;
				return name;
			});
		}

		return normalizePromise;
	};

	var emptyExecute = function(){
		return loader.newModule({});
	};

	var passThroughModules = {
		traceur: true,
		babel: true
	};
	var isAllowedToExecute = function(load){
		return passThroughModules[load.name] || this._allowModuleExecution[load.name];
	};

	var map = [].map || function(callback){
		var res = [];
		for(var i = 0, len = this.length; i < len; i++) {
			res.push(callback(this[i]));
		}
		return res;
	};

	var esImportDepsExp = /import [\s\S]*?["'](.+)["']/g;
	var esExportDepsExp = /export .+ from ["'](.+)["']/g;
	var commentRegEx = /(?:(?:^|\s)\/\/(.+?)$)|(?:\/\*([\S\s]*?)\*\/)/gm;
	var stringRegEx = /(?:("|')[^\1\\\n\r]*(?:\\.[^\1\\\n\r]*)*\1|`[^`]*`)/g;

	function getESDeps(source) {
		var cleanSource = source.replace(commentRegEx, "");

		esImportDepsExp.lastIndex = commentRegEx.lastIndex =
			esExportDepsExp.lastIndex = stringRegEx.lastIndex = 0;

		var match;
		var deps = [];
		var stringLocations = []; // track string for unminified source

		function inLocation(locations, match) {
		  for (var i = 0; i < locations.length; i++)
			if (locations[i][0] < match.index && locations[i][1] > match.index)
			  return true;
		  return false;
		}

		function addDeps(exp) {
			while (match = exp.exec(cleanSource)) {
			  // ensure we're not within a string location
			  if (!inLocation(stringLocations, match)) {
				var dep = match[1];
				deps.push(dep);
			  }
			}
		}

		if (source.length / source.split('\n').length < 200) {
		  while (match = stringRegEx.exec(cleanSource))
			stringLocations.push([match.index, match.index + match[0].length]);
		}

		addDeps(esImportDepsExp);
		addDeps(esExportDepsExp);

		return deps;
	}

	var instantiate = loader.instantiate;
	loader.instantiate = function(load){
		this._traceData.loads[load.name] = load;
		var loader = this;
		var instantiatePromise = Promise.resolve(instantiate.apply(this, arguments));

		function finalizeResult(result){
			var preventExecution = loader.preventModuleExecution &&
				!isAllowedToExecute.call(loader, load);

			// deps either comes from the instantiate result, or if an
			// es6 module it was found in the transpile hook.
			var deps = result ? result.deps : load.metadata.deps;

			return Promise.all(map.call(deps, function(depName){
				return loader.normalize(depName, load.name);
			})).then(function(dependencies){
				load.metadata.deps = deps;
				load.metadata.dependencies = dependencies;

				if(preventExecution) {
					return {
						deps: deps,
						execute: emptyExecute
					};
				}

				return result;

			});
		}

		return instantiatePromise.then(function(result){
			// This must be es6
			if(!result) {
				var deps = getESDeps(load.source);
				load.metadata.deps = deps;
			}
			return finalizeResult(result);
		});
	};

	var transpile = loader.transpile;
	// Allow transpile to be memoized, but only once
	loader.transpile = function(load){
		var transpiled = load.metadata.transpiledSource;
		if(transpiled) {
			delete load.metadata.transpiledSource;
			return Promise.resolve(transpiled);
		}
		return transpile.apply(this, arguments);
	};

	loader.eachModule = function(cb){
		for (var moduleName in this._loader.modules) {
			cb.call(this, moduleName, this.get(moduleName));
		}
	};
});

// Steal JSON Format
// Provides the JSON module format definition.
addStealExtension(function (loader) {
  var jsonExt = /\.json$/i;
  var jsExt = /\.js$/i;

  // taken from prototypejs
  // https://github.com/sstephenson/prototype/blob/master/src/prototype/lang/string.js#L682-L706
  function isJSON(json) {
	var str = json;
    if (!str) return false;

    str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
    str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
    str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
    return (/^[\],:{}\s]*$/).test(str);
  }

  // if someone has a moduleName that is .json, make sure it loads a json file
  // no matter what paths might do
  var loaderLocate = loader.locate;
  loader.locate = function(load){
    return loaderLocate.apply(this, arguments).then(function(address){
      if(jsonExt.test(load.name)) {
        return address.replace(jsExt, "");
      }

      return address;
    });
  };

  var transform = function(loader, load, data){
    var fn = loader.jsonOptions && loader.jsonOptions.transform;
    if(!fn) return data;
    return fn.call(loader, load, data);
  };

  // If we are in a build we should convert to CommonJS instead.
  if(isNode) {
    var loaderTranslate = loader.translate;
    loader.translate = function(load){
      var address = load.metadata.address || load.address;
      if(jsonExt.test(address) && load.name.indexOf('!') === -1) {
        var parsed = parse(load);
        if(parsed) {
          parsed = transform(this, load, parsed);
          return "def" + "ine([], function(){\n" +
            "\treturn " + JSON.stringify(parsed) + "\n});";
        }
      }

      return loaderTranslate.call(this, load);
    };
    return;
  }

  var loaderInstantiate = loader.instantiate;
  loader.instantiate = function(load) {
    var loader = this,
      parsed;

    parsed = parse(load);
    if(parsed) {
      parsed = transform(loader, load, parsed);
      load.metadata.format = 'json';

      load.metadata.execute = function(){
        return parsed;
      };
    }

    return loaderInstantiate.call(loader, load);
  };

  return loader;

  // Attempt to parse a load as json.
  function parse(load){
    if ((load.metadata.format === 'json' || !load.metadata.format) && isJSON(load.source)) {
      try {
        return JSON.parse(load.source);
      } catch(e) {
        warn("Error parsing " + load.address + ":", e);
        return {};
      }
    }

  }
});

// Steal Cache-Bust Extension
// if enabled, Steal Cache-Bust will add a
// cacheKey and cacheVersion to the required file address
addStealExtension(function (loader) {
	var fetch = loader.fetch;

	loader.fetch = function(load) {
		var loader = this;

		if(loader.isEnv("production") && loader.cacheVersion) {
			var cacheVersion = loader.cacheVersion,
				cacheKey = loader.cacheKey || "version",
				cacheKeyVersion = cacheKey + "=" + cacheVersion;

			load.address = load.address + (load.address.indexOf('?') === -1 ? '?' : '&') + cacheKeyVersion;
		}
		return fetch.call(this, load);
	};
});
	// Overwrites System.config with setter hooks
	var setterConfig = function(loader, configOrder, configSpecial){
		var oldConfig = loader.config;

		loader.config =  function(cfg){

			var data = extend({},cfg);
			// check each special
			each(configOrder, function(name){
				var special = configSpecial[name];
				// if there is a setter and a value
				if(special.set && data[name]){
					// call the setter
					var res = special.set.call(loader,data[name], cfg);
					// if the setter returns a value
					if(res !== undefined) {
						// set that on the loader
						loader[name] = res;
					}
					// delete the property b/c setting is done
					delete data[name];
				}
			});
			oldConfig.call(this, data);
		};
	};

	var setIfNotPresent = function(obj, prop, value){
		if(!obj[prop]) {
			obj[prop] = value;
		}
	};

	// steal.js's default configuration values
	System.configMain = "@config";
	System.devBundle = "@empty";
	System.depsBundle = "@empty";
	System.paths[System.configMain] = "stealconfig.js";
	System.env = (isWebWorker ? "worker" : "window") + "-development";
	System.ext = Object.create(null);
	System.logLevel = 0;
	var cssBundlesNameGlob = "bundles/*.css",
		jsBundlesNameGlob = "bundles/*";
	setIfNotPresent(System.paths,cssBundlesNameGlob, "dist/bundles/*css");
	setIfNotPresent(System.paths,jsBundlesNameGlob, "dist/bundles/*.js");

	var configSetter = function(order){
		return {
			order: order,
			set: function(val){
				var name = filename(val),
					root = dir(val);

				if(!isNode) {
					System.configPath = joinURIs( location.href, val);
				}
				System.configMain = name;
				System.paths[name] = name;
				this.config({ baseURL: (root === val ? "." : root) + "/" });
			}
		}
	},
		valueSetter = function(prop, order) {
			return {
				order: order,
				set: function(val) {
					this[prop] = val;
				}
			}
		},
		booleanSetter = function(prop, order) {
			return {
				order: order,
				set: function(val) {
					this[prop] = !!val;
				}
			}
		},
		fileSetter = function(prop, order) {
			return {
				order: order,
				set: function(val) {
					this[prop] = envPath(val);
				}
			};
		};

	// checks if we're running in node, then prepends the "file:" protocol if we are
	var envPath = function(pathVal) {
		var val = pathVal;
		if(isNode && !/^file:/.test(val)) {
			// If relative join with the current working directory
			if(val[0] === "." && (val[1] === "/" ||
								 (val[1] === "." && val[2] === "/"))) {
				val = require("path").join(process.cwd(), val);
			}
			if(!val) return val;

			return "file:" + val;
		}
		return val;
	};

	var setToSystem = function(prop){
		return {
			set: function(val){
				if(typeof val === "object" && typeof steal.System[prop] === "object") {
					this[prop] = extend(this[prop] || {},val || {});
				} else {
					this[prop] = val;
				}
			}
		};
	};

	var pluginPart = function(name) {
		var bang = name.lastIndexOf("!");
		if(bang !== -1) {
			return name.substr(bang+1);
		}
	};

	var pluginResource = function(name){
		var bang = name.lastIndexOf("!");
		if(bang !== -1) {
			return name.substr(0, bang);
		}
	};

	var addProductionBundles = function(){
		// we don't want add the main bundled module if steal is bundled inside!
		if(this.loadBundles && this.main && !this.stealBundled) {
			var main = this.main,
				bundlesDir = this.bundlesName || "bundles/",
				mainBundleName = bundlesDir+main;

			setIfNotPresent(this.meta, mainBundleName, {format:"amd"});

			// If the configMain has a plugin like package.json!npm,
			// plugin has to be defined prior to importing.
			var plugin = pluginPart(System.configMain);
			var bundle = [main, System.configMain];
			if(plugin){
				System.set(plugin, System.newModule({}));
			}
			plugin = pluginPart(main);
			if(plugin) {
				var resource = pluginResource(main);
				bundle.push(plugin);
				bundle.push(resource);

				mainBundleName = bundlesDir+resource.substr(0, resource.indexOf("."));
			}

			this.bundles[mainBundleName] = bundle;
		}
	};

	var setEnvsConfig = function(){
		if(this.envs) {
			var envConfig = this.envs[this.env];
			if(envConfig) {
				this.config(envConfig);
			}
		}
	};

	var setupLiveReload = function(){
		if(this.liveReloadInstalled) {
			var loader = this;
			this["import"]("live-reload", {
				name: "@@steal"
			}).then(function(reload){
				reload(loader.configMain, function(){
					setEnvsConfig.call(loader);
				});
			});
		}
	};

	var specialConfigOrder = [];
	var envsSpecial = { map: true, paths: true, meta: true };
	var specialConfig = {
		instantiated: {
			order: 1,
			set: function(val){
				var loader = this;

				each(val || {}, function(value, name){
					loader.set(name,  loader.newModule(value));
				});
			}
		},
		envs: {
			order: 2,
			set: function(val){
				// envs should be set, deep
				var envs = this.envs;
				if(!envs) envs = this.envs = {};
				each(val, function(cfg, name){
					var env = envs[name];
					if(!env) env = envs[name] = {};

					each(cfg, function(val, name){
						if(envsSpecial[name] && env[name]) {
							extend(env[name], val);
						} else {
							env[name] = val;
						}
					});
				});
			}
		},
		env: {
			order: 3,
			set: function(val){
				this.env = val;

				if(this.isEnv("production")) {
					this.loadBundles = true;
				}
			}
		},
		loadBundles: booleanSetter("loadBundles", 4),
		stealBundled: booleanSetter("stealBundled", 5),
		// System.config does not like being passed arrays.
		bundle: {
			order: 6,
			set: function(val){
				System.bundle = val;
			}
		},
		bundlesPath: {
			order: 7,
			set: function(val){
				this.paths[cssBundlesNameGlob] = val+"/*css";
				this.paths[jsBundlesNameGlob]  = val+"/*.js";
				return val;
			}
		},
		meta: {
			order: 8,
			set: function(cfg){
				var loader = this;
				each(cfg || {}, function(value, name){
					if(typeof value !== "object") {
						return;
					}
					var cur = loader.meta[name];
					if(cur && cur.format === value.format) {
						// Keep the deps, if we have any
						var deps = value.deps;
						extend(value, cur);
						if(deps) {
							value.deps = deps;
						}
					}
				});
				extend(this.meta, cfg);
			}
		},
		configMain: valueSetter("configMain", 9),
		config: configSetter(10),
		configPath: configSetter(11),
		baseURL: fileSetter("baseURL", 12),
		main: valueSetter("main", 13),
		// this gets called with the __dirname steal is in
		// directly called from steal-tools
		stealPath: {
			order: 14,
			set: function(identifier, cfg) {
				var dirname = envPath(identifier);
				var parts = dirname.split("/");

				// steal keeps this around to make things easy no matter how you are using it.
				setIfNotPresent(this.paths,"@dev", dirname+"/ext/dev.js");
				setIfNotPresent(this.paths,"npm", dirname+"/ext/npm.js");
				setIfNotPresent(this.paths,"npm-extension", dirname+"/ext/npm-extension.js");
				setIfNotPresent(this.paths,"npm-utils", dirname+"/ext/npm-utils.js");
				setIfNotPresent(this.paths,"npm-crawl", dirname+"/ext/npm-crawl.js");
				setIfNotPresent(this.paths,"npm-load", dirname+"/ext/npm-load.js");
				setIfNotPresent(this.paths,"npm-convert", dirname+"/ext/npm-convert.js");
				setIfNotPresent(this.paths,"semver", dirname+"/ext/semver.js");
				setIfNotPresent(this.paths,"bower", dirname+"/ext/bower.js");
				setIfNotPresent(this.paths,"live-reload", dirname+"/ext/live-reload.js");
				setIfNotPresent(this.paths,"steal-clone", dirname+"/ext/steal-clone.js");
				this.paths["traceur"] = dirname+"/ext/traceur.js";
				this.paths["traceur-runtime"] = dirname+"/ext/traceur-runtime.js";
				this.paths["babel"] = dirname+"/ext/babel.js";
				this.paths["babel-runtime"] = dirname+"/ext/babel-runtime.js";
				setIfNotPresent(this.meta,"traceur",{"exports":"traceur"});

				// steal-clone is contextual so it can override modules using relative paths
				this.setContextual('steal-clone', 'steal-clone');

				if(isNode) {
					if(this.configMain === "@config" && last(parts) === "steal") {
						parts.pop();
						if(last(parts) === "node_modules") {
							this.configMain = "package.json!npm";
							parts.pop();
						}
					}
					if(this.isEnv("production") || this.loadBundles) {
						addProductionBundles.call(this);
					}
				} else {
					// make sure we don't set baseURL if it already set
					if(!cfg.baseURL && !cfg.config && !cfg.configPath) {

						// if we loading steal.js and it is located in node_modules or bower_components
						// we rewrite the baseURL relative to steal.js (one directory up!)
						// we do this because, normaly our app is located as a sibling folder to
						// node_modules or bower_components
						if ( last(parts) === "steal" ) {
							parts.pop();
							var isFromPackage = false;
							if ( last(parts) === cfg.bowerPath || last(parts) === "bower_components" ) {
								System.configMain = "bower.json!bower";
								addProductionBundles.call(this);
								parts.pop();
								isFromPackage = true;
							}
							if (last(parts) === "node_modules") {
								System.configMain = "package.json!npm";
								addProductionBundles.call(this);
								parts.pop();
								isFromPackage = true;
							}
							if(!isFromPackage) {
								parts.push("steal");
							}
						}
						this.config({ baseURL: parts.join("/")+"/"});
					}
				}
				System.stealPath = dirname;
			}
		},
		stealURL: {
			order: 15,
			// http://domain.com/steal/steal.js?moduleName,env&
			set: function(url, cfg)	{
				var urlParts = url.split("?"),
					path = urlParts.shift(),
					paths = path.split("/"),
					lastPart = paths.pop(),
					stealPath = paths.join("/"),
					platform = this.getPlatform() || (isWebWorker ? "worker" : "window");

				System.stealURL = path;

				// if steal is bundled or we are loading steal.production
				// we always are in production environment
				if((this.stealBundled && this.stealBundled === true) ||
					((lastPart.indexOf("steal.production") > -1) ||
						(lastPart.indexOf("steal-sans-promises.production") > -1)
					 	&& !cfg.env)) {
					this.config({ env: platform+"-production" });
				}

				if(this.isEnv("production") || this.loadBundles) {
					addProductionBundles.call(this);
				}

				specialConfig.stealPath.set.call(this,stealPath, cfg);

			}
		},
		devBundle: {
			order: 16,

			set: function(dirname, cfg) {
				var path = (dirname === true) ? "dev-bundle" : dirname;

				if (path) {
					this.devBundle = path;
				}
			}
		},
		depsBundle: {
			order: 17,

			set: function(dirname, cfg) {
				var path = (dirname === true) ? "dev-bundle" : dirname;

				if (path) {
					this.depsBundle = path;
				}
			}
		}
	};

	/*
	 make a setter order
	 currently:

	 instantiated
	 envs
	 env
	 loadBundles
	 stealBundled
	 bundle
	 bundlesPath
	 meta
	 config
	 configPath
	 baseURL
	 main
	 stealPath
	 stealURL
	 */
	each(specialConfig, function(setter, name){
		if(!setter.order) {
			specialConfigOrder.push(name)
		}else{
			specialConfigOrder.splice(setter.order, 0, name);
		}
	});

	// special setter config
	setterConfig(System, specialConfigOrder, specialConfig);

	steal.config = function(cfg){
		if(typeof cfg === "string") {
			return this.loader[cfg];
		} else {
			this.loader.config(cfg);
		}
	};

// Steal Env Extension
// adds some special environment functions to the loader
addStealExtension(function (loader) {

	loader.getEnv = function(){
		var envParts = (this.env || "").split("-");
		// Fallback to this.env for legacy
		return envParts[1] || this.env;
	};

	loader.getPlatform = function(){
		var envParts = (this.env || "").split("-");
		return envParts.length === 2 ? envParts[0] : undefined;
	};

	loader.isEnv = function(name){
		return this.getEnv() === name;
	};

	loader.isPlatform = function(name){
		return this.getPlatform() === name;
	};
});
	// get config by the URL query
	// like ?main=foo&env=production
	// formally used for Webworkers
	var getQueryOptions = function(url) {
		var queryOptions = {},
			urlRegEx = /Url$/,
			urlParts = url.split("?"),
			path = urlParts.shift(),
			search = urlParts.join("?"),
			searchParts = search.split("&"),
			paths = path.split("/"),
			lastPart = paths.pop(),
			stealPath = paths.join("/");

		if(searchParts.length && searchParts[0].length) {
				var searchPart;
			for(var i =0; i < searchParts.length; i++) {
				searchPart = searchParts[i];
				var paramParts = searchPart.split("=");
				if(paramParts.length > 1) {
					var optionName = camelize(paramParts[0]);
					// make options uniform e.g. baseUrl => baseURL
					optionName = optionName.replace(urlRegEx, "URL")
					queryOptions[optionName] = paramParts.slice(1).join("=");
				}
			}
		}
		return queryOptions;
	};

	// extract the script tag options
	var getScriptOptions = function (script) {
		var scriptOptions = {},
			urlRegEx = /Url$/;

		scriptOptions.stealURL = script.src;

		each(script.attributes, function(attr){
			var nodeName = attr.nodeName || attr.name;
			// get option, remove "data" and camelize
			var optionName =
				camelize( nodeName.indexOf("data-") === 0 ?
					nodeName.replace("data-","") :
					nodeName );
			// make options uniform e.g. baseUrl => baseURL
			optionName = optionName.replace(urlRegEx, "URL")
			scriptOptions[optionName] = (attr.value === "") ? true : attr.value;
		});

		// main source within steals script is deprecated
		// and will be removed in future releases
		var source = script.innerHTML;
		if(/\S/.test(source)){
			scriptOptions.mainSource = source;
		}
		// script config ever wins!
		return extend(getQueryOptions(script.src), scriptOptions);
	};

	// get steal URL
	// if we are in a browser, we need to know which script is steal
	// to extract the script tag options => getScriptOptions()
	var getUrlOptions = function (){
		return new Promise(function(resolve, reject){

			// for Workers get options from steal query
			if (isWebWorker) {
				resolve(extend({
					stealURL: location.href
				}, getQueryOptions(location.href)));
				return;
			} else if(isBrowserWithWindow || isNW || isElectron) {
				// if the browser supports currentScript, use it!
				if (document.currentScript) {
					// get options from script tag and query
					resolve(getScriptOptions(document.currentScript));
					return;
				}
				// assume the last script on the page is the one loading steal.js
				else {
					var scripts = document.scripts;

					if (scripts.length) {
						resolve(getScriptOptions(scripts[scripts.length - 1]));
					}
				}
			} else {
				// or the only option is where steal is.
				resolve({
					stealPath: __dirname
				});
			}
		})
	};

	// configure and startup steal
	// load the main module(s) if everything is configured
	steal.startup = function(startupConfig){
		var steal = this;
		var loader = this.loader;
		var configResolve;
		var configReject;

		configPromise = new Promise(function(resolve, reject){
			configResolve = resolve;
			configReject = reject;
		});

		appPromise = getUrlOptions().then(function(urlOptions) {
			var config;

			if (typeof startupConfig === 'object') {
				// the url options are the source of truth
				config = extend(startupConfig, urlOptions);
			} else {
				config = urlOptions;
			}

			// set the config
			loader.config(config);

			setEnvsConfig.call(loader);

			// we only load things with force = true
			if (loader.loadBundles) {

				if (!loader.main && loader.isEnv("production") &&
					!loader.stealBundled) {
					// prevent this warning from being removed by Uglify
					warn("Attribute 'main' is required in production environment. Please add it to the script tag.");
				}

				loader["import"](loader.configMain)
				.then(configResolve, configReject);

				return configPromise.then(function (cfg) {
					setEnvsConfig.call(loader);
					return loader.main ? loader["import"](loader.main) : cfg;
				});

			} else {
				// devBundle includes the same modules as "depsBundle and it also
				// includes the @config graph, so it should be loaded before of
				// configMain
				loader["import"](loader.devBundle)
					.then(function() {
						return loader["import"](loader.configMain);
					})
					.then(function() {
						// depsBundle includes the dependencies in the node_modules
						// folder so it has to be loaded after configMain finished
						// loading
						return loader["import"](loader.depsBundle);
					})
					.then(configResolve, configReject);

				devPromise = configPromise.then(function () {
					setEnvsConfig.call(loader);
					setupLiveReload.call(loader);

					// If a configuration was passed to startup we'll use that to overwrite
					// what was loaded in stealconfig.js
					// This means we call it twice, but that's ok
					if (config) {
						loader.config(config);
					}

					return loader["import"]("@dev");
				});

				return devPromise.then(function () {
					// if there's a main, get it, otherwise, we are just loading
					// the config.
					if (!loader.main || loader.localLoader) {
						return configPromise;
					}
					var main = loader.main;
					if (typeof main === "string") {
						main = [main];
					}
					return Promise.all(map(main, function (main) {
						return loader["import"](main);
					}));
				});
			}
		}).then(function(main){
			if(loader.mainSource) {
				return loader.module(loader.mainSource);
			}

			// load script modules they are tagged as
			// text/steal-module
			loader.loadScriptModules();

			return main;
		});

		return appPromise;
	};
	steal.done = function(){
		return appPromise;
	};

	steal["import"] = function(){
		var names = arguments;
		var loader = this.System;

		function afterConfig(){
			var imports = [];
			each(names, function(name){
				imports.push(loader["import"](name));
			});
			if(imports.length > 1) {
				return Promise.all(imports);
			} else {
				return imports[0];
			}
		}

		if(!configPromise) {
			// In Node a main isn't required, but we still want
			// to call startup() to do autoconfiguration,
			// so setting to empty allows this to work.
			if(!loader.main) {
				loader.main = "@empty";
			}
			steal.startup();
		}

		return configPromise.then(afterConfig);
	};
	steal.setContextual = fBind.call(System.setContextual, System);
	steal.isEnv = fBind.call(System.isEnv, System);
	steal.isPlatform = fBind.call(System.isPlatform, System);
	return steal;

};
	if( isNode && !isNW && !isElectron ) {

		global.steal = makeSteal(System);
		global.steal.System = System;
		global.steal.dev = require("./ext/dev.js");
		steal.clone = cloneSteal;
		module.exports = global.steal;

	} else {
		var oldSteal = global.steal;
		global.steal = makeSteal(System);
		global.steal.startup(oldSteal && typeof oldSteal == 'object' && oldSteal)
			.then(null, function(error){
				if(typeof console !== "undefined") {
					// Hide from uglify
					var c = console;
					var type = c.error ? "error" : "log";
					c[type](error);
				}
			});
		global.steal.clone = cloneSteal;
	}

})(typeof window == "undefined" ? (typeof global === "undefined" ? this : global) : window);

/*[add-define]*/
((typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) ? self : window).define = System.amdDefine;
/*[system-bundles-config]*/
System.bundles = {};
/*npm-utils*/
define('npm-utils', function (require, exports, module) {
    (function (global, require, exports, module) {
        var slice = Array.prototype.slice;
        var npmModuleRegEx = /.+@.+\..+\..+#.+/;
        var conditionalModuleRegEx = /#\{[^\}]+\}|#\?.+$/;
        var gitUrlEx = /(git|http(s?)):\/\//;
        var supportsSet = typeof Set === 'function';
        var utils = {
            extend: function (d, s, deep, existingSet) {
                var val;
                var set = existingSet;
                if (deep) {
                    if (!set) {
                        if (supportsSet) {
                            set = new Set();
                        } else {
                            set = [];
                        }
                    }
                    if (supportsSet) {
                        if (set.has(s)) {
                            return s;
                        } else {
                            set.add(s);
                        }
                    } else {
                        if (set.indexOf(s) !== -1) {
                            return s;
                        } else {
                            set.push(s);
                        }
                    }
                }
                for (var prop in s) {
                    val = s[prop];
                    if (deep) {
                        if (utils.isArray(val)) {
                            d[prop] = slice.call(val);
                        } else if (utils.isPlainObject(val)) {
                            d[prop] = utils.extend({}, val, deep, set);
                        } else {
                            d[prop] = s[prop];
                        }
                    } else {
                        d[prop] = s[prop];
                    }
                }
                return d;
            },
            map: function (arr, fn) {
                var i = 0, len = arr.length, out = [];
                for (; i < len; i++) {
                    out.push(fn.call(arr, arr[i]));
                }
                return out;
            },
            filter: function (arr, fn) {
                var i = 0, len = arr.length, out = [], res;
                for (; i < len; i++) {
                    res = fn.call(arr, arr[i]);
                    if (res) {
                        out.push(arr[i]);
                    }
                }
                return out;
            },
            forEach: function (arr, fn) {
                var i = 0, len = arr.length;
                for (; i < len; i++) {
                    fn.call(arr, arr[i], i);
                }
            },
            isObject: function (obj) {
                return typeof obj === 'object';
            },
            isPlainObject: function (obj) {
                return utils.isObject(obj) && (!obj || obj.__proto__ === Object.prototype);
            },
            isArray: Array.isArray || function (arr) {
                return Object.prototype.toString.call(arr) === '[object Array]';
            },
            isEnv: function (name) {
                return this.isEnv ? this.isEnv(name) : this.env === name;
            },
            isGitUrl: function (str) {
                return gitUrlEx.test(str);
            },
            warnOnce: function (msg) {
                var w = this._warnings = this._warnings || {};
                if (w[msg])
                    return;
                w[msg] = true;
                this.warn(msg);
            },
            warn: function (msg) {
                if (typeof steal !== 'undefined' && typeof console !== 'undefined' && console.warn) {
                    steal.done().then(function () {
                        if (steal.dev && steal.dev.warn) {
                        } else if (console.warn) {
                            console.warn('steal.js WARNING: ' + msg);
                        } else {
                            console.log(msg);
                        }
                    });
                }
            },
            relativeURI: function (baseURL, url) {
                return typeof steal !== 'undefined' ? steal.relativeURI(baseURL, url) : url;
            },
            moduleName: {
                create: function (descriptor, standard) {
                    if (standard) {
                        return descriptor.moduleName;
                    } else {
                        if (descriptor === '@empty') {
                            return descriptor;
                        }
                        var modulePath;
                        if (descriptor.modulePath) {
                            modulePath = descriptor.modulePath.substr(0, 2) === './' ? descriptor.modulePath.substr(2) : descriptor.modulePath;
                        }
                        return descriptor.packageName + (descriptor.version ? '@' + descriptor.version : '') + (modulePath ? '#' + modulePath : '') + (descriptor.plugin ? descriptor.plugin : '');
                    }
                },
                isNpm: function (moduleName) {
                    return npmModuleRegEx.test(moduleName);
                },
                isConditional: function (moduleName) {
                    return conditionalModuleRegEx.test(moduleName);
                },
                isFullyConvertedNpm: function (parsedModuleName) {
                    return !!(parsedModuleName.packageName && parsedModuleName.version && parsedModuleName.modulePath);
                },
                isScoped: function (moduleName) {
                    return moduleName[0] === '@';
                },
                parse: function (moduleName, currentPackageName, global, context) {
                    var pluginParts = moduleName.split('!');
                    var modulePathParts = pluginParts[0].split('#');
                    var versionParts = modulePathParts[0].split('@');
                    if (!modulePathParts[1] && !versionParts[0]) {
                        versionParts = ['@' + versionParts[1]];
                    }
                    if (versionParts.length === 3 && utils.moduleName.isScoped(moduleName)) {
                        versionParts.splice(0, 1);
                        versionParts[0] = '@' + versionParts[0];
                    }
                    var packageName, modulePath;
                    if (currentPackageName && utils.path.isRelative(moduleName)) {
                        packageName = currentPackageName;
                        modulePath = versionParts[0];
                    } else if (currentPackageName && utils.path.isInHomeDir(moduleName, context)) {
                        packageName = currentPackageName;
                        modulePath = versionParts[0].split('/').slice(1).join('/');
                    } else {
                        if (modulePathParts[1]) {
                            packageName = versionParts[0];
                            modulePath = modulePathParts[1];
                        } else {
                            var folderParts = versionParts[0].split('/');
                            if (folderParts.length && folderParts[0][0] === '@') {
                                packageName = folderParts.splice(0, 2).join('/');
                            } else {
                                packageName = folderParts.shift();
                            }
                            modulePath = folderParts.join('/');
                        }
                    }
                    modulePath = utils.path.removeJS(modulePath);
                    return {
                        plugin: pluginParts.length === 2 ? '!' + pluginParts[1] : undefined,
                        version: versionParts[1],
                        modulePath: modulePath,
                        packageName: packageName,
                        moduleName: moduleName,
                        isGlobal: global
                    };
                },
                parseFromPackage: function (loader, refPkg, name, parentName) {
                    var packageName = utils.pkg.name(refPkg), parsedModuleName = utils.moduleName.parse(name, packageName, undefined, { loader: loader }), isRelative = utils.path.isRelative(parsedModuleName.modulePath);
                    if (isRelative && !parentName) {
                        throw new Error('Cannot resolve a relative module identifier ' + 'with no parent module:', name);
                    }
                    if (isRelative) {
                        var parentParsed = utils.moduleName.parse(parentName, packageName);
                        if (parentParsed.packageName === parsedModuleName.packageName && parentParsed.modulePath) {
                            var makePathRelative = true;
                            if (name === '../' || name === './' || name === '..') {
                                var relativePath = utils.path.relativeTo(parentParsed.modulePath, name);
                                var isInRoot = utils.path.isPackageRootDir(relativePath);
                                if (isInRoot) {
                                    parsedModuleName.modulePath = utils.pkg.main(refPkg);
                                    makePathRelative = false;
                                } else {
                                    parsedModuleName.modulePath = name + (utils.path.endsWithSlash(name) ? '' : '/') + 'index';
                                }
                            }
                            if (makePathRelative) {
                                parsedModuleName.modulePath = utils.path.makeRelative(utils.path.joinURIs(parentParsed.modulePath, parsedModuleName.modulePath));
                            }
                        }
                    }
                    var mapName = utils.moduleName.create(parsedModuleName), refSteal = utils.pkg.config(refPkg), mappedName;
                    if (refPkg.browser && typeof refPkg.browser !== 'string' && mapName in refPkg.browser && (!refSteal || !refSteal.ignoreBrowser)) {
                        mappedName = refPkg.browser[mapName] === false ? '@empty' : refPkg.browser[mapName];
                    }
                    var global = loader && loader.globalBrowser && loader.globalBrowser[mapName];
                    if (global) {
                        mappedName = global.moduleName === false ? '@empty' : global.moduleName;
                    }
                    if (mappedName) {
                        return utils.moduleName.parse(mappedName, packageName, !!global);
                    } else {
                        return parsedModuleName;
                    }
                },
                nameAndVersion: function (parsedModuleName) {
                    return parsedModuleName.packageName + '@' + parsedModuleName.version;
                },
                isBareIdentifier: function (identifier) {
                    return identifier && identifier[0] !== '.' && identifier[0] !== '@';
                }
            },
            pkg: {
                name: function (pkg) {
                    var steal = utils.pkg.config(pkg);
                    return steal && steal.name || pkg.name;
                },
                main: function (pkg) {
                    var main;
                    var steal = utils.pkg.config(pkg);
                    if (steal && steal.main) {
                        main = steal.main;
                    } else if (typeof pkg.browser === 'string') {
                        if (utils.path.endsWithSlash(pkg.browser)) {
                            main = pkg.browser + 'index';
                        } else {
                            main = pkg.browser;
                        }
                    } else if (typeof pkg.jam === 'object' && pkg.jam.main) {
                        main = pkg.jam.main;
                    } else if (pkg.main) {
                        main = pkg.main;
                    } else {
                        main = 'index';
                    }
                    return utils.path.removeJS(utils.path.removeDotSlash(main));
                },
                rootDir: function (pkg, isRoot) {
                    var root = isRoot ? utils.path.removePackage(pkg.fileUrl) : utils.path.pkgDir(pkg.fileUrl);
                    var lib = utils.pkg.directoriesLib(pkg);
                    if (lib) {
                        root = utils.path.joinURIs(utils.path.addEndingSlash(root), lib);
                    }
                    return root;
                },
                isRoot: function (loader, pkg) {
                    var root = utils.pkg.getDefault(loader);
                    return pkg.name === root.name && pkg.version === root.version;
                },
                homeAlias: function (context) {
                    return context && context.loader && context.loader.homeAlias || '~';
                },
                getDefault: function (loader) {
                    return loader.npmPaths.__default;
                },
                findByModuleNameOrAddress: function (loader, moduleName, moduleAddress) {
                    if (loader.npm) {
                        if (moduleName) {
                            var parsed = utils.moduleName.parse(moduleName);
                            if (parsed.version && parsed.packageName) {
                                var name = parsed.packageName + '@' + parsed.version;
                                if (name in loader.npm) {
                                    return loader.npm[name];
                                }
                            }
                        }
                        if (moduleAddress) {
                            var startingAddress = utils.relativeURI(loader.baseURL, moduleAddress);
                            var packageFolder = utils.pkg.folderAddress(startingAddress);
                            return packageFolder ? loader.npmPaths[packageFolder] : utils.pkg.getDefault(loader);
                        } else {
                            return utils.pkg.getDefault(loader);
                        }
                    }
                },
                folderAddress: function (address) {
                    var nodeModules = '/node_modules/', nodeModulesIndex = address.lastIndexOf(nodeModules), nextSlash = address.indexOf('/', nodeModulesIndex + nodeModules.length);
                    if (nodeModulesIndex >= 0) {
                        return nextSlash >= 0 ? address.substr(0, nextSlash) : address;
                    }
                },
                findDep: function (loader, refPkg, name) {
                    if (loader.npm && refPkg && !utils.path.startsWithDotSlash(name)) {
                        var nameAndVersion = name + '@' + refPkg.resolutions[name];
                        var pkg = loader.npm[nameAndVersion];
                        return pkg;
                    }
                },
                findDepWalking: function (loader, refPackage, name) {
                    if (loader.npm && refPackage && !utils.path.startsWithDotSlash(name)) {
                        var curPackage = utils.path.depPackageDir(refPackage.fileUrl, name);
                        while (curPackage) {
                            var pkg = loader.npmPaths[curPackage];
                            if (pkg) {
                                return pkg;
                            }
                            var parentAddress = utils.path.parentNodeModuleAddress(curPackage);
                            if (!parentAddress) {
                                return;
                            }
                            curPackage = parentAddress + '/' + name;
                        }
                    }
                },
                findByName: function (loader, name) {
                    if (loader.npm && !utils.path.startsWithDotSlash(name)) {
                        return loader.npm[name];
                    }
                },
                findByNameAndVersion: function (loader, name, version) {
                    if (loader.npm && !utils.path.startsWithDotSlash(name)) {
                        var nameAndVersion = name + '@' + version;
                        return loader.npm[nameAndVersion];
                    }
                },
                findByUrl: function (loader, url) {
                    if (loader.npm) {
                        var fullUrl = utils.pkg.folderAddress(url);
                        return loader.npmPaths[fullUrl];
                    }
                },
                directoriesLib: function (pkg) {
                    var steal = utils.pkg.config(pkg);
                    var lib = steal && steal.directories && steal.directories.lib;
                    var ignores = [
                            '.',
                            '/'
                        ], ignore;
                    if (!lib)
                        return undefined;
                    while (!!(ignore = ignores.shift())) {
                        if (lib[0] === ignore) {
                            lib = lib.substr(1);
                        }
                    }
                    return lib;
                },
                hasDirectoriesLib: function (pkg) {
                    var steal = utils.pkg.config(pkg);
                    return steal && steal.directories && !!steal.directories.lib;
                },
                findPackageInfo: function (context, pkg) {
                    var pkgInfo = context.pkgInfo;
                    if (pkgInfo) {
                        var out;
                        utils.forEach(pkgInfo, function (p) {
                            if (pkg.name === p.name && pkg.version === p.version) {
                                out = p;
                            }
                        });
                        return out;
                    }
                },
                saveResolution: function (context, refPkg, pkg) {
                    var npmPkg = utils.pkg.findPackageInfo(context, refPkg);
                    npmPkg.resolutions[pkg.name] = refPkg.resolutions[pkg.name] = pkg.version;
                },
                config: function (pkg) {
                    return pkg.steal || pkg.system;
                }
            },
            path: {
                makeRelative: function (path) {
                    if (utils.path.isRelative(path) && path.substr(0, 1) !== '/') {
                        return path;
                    } else {
                        return './' + path;
                    }
                },
                removeJS: function (path) {
                    return path.replace(/\.js(!|$)/, function (whole, part) {
                        return part;
                    });
                },
                removePackage: function (path) {
                    return path.replace(/\/package\.json.*/, '');
                },
                addJS: function (path) {
                    if (/\.js(on)?$/.test(path)) {
                        return path;
                    } else {
                        return path + '.js';
                    }
                },
                isRelative: function (path) {
                    return path.substr(0, 1) === '.';
                },
                isInHomeDir: function (path, context) {
                    return path.substr(0, 2) === utils.pkg.homeAlias(context) + '/';
                },
                joinURIs: function (baseUri, rel) {
                    function removeDotSegments(input) {
                        var output = [];
                        input.replace(/^(\.\.?(\/|$))+/, '').replace(/\/(\.(\/|$))+/g, '/').replace(/\/\.\.$/, '/../').replace(/\/?[^\/]*/g, function (p) {
                            if (p === '/..') {
                                output.pop();
                            } else {
                                output.push(p);
                            }
                        });
                        return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
                    }
                    var href = parseURI(rel || '');
                    var base = parseURI(baseUri || '');
                    return !href || !base ? null : (href.protocol || base.protocol) + (href.protocol || href.authority ? href.authority : base.authority) + removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : href.pathname ? (base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname : base.pathname) + (href.protocol || href.authority || href.pathname ? href.search : href.search || base.search) + href.hash;
                },
                startsWithDotSlash: function (path) {
                    return path.substr(0, 2) === './';
                },
                removeDotSlash: function (path) {
                    return utils.path.startsWithDotSlash(path) ? path.substr(2) : path;
                },
                endsWithSlash: function (path) {
                    return path[path.length - 1] === '/';
                },
                addEndingSlash: function (path) {
                    return utils.path.endsWithSlash(path) ? path : path + '/';
                },
                depPackage: function (parentPackageAddress, childName) {
                    var packageFolderName = parentPackageAddress.replace(/\/package\.json.*/, '');
                    return (packageFolderName ? packageFolderName + '/' : '') + 'node_modules/' + childName + '/package.json';
                },
                peerPackage: function (parentPackageAddress, childName) {
                    var packageFolderName = parentPackageAddress.replace(/\/package\.json.*/, '');
                    return packageFolderName.substr(0, packageFolderName.lastIndexOf('/')) + '/' + childName + '/package.json';
                },
                depPackageDir: function (parentPackageAddress, childName) {
                    return utils.path.depPackage(parentPackageAddress, childName).replace(/\/package\.json.*/, '');
                },
                peerNodeModuleAddress: function (address) {
                    var nodeModules = '/node_modules/', nodeModulesIndex = address.lastIndexOf(nodeModules);
                    if (nodeModulesIndex >= 0) {
                        return address.substr(0, nodeModulesIndex + nodeModules.length - 1);
                    }
                },
                parentNodeModuleAddress: function (address) {
                    var nodeModules = '/node_modules/', nodeModulesIndex = address.lastIndexOf(nodeModules), prevModulesIndex = address.lastIndexOf(nodeModules, nodeModulesIndex - 1);
                    if (prevModulesIndex >= 0) {
                        return address.substr(0, prevModulesIndex + nodeModules.length - 1);
                    }
                },
                pkgDir: function (address) {
                    var nodeModules = '/node_modules/', nodeModulesIndex = address.lastIndexOf(nodeModules), nextSlash = address.indexOf('/', nodeModulesIndex + nodeModules.length);
                    if (address[nodeModulesIndex + nodeModules.length] === '@') {
                        nextSlash = address.indexOf('/', nextSlash + 1);
                    }
                    if (nodeModulesIndex >= 0) {
                        return nextSlash >= 0 ? address.substr(0, nextSlash) : address;
                    }
                },
                basename: function (address) {
                    var parts = address.split('/');
                    return parts[parts.length - 1];
                },
                relativeTo: function (modulePath, rel) {
                    var parts = modulePath.split('/');
                    var idx = 1;
                    while (rel[idx] === '.') {
                        parts.pop();
                        idx++;
                    }
                    return parts.join('/');
                },
                isPackageRootDir: function (pth) {
                    return pth.indexOf('/') === -1;
                }
            },
            json: {
                transform: function (loader, load, data) {
                    data.steal = utils.pkg.config(data);
                    var fn = loader.jsonOptions && loader.jsonOptions.transform;
                    if (!fn)
                        return data;
                    return fn.call(loader, load, data);
                }
            },
            includeInBuild: true
        };
        function parseURI(url) {
            var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@\/]*(?::[^:@\/]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
            return m ? {
                href: m[0] || '',
                protocol: m[1] || '',
                authority: m[2] || '',
                host: m[3] || '',
                hostname: m[4] || '',
                port: m[5] || '',
                pathname: m[6] || '',
                search: m[7] || '',
                hash: m[8] || ''
            } : null;
        }
        module.exports = utils;
    }(function () {
        return this;
    }(), require, exports, module));
});
/*npm-extension*/
define('npm-extension', [
    'require',
    'exports',
    'module',
    '@steal',
    './npm-utils'
], function (require, exports, module) {
    (function (global, require, exports, module) {
        'format cjs';
        var steal = require('@steal');
        var utils = require('./npm-utils');
        exports.includeInBuild = true;
        var isNode = typeof process === 'object' && {}.toString.call(process) === '[object process]';
        var isWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
        var isBrowser = typeof window !== 'undefined' && !isNode && !isWorker;
        exports.addExtension = function (System) {
            if (System._extensions) {
                System._extensions.push(exports.addExtension);
            }
            var oldNormalize = System.normalize;
            System.normalize = function (identifier, parentModuleName, parentAddress, pluginNormalize) {
                var name = identifier;
                var parentName = parentModuleName;
                if (parentName && this.npmParentMap && this.npmParentMap[parentName]) {
                    parentName = this.npmParentMap[parentName];
                }
                var hasNoParent = !parentName;
                var nameIsRelative = utils.path.isRelative(name);
                var parentIsNpmModule = utils.moduleName.isNpm(parentName);
                var identifierEndsWithSlash = utils.path.endsWithSlash(name);
                if (parentName && nameIsRelative && !parentIsNpmModule) {
                    return oldNormalize.call(this, name, parentName, parentAddress, pluginNormalize);
                }
                if (utils.moduleName.isConditional(name)) {
                    return oldNormalize.call(this, name, parentName, parentAddress, pluginNormalize);
                }
                var hasContextualMap = typeof this.map[parentName] === 'object' && this.map[parentName][name];
                if (hasContextualMap) {
                    return oldNormalize.call(this, name, parentName, parentAddress, pluginNormalize);
                }
                var refPkg = utils.pkg.findByModuleNameOrAddress(this, parentName, parentAddress);
                if (!refPkg) {
                    return oldNormalize.call(this, name, parentName, parentAddress, pluginNormalize);
                }
                var isPointingAtParentFolder = name === '../' || name === './';
                if (parentIsNpmModule && isPointingAtParentFolder) {
                    var parsedParentModuleName = utils.moduleName.parse(parentName);
                    var parentModulePath = parsedParentModuleName.modulePath || '';
                    var relativePath = utils.path.relativeTo(parentModulePath, name);
                    var isInRoot = utils.path.isPackageRootDir(relativePath);
                    if (isInRoot) {
                        name = refPkg.name + '#' + utils.path.removeJS(refPkg.main);
                    } else {
                        name = name + 'index';
                    }
                }
                var parsedModuleName = utils.moduleName.parseFromPackage(this, refPkg, name, parentName);
                var isRoot = utils.pkg.isRoot(this, refPkg);
                var parsedPackageNameIsReferringPackage = parsedModuleName.packageName === refPkg.name;
                var isRelativeToParentNpmModule = parentIsNpmModule && nameIsRelative && parsedPackageNameIsReferringPackage;
                var depPkg, wantedPkg;
                if (isRelativeToParentNpmModule) {
                    depPkg = refPkg;
                }
                var context = this.npmContext;
                var crawl = context && context.crawl;
                var isDev = !!crawl;
                if (!depPkg) {
                    if (crawl) {
                        var parentPkg = nameIsRelative ? null : crawl.matchedVersion(context, refPkg.name, refPkg.version);
                        if (parentPkg) {
                            var depMap = crawl.getFullDependencyMap(this, parentPkg, isRoot);
                            wantedPkg = depMap[parsedModuleName.packageName];
                            if (wantedPkg) {
                                var wantedVersion = refPkg.resolutions && refPkg.resolutions[wantedPkg.name] || wantedPkg.version;
                                var foundPkg = crawl.matchedVersion(this.npmContext, wantedPkg.name, wantedVersion);
                                if (foundPkg) {
                                    depPkg = utils.pkg.findByUrl(this, foundPkg.fileUrl);
                                }
                            }
                        }
                    } else {
                        if (isRoot) {
                            depPkg = utils.pkg.findDepWalking(this, refPkg, parsedModuleName.packageName);
                        } else {
                            depPkg = utils.pkg.findDep(this, refPkg, parsedModuleName.packageName);
                        }
                    }
                }
                if (parsedPackageNameIsReferringPackage) {
                    depPkg = utils.pkg.findByNameAndVersion(this, parsedModuleName.packageName, refPkg.version);
                }
                var lookupByName = parsedModuleName.isGlobal || hasNoParent;
                if (!depPkg) {
                    depPkg = utils.pkg.findByName(this, parsedModuleName.packageName);
                }
                var isThePackageWeWant = !isDev || !depPkg || (wantedPkg ? crawl.pkgSatisfies(depPkg, wantedPkg.version) : true);
                if (!isThePackageWeWant) {
                    depPkg = undefined;
                } else if (isDev && depPkg) {
                    utils.pkg.saveResolution(context, refPkg, depPkg);
                }
                if (!depPkg) {
                    var browserPackageName = this.globalBrowser[parsedModuleName.packageName];
                    if (browserPackageName) {
                        parsedModuleName.packageName = browserPackageName.moduleName;
                        depPkg = utils.pkg.findByName(this, parsedModuleName.packageName);
                    }
                }
                if (!depPkg && isRoot && name === refPkg.main && utils.pkg.hasDirectoriesLib(refPkg)) {
                    parsedModuleName.version = refPkg.version;
                    parsedModuleName.packageName = refPkg.name;
                    parsedModuleName.modulePath = utils.pkg.main(refPkg);
                    return oldNormalize.call(this, utils.moduleName.create(parsedModuleName), parentName, parentAddress, pluginNormalize);
                }
                var loader = this;
                if (!depPkg) {
                    if (crawl) {
                        var parentPkg = crawl.matchedVersion(this.npmContext, refPkg.name, refPkg.version);
                        if (parentPkg) {
                            var depMap = crawl.getFullDependencyMap(this, parentPkg, isRoot);
                            depPkg = depMap[parsedModuleName.packageName];
                            if (!depPkg) {
                                var parents = crawl.findPackageAndParents(this.npmContext, parsedModuleName.packageName);
                                if (parents) {
                                    depPkg = parents.package;
                                }
                            }
                        }
                    }
                    if (!depPkg) {
                        if (refPkg.browser && refPkg.browser[name]) {
                            return oldNormalize.call(this, refPkg.browser[name], parentName, parentAddress, pluginNormalize);
                        }
                        var steal = utils.pkg.config(refPkg);
                        if (steal && steal.map && typeof steal.map[name] === 'string') {
                            return loader.normalize(steal.map[name], parentName, parentAddress, pluginNormalize);
                        } else {
                            return oldNormalize.call(this, name, parentName, parentAddress, pluginNormalize);
                        }
                    }
                    return crawl.dep(this.npmContext, parentPkg, refPkg, depPkg, isRoot).then(createModuleNameAndNormalize);
                } else {
                    return createModuleNameAndNormalize(depPkg);
                }
                function createModuleNameAndNormalize(depPkg) {
                    parsedModuleName.version = depPkg.version;
                    if (!parsedModuleName.modulePath) {
                        parsedModuleName.modulePath = utils.pkg.main(depPkg);
                    }
                    var p = oldNormalize.call(loader, utils.moduleName.create(parsedModuleName), parentName, parentAddress, pluginNormalize);
                    if (identifierEndsWithSlash) {
                        p.then(function (name) {
                            if (context && context.forwardSlashMap) {
                                context.forwardSlashMap[name] = true;
                            }
                        });
                    }
                    return p;
                }
            };
            var oldLocate = System.locate;
            System.locate = function (load) {
                var parsedModuleName = utils.moduleName.parse(load.name), loader = this;
                load.metadata.parsedModuleName = parsedModuleName;
                if (parsedModuleName.version && this.npm && !loader.paths[load.name]) {
                    var pkg = this.npm[utils.moduleName.nameAndVersion(parsedModuleName)];
                    if (pkg) {
                        return oldLocate.call(this, load).then(function (locatedAddress) {
                            var address = locatedAddress;
                            var expectedAddress = utils.path.joinURIs(System.baseURL, load.name);
                            if (isBrowser) {
                                expectedAddress = expectedAddress.replace(/#/g, '%23');
                            }
                            if (address !== expectedAddress + '.js' && address !== expectedAddress) {
                                return address;
                            }
                            var root = utils.pkg.rootDir(pkg, utils.pkg.isRoot(loader, pkg));
                            if (parsedModuleName.modulePath) {
                                var npmAddress = utils.path.joinURIs(utils.path.addEndingSlash(root), parsedModuleName.plugin ? parsedModuleName.modulePath : utils.path.addJS(parsedModuleName.modulePath));
                                address = typeof steal !== 'undefined' ? utils.path.joinURIs(loader.baseURL, npmAddress) : npmAddress;
                            }
                            return address;
                        });
                    }
                }
                return oldLocate.call(this, load);
            };
            var oldFetch = System.fetch;
            System.fetch = function (load) {
                if (load.metadata.dryRun) {
                    return oldFetch.apply(this, arguments);
                }
                var loader = this;
                var context = loader.npmContext;
                var fetchPromise = Promise.resolve(oldFetch.apply(this, arguments));
                if (utils.moduleName.isNpm(load.name)) {
                    fetchPromise = fetchPromise.then(null, function (err) {
                        if (err.statusCode !== 404) {
                            return Promise.reject(err);
                        }
                        var types = [].slice.call(retryTypes);
                        return retryAll(types, err);
                        function retryAll(types, err) {
                            if (!types.length) {
                                throw err;
                            }
                            var type = types.shift();
                            if (!type.test(load)) {
                                throw err;
                            }
                            return Promise.resolve(retryFetch.call(loader, load, type)).then(null, function (err) {
                                return retryAll(types, err);
                            });
                        }
                    });
                }
                return fetchPromise.catch(function (error) {
                    if (error.statusCode === 404 && utils.moduleName.isBareIdentifier(load.name)) {
                        throw new Error([
                            'Could not load \'' + load.name + '\'',
                            'Is this an npm module not saved in your package.json?'
                        ].join('\n'));
                    } else {
                        throw error;
                    }
                });
            };
            var convertName = function (loader, name) {
                var pkg = utils.pkg.findByName(loader, name.split('/')[0]);
                if (pkg) {
                    var parsed = utils.moduleName.parse(name, pkg.name);
                    parsed.version = pkg.version;
                    if (!parsed.modulePath) {
                        parsed.modulePath = utils.pkg.main(pkg);
                    }
                    return utils.moduleName.create(parsed);
                }
                return name;
            };
            var configSpecial = {
                map: function (map) {
                    var newMap = {}, val;
                    for (var name in map) {
                        val = map[name];
                        newMap[convertName(this, name)] = typeof val === 'object' ? configSpecial.map(val) : convertName(this, val);
                    }
                    return newMap;
                },
                meta: function (map) {
                    var newMap = {};
                    for (var name in map) {
                        newMap[convertName(this, name)] = map[name];
                    }
                    return newMap;
                },
                paths: function (paths) {
                    var newPaths = {};
                    for (var name in paths) {
                        newPaths[convertName(this, name)] = paths[name];
                    }
                    return newPaths;
                }
            };
            var oldConfig = System.config;
            System.config = function (cfg) {
                var loader = this;
                if (loader.npmContext) {
                    var context = loader.npmContext;
                    var pkg = context.versions.__default;
                    context.convert.steal(context, pkg, cfg, true, false, false);
                    oldConfig.apply(loader, arguments);
                    return;
                }
                for (var name in cfg) {
                    if (configSpecial[name]) {
                        cfg[name] = configSpecial[name].call(loader, cfg[name]);
                    }
                }
                oldConfig.apply(loader, arguments);
            };
            steal.addNpmPackages = function (npmPackages) {
                var packages = npmPackages || [];
                var loader = this.loader;
                for (var i = 0; i < packages.length; i += 1) {
                    var pkg = packages[i];
                    var path = pkg && pkg.fileUrl;
                    if (path) {
                        loader.npmContext.paths[path] = pkg;
                    }
                }
            };
            steal.getNpmPackages = function () {
                var context = this.loader.npmContext;
                return context ? context.packages || [] : [];
            };
            function retryFetch(load, type) {
                var loader = this;
                var moduleName = typeof type.name === 'function' ? type.name(loader, load) : load.name + type.name;
                var local = utils.extend({}, load);
                local.name = moduleName;
                local.metadata = { dryRun: true };
                return Promise.resolve(loader.locate(local)).then(function (address) {
                    local.address = address;
                    return loader.fetch(local);
                }).then(function (source) {
                    load.metadata.address = local.address;
                    loader.npmParentMap[load.name] = local.name;
                    var npmLoad = loader.npmContext && loader.npmContext.npmLoad;
                    if (npmLoad) {
                        npmLoad.saveLoadIfNeeded(loader.npmContext);
                        if (!isNode) {
                            utils.warnOnce('Some 404s were encountered ' + 'while loading. Don\'t panic! ' + 'These will only happen in dev ' + 'and are harmless.');
                        }
                    }
                    return source;
                });
            }
            var retryTypes = [
                {
                    name: function (loader, load) {
                        var context = loader.npmContext;
                        if (context.forwardSlashMap[load.name]) {
                            var parts = load.name.split('/');
                            parts.pop();
                            return parts.concat(['index']).join('/');
                        }
                        return load.name + '/index';
                    },
                    test: function () {
                        return true;
                    }
                },
                {
                    name: '.json',
                    test: function (load) {
                        return utils.moduleName.isNpm(load.name) && utils.path.basename(load.address) === 'package.js';
                    }
                }
            ];
        };
    }(function () {
        return this;
    }(), require, exports, module));
});
/*config*/
define('config', function (require, exports, module) {
    const IS_NODE = typeof process === 'object' && {}.toString.call(process) === '[object process]';
    const env = IS_NODE ? process.env.NODE_ENV : window.System.env;
    const IS_PRODUCTION = /production$/.test(env);
    const IS_BUILD = IS_NODE && /build$/.test(process.argv[1]);
    const systemConfig = {};
    if (IS_BUILD || IS_PRODUCTION) {
        Object.assign(systemConfig, {
            map: {
                'react': 'react/umd/react.production.min',
                'react-dom': 'react-dom/umd/react-dom.production.min',
                'styled-components': 'styled-components/dist/styled-components.min'
            }
        });
    }
    module.exports = { systemConfig };
});
/*npm-load*/
define('npm-load', [], function(){ return {}; });
/*semver*/
define('semver', [], function(){ return {}; });
/*npm-crawl*/
define('npm-crawl', [], function(){ return {}; });
/*npm-convert*/
define('npm-convert', [], function(){ return {}; });
/*npm*/
define('npm', [], function(){ return {}; });
/*package.json!npm*/
define('package.json!npm', [
    '@loader',
    'npm-extension',
    'module',
    './config',
    './config'
], function (loader, npmExtension, module) {
    npmExtension.addExtension(loader);
    if (!loader.main) {
        loader.main = 'steal-styled-components-bug@1.0.0#public/index';
    }
    loader._npmExtensions = [].slice.call(arguments, 2);
    (function (loader, packages, options) {
        var g = loader.global;
        if (!g.process) {
            g.process = {
                argv: [],
                cwd: function () {
                    var baseURL = loader.baseURL;
                    return baseURL;
                },
                browser: true,
                env: { NODE_ENV: loader.env },
                version: '',
                platform: navigator && navigator.userAgent && /Windows/.test(navigator.userAgent) ? 'win' : ''
            };
        }
        if (!loader.npm) {
            loader.npm = {};
            loader.npmPaths = {};
            loader.globalBrowser = {};
        }
        if (!loader.npmParentMap) {
            loader.npmParentMap = options.npmParentMap || {};
        }
        var rootPkg = loader.npmPaths.__default = packages[0];
        var rootConfig = rootPkg.steal || rootPkg.system;
        var lib = rootConfig && rootConfig.directories && rootConfig.directories.lib;
        var setGlobalBrowser = function (globals, pkg) {
            for (var name in globals) {
                loader.globalBrowser[name] = {
                    pkg: pkg,
                    moduleName: globals[name]
                };
            }
        };
        var setInNpm = function (name, pkg) {
            if (!loader.npm[name]) {
                loader.npm[name] = pkg;
            }
            loader.npm[name + '@' + pkg.version] = pkg;
        };
        var forEach = function (arr, fn) {
            var i = 0, len = arr.length;
            for (; i < len; i++) {
                res = fn.call(arr, arr[i], i);
                if (res === false)
                    break;
            }
        };
        var setupLiveReload = function () {
            if (loader.liveReloadInstalled) {
                loader['import']('live-reload', { name: module.id }).then(function (reload) {
                    reload.dispose(function () {
                        var pkgInfo = loader.npmContext.pkgInfo;
                        delete pkgInfo[rootPkg.name + '@' + rootPkg.version];
                        var idx = -1;
                        forEach(pkgInfo, function (pkg, i) {
                            if (pkg.name === rootPkg.name && pkg.version === rootPkg.version) {
                                idx = i;
                                return false;
                            }
                        });
                        pkgInfo.splice(idx, 1);
                    });
                });
            }
        };
        var ignoredConfig = [
            'bundle',
            'configDependencies',
            'transpiler'
        ];
        packages.reverse();
        forEach(packages, function (pkg) {
            var steal = pkg.steal || pkg.system;
            if (steal) {
                var main = steal.main;
                delete steal.main;
                var configDeps = steal.configDependencies;
                if (pkg !== rootPkg) {
                    forEach(ignoredConfig, function (name) {
                        delete steal[name];
                    });
                }
                loader.config(steal);
                if (pkg === rootPkg) {
                    steal.configDependencies = configDeps;
                }
                steal.main = main;
            }
            if (pkg.globalBrowser) {
                var doNotApplyGlobalBrowser = pkg.name === 'steal' && rootConfig.builtins === false;
                if (!doNotApplyGlobalBrowser) {
                    setGlobalBrowser(pkg.globalBrowser, pkg);
                }
            }
            var systemName = steal && steal.name;
            if (systemName) {
                setInNpm(systemName, pkg);
            } else {
                setInNpm(pkg.name, pkg);
            }
            if (!loader.npm[pkg.name]) {
                loader.npm[pkg.name] = pkg;
            }
            loader.npm[pkg.name + '@' + pkg.version] = pkg;
            var pkgAddress = pkg.fileUrl.replace(/\/package\.json.*/, '');
            loader.npmPaths[pkgAddress] = pkg;
        });
        setupLiveReload();
        forEach(loader._npmExtensions || [], function (ext) {
            if (ext.systemConfig) {
                loader.config(ext.systemConfig);
            }
        });
    }(loader, [
        {
            'name': 'steal-styled-components-bug',
            'version': '1.0.0',
            'fileUrl': './package.json',
            'main': 'public/index.js',
            'steal': {
                'configDependencies': ['./config'],
                'npmAlgorithm': 'flat'
            },
            'resolutions': {
                'steal-styled-components-bug': '1.0.0',
                'react-dom': '16.0.0',
                'styled-components': '2.2.3',
                'react': '16.0.0'
            }
        },
        {
            'name': 'react-dom',
            'version': '16.0.0',
            'fileUrl': './node_modules/react-dom/package.json',
            'main': 'index.js',
            'browser': { 'react-dom#server': 'react-dom#server.browser' },
            'resolutions': {}
        },
        {
            'name': 'styled-components',
            'version': '2.2.3',
            'fileUrl': './node_modules/styled-components/package.json',
            'main': 'lib/index.js',
            'resolutions': {}
        },
        {
            'name': 'react',
            'version': '16.0.0',
            'fileUrl': './node_modules/react/package.json',
            'main': 'index.js',
            'browser': { 'transform': ['loose-envify'] },
            'resolutions': {}
        }
    ], { 'npmParentMap': {} }));
});
/*react@16.0.0#umd/react.production.min*/
'use strict';
function y() {
    function q() {
    }
    function n(a, b, c, d, e, f, g) {
        return {
            $$typeof: J,
            type: a,
            key: b,
            ref: c,
            props: g,
            _owner: f
        };
    }
    function z(a) {
        for (var b = arguments.length - 1, c = 'Minified React error #' + a + '; visit http://facebook.github.io/react/docs/error-decoder.html?invariant=' + a, d = 0; d < b; d++)
            c += '&args[]=' + encodeURIComponent(arguments[d + 1]);
        b = Error(c + ' for the full message or use the non-minified dev environment for full errors and additional helpful warnings.');
        b.name = 'Invariant Violation';
        b.framesToPop = 1;
        throw b;
    }
    function r(a, b, c) {
        this.props = a;
        this.context = b;
        this.refs = A;
        this.updater = c || B;
    }
    function C(a, b, c) {
        this.props = a;
        this.context = b;
        this.refs = A;
        this.updater = c || B;
    }
    function D() {
    }
    function E(a, b, c) {
        this.props = a;
        this.context = b;
        this.refs = A;
        this.updater = c || B;
    }
    function v(a) {
        return function () {
            return a;
        };
    }
    function R(a) {
        var b = {
            '=': '=0',
            ':': '=2'
        };
        return '$' + ('' + a).replace(/[=:]/g, function (a) {
            return b[a];
        });
    }
    function K(a, b, c, d) {
        if (w.length) {
            var e = w.pop();
            e.result = a;
            e.keyPrefix = b;
            e.func = c;
            e.context = d;
            e.count = 0;
            return e;
        }
        return {
            result: a,
            keyPrefix: b,
            func: c,
            context: d,
            count: 0
        };
    }
    function L(a) {
        a.result = null;
        a.keyPrefix = null;
        a.func = null;
        a.context = null;
        a.count = 0;
        10 > w.length && w.push(a);
    }
    function u(a, b, c, d) {
        var e = typeof a;
        if ('undefined' === e || 'boolean' === e)
            a = null;
        if (null === a || 'string' === e || 'number' === e || 'object' === e && a.$$typeof === S)
            return c(d, a, '' === b ? '.' + F(a, 0) : b), 1;
        var f = 0;
        b = '' === b ? '.' : b + ':';
        if (Array.isArray(a))
            for (var g = 0; g < a.length; g++) {
                e = a[g];
                var h = b + F(e, g);
                f += u(e, h, c, d);
            }
        else if (h = M && a[M] || a['@@iterator'], 'function' === typeof h)
            for (a = h.call(a), g = 0; !(e = a.next()).done;)
                e = e.value, h = b + F(e, g++), f += u(e, h, c, d);
        else
            'object' === e && (c = '' + a, z('31', '[object Object]' === c ? 'object with keys {' + Object.keys(a).join(', ') + '}' : c, ''));
        return f;
    }
    function F(a, b) {
        return 'object' === typeof a && null !== a && null != a.key ? R(a.key) : b.toString(36);
    }
    function T(a, b) {
        a.func.call(a.context, b, a.count++);
    }
    function U(a, b, c) {
        var d = a.result, e = a.keyPrefix;
        a = a.func.call(a.context, b, a.count++);
        Array.isArray(a) ? G(a, d, c, H.thatReturnsArgument) : null != a && (t.isValidElement(a) && (a = t.cloneAndReplaceKey(a, e + (!a.key || b && b.key === a.key ? '' : ('' + a.key).replace(N, '$&/') + '/') + c)), d.push(a));
    }
    function G(a, b, c, d, e) {
        var f = '';
        null != c && (f = ('' + c).replace(N, '$&/') + '/');
        b = K(b, f, d, e);
        null == a || u(a, '', U, b);
        L(b);
    }
    var O = Object.getOwnPropertySymbols, V = Object.prototype.hasOwnProperty, W = Object.prototype.propertyIsEnumerable, x = function () {
            try {
                if (!Object.assign)
                    return !1;
                var a = new String('abc');
                a[5] = 'de';
                if ('5' === Object.getOwnPropertyNames(a)[0])
                    return !1;
                var b = {};
                for (a = 0; 10 > a; a++)
                    b['_' + String.fromCharCode(a)] = a;
                if ('0123456789' !== Object.getOwnPropertyNames(b).map(function (a) {
                        return b[a];
                    }).join(''))
                    return !1;
                var c = {};
                'abcdefghijklmnopqrst'.split('').forEach(function (a) {
                    c[a] = a;
                });
                return 'abcdefghijklmnopqrst' !== Object.keys(Object.assign({}, c)).join('') ? !1 : !0;
            } catch (d) {
                return !1;
            }
        }() ? Object.assign : function (a, b) {
            if (null === a || void 0 === a)
                throw new TypeError('Object.assign cannot be called with null or undefined');
            var c = Object(a);
            for (var d, e = 1; e < arguments.length; e++) {
                var f = Object(arguments[e]);
                for (var g in f)
                    V.call(f, g) && (c[g] = f[g]);
                if (O) {
                    d = O(f);
                    for (var h = 0; h < d.length; h++)
                        W.call(f, d[h]) && (c[d[h]] = f[d[h]]);
                }
            }
            return c;
        }, B = {
            isMounted: function () {
                return !1;
            },
            enqueueForceUpdate: function () {
            },
            enqueueReplaceState: function () {
            },
            enqueueSetState: function () {
            }
        }, A = {};
    r.prototype.isReactComponent = {};
    r.prototype.setState = function (a, b) {
        'object' !== typeof a && 'function' !== typeof a && null != a ? z('85') : void 0;
        this.updater.enqueueSetState(this, a, b, 'setState');
    };
    r.prototype.forceUpdate = function (a) {
        this.updater.enqueueForceUpdate(this, a, 'forceUpdate');
    };
    D.prototype = r.prototype;
    var k = C.prototype = new D();
    k.constructor = C;
    x(k, r.prototype);
    k.isPureReactComponent = !0;
    k = E.prototype = new D();
    k.constructor = E;
    x(k, r.prototype);
    k.unstable_isAsyncReactComponent = !0;
    k.render = function () {
        return this.props.children;
    };
    var I = { current: null }, P = Object.prototype.hasOwnProperty, J = 'function' === typeof Symbol && Symbol['for'] && Symbol['for']('react.element') || 60103, Q = {
            key: !0,
            ref: !0,
            __self: !0,
            __source: !0
        };
    n.createElement = function (a, b, c) {
        var d, e = {}, f = null, g = null, h = null, k = null;
        if (null != b)
            for (d in void 0 !== b.ref && (g = b.ref), void 0 !== b.key && (f = '' + b.key), h = void 0 === b.__self ? null : b.__self, k = void 0 === b.__source ? null : b.__source, b)
                P.call(b, d) && !Q.hasOwnProperty(d) && (e[d] = b[d]);
        var m = arguments.length - 2;
        if (1 === m)
            e.children = c;
        else if (1 < m) {
            for (var l = Array(m), p = 0; p < m; p++)
                l[p] = arguments[p + 2];
            e.children = l;
        }
        if (a && a.defaultProps)
            for (d in m = a.defaultProps, m)
                void 0 === e[d] && (e[d] = m[d]);
        return n(a, f, g, h, k, I.current, e);
    };
    n.createFactory = function (a) {
        var b = n.createElement.bind(null, a);
        b.type = a;
        return b;
    };
    n.cloneAndReplaceKey = function (a, b) {
        return n(a.type, b, a.ref, a._self, a._source, a._owner, a.props);
    };
    n.cloneElement = function (a, b, c) {
        var d = x({}, a.props), e = a.key, f = a.ref, g = a._self, h = a._source, k = a._owner;
        if (null != b) {
            void 0 !== b.ref && (f = b.ref, k = I.current);
            void 0 !== b.key && (e = '' + b.key);
            if (a.type && a.type.defaultProps)
                var m = a.type.defaultProps;
            for (l in b)
                P.call(b, l) && !Q.hasOwnProperty(l) && (d[l] = void 0 === b[l] && void 0 !== m ? m[l] : b[l]);
        }
        var l = arguments.length - 2;
        if (1 === l)
            d.children = c;
        else if (1 < l) {
            m = Array(l);
            for (var p = 0; p < l; p++)
                m[p] = arguments[p + 2];
            d.children = m;
        }
        return n(a.type, e, f, g, h, k, d);
    };
    n.isValidElement = function (a) {
        return 'object' === typeof a && null !== a && a.$$typeof === J;
    };
    var t = n;
    q.thatReturns = v;
    q.thatReturnsFalse = v(!1);
    q.thatReturnsTrue = v(!0);
    q.thatReturnsNull = v(null);
    q.thatReturnsThis = function () {
        return this;
    };
    q.thatReturnsArgument = function (a) {
        return a;
    };
    var H = q, M = 'function' === typeof Symbol && Symbol.iterator, S = 'function' === typeof Symbol && Symbol['for'] && Symbol['for']('react.element') || 60103, N = /\/+/g, w = [];
    return {
        Children: {
            map: function (a, b, c) {
                if (null == a)
                    return a;
                var d = [];
                G(a, d, null, b, c);
                return d;
            },
            forEach: function (a, b, c) {
                if (null == a)
                    return a;
                b = K(null, null, b, c);
                null == a || u(a, '', T, b);
                L(b);
            },
            count: function (a) {
                return null == a ? 0 : u(a, '', H.thatReturnsNull, null);
            },
            toArray: function (a) {
                var b = [];
                G(a, b, null, H.thatReturnsArgument);
                return b;
            },
            only: function (a) {
                t.isValidElement(a) ? void 0 : z('143');
                return a;
            }
        },
        Component: r,
        PureComponent: C,
        unstable_AsyncComponent: E,
        createElement: t.createElement,
        cloneElement: t.cloneElement,
        isValidElement: t.isValidElement,
        createFactory: t.createFactory,
        version: '16.0.0',
        __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
            ReactCurrentOwner: I,
            assign: x
        }
    };
}
'object' === typeof exports && 'undefined' !== typeof module ? module.exports = y() : 'function' === typeof define && define.amd ? define('react@16.0.0#umd/react.production.min', y) : this.React = y();
/*react-dom@16.0.0#umd/react-dom.production.min*/
'use strict';
function Nb(Za) {
    function Ob(a, b) {
        return null == a || 'http://www.w3.org/1999/xhtml' === a ? Sc(b) : 'http://www.w3.org/2000/svg' === a && 'foreignObject' === b ? 'http://www.w3.org/1999/xhtml' : a;
    }
    function Me(a) {
        return a[1].toUpperCase();
    }
    function $a(a) {
        var b = a.keyCode;
        'charCode' in a ? (a = a.charCode, 0 === a && 13 === b && (a = 13)) : a = b;
        return 32 <= a || 13 === a ? a : 0;
    }
    function Pb() {
        return Ne;
    }
    function Tc(a) {
        var b = a && a.nodeName && a.nodeName.toLowerCase();
        return 'input' === b ? !!Oe[a.type] : 'textarea' === b ? !0 : !1;
    }
    function ab(a) {
        if (null == a)
            return null;
        if (1 === a.nodeType)
            return a;
        var b = fa.get(a);
        if (b)
            return 'number' === typeof b.tag ? Uc(b) : Vc(b);
        'function' === typeof a.render ? m('188') : m('213', Object.keys(a));
    }
    function Vc() {
        m('212');
    }
    function Uc() {
        m('211');
    }
    function Qb(a) {
        a = a || ('undefined' !== typeof document ? document : void 0);
        if ('undefined' === typeof a)
            return null;
        try {
            return a.activeElement || a.body;
        } catch (b) {
            return a.body;
        }
    }
    function Wc(a) {
        var b = (a ? a.ownerDocument || a : document).defaultView || window;
        return !!(a && ('function' === typeof b.Node ? a instanceof b.Node : 'object' === typeof a && 'number' === typeof a.nodeType && 'string' === typeof a.nodeName)) && 3 == a.nodeType;
    }
    function Xc() {
        !Rb && z && (Rb = 'textContent' in document.documentElement ? 'textContent' : 'innerText');
        return Rb;
    }
    function Yc(a, b) {
        var c = Zc(a);
        a = 0;
        for (var d; c;) {
            if (3 === c.nodeType) {
                d = a + c.textContent.length;
                if (a <= b && d >= b)
                    return {
                        node: c,
                        offset: b - a
                    };
                a = d;
            }
            a: {
                for (; c;) {
                    if (c.nextSibling) {
                        c = c.nextSibling;
                        break a;
                    }
                    c = c.parentNode;
                }
                c = void 0;
            }
            c = Zc(c);
        }
    }
    function $c() {
        m('196');
    }
    function Pe(a) {
        function b() {
            for (; null !== w && 0 === w.current.pendingWorkPriority;) {
                w.isScheduled = !1;
                var a = w.nextScheduledRoot;
                w.nextScheduledRoot = null;
                if (w === I)
                    return I = w = null, y = 0, null;
                w = a;
            }
            a = w;
            for (var b = null, c = 0; null !== a;)
                0 !== a.current.pendingWorkPriority && (0 === c || c > a.current.pendingWorkPriority) && (c = a.current.pendingWorkPriority, b = a), a = a.nextScheduledRoot;
            if (null !== b) {
                for (y = c; -1 < da;)
                    bb[da] = null, da--;
                cb = ba;
                ca.current = ba;
                S.current = !1;
                p();
                D = ad(b.current, c);
                b !== V && (U = 0, V = b);
            } else
                y = 0, V = D = null;
        }
        function c(c) {
            X = !0;
            q = null;
            var d = c.stateNode;
            d.current === c ? m('177') : void 0;
            1 !== y && 2 !== y || U++;
            db.current = null;
            if (1 < c.effectTag)
                if (null !== c.lastEffect) {
                    c.lastEffect.nextEffect = c;
                    var p = c.firstEffect;
                } else
                    p = c;
            else
                p = c.firstEffect;
            N();
            for (u = p; null !== u;) {
                var n = !1, e = void 0;
                try {
                    for (; null !== u;) {
                        var f = u.effectTag;
                        f & 16 && a.resetTextContent(u.stateNode);
                        if (f & 128) {
                            var g = u.alternate;
                            null !== g && t(g);
                        }
                        switch (f & -242) {
                        case 2:
                            E(u);
                            u.effectTag &= -3;
                            break;
                        case 6:
                            E(u);
                            u.effectTag &= -3;
                            bd(u.alternate, u);
                            break;
                        case 4:
                            bd(u.alternate, u);
                            break;
                        case 8:
                            Y = !0, Qe(u), Y = !1;
                        }
                        u = u.nextEffect;
                    }
                } catch (Sb) {
                    n = !0, e = Sb;
                }
                n && (null === u ? m('178') : void 0, T(u, e), null !== u && (u = u.nextEffect));
            }
            O();
            d.current = c;
            for (u = p; null !== u;) {
                d = !1;
                p = void 0;
                try {
                    for (; null !== u;) {
                        var h = u.effectTag;
                        h & 36 && Re(u.alternate, u);
                        h & 128 && r(u);
                        if (h & 64)
                            switch (n = u, e = void 0, null !== P && (e = P.get(n), P['delete'](n), null == e && null !== n.alternate && (n = n.alternate, e = P.get(n), P['delete'](n))), null == e ? m('184') : void 0, n.tag) {
                            case 2:
                                n.stateNode.componentDidCatch(e.error, { componentStack: e.componentStack });
                                break;
                            case 3:
                                null === M && (M = e.error);
                                break;
                            default:
                                m('157');
                            }
                        var v = u.nextEffect;
                        u.nextEffect = null;
                        u = v;
                    }
                } catch (Sb) {
                    d = !0, p = Sb;
                }
                d && (null === u ? m('178') : void 0, T(u, p), null !== u && (u = u.nextEffect));
            }
            X = !1;
            'function' === typeof cd && cd(c.stateNode);
            B && (B.forEach(Z), B = null);
            b();
        }
        function d(a) {
            for (;;) {
                var b = Se(a.alternate, a, y), c = a['return'], d = a.sibling;
                var n = a;
                if (!(0 !== n.pendingWorkPriority && n.pendingWorkPriority > y)) {
                    var p = n.updateQueue;
                    p = null === p || 2 !== n.tag && 3 !== n.tag ? 0 : null !== p.first ? p.first.priorityLevel : 0;
                    for (var e = n.child; null !== e;) {
                        var f = e.pendingWorkPriority;
                        p = 0 !== p && (0 === f || f > p) ? p : f;
                        e = e.sibling;
                    }
                    n.pendingWorkPriority = p;
                }
                if (null !== b)
                    return b;
                null !== c && (null === c.firstEffect && (c.firstEffect = a.firstEffect), null !== a.lastEffect && (null !== c.lastEffect && (c.lastEffect.nextEffect = a.firstEffect), c.lastEffect = a.lastEffect), 1 < a.effectTag && (null !== c.lastEffect ? c.lastEffect.nextEffect = a : c.firstEffect = a, c.lastEffect = a));
                if (null !== d)
                    return d;
                if (null !== c)
                    a = c;
                else {
                    q = a;
                    break;
                }
            }
            return null;
        }
        function e(a) {
            var b = pa(a.alternate, a, y);
            null === b && (b = d(a));
            db.current = null;
            return b;
        }
        function f(a) {
            var b = Ub(a.alternate, a, y);
            null === b && (b = d(a));
            db.current = null;
            return b;
        }
        function g(a) {
            Q(5, a);
        }
        function h() {
            if (null !== P && 0 < P.size && 2 === y)
                for (; null !== D;) {
                    var a = D;
                    D = null !== P && (P.has(a) || null !== a.alternate && P.has(a.alternate)) ? f(D) : e(D);
                    if (null === D && (null === q ? m('179') : void 0, J = 2, c(q), J = y, null === P || 0 === P.size || 2 !== y))
                        break;
                }
        }
        function k(a, d) {
            null !== q ? (J = 2, c(q), h()) : null === D && b();
            if (!(0 === y || y > a)) {
                J = y;
                a:
                    do {
                        if (2 >= y)
                            for (; null !== D && !(D = e(D), null === D && (null === q ? m('179') : void 0, J = 2, c(q), J = y, h(), 0 === y || y > a || 2 < y)););
                        else if (null !== d)
                            for (; null !== D && !F;)
                                if (1 < d.timeRemaining()) {
                                    if (D = e(D), null === D)
                                        if (null === q ? m('179') : void 0, 1 < d.timeRemaining()) {
                                            if (J = 2, c(q), J = y, h(), 0 === y || y > a || 3 > y)
                                                break;
                                        } else
                                            F = !0;
                                } else
                                    F = !0;
                        switch (y) {
                        case 1:
                        case 2:
                            if (y <= a)
                                continue a;
                            break a;
                        case 3:
                        case 4:
                        case 5:
                            if (null === d)
                                break a;
                            if (!F && y <= a)
                                continue a;
                            break a;
                        case 0:
                            break a;
                        default:
                            m('181');
                        }
                    } while (1);
            }
        }
        function Q(a, b) {
            z ? m('182') : void 0;
            z = !0;
            var c = J, d = !1, p = null;
            try {
                k(a, b);
            } catch (Tb) {
                d = !0, p = Tb;
            }
            for (; d;) {
                if (R) {
                    M = p;
                    break;
                }
                var e = D;
                if (null === e)
                    R = !0;
                else {
                    var E = T(e, p);
                    null === E ? m('183') : void 0;
                    if (!R) {
                        try {
                            d = E;
                            p = a;
                            E = b;
                            for (var h = d; null !== e;) {
                                switch (e.tag) {
                                case 2:
                                    dd(e);
                                    break;
                                case 5:
                                    n(e);
                                    break;
                                case 3:
                                    x(e);
                                    break;
                                case 4:
                                    x(e);
                                }
                                if (e === h || e.alternate === h)
                                    break;
                                e = e['return'];
                            }
                            D = f(d);
                            k(p, E);
                        } catch (Tb) {
                            d = !0;
                            p = Tb;
                            continue;
                        }
                        break;
                    }
                }
            }
            J = c;
            null !== b && (L = !1);
            2 < y && !L && (A(g), L = !0);
            a = M;
            R = F = z = !1;
            V = C = P = M = null;
            U = 0;
            if (null !== a)
                throw a;
        }
        function T(a, b) {
            var c = db.current = null, d = !1, p = !1, n = null;
            if (3 === a.tag)
                c = a, eb(a) && (R = !0);
            else
                for (var e = a['return']; null !== e && null === c;) {
                    2 === e.tag ? 'function' === typeof e.stateNode.componentDidCatch && (d = !0, n = Ba(e), c = e, p = !0) : 3 === e.tag && (c = e);
                    if (eb(e)) {
                        if (Y || null !== B && (B.has(e) || null !== e.alternate && B.has(e.alternate)))
                            return null;
                        c = null;
                        p = !1;
                    }
                    e = e['return'];
                }
            if (null !== c) {
                null === C && (C = new Set());
                C.add(c);
                var f = '';
                e = a;
                do {
                    a:
                        switch (e.tag) {
                        case 0:
                        case 1:
                        case 2:
                        case 5:
                            var E = e._debugOwner, g = e._debugSource;
                            var h = Ba(e);
                            var v = null;
                            E && (v = Ba(E));
                            E = g;
                            h = '\n    in ' + (h || 'Unknown') + (E ? ' (at ' + E.fileName.replace(/^.*[\\\/]/, '') + ':' + E.lineNumber + ')' : v ? ' (created by ' + v + ')' : '');
                            break a;
                        default:
                            h = '';
                        }
                    f += h;
                    e = e['return'];
                } while (e);
                e = f;
                a = Ba(a);
                null === P && (P = new Map());
                b = {
                    componentName: a,
                    componentStack: e,
                    error: b,
                    errorBoundary: d ? c.stateNode : null,
                    errorBoundaryFound: d,
                    errorBoundaryName: n,
                    willRetry: p
                };
                P.set(c, b);
                try {
                    console.error(b.error);
                } catch (Te) {
                    console.error(Te);
                }
                X ? (null === B && (B = new Set()), B.add(c)) : Z(c);
                return c;
            }
            null === M && (M = b);
            return null;
        }
        function eb(a) {
            return null !== C && (C.has(a) || null !== a.alternate && C.has(a.alternate));
        }
        function fb(a, b) {
            return ed(a, b, !1);
        }
        function ed(a, b) {
            U > aa && (R = !0, m('185'));
            !z && b <= y && (D = null);
            for (var c = !0; null !== a && c;) {
                c = !1;
                if (0 === a.pendingWorkPriority || a.pendingWorkPriority > b)
                    c = !0, a.pendingWorkPriority = b;
                null !== a.alternate && (0 === a.alternate.pendingWorkPriority || a.alternate.pendingWorkPriority > b) && (c = !0, a.alternate.pendingWorkPriority = b);
                if (null === a['return'])
                    if (3 === a.tag) {
                        var d = a.stateNode;
                        0 === b || d.isScheduled || (d.isScheduled = !0, I ? I.nextScheduledRoot = d : w = d, I = d);
                        if (!z)
                            switch (b) {
                            case 1:
                                K ? Q(1, null) : Q(2, null);
                                break;
                            case 2:
                                W ? void 0 : m('186');
                                break;
                            default:
                                L || (A(g), L = !0);
                            }
                    } else
                        break;
                a = a['return'];
            }
        }
        function l(a, b) {
            var c = J;
            0 === c && (c = !G || a.internalContextTag & 1 || b ? 4 : 1);
            return 1 === c && (z || W) ? 2 : c;
        }
        function Z(a) {
            ed(a, 2, !0);
        }
        var H = Ue(a), fd = Ve(a), x = H.popHostContainer, n = H.popHostContext, p = H.resetHostContainer, v = We(a, H, fd, fb, l), pa = v.beginWork, Ub = v.beginFailedWork, Se = Xe(a, H, fd).completeWork;
        H = Ye(a, T);
        var E = H.commitPlacement, Qe = H.commitDeletion, bd = H.commitWork, Re = H.commitLifeCycles, r = H.commitAttachRef, t = H.commitDetachRef, A = a.scheduleDeferredCallback, G = a.useSyncScheduling, N = a.prepareForCommit, O = a.resetAfterCommit, J = 0, z = !1, F = !1, W = !1, K = !1, D = null, y = 0, u = null, q = null, w = null, I = null, L = !1, P = null, C = null, B = null, M = null, R = !1, X = !1, Y = !1, aa = 1000, U = 0, V = null;
        return {
            scheduleUpdate: fb,
            getPriorityContext: l,
            batchedUpdates: function (a, b) {
                var c = W;
                W = !0;
                try {
                    return a(b);
                } finally {
                    W = c, z || W || Q(2, null);
                }
            },
            unbatchedUpdates: function (a) {
                var b = K, c = W;
                K = W;
                W = !1;
                try {
                    return a();
                } finally {
                    W = c, K = b;
                }
            },
            flushSync: function (a) {
                var b = W, c = J;
                W = !0;
                J = 1;
                try {
                    return a();
                } finally {
                    W = b, J = c, z ? m('187') : void 0, Q(2, null);
                }
            },
            deferredUpdates: function (a) {
                var b = J;
                J = 4;
                try {
                    return a();
                } finally {
                    J = b;
                }
            }
        };
    }
    function cd(a) {
        'function' === typeof Vb && Vb(a);
    }
    function Ve(a) {
        function b(a, b) {
            var c = new F(5, null, 0);
            c.type = 'DELETED';
            c.stateNode = b;
            c['return'] = a;
            c.effectTag = 8;
            null !== a.lastEffect ? (a.lastEffect.nextEffect = c, a.lastEffect = c) : a.firstEffect = a.lastEffect = c;
        }
        function c(a, b) {
            switch (a.tag) {
            case 5:
                return f(b, a.type, a.pendingProps);
            case 6:
                return g(b, a.pendingProps);
            default:
                return !1;
            }
        }
        function d(a) {
            for (a = a['return']; null !== a && 5 !== a.tag && 3 !== a.tag;)
                a = a['return'];
            l = a;
        }
        var e = a.shouldSetTextContent, f = a.canHydrateInstance, g = a.canHydrateTextInstance, h = a.getNextHydratableSibling, k = a.getFirstHydratableChild, Q = a.hydrateInstance, T = a.hydrateTextInstance, eb = a.didNotHydrateInstance, fb = a.didNotFindHydratableInstance;
        a = a.didNotFindHydratableTextInstance;
        if (!(f && g && h && k && Q && T && eb && fb && a))
            return {
                enterHydrationState: function () {
                    return !1;
                },
                resetHydrationState: function () {
                },
                tryToClaimNextHydratableInstance: function () {
                },
                prepareToHydrateHostInstance: function () {
                    m('175');
                },
                prepareToHydrateHostTextInstance: function () {
                    m('176');
                },
                popHydrationState: function () {
                    return !1;
                }
            };
        var l = null, r = null, Z = !1;
        return {
            enterHydrationState: function (a) {
                r = k(a.stateNode.containerInfo);
                l = a;
                return Z = !0;
            },
            resetHydrationState: function () {
                r = l = null;
                Z = !1;
            },
            tryToClaimNextHydratableInstance: function (a) {
                if (Z) {
                    var d = r;
                    if (d) {
                        if (!c(a, d)) {
                            d = h(d);
                            if (!d || !c(a, d)) {
                                a.effectTag |= 2;
                                Z = !1;
                                l = a;
                                return;
                            }
                            b(l, r);
                        }
                        a.stateNode = d;
                        l = a;
                        r = k(d);
                    } else
                        a.effectTag |= 2, Z = !1, l = a;
                }
            },
            prepareToHydrateHostInstance: function (a, b, c) {
                b = Q(a.stateNode, a.type, a.memoizedProps, b, c, a);
                a.updateQueue = b;
                return null !== b ? !0 : !1;
            },
            prepareToHydrateHostTextInstance: function (a) {
                return T(a.stateNode, a.memoizedProps, a);
            },
            popHydrationState: function (a) {
                if (a !== l)
                    return !1;
                if (!Z)
                    return d(a), Z = !0, !1;
                var c = a.type;
                if (5 !== a.tag || 'head' !== c && 'body' !== c && !e(c, a.memoizedProps))
                    for (c = r; c;)
                        b(a, c), c = h(c);
                d(a);
                r = l ? h(a.stateNode) : null;
                return !0;
            }
        };
    }
    function Ue(a) {
        function b(a) {
            a === qa ? m('174') : void 0;
            return a;
        }
        var c = a.getChildHostContext, d = a.getRootHostContext, e = { current: qa }, f = { current: qa }, g = { current: qa };
        return {
            getHostContext: function () {
                return b(e.current);
            },
            getRootHostContainer: function () {
                return b(g.current);
            },
            popHostContainer: function (a) {
                K(e, a);
                K(f, a);
                K(g, a);
            },
            popHostContext: function (a) {
                f.current === a && (K(e, a), K(f, a));
            },
            pushHostContainer: function (a, b) {
                L(g, b, a);
                b = d(b);
                L(f, a, a);
                L(e, b, a);
            },
            pushHostContext: function (a) {
                var d = b(g.current), h = b(e.current);
                d = c(h, a.type, d);
                h !== d && (L(f, a, a), L(e, d, a));
            },
            resetHostContainer: function () {
                e.current = qa;
                g.current = qa;
            }
        };
    }
    function Ye(a, b) {
        function c(a) {
            var c = a.ref;
            if (null !== c)
                try {
                    c(null);
                } catch (p) {
                    b(a, p);
                }
        }
        function d(a) {
            return 5 === a.tag || 3 === a.tag || 4 === a.tag;
        }
        function e(a) {
            for (var b = a;;)
                if (g(b), null !== b.child && 4 !== b.tag)
                    b.child['return'] = b, b = b.child;
                else {
                    if (b === a)
                        break;
                    for (; null === b.sibling;) {
                        if (null === b['return'] || b['return'] === a)
                            return;
                        b = b['return'];
                    }
                    b.sibling['return'] = b['return'];
                    b = b.sibling;
                }
        }
        function f(a) {
            for (var b = a, c = !1, d = void 0, f = void 0;;) {
                if (!c) {
                    c = b['return'];
                    a:
                        for (;;) {
                            null === c ? m('160') : void 0;
                            switch (c.tag) {
                            case 5:
                                d = c.stateNode;
                                f = !1;
                                break a;
                            case 3:
                                d = c.stateNode.containerInfo;
                                f = !0;
                                break a;
                            case 4:
                                d = c.stateNode.containerInfo;
                                f = !0;
                                break a;
                            }
                            c = c['return'];
                        }
                    c = !0;
                }
                if (5 === b.tag || 6 === b.tag)
                    e(b), f ? H(d, b.stateNode) : Z(d, b.stateNode);
                else if (4 === b.tag ? d = b.stateNode.containerInfo : g(b), null !== b.child) {
                    b.child['return'] = b;
                    b = b.child;
                    continue;
                }
                if (b === a)
                    break;
                for (; null === b.sibling;) {
                    if (null === b['return'] || b['return'] === a)
                        return;
                    b = b['return'];
                    4 === b.tag && (c = !1);
                }
                b.sibling['return'] = b['return'];
                b = b.sibling;
            }
        }
        function g(a) {
            'function' === typeof gd && gd(a);
            switch (a.tag) {
            case 2:
                c(a);
                var d = a.stateNode;
                if ('function' === typeof d.componentWillUnmount)
                    try {
                        d.props = a.memoizedProps, d.state = a.memoizedState, d.componentWillUnmount();
                    } catch (p) {
                        b(a, p);
                    }
                break;
            case 5:
                c(a);
                break;
            case 7:
                e(a.stateNode);
                break;
            case 4:
                f(a);
            }
        }
        var h = a.commitMount, k = a.commitUpdate, Q = a.resetTextContent, T = a.commitTextUpdate, l = a.appendChild, r = a.appendChildToContainer, t = a.insertBefore, q = a.insertInContainerBefore, Z = a.removeChild, H = a.removeChildFromContainer, w = a.getPublicInstance;
        return {
            commitPlacement: function (a) {
                a: {
                    for (var b = a['return']; null !== b;) {
                        if (d(b)) {
                            var c = b;
                            break a;
                        }
                        b = b['return'];
                    }
                    m('160');
                    c = void 0;
                }
                var e = b = void 0;
                switch (c.tag) {
                case 5:
                    b = c.stateNode;
                    e = !1;
                    break;
                case 3:
                    b = c.stateNode.containerInfo;
                    e = !0;
                    break;
                case 4:
                    b = c.stateNode.containerInfo;
                    e = !0;
                    break;
                default:
                    m('161');
                }
                c.effectTag & 16 && (Q(b), c.effectTag &= -17);
                a:
                    b:
                        for (c = a;;) {
                            for (; null === c.sibling;) {
                                if (null === c['return'] || d(c['return'])) {
                                    c = null;
                                    break a;
                                }
                                c = c['return'];
                            }
                            c.sibling['return'] = c['return'];
                            for (c = c.sibling; 5 !== c.tag && 6 !== c.tag;) {
                                if (c.effectTag & 2)
                                    continue b;
                                if (null === c.child || 4 === c.tag)
                                    continue b;
                                else
                                    c.child['return'] = c, c = c.child;
                            }
                            if (!(c.effectTag & 2)) {
                                c = c.stateNode;
                                break a;
                            }
                        }
                for (var f = a;;) {
                    if (5 === f.tag || 6 === f.tag)
                        c ? e ? q(b, f.stateNode, c) : t(b, f.stateNode, c) : e ? r(b, f.stateNode) : l(b, f.stateNode);
                    else if (4 !== f.tag && null !== f.child) {
                        f.child['return'] = f;
                        f = f.child;
                        continue;
                    }
                    if (f === a)
                        break;
                    for (; null === f.sibling;) {
                        if (null === f['return'] || f['return'] === a)
                            return;
                        f = f['return'];
                    }
                    f.sibling['return'] = f['return'];
                    f = f.sibling;
                }
            },
            commitDeletion: function (a) {
                f(a);
                a['return'] = null;
                a.child = null;
                a.alternate && (a.alternate.child = null, a.alternate['return'] = null);
            },
            commitWork: function (a, b) {
                switch (b.tag) {
                case 2:
                    break;
                case 5:
                    var c = b.stateNode;
                    if (null != c) {
                        var d = b.memoizedProps;
                        a = null !== a ? a.memoizedProps : d;
                        var e = b.type, f = b.updateQueue;
                        b.updateQueue = null;
                        null !== f && k(c, f, e, a, d, b);
                    }
                    break;
                case 6:
                    null === b.stateNode ? m('162') : void 0;
                    c = b.memoizedProps;
                    T(b.stateNode, null !== a ? a.memoizedProps : c, c);
                    break;
                case 3:
                    break;
                case 4:
                    break;
                default:
                    m('163');
                }
            },
            commitLifeCycles: function (a, b) {
                switch (b.tag) {
                case 2:
                    var c = b.stateNode;
                    if (b.effectTag & 4)
                        if (null === a)
                            c.props = b.memoizedProps, c.state = b.memoizedState, c.componentDidMount();
                        else {
                            var d = a.memoizedProps;
                            a = a.memoizedState;
                            c.props = b.memoizedProps;
                            c.state = b.memoizedState;
                            c.componentDidUpdate(d, a);
                        }
                    b.effectTag & 32 && null !== b.updateQueue && hd(b, b.updateQueue, c);
                    break;
                case 3:
                    a = b.updateQueue;
                    null !== a && hd(b, a, b.child && b.child.stateNode);
                    break;
                case 5:
                    c = b.stateNode;
                    null === a && b.effectTag & 4 && h(c, b.type, b.memoizedProps, b);
                    break;
                case 6:
                    break;
                case 4:
                    break;
                default:
                    m('163');
                }
            },
            commitAttachRef: function (a) {
                var b = a.ref;
                if (null !== b) {
                    var c = a.stateNode;
                    switch (a.tag) {
                    case 5:
                        b(w(c));
                        break;
                    default:
                        b(c);
                    }
                }
            },
            commitDetachRef: function (a) {
                a = a.ref;
                null !== a && a(null);
            }
        };
    }
    function gd(a) {
        'function' === typeof Wb && Wb(a);
    }
    function hd(a, b, c) {
        a = b.callbackList;
        if (null !== a)
            for (b.callbackList = null, b = 0; b < a.length; b++) {
                var d = a[b];
                'function' !== typeof d ? m('191', d) : void 0;
                d.call(c);
            }
    }
    function Xe(a, b, c) {
        var d = a.createInstance, e = a.createTextInstance, f = a.appendInitialChild, g = a.finalizeInitialChildren, h = a.prepareUpdate, k = b.getRootHostContainer, Q = b.popHostContext, T = b.getHostContext, l = b.popHostContainer, r = c.prepareToHydrateHostInstance, t = c.prepareToHydrateHostTextInstance, q = c.popHydrationState;
        return {
            completeWork: function (a, b, c) {
                var x = b.pendingProps;
                if (null === x)
                    x = b.memoizedProps;
                else if (5 !== b.pendingWorkPriority || 5 === c)
                    b.pendingProps = null;
                switch (b.tag) {
                case 1:
                    return null;
                case 2:
                    return dd(b), null;
                case 3:
                    l(b);
                    K(S, b);
                    K(ca, b);
                    x = b.stateNode;
                    x.pendingContext && (x.context = x.pendingContext, x.pendingContext = null);
                    if (null === a || null === a.child)
                        q(b), b.effectTag &= -3;
                    return null;
                case 5:
                    Q(b);
                    c = k();
                    var n = b.type;
                    if (null !== a && null != b.stateNode) {
                        var p = a.memoizedProps, v = b.stateNode, pa = T();
                        x = h(v, n, p, x, c, pa);
                        if (b.updateQueue = x)
                            b.effectTag |= 4;
                        a.ref !== b.ref && (b.effectTag |= 128);
                    } else {
                        if (!x)
                            return null === b.stateNode ? m('166') : void 0, null;
                        a = T();
                        if (q(b))
                            r(b, c, a) && (b.effectTag |= 4);
                        else {
                            a = d(n, x, c, a, b);
                            a:
                                for (p = b.child; null !== p;) {
                                    if (5 === p.tag || 6 === p.tag)
                                        f(a, p.stateNode);
                                    else if (4 !== p.tag && null !== p.child) {
                                        p = p.child;
                                        continue;
                                    }
                                    if (p === b)
                                        break a;
                                    for (; null === p.sibling;) {
                                        if (null === p['return'] || p['return'] === b)
                                            break a;
                                        p = p['return'];
                                    }
                                    p = p.sibling;
                                }
                            g(a, n, x, c) && (b.effectTag |= 4);
                            b.stateNode = a;
                        }
                        null !== b.ref && (b.effectTag |= 128);
                    }
                    return null;
                case 6:
                    if (a && null != b.stateNode)
                        a.memoizedProps !== x && (b.effectTag |= 4);
                    else {
                        if ('string' !== typeof x)
                            return null === b.stateNode ? m('166') : void 0, null;
                        a = k();
                        c = T();
                        q(b) ? t(b) && (b.effectTag |= 4) : b.stateNode = e(x, a, c, b);
                    }
                    return null;
                case 7:
                    (x = b.memoizedProps) ? void 0 : m('165');
                    b.tag = 8;
                    c = [];
                    a:
                        for ((n = b.stateNode) && (n['return'] = b); null !== n;) {
                            if (5 === n.tag || 6 === n.tag || 4 === n.tag)
                                m('164');
                            else if (9 === n.tag)
                                c.push(n.type);
                            else if (null !== n.child) {
                                n.child['return'] = n;
                                n = n.child;
                                continue;
                            }
                            for (; null === n.sibling;) {
                                if (null === n['return'] || n['return'] === b)
                                    break a;
                                n = n['return'];
                            }
                            n.sibling['return'] = n['return'];
                            n = n.sibling;
                        }
                    n = x.handler;
                    x = n(x.props, c);
                    b.child = Xb(b, null !== a ? a.child : null, x, b.pendingWorkPriority);
                    return b.child;
                case 8:
                    return b.tag = 7, null;
                case 9:
                    return null;
                case 10:
                    return null;
                case 4:
                    return b.effectTag |= 4, l(b), null;
                case 0:
                    m('167');
                default:
                    m('156');
                }
            }
        };
    }
    function We(a, b, c, d, e) {
        function f(a, b, c) {
            g(a, b, c, b.pendingWorkPriority);
        }
        function g(a, b, c, d) {
            b.child = null === a ? Yb(b, b.child, c, d) : a.child === b.child ? Xb(b, b.child, c, d) : Zb(b, b.child, c, d);
        }
        function h(a, b) {
            var c = b.ref;
            null === c || a && a.ref === c || (b.effectTag |= 128);
        }
        function k(a, b, c, d) {
            h(a, b);
            if (!c)
                return d && id(b, !1), l(a, b);
            c = b.stateNode;
            Ze.current = b;
            var e = c.render();
            b.effectTag |= 1;
            f(a, b, e);
            b.memoizedState = c.state;
            b.memoizedProps = c.props;
            d && id(b, !0);
            return b.child;
        }
        function Q(a) {
            var b = a.stateNode;
            b.pendingContext ? jd(a, b.pendingContext, b.pendingContext !== b.context) : b.context && jd(a, b.context, !1);
            H(a, b.containerInfo);
        }
        function l(a, b) {
            null !== a && b.child !== a.child ? m('153') : void 0;
            if (null !== b.child) {
                a = b.child;
                var c = $b(a, a.pendingWorkPriority);
                c.pendingProps = a.pendingProps;
                b.child = c;
                for (c['return'] = b; null !== a.sibling;)
                    a = a.sibling, c = c.sibling = $b(a, a.pendingWorkPriority), c.pendingProps = a.pendingProps, c['return'] = b;
                c.sibling = null;
            }
            return b.child;
        }
        function r(a, b) {
            switch (b.tag) {
            case 3:
                Q(b);
                break;
            case 2:
                gb(b);
                break;
            case 4:
                H(b, b.stateNode.containerInfo);
            }
            return null;
        }
        var q = a.shouldSetTextContent, t = a.useSyncScheduling, w = a.shouldDeprioritizeSubtree, z = b.pushHostContext, H = b.pushHostContainer, A = c.enterHydrationState, x = c.resetHydrationState, n = c.tryToClaimNextHydratableInstance;
        a = $e(d, e, function (a, b) {
            a.memoizedProps = b;
        }, function (a, b) {
            a.memoizedState = b;
        });
        var p = a.adoptClassInstance, v = a.constructClassInstance, pa = a.mountClassInstance, Ub = a.updateClassInstance;
        return {
            beginWork: function (a, b, c) {
                if (0 === b.pendingWorkPriority || b.pendingWorkPriority > c)
                    return r(a, b);
                switch (b.tag) {
                case 0:
                    null !== a ? m('155') : void 0;
                    var d = b.type, e = b.pendingProps, g = Ca(b);
                    g = Da(b, g);
                    d = d(e, g);
                    b.effectTag |= 1;
                    'object' === typeof d && null !== d && 'function' === typeof d.render ? (b.tag = 2, e = gb(b), p(b, d), pa(b, c), b = k(a, b, !0, e)) : (b.tag = 1, f(a, b, d), b.memoizedProps = e, b = b.child);
                    return b;
                case 1:
                    a: {
                        e = b.type;
                        c = b.pendingProps;
                        d = b.memoizedProps;
                        if (S.current)
                            null === c && (c = d);
                        else if (null === c || d === c) {
                            b = l(a, b);
                            break a;
                        }
                        d = Ca(b);
                        d = Da(b, d);
                        e = e(c, d);
                        b.effectTag |= 1;
                        f(a, b, e);
                        b.memoizedProps = c;
                        b = b.child;
                    }
                    return b;
                case 2:
                    return e = gb(b), d = void 0, null === a ? b.stateNode ? m('153') : (v(b, b.pendingProps), pa(b, c), d = !0) : d = Ub(a, b, c), k(a, b, d, e);
                case 3:
                    return Q(b), d = b.updateQueue, null !== d ? (e = b.memoizedState, d = ac(a, b, d, null, e, null, c), e === d ? (x(), b = l(a, b)) : (e = d.element, null !== a && null !== a.child || !A(b) ? (x(), f(a, b, e)) : (b.effectTag |= 2, b.child = Yb(b, b.child, e, c)), b.memoizedState = d, b = b.child)) : (x(), b = l(a, b)), b;
                case 5:
                    z(b);
                    null === a && n(b);
                    e = b.type;
                    var E = b.memoizedProps;
                    d = b.pendingProps;
                    null === d && (d = E, null === d ? m('154') : void 0);
                    g = null !== a ? a.memoizedProps : null;
                    S.current || null !== d && E !== d ? (E = d.children, q(e, d) ? E = null : g && q(e, g) && (b.effectTag |= 16), h(a, b), 5 !== c && !t && w(e, d) ? (b.pendingWorkPriority = 5, b = null) : (f(a, b, E), b.memoizedProps = d, b = b.child)) : b = l(a, b);
                    return b;
                case 6:
                    return null === a && n(b), a = b.pendingProps, null === a && (a = b.memoizedProps), b.memoizedProps = a, null;
                case 8:
                    b.tag = 7;
                case 7:
                    c = b.pendingProps;
                    if (S.current)
                        null === c && (c = a && a.memoizedProps, null === c ? m('154') : void 0);
                    else if (null === c || b.memoizedProps === c)
                        c = b.memoizedProps;
                    e = c.children;
                    d = b.pendingWorkPriority;
                    b.stateNode = null === a ? Yb(b, b.stateNode, e, d) : a.child === b.child ? Xb(b, b.stateNode, e, d) : Zb(b, b.stateNode, e, d);
                    b.memoizedProps = c;
                    return b.stateNode;
                case 9:
                    return null;
                case 4:
                    a: {
                        H(b, b.stateNode.containerInfo);
                        c = b.pendingWorkPriority;
                        e = b.pendingProps;
                        if (S.current)
                            null === e && (e = a && a.memoizedProps, null == e ? m('154') : void 0);
                        else if (null === e || b.memoizedProps === e) {
                            b = l(a, b);
                            break a;
                        }
                        null === a ? b.child = Zb(b, b.child, e, c) : f(a, b, e);
                        b.memoizedProps = e;
                        b = b.child;
                    }
                    return b;
                case 10:
                    a: {
                        c = b.pendingProps;
                        if (S.current)
                            null === c && (c = b.memoizedProps);
                        else if (null === c || b.memoizedProps === c) {
                            b = l(a, b);
                            break a;
                        }
                        f(a, b, c);
                        b.memoizedProps = c;
                        b = b.child;
                    }
                    return b;
                default:
                    m('156');
                }
            },
            beginFailedWork: function (a, b, c) {
                switch (b.tag) {
                case 2:
                    gb(b);
                    break;
                case 3:
                    Q(b);
                    break;
                default:
                    m('157');
                }
                b.effectTag |= 64;
                null === a ? b.child = null : b.child !== a.child && (b.child = a.child);
                if (0 === b.pendingWorkPriority || b.pendingWorkPriority > c)
                    return r(a, b);
                b.firstEffect = null;
                b.lastEffect = null;
                g(a, b, null, c);
                2 === b.tag && (a = b.stateNode, b.memoizedProps = a.props, b.memoizedState = a.state);
                return b.child;
            }
        };
    }
    function id(a, b) {
        var c = a.stateNode;
        c ? void 0 : m('169');
        if (b) {
            var d = kd(a, cb, !0);
            c.__reactInternalMemoizedMergedChildContext = d;
            K(S, a);
            K(ca, a);
            L(ca, d, a);
        } else
            K(S, a);
        L(S, b, a);
    }
    function jd(a, b, c) {
        null != ca.cursor ? m('168') : void 0;
        L(ca, b, a);
        L(S, c, a);
    }
    function gb(a) {
        if (!Ea(a))
            return !1;
        var b = a.stateNode;
        b = b && b.__reactInternalMemoizedMergedChildContext || ba;
        cb = ca.current;
        L(ca, b, a);
        L(S, S.current, a);
        return !0;
    }
    function $e(a, b, c, d) {
        function e(a, b) {
            b.updater = f;
            a.stateNode = b;
            fa.set(b, a);
        }
        var f = {
            isMounted: af,
            enqueueSetState: function (c, d, e) {
                c = fa.get(c);
                var f = b(c, !1);
                hb(c, {
                    priorityLevel: f,
                    partialState: d,
                    callback: void 0 === e ? null : e,
                    isReplace: !1,
                    isForced: !1,
                    isTopLevelUnmount: !1,
                    next: null
                });
                a(c, f);
            },
            enqueueReplaceState: function (c, d, e) {
                c = fa.get(c);
                var f = b(c, !1);
                hb(c, {
                    priorityLevel: f,
                    partialState: d,
                    callback: void 0 === e ? null : e,
                    isReplace: !0,
                    isForced: !1,
                    isTopLevelUnmount: !1,
                    next: null
                });
                a(c, f);
            },
            enqueueForceUpdate: function (c, d) {
                c = fa.get(c);
                var e = b(c, !1);
                hb(c, {
                    priorityLevel: e,
                    partialState: null,
                    callback: void 0 === d ? null : d,
                    isReplace: !1,
                    isForced: !0,
                    isTopLevelUnmount: !1,
                    next: null
                });
                a(c, e);
            }
        };
        return {
            adoptClassInstance: e,
            constructClassInstance: function (a, b) {
                var c = a.type, d = Ca(a), f = 2 === a.tag && null != a.type.contextTypes, g = f ? Da(a, d) : ba;
                b = new c(b, g);
                e(a, b);
                f && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = d, a.__reactInternalMemoizedMaskedChildContext = g);
                return b;
            },
            mountClassInstance: function (a, b) {
                var c = a.alternate, d = a.stateNode, e = d.state || null, g = a.pendingProps;
                g ? void 0 : m('158');
                var h = Ca(a);
                d.props = g;
                d.state = e;
                d.refs = ba;
                d.context = Da(a, h);
                null != a.type && null != a.type.prototype && !0 === a.type.prototype.unstable_isAsyncReactComponent && (a.internalContextTag |= 1);
                'function' === typeof d.componentWillMount && (h = d.state, d.componentWillMount(), h !== d.state && f.enqueueReplaceState(d, d.state, null), h = a.updateQueue, null !== h && (d.state = ac(c, a, h, d, e, g, b)));
                'function' === typeof d.componentDidMount && (a.effectTag |= 4);
            },
            updateClassInstance: function (a, b, e) {
                var g = b.stateNode;
                g.props = b.memoizedProps;
                g.state = b.memoizedState;
                var h = b.memoizedProps, k = b.pendingProps;
                k || (k = h, null == k ? m('159') : void 0);
                var l = g.context, r = Ca(b);
                r = Da(b, r);
                'function' !== typeof g.componentWillReceiveProps || h === k && l === r || (l = g.state, g.componentWillReceiveProps(k, r), g.state !== l && f.enqueueReplaceState(g, g.state, null));
                l = b.memoizedState;
                e = null !== b.updateQueue ? ac(a, b, b.updateQueue, g, l, k, e) : l;
                if (!(h !== k || l !== e || S.current || null !== b.updateQueue && b.updateQueue.hasForceUpdate))
                    return 'function' !== typeof g.componentDidUpdate || h === a.memoizedProps && l === a.memoizedState || (b.effectTag |= 4), !1;
                var q = k;
                if (null === h || null !== b.updateQueue && b.updateQueue.hasForceUpdate)
                    q = !0;
                else {
                    var t = b.stateNode, w = b.type;
                    q = 'function' === typeof t.shouldComponentUpdate ? t.shouldComponentUpdate(q, e, r) : w.prototype && w.prototype.isPureReactComponent ? !bc(h, q) || !bc(l, e) : !0;
                }
                q ? ('function' === typeof g.componentWillUpdate && g.componentWillUpdate(k, e, r), 'function' === typeof g.componentDidUpdate && (b.effectTag |= 4)) : ('function' !== typeof g.componentDidUpdate || h === a.memoizedProps && l === a.memoizedState || (b.effectTag |= 4), c(b, k), d(b, e));
                g.props = k;
                g.state = e;
                g.context = r;
                return q;
            }
        };
    }
    function bc(a, b) {
        if (ld(a, b))
            return !0;
        if ('object' !== typeof a || null === a || 'object' !== typeof b || null === b)
            return !1;
        var c = Object.keys(a), d = Object.keys(b);
        if (c.length !== d.length)
            return !1;
        for (d = 0; d < c.length; d++)
            if (!bf.call(b, c[d]) || !ld(a[c[d]], b[c[d]]))
                return !1;
        return !0;
    }
    function cc(a, b, c) {
        b = new F(4, a.key, b);
        b.pendingProps = a.children || [];
        b.pendingWorkPriority = c;
        b.stateNode = {
            containerInfo: a.containerInfo,
            implementation: a.implementation
        };
        return b;
    }
    function dc(a, b, c) {
        b = new F(7, a.key, b);
        b.type = a.handler;
        b.pendingProps = a;
        b.pendingWorkPriority = c;
        return b;
    }
    function ec(a, b, c) {
        b = new F(6, null, b);
        b.pendingProps = a;
        b.pendingWorkPriority = c;
        return b;
    }
    function md(a, b, c) {
        b = new F(10, null, b);
        b.pendingProps = a;
        b.pendingWorkPriority = c;
        return b;
    }
    function fc(a, b, c) {
        var d = a.type, e = a.key, f = void 0;
        'function' === typeof d ? (f = d.prototype && d.prototype.isReactComponent ? new F(2, e, b) : new F(0, e, b), f.type = d) : 'string' === typeof d ? (f = new F(5, e, b), f.type = d) : 'object' === typeof d && null !== d && 'number' === typeof d.tag ? f = d : m('130', null == d ? d : typeof d, '');
        b = f;
        b.pendingProps = a.props;
        b.pendingWorkPriority = c;
        return b;
    }
    function ad(a, b) {
        var c = a.alternate;
        null === c ? (c = new F(a.tag, a.key, a.internalContextTag), c.type = a.type, c.stateNode = a.stateNode, c.alternate = a, a.alternate = c) : (c.effectTag = 0, c.nextEffect = null, c.firstEffect = null, c.lastEffect = null);
        c.pendingWorkPriority = b;
        c.child = a.child;
        c.memoizedProps = a.memoizedProps;
        c.memoizedState = a.memoizedState;
        c.updateQueue = a.updateQueue;
        c.sibling = a.sibling;
        c.index = a.index;
        c.ref = a.ref;
        return c;
    }
    function dd(a) {
        Ea(a) && (K(S, a), K(ca, a));
    }
    function Da(a, b) {
        var c = a.type.contextTypes;
        if (!c)
            return ba;
        var d = a.stateNode;
        if (d && d.__reactInternalMemoizedUnmaskedChildContext === b)
            return d.__reactInternalMemoizedMaskedChildContext;
        var e = {}, f;
        for (f in c)
            e[f] = b[f];
        d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = b, a.__reactInternalMemoizedMaskedChildContext = e);
        return e;
    }
    function Ca(a) {
        return Ea(a) ? cb : ca.current;
    }
    function L(a, b) {
        da++;
        bb[da] = a.current;
        a.current = b;
    }
    function K(a) {
        0 > da || (a.current = bb[da], bb[da] = null, da--);
    }
    function ac(a, b, c, d, e, f, g) {
        null !== a && a.updateQueue === c && (c = b.updateQueue = {
            first: c.first,
            last: c.last,
            callbackList: null,
            hasForceUpdate: !1
        });
        a = c.callbackList;
        for (var h = c.hasForceUpdate, m = !0, l = c.first; null !== l && 0 >= gc(l.priorityLevel, g);) {
            c.first = l.next;
            null === c.first && (c.last = null);
            var r;
            if (l.isReplace)
                e = nd(l, d, e, f), m = !0;
            else if (r = nd(l, d, e, f))
                e = m ? q({}, e, r) : q(e, r), m = !1;
            l.isForced && (h = !0);
            null === l.callback || l.isTopLevelUnmount && null !== l.next || (a = null !== a ? a : [], a.push(l.callback), b.effectTag |= 32);
            l = l.next;
        }
        c.callbackList = a;
        c.hasForceUpdate = h;
        null !== c.first || null !== a || h || (b.updateQueue = null);
        return e;
    }
    function od(a, b) {
        if (b) {
            var c = a.firstChild;
            if (c && c === a.lastChild && 3 === c.nodeType) {
                c.nodeValue = b;
                return;
            }
        }
        a.textContent = b;
    }
    function hc(a, b) {
        if (-1 === a.indexOf('-'))
            return 'string' === typeof b.is;
        switch (a) {
        case 'annotation-xml':
        case 'color-profile':
        case 'font-face':
        case 'font-face-src':
        case 'font-face-uri':
        case 'font-face-format':
        case 'font-face-name':
        case 'missing-glyph':
            return !1;
        default:
            return !0;
        }
    }
    function ic(a, b) {
        b && (cf[a] && (null != b.children || null != b.dangerouslySetInnerHTML ? m('137', a, '') : void 0), null != b.dangerouslySetInnerHTML && (null != b.children ? m('60') : void 0, 'object' === typeof b.dangerouslySetInnerHTML && '__html' in b.dangerouslySetInnerHTML ? void 0 : m('61')), null != b.style && 'object' !== typeof b.style ? m('62', '') : void 0);
    }
    function ib(a) {
        if (jc[a])
            return jc[a];
        if (!ra[a])
            return a;
        var b = ra[a], c;
        for (c in b)
            if (b.hasOwnProperty(c) && c in pd)
                return jc[a] = b[c];
        return '';
    }
    function Fa(a, b) {
        if (!z || b && !('addEventListener' in document))
            return !1;
        b = 'on' + a;
        var c = b in document;
        c || (c = document.createElement('div'), c.setAttribute(b, 'return;'), c = 'function' === typeof c[b]);
        !c && qd && 'wheel' === a && (c = document.implementation.hasFeature('Events.wheel', '3.0'));
        return c;
    }
    function df(a) {
        return rd(a, !1);
    }
    function ef(a) {
        return rd(a, !0);
    }
    function rd(a, b) {
        a && (Ga.executeDispatchesInOrder(a, b), a.isPersistent() || a.constructor.release(a));
    }
    function Ha(a, b, c) {
        Array.isArray(a) ? a.forEach(b, c) : a && b.call(c, a);
    }
    function sa(a, b) {
        null == b ? m('30') : void 0;
        if (null == a)
            return b;
        if (Array.isArray(a)) {
            if (Array.isArray(b))
                return a.push.apply(a, b), a;
            a.push(b);
            return a;
        }
        return Array.isArray(b) ? [a].concat(b) : [
            a,
            b
        ];
    }
    function jb(a) {
        a = a.target || a.srcElement || window;
        a.correspondingUseElement && (a = a.correspondingUseElement);
        return 3 === a.nodeType ? a.parentNode : a;
    }
    function sd(a, b) {
        return a(b);
    }
    function kc(a, b, c, d, e, f) {
        return a(b, c, d, e, f);
    }
    function ff() {
        if (t._hasRethrowError) {
            var a = t._rethrowError;
            t._rethrowError = null;
            t._hasRethrowError = !1;
            throw a;
        }
    }
    function td(a, b, c, d, e, f, g, h, m) {
        t._hasCaughtError = !1;
        t._caughtError = null;
        var k = Array.prototype.slice.call(arguments, 3);
        try {
            b.apply(c, k);
        } catch (T) {
            t._caughtError = T, t._hasCaughtError = !0;
        }
    }
    function Ba(a) {
        if ('function' === typeof a.getName)
            return a.getName();
        if ('number' === typeof a.tag) {
            a = a.type;
            if ('string' === typeof a)
                return a;
            if ('function' === typeof a)
                return a.displayName || a.name;
        }
        return null;
    }
    function ka() {
    }
    function m(a) {
        for (var b = arguments.length - 1, c = 'Minified React error #' + a + '; visit http://facebook.github.io/react/docs/error-decoder.html?invariant=' + a, d = 0; d < b; d++)
            c += '&args[]=' + encodeURIComponent(arguments[d + 1]);
        b = Error(c + ' for the full message or use the non-minified dev environment for full errors and additional helpful warnings.');
        b.name = 'Invariant Violation';
        b.framesToPop = 1;
        throw b;
    }
    function Sc(a) {
        switch (a) {
        case 'svg':
            return 'http://www.w3.org/2000/svg';
        case 'math':
            return 'http://www.w3.org/1998/Math/MathML';
        default:
            return 'http://www.w3.org/1999/xhtml';
        }
    }
    function ud() {
        if (kb)
            for (var a in ta) {
                var b = ta[a], c = kb.indexOf(a);
                -1 < c ? void 0 : m('96', a);
                if (!ha.plugins[c]) {
                    b.extractEvents ? void 0 : m('97', a);
                    ha.plugins[c] = b;
                    c = b.eventTypes;
                    for (var d in c) {
                        var e = void 0;
                        var f = c[d], g = b, h = d;
                        ha.eventNameDispatchConfigs.hasOwnProperty(h) ? m('99', h) : void 0;
                        ha.eventNameDispatchConfigs[h] = f;
                        var k = f.phasedRegistrationNames;
                        if (k) {
                            for (e in k)
                                k.hasOwnProperty(e) && vd(k[e], g, h);
                            e = !0;
                        } else
                            f.registrationName ? (vd(f.registrationName, g, h), e = !0) : e = !1;
                        e ? void 0 : m('98', d, a);
                    }
                }
            }
    }
    function vd(a, b, c) {
        ha.registrationNameModules[a] ? m('100', a) : void 0;
        ha.registrationNameModules[a] = b;
        ha.registrationNameDependencies[a] = b.eventTypes[c].dependencies;
    }
    function lb(a) {
        return function () {
            return a;
        };
    }
    function ua(a, b) {
        return (a & b) === b;
    }
    function wd(a) {
        for (var b; b = a._renderedComponent;)
            a = b;
        return a;
    }
    function xd(a, b) {
        a = wd(a);
        a._hostNode = b;
        b[M] = a;
    }
    function lc(a, b) {
        if (!(a._flags & yd.hasCachedChildNodes)) {
            var c = a._renderedChildren;
            b = b.firstChild;
            var d;
            a:
                for (d in c)
                    if (c.hasOwnProperty(d)) {
                        var e = c[d], f = wd(e)._domID;
                        if (0 !== f) {
                            for (; null !== b; b = b.nextSibling) {
                                var g = b, h = f;
                                if (1 === g.nodeType && g.getAttribute(gf) === '' + h || 8 === g.nodeType && g.nodeValue === ' react-text: ' + h + ' ' || 8 === g.nodeType && g.nodeValue === ' react-empty: ' + h + ' ') {
                                    xd(e, b);
                                    continue a;
                                }
                            }
                            m('32', f);
                        }
                    }
            a._flags |= yd.hasCachedChildNodes;
        }
    }
    function zd(a) {
        if (a[M])
            return a[M];
        for (var b = []; !a[M];)
            if (b.push(a), a.parentNode)
                a = a.parentNode;
            else
                return null;
        var c = a[M];
        if (5 === c.tag || 6 === c.tag)
            return c;
        for (; a && (c = a[M]); a = b.pop()) {
            var d = c;
            b.length && lc(c, a);
        }
        return d;
    }
    function mb(a) {
        var b = a;
        if (a.alternate)
            for (; b['return'];)
                b = b['return'];
        else {
            if (0 !== (b.effectTag & 2))
                return 1;
            for (; b['return'];)
                if (b = b['return'], 0 !== (b.effectTag & 2))
                    return 1;
        }
        return 3 === b.tag ? 2 : 3;
    }
    function Ad(a) {
        2 !== mb(a) ? m('188') : void 0;
    }
    function mc(a) {
        var b = a.alternate;
        if (!b)
            return b = mb(a), 3 === b ? m('188') : void 0, 1 === b ? null : a;
        for (var c = a, d = b;;) {
            var e = c['return'], f = e ? e.alternate : null;
            if (!e || !f)
                break;
            if (e.child === f.child) {
                for (var g = e.child; g;) {
                    if (g === c)
                        return Ad(e), a;
                    if (g === d)
                        return Ad(e), b;
                    g = g.sibling;
                }
                m('188');
            }
            if (c['return'] !== d['return'])
                c = e, d = f;
            else {
                g = !1;
                for (var h = e.child; h;) {
                    if (h === c) {
                        g = !0;
                        c = e;
                        d = f;
                        break;
                    }
                    if (h === d) {
                        g = !0;
                        d = e;
                        c = f;
                        break;
                    }
                    h = h.sibling;
                }
                if (!g) {
                    for (h = f.child; h;) {
                        if (h === c) {
                            g = !0;
                            c = f;
                            d = e;
                            break;
                        }
                        if (h === d) {
                            g = !0;
                            d = f;
                            c = e;
                            break;
                        }
                        h = h.sibling;
                    }
                    g ? void 0 : m('189');
                }
            }
            c.alternate !== d ? m('190') : void 0;
        }
        3 !== c.tag ? m('188') : void 0;
        return c.stateNode.current === c ? a : b;
    }
    function Bd(a, b, c, d) {
        b = a.type || 'unknown-event';
        a.currentTarget = nc.getNodeFromInstance(d);
        Cd.invokeGuardedCallbackAndCatchFirstError(b, c, void 0, a);
        a.currentTarget = null;
    }
    function Dd(a) {
        if (a = Ga.getInstanceFromNode(a))
            if ('number' === typeof a.tag) {
                nb && 'function' === typeof nb.restoreControlledState ? void 0 : m('194');
                var b = Ga.getFiberCurrentPropsFromNode(a.stateNode);
                nb.restoreControlledState(a.stateNode, a.type, b);
            } else
                'function' !== typeof a.restoreControlledState ? m('195') : void 0, a.restoreControlledState();
    }
    function Ed(a, b) {
        return sd(a, b);
    }
    function hf(a) {
        var b = a.targetInst;
        do {
            if (!b) {
                a.ancestors.push(b);
                break;
            }
            var c = b;
            if ('number' === typeof c.tag) {
                for (; c['return'];)
                    c = c['return'];
                c = 3 !== c.tag ? null : c.stateNode.containerInfo;
            } else {
                for (; c._hostParent;)
                    c = c._hostParent;
                c = N.getNodeFromInstance(c).parentNode;
            }
            if (!c)
                break;
            a.ancestors.push(b);
            b = N.getClosestInstanceFromNode(c);
        } while (b);
        for (c = 0; c < a.ancestors.length; c++)
            b = a.ancestors[c], ia._handleTopLevel(a.topLevelType, b, a.nativeEvent, jb(a.nativeEvent));
    }
    function Fd(a, b, c) {
        switch (a) {
        case 'onClick':
        case 'onClickCapture':
        case 'onDoubleClick':
        case 'onDoubleClickCapture':
        case 'onMouseDown':
        case 'onMouseDownCapture':
        case 'onMouseMove':
        case 'onMouseMoveCapture':
        case 'onMouseUp':
        case 'onMouseUpCapture':
            return !(!c.disabled || 'button' !== b && 'input' !== b && 'select' !== b && 'textarea' !== b);
        default:
            return !1;
        }
    }
    function ob(a, b) {
        var c = {};
        c[a.toLowerCase()] = b.toLowerCase();
        c['Webkit' + a] = 'webkit' + b;
        c['Moz' + a] = 'moz' + b;
        c['ms' + a] = 'MS' + b;
        c['O' + a] = 'o' + b.toLowerCase();
        return c;
    }
    function Gd(a) {
        Object.prototype.hasOwnProperty.call(a, pb) || (a[pb] = jf++, Hd[a[pb]] = {});
        return Hd[a[pb]];
    }
    function kf(a) {
        if (Id.hasOwnProperty(a))
            return !0;
        if (Jd.hasOwnProperty(a))
            return !1;
        if (lf.test(a))
            return Id[a] = !0;
        Jd[a] = !0;
        return !1;
    }
    function Kd() {
        return null;
    }
    function mf(a) {
        var b = '';
        Za.Children.forEach(a, function (a) {
            null == a || 'string' !== typeof a && 'number' !== typeof a || (b += a);
        });
        return b;
    }
    function va(a, b, c) {
        a = a.options;
        if (b) {
            b = {};
            for (var d = 0; d < c.length; d++)
                b['$' + c[d]] = !0;
            for (c = 0; c < a.length; c++)
                d = b.hasOwnProperty('$' + a[c].value), a[c].selected !== d && (a[c].selected = d);
        } else {
            c = '' + c;
            b = null;
            for (d = 0; d < a.length; d++) {
                if (a[d].value === c) {
                    a[d].selected = !0;
                    return;
                }
                null !== b || a[d].disabled || (b = a[d]);
            }
            null !== b && (b.selected = !0);
        }
    }
    function Ld(a) {
        var b = a.type;
        return (a = a.nodeName) && 'input' === a.toLowerCase() && ('checkbox' === b || 'radio' === b);
    }
    function nf(a) {
        var b = Ld(a) ? 'checked' : 'value', c = Object.getOwnPropertyDescriptor(a.constructor.prototype, b), d = '' + a[b];
        if (!a.hasOwnProperty(b) && 'function' === typeof c.get && 'function' === typeof c.set)
            return Object.defineProperty(a, b, {
                enumerable: c.enumerable,
                configurable: !0,
                get: function () {
                    return c.get.call(this);
                },
                set: function (a) {
                    d = '' + a;
                    c.set.call(this, a);
                }
            }), {
                getValue: function () {
                    return d;
                },
                setValue: function (a) {
                    d = '' + a;
                },
                stopTracking: function () {
                    a._valueTracker = null;
                    delete a[b];
                }
            };
    }
    function R(a, b) {
        of(b, 9 === a.nodeType || 11 === a.nodeType ? a : a.ownerDocument);
    }
    function gc(a, b) {
        return 2 !== a && 1 !== a || 2 !== b && 1 !== b ? 0 === a && 0 !== b ? -255 : 0 !== a && 0 === b ? 255 : a - b : 0;
    }
    function Md() {
        return {
            first: null,
            last: null,
            hasForceUpdate: !1,
            callbackList: null
        };
    }
    function oc(a, b, c, d) {
        null !== c ? c.next = b : (b.next = a.first, a.first = b);
        null !== d ? b.next = d : a.last = b;
    }
    function Nd(a, b) {
        b = b.priorityLevel;
        var c = null;
        if (null !== a.last && 0 >= gc(a.last.priorityLevel, b))
            c = a.last;
        else
            for (a = a.first; null !== a && 0 >= gc(a.priorityLevel, b);)
                c = a, a = a.next;
        return c;
    }
    function hb(a, b) {
        var c = a.alternate, d = a.updateQueue;
        null === d && (d = a.updateQueue = Md());
        null !== c ? (a = c.updateQueue, null === a && (a = c.updateQueue = Md())) : a = null;
        pc = d;
        qc = a !== d ? a : null;
        var e = pc;
        c = qc;
        var f = Nd(e, b), g = null !== f ? f.next : e.first;
        if (null === c)
            return oc(e, b, f, g), null;
        d = Nd(c, b);
        a = null !== d ? d.next : c.first;
        oc(e, b, f, g);
        if (g === a && null !== g || f === d && null !== f)
            return null === d && (c.first = b), null === a && (c.last = null), null;
        b = {
            priorityLevel: b.priorityLevel,
            partialState: b.partialState,
            callback: b.callback,
            isReplace: b.isReplace,
            isForced: b.isForced,
            isTopLevelUnmount: b.isTopLevelUnmount,
            next: null
        };
        oc(c, b, d, a);
        return b;
    }
    function nd(a, b, c, d) {
        a = a.partialState;
        return 'function' === typeof a ? a.call(b, c, d) : a;
    }
    function Ea(a) {
        return 2 === a.tag && null != a.type.childContextTypes;
    }
    function kd(a, b) {
        var c = a.stateNode, d = a.type.childContextTypes;
        if ('function' !== typeof c.getChildContext)
            return b;
        c = c.getChildContext();
        for (var e in c)
            e in d ? void 0 : m('108', Ba(a) || 'Unknown', e);
        return q({}, b, c);
    }
    function F(a, b, c) {
        this.tag = a;
        this.key = b;
        this.stateNode = this.type = null;
        this.sibling = this.child = this['return'] = null;
        this.index = 0;
        this.memoizedState = this.updateQueue = this.memoizedProps = this.pendingProps = this.ref = null;
        this.internalContextTag = c;
        this.effectTag = 0;
        this.lastEffect = this.firstEffect = this.nextEffect = null;
        this.pendingWorkPriority = 0;
        this.alternate = null;
    }
    function Ia(a) {
        if (null === a || 'undefined' === typeof a)
            return null;
        a = Od && a[Od] || a['@@iterator'];
        return 'function' === typeof a ? a : null;
    }
    function Ja(a, b) {
        var c = b.ref;
        if (null !== c && 'function' !== typeof c) {
            if (b._owner) {
                b = b._owner;
                var d = void 0;
                b && ('number' === typeof b.tag ? (2 !== b.tag ? m('110') : void 0, d = b.stateNode) : d = b.getPublicInstance());
                d ? void 0 : m('147', c);
                var e = '' + c;
                if (null !== a && null !== a.ref && a.ref._stringRef === e)
                    return a.ref;
                a = function (a) {
                    var b = d.refs === ba ? d.refs = {} : d.refs;
                    null === a ? delete b[e] : b[e] = a;
                };
                a._stringRef = e;
                return a;
            }
            'string' !== typeof c ? m('148') : void 0;
            b._owner ? void 0 : m('149', c);
        }
        return c;
    }
    function qb(a, b) {
        'textarea' !== a.type && m('31', '[object Object]' === Object.prototype.toString.call(b) ? 'object with keys {' + Object.keys(b).join(', ') + '}' : b, '');
    }
    function rc(a, b) {
        function c(c, d) {
            if (b) {
                if (!a) {
                    if (null === d.alternate)
                        return;
                    d = d.alternate;
                }
                var e = c.lastEffect;
                null !== e ? (e.nextEffect = d, c.lastEffect = d) : c.firstEffect = c.lastEffect = d;
                d.nextEffect = null;
                d.effectTag = 8;
            }
        }
        function d(a, d) {
            if (!b)
                return null;
            for (; null !== d;)
                c(a, d), d = d.sibling;
            return null;
        }
        function e(a, b) {
            for (a = new Map(); null !== b;)
                null !== b.key ? a.set(b.key, b) : a.set(b.index, b), b = b.sibling;
            return a;
        }
        function f(b, c) {
            if (a)
                return b = $b(b, c), b.index = 0, b.sibling = null, b;
            b.pendingWorkPriority = c;
            b.effectTag = 0;
            b.index = 0;
            b.sibling = null;
            return b;
        }
        function g(a, c, d) {
            a.index = d;
            if (!b)
                return c;
            d = a.alternate;
            if (null !== d)
                return d = d.index, d < c ? (a.effectTag = 2, c) : d;
            a.effectTag = 2;
            return c;
        }
        function h(a) {
            b && null === a.alternate && (a.effectTag = 2);
            return a;
        }
        function k(a, b, c, d) {
            if (null === b || 6 !== b.tag)
                return c = ec(c, a.internalContextTag, d), c['return'] = a, c;
            b = f(b, d);
            b.pendingProps = c;
            b['return'] = a;
            return b;
        }
        function l(a, b, c, d) {
            if (null === b || b.type !== c.type)
                return d = fc(c, a.internalContextTag, d), d.ref = Ja(b, c), d['return'] = a, d;
            d = f(b, d);
            d.ref = Ja(b, c);
            d.pendingProps = c.props;
            d['return'] = a;
            return d;
        }
        function r(a, b, c, d) {
            if (null === b || 7 !== b.tag)
                return c = dc(c, a.internalContextTag, d), c['return'] = a, c;
            b = f(b, d);
            b.pendingProps = c;
            b['return'] = a;
            return b;
        }
        function q(a, b, c, d) {
            if (null === b || 9 !== b.tag)
                return b = new F(9, null, a.internalContextTag), b.type = c.value, b['return'] = a, b;
            b = f(b, d);
            b.type = c.value;
            b['return'] = a;
            return b;
        }
        function t(a, b, c, d) {
            if (null === b || 4 !== b.tag || b.stateNode.containerInfo !== c.containerInfo || b.stateNode.implementation !== c.implementation)
                return c = cc(c, a.internalContextTag, d), c['return'] = a, c;
            b = f(b, d);
            b.pendingProps = c.children || [];
            b['return'] = a;
            return b;
        }
        function w(a, b, c, d) {
            if (null === b || 10 !== b.tag)
                return c = md(c, a.internalContextTag, d), c['return'] = a, c;
            b = f(b, d);
            b.pendingProps = c;
            b['return'] = a;
            return b;
        }
        function z(a, b, c) {
            if ('string' === typeof b || 'number' === typeof b)
                return b = ec('' + b, a.internalContextTag, c), b['return'] = a, b;
            if ('object' === typeof b && null !== b) {
                switch (b.$$typeof) {
                case rb:
                    return c = fc(b, a.internalContextTag, c), c.ref = Ja(null, b), c['return'] = a, c;
                case sb:
                    return b = dc(b, a.internalContextTag, c), b['return'] = a, b;
                case tb:
                    return c = new F(9, null, a.internalContextTag), c.type = b.value, c['return'] = a, c;
                case ub:
                    return b = cc(b, a.internalContextTag, c), b['return'] = a, b;
                }
                if (vb(b) || Ia(b))
                    return b = md(b, a.internalContextTag, c), b['return'] = a, b;
                qb(a, b);
            }
            return null;
        }
        function A(a, b, c, d) {
            var e = null !== b ? b.key : null;
            if ('string' === typeof c || 'number' === typeof c)
                return null !== e ? null : k(a, b, '' + c, d);
            if ('object' === typeof c && null !== c) {
                switch (c.$$typeof) {
                case rb:
                    return c.key === e ? l(a, b, c, d) : null;
                case sb:
                    return c.key === e ? r(a, b, c, d) : null;
                case tb:
                    return null === e ? q(a, b, c, d) : null;
                case ub:
                    return c.key === e ? t(a, b, c, d) : null;
                }
                if (vb(c) || Ia(c))
                    return null !== e ? null : w(a, b, c, d);
                qb(a, c);
            }
            return null;
        }
        function B(a, b, c, d, e) {
            if ('string' === typeof d || 'number' === typeof d)
                return a = a.get(c) || null, k(b, a, '' + d, e);
            if ('object' === typeof d && null !== d) {
                switch (d.$$typeof) {
                case rb:
                    return a = a.get(null === d.key ? c : d.key) || null, l(b, a, d, e);
                case sb:
                    return a = a.get(null === d.key ? c : d.key) || null, r(b, a, d, e);
                case tb:
                    return a = a.get(c) || null, q(b, a, d, e);
                case ub:
                    return a = a.get(null === d.key ? c : d.key) || null, t(b, a, d, e);
                }
                if (vb(d) || Ia(d))
                    return a = a.get(c) || null, w(b, a, d, e);
                qb(b, d);
            }
            return null;
        }
        function C(a, f, h, m) {
            for (var p = null, n = null, l = f, k = f = 0, v = null; null !== l && k < h.length; k++) {
                l.index > k ? (v = l, l = null) : v = l.sibling;
                var r = A(a, l, h[k], m);
                if (null === r) {
                    null === l && (l = v);
                    break;
                }
                b && l && null === r.alternate && c(a, l);
                f = g(r, f, k);
                null === n ? p = r : n.sibling = r;
                n = r;
                l = v;
            }
            if (k === h.length)
                return d(a, l), p;
            if (null === l) {
                for (; k < h.length; k++)
                    if (l = z(a, h[k], m))
                        f = g(l, f, k), null === n ? p = l : n.sibling = l, n = l;
                return p;
            }
            for (l = e(a, l); k < h.length; k++)
                if (v = B(l, a, k, h[k], m)) {
                    if (b && null !== v.alternate)
                        l['delete'](null === v.key ? k : v.key);
                    f = g(v, f, k);
                    null === n ? p = v : n.sibling = v;
                    n = v;
                }
            b && l.forEach(function (b) {
                return c(a, b);
            });
            return p;
        }
        function x(a, f, h, l) {
            var p = Ia(h);
            'function' !== typeof p ? m('150') : void 0;
            h = p.call(h);
            null == h ? m('151') : void 0;
            for (var n = p = null, k = f, v = f = 0, r = null, q = h.next(); null !== k && !q.done; v++, q = h.next()) {
                k.index > v ? (r = k, k = null) : r = k.sibling;
                var t = A(a, k, q.value, l);
                if (null === t) {
                    k || (k = r);
                    break;
                }
                b && k && null === t.alternate && c(a, k);
                f = g(t, f, v);
                null === n ? p = t : n.sibling = t;
                n = t;
                k = r;
            }
            if (q.done)
                return d(a, k), p;
            if (null === k) {
                for (; !q.done; v++, q = h.next())
                    q = z(a, q.value, l), null !== q && (f = g(q, f, v), null === n ? p = q : n.sibling = q, n = q);
                return p;
            }
            for (k = e(a, k); !q.done; v++, q = h.next())
                if (q = B(k, a, v, q.value, l), null !== q) {
                    if (b && null !== q.alternate)
                        k['delete'](null === q.key ? v : q.key);
                    f = g(q, f, v);
                    null === n ? p = q : n.sibling = q;
                    n = q;
                }
            b && k.forEach(function (b) {
                return c(a, b);
            });
            return p;
        }
        return function (a, b, e, g) {
            var k = 'object' === typeof e && null !== e;
            if (k)
                switch (e.$$typeof) {
                case rb:
                    a: {
                        var l = e.key;
                        for (k = b; null !== k;) {
                            if (k.key === l)
                                if (k.type === e.type) {
                                    d(a, k.sibling);
                                    b = f(k, g);
                                    b.ref = Ja(k, e);
                                    b.pendingProps = e.props;
                                    b['return'] = a;
                                    a = b;
                                    break a;
                                } else {
                                    d(a, k);
                                    break;
                                }
                            else
                                c(a, k);
                            k = k.sibling;
                        }
                        g = fc(e, a.internalContextTag, g);
                        g.ref = Ja(b, e);
                        g['return'] = a;
                        a = g;
                    }
                    return h(a);
                case sb:
                    a: {
                        for (k = e.key; null !== b;) {
                            if (b.key === k)
                                if (7 === b.tag) {
                                    d(a, b.sibling);
                                    b = f(b, g);
                                    b.pendingProps = e;
                                    b['return'] = a;
                                    a = b;
                                    break a;
                                } else {
                                    d(a, b);
                                    break;
                                }
                            else
                                c(a, b);
                            b = b.sibling;
                        }
                        e = dc(e, a.internalContextTag, g);
                        e['return'] = a;
                        a = e;
                    }
                    return h(a);
                case tb:
                    a: {
                        if (null !== b)
                            if (9 === b.tag) {
                                d(a, b.sibling);
                                b = f(b, g);
                                b.type = e.value;
                                b['return'] = a;
                                a = b;
                                break a;
                            } else
                                d(a, b);
                        b = new F(9, null, a.internalContextTag);
                        b.type = e.value;
                        b['return'] = a;
                        a = b;
                    }
                    return h(a);
                case ub:
                    a: {
                        for (k = e.key; null !== b;) {
                            if (b.key === k)
                                if (4 === b.tag && b.stateNode.containerInfo === e.containerInfo && b.stateNode.implementation === e.implementation) {
                                    d(a, b.sibling);
                                    b = f(b, g);
                                    b.pendingProps = e.children || [];
                                    b['return'] = a;
                                    a = b;
                                    break a;
                                } else {
                                    d(a, b);
                                    break;
                                }
                            else
                                c(a, b);
                            b = b.sibling;
                        }
                        e = cc(e, a.internalContextTag, g);
                        e['return'] = a;
                        a = e;
                    }
                    return h(a);
                }
            if ('string' === typeof e || 'number' === typeof e)
                return e = '' + e, null !== b && 6 === b.tag ? (d(a, b.sibling), b = f(b, g), b.pendingProps = e, b['return'] = a, a = b) : (d(a, b), e = ec(e, a.internalContextTag, g), e['return'] = a, a = e), h(a);
            if (vb(e))
                return C(a, b, e, g);
            if (Ia(e))
                return x(a, b, e, g);
            k && qb(a, e);
            if ('undefined' === typeof e)
                switch (a.tag) {
                case 2:
                case 1:
                    e = a.type, m('152', e.displayName || e.name || 'Component');
                }
            return d(a, b);
        };
    }
    function ld(a, b) {
        return a === b ? 0 !== a || 0 !== b || 1 / a === 1 / b : a !== a && b !== b;
    }
    function Pd(a) {
        return function (b) {
            try {
                return a(b);
            } catch (c) {
            }
        };
    }
    function sc(a) {
        if (!a)
            return ba;
        a = fa.get(a);
        return 'number' === typeof a.tag ? $c(a) : a._processChildContext(a._context);
    }
    function Zc(a) {
        for (; a && a.firstChild;)
            a = a.firstChild;
        return a;
    }
    function Qd(a, b) {
        return a && b ? a === b ? !0 : Wc(a) ? !1 : Wc(b) ? Qd(a, b.parentNode) : 'contains' in a ? a.contains(b) : a.compareDocumentPosition ? !!(a.compareDocumentPosition(b) & 16) : !1 : !1;
    }
    function C(a) {
        if (void 0 !== a._hostParent)
            return a._hostParent;
        if ('number' === typeof a.tag) {
            do
                a = a['return'];
            while (a && 5 !== a.tag);
            if (a)
                return a;
        }
        return null;
    }
    function Rd(a, b) {
        for (var c = 0, d = a; d; d = C(d))
            c++;
        d = 0;
        for (var e = b; e; e = C(e))
            d++;
        for (; 0 < c - d;)
            a = C(a), c--;
        for (; 0 < d - c;)
            b = C(b), d--;
        for (; c--;) {
            if (a === b || a === b.alternate)
                return a;
            a = C(a);
            b = C(b);
        }
        return null;
    }
    function Sd(a, b, c) {
        if (b = Td(a, c.dispatchConfig.phasedRegistrationNames[b]))
            c._dispatchListeners = sa(c._dispatchListeners, b), c._dispatchInstances = sa(c._dispatchInstances, a);
    }
    function pf(a) {
        a && a.dispatchConfig.phasedRegistrationNames && wb.traverseTwoPhase(a._targetInst, Sd, a);
    }
    function qf(a) {
        if (a && a.dispatchConfig.phasedRegistrationNames) {
            var b = a._targetInst;
            b = b ? wb.getParentInstance(b) : null;
            wb.traverseTwoPhase(b, Sd, a);
        }
    }
    function Ud(a, b, c) {
        a && c && c.dispatchConfig.registrationName && (b = Td(a, c.dispatchConfig.registrationName)) && (c._dispatchListeners = sa(c._dispatchListeners, b), c._dispatchInstances = sa(c._dispatchInstances, a));
    }
    function rf(a) {
        a && a.dispatchConfig.registrationName && Ud(a._targetInst, null, a);
    }
    function Ka(a, b, c, d) {
        this.dispatchConfig = a;
        this._targetInst = b;
        this.nativeEvent = c;
        a = this.constructor.Interface;
        for (var e in a)
            a.hasOwnProperty(e) && ((b = a[e]) ? this[e] = b(c) : 'target' === e ? this.target = d : this[e] = c[e]);
        this.isDefaultPrevented = (null != c.defaultPrevented ? c.defaultPrevented : !1 === c.returnValue) ? w.thatReturnsTrue : w.thatReturnsFalse;
        this.isPropagationStopped = w.thatReturnsFalse;
        return this;
    }
    function sf(a, b, c, d) {
        if (this.eventPool.length) {
            var e = this.eventPool.pop();
            this.call(e, a, b, c, d);
            return e;
        }
        return new this(a, b, c, d);
    }
    function tf(a) {
        a instanceof this ? void 0 : m('223');
        a.destructor();
        10 > this.eventPool.length && this.eventPool.push(a);
    }
    function Vd(a) {
        a.eventPool = [];
        a.getPooled = sf;
        a.release = tf;
    }
    function Wd(a, b, c, d) {
        return O.call(this, a, b, c, d);
    }
    function Xd(a, b, c, d) {
        return O.call(this, a, b, c, d);
    }
    function uf() {
        var a = window.opera;
        return 'object' === typeof a && 'function' === typeof a.version && 12 >= parseInt(a.version(), 10);
    }
    function Yd(a, b) {
        switch (a) {
        case 'topKeyUp':
            return -1 !== vf.indexOf(b.keyCode);
        case 'topKeyDown':
            return 229 !== b.keyCode;
        case 'topKeyPress':
        case 'topMouseDown':
        case 'topBlur':
            return !0;
        default:
            return !1;
        }
    }
    function Zd(a) {
        a = a.detail;
        return 'object' === typeof a && 'data' in a ? a.data : null;
    }
    function wf(a, b) {
        switch (a) {
        case 'topCompositionEnd':
            return Zd(b);
        case 'topKeyPress':
            if (32 !== b.which)
                return null;
            $d = !0;
            return ae;
        case 'topTextInput':
            return a = b.data, a === ae && $d ? null : a;
        default:
            return null;
        }
    }
    function xf(a, b) {
        if (wa)
            return 'topCompositionEnd' === a || !tc && Yd(a, b) ? (a = xb.getData(), xb.reset(), wa = !1, a) : null;
        switch (a) {
        case 'topPaste':
            return null;
        case 'topKeyPress':
            if (!(b.ctrlKey || b.altKey || b.metaKey) || b.ctrlKey && b.altKey) {
                if (b.char && 1 < b.char.length)
                    return b.char;
                if (b.which)
                    return String.fromCharCode(b.which);
            }
            return null;
        case 'topCompositionEnd':
            return be ? null : b.data;
        default:
            return null;
        }
    }
    function ce(a, b, c) {
        a = O.getPooled(de.change, a, b, c);
        a.type = 'change';
        yb.enqueueStateRestore(c);
        la.accumulateTwoPhaseDispatches(a);
        return a;
    }
    function yf(a) {
        X.enqueueEvents(a);
        X.processEventQueue(!1);
    }
    function zb(a) {
        var b = N.getNodeFromInstance(a);
        if (xa.updateValueIfChanged(b))
            return a;
    }
    function zf(a, b) {
        if ('topChange' === a)
            return b;
    }
    function ee() {
        La && (La.detachEvent('onpropertychange', fe), Ma = La = null);
    }
    function fe(a) {
        'value' === a.propertyName && zb(Ma) && (a = ce(Ma, a, jb(a)), Ab.batchedUpdates(yf, a));
    }
    function Af(a, b, c) {
        'topFocus' === a ? (ee(), La = b, Ma = c, La.attachEvent('onpropertychange', fe)) : 'topBlur' === a && ee();
    }
    function Bf(a) {
        if ('topSelectionChange' === a || 'topKeyUp' === a || 'topKeyDown' === a)
            return zb(Ma);
    }
    function Cf(a, b) {
        if ('topClick' === a)
            return zb(b);
    }
    function Df(a, b) {
        if ('topInput' === a || 'topChange' === a)
            return zb(b);
    }
    function ge(a, b, c, d) {
        return O.call(this, a, b, c, d);
    }
    function Ne(a) {
        var b = this.nativeEvent;
        return b.getModifierState ? b.getModifierState(a) : (a = Ef[a]) ? !!b[a] : !1;
    }
    function he(a, b, c, d) {
        return Y.call(this, a, b, c, d);
    }
    function ie(a, b) {
        if (uc || null == ya || ya !== Qb())
            return null;
        var c = ya;
        'selectionStart' in c && vc.hasSelectionCapabilities(c) ? c = {
            start: c.selectionStart,
            end: c.selectionEnd
        } : window.getSelection ? (c = window.getSelection(), c = {
            anchorNode: c.anchorNode,
            anchorOffset: c.anchorOffset,
            focusNode: c.focusNode,
            focusOffset: c.focusOffset
        }) : c = void 0;
        return Na && bc(Na, c) ? null : (Na = c, a = O.getPooled(je.select, wc, a, b), a.type = 'select', a.target = ya, la.accumulateTwoPhaseDispatches(a), a);
    }
    function ke(a, b, c, d) {
        return O.call(this, a, b, c, d);
    }
    function le(a, b, c, d) {
        return O.call(this, a, b, c, d);
    }
    function me(a, b, c, d) {
        return Y.call(this, a, b, c, d);
    }
    function ne(a, b, c, d) {
        return Y.call(this, a, b, c, d);
    }
    function oe(a, b, c, d) {
        return ma.call(this, a, b, c, d);
    }
    function pe(a, b, c, d) {
        return Y.call(this, a, b, c, d);
    }
    function qe(a, b, c, d) {
        return O.call(this, a, b, c, d);
    }
    function re(a, b, c, d) {
        return ma.call(this, a, b, c, d);
    }
    function xc(a) {
        return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType && (8 !== a.nodeType || ' react-mount-point-unstable ' !== a.nodeValue));
    }
    function Ff(a) {
        a = a ? 9 === a.nodeType ? a.documentElement : a.firstChild : null;
        return !(!a || 1 !== a.nodeType || !a.hasAttribute(Gf));
    }
    function Bb(a, b, c, d, e) {
        xc(c) ? void 0 : m('200');
        var f = c._reactRootContainer;
        if (f)
            B.updateContainer(b, f, a, e);
        else {
            if (!d && !Ff(c))
                for (d = void 0; d = c.lastChild;)
                    c.removeChild(d);
            var g = B.createContainer(c);
            f = c._reactRootContainer = g;
            B.unbatchedUpdates(function () {
                B.updateContainer(b, g, a, e);
            });
        }
        return B.getPublicRootInstance(f);
    }
    function se(a, b) {
        var c = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
        xc(b) ? void 0 : m('200');
        return te.createPortal(a, b, null, c);
    }
    Za ? void 0 : m('227');
    var z = !('undefined' === typeof window || !window.document || !window.document.createElement), q = Za.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.assign, kb = null, ta = {}, ha = {
            plugins: [],
            eventNameDispatchConfigs: {},
            registrationNameModules: {},
            registrationNameDependencies: {},
            possibleRegistrationNames: null,
            injectEventPluginOrder: function (a) {
                kb ? m('101') : void 0;
                kb = Array.prototype.slice.call(a);
                ud();
            },
            injectEventPluginsByName: function (a) {
                var b = !1, c;
                for (c in a)
                    if (a.hasOwnProperty(c)) {
                        var d = a[c];
                        ta.hasOwnProperty(c) && ta[c] === d || (ta[c] ? m('102', c) : void 0, ta[c] = d, b = !0);
                    }
                b && ud();
            }
        }, na = ha;
    ka.thatReturns = lb;
    ka.thatReturnsFalse = lb(!1);
    ka.thatReturnsTrue = lb(!0);
    ka.thatReturnsNull = lb(null);
    ka.thatReturnsThis = function () {
        return this;
    };
    ka.thatReturnsArgument = function (a) {
        return a;
    };
    var w = ka, ue = {
            listen: function (a, b, c) {
                if (a.addEventListener)
                    return a.addEventListener(b, c, !1), {
                        remove: function () {
                            a.removeEventListener(b, c, !1);
                        }
                    };
                if (a.attachEvent)
                    return a.attachEvent('on' + b, c), {
                        remove: function () {
                            a.detachEvent('on' + b, c);
                        }
                    };
            },
            capture: function (a, b, c) {
                return a.addEventListener ? (a.addEventListener(b, c, !0), {
                    remove: function () {
                        a.removeEventListener(b, c, !0);
                    }
                }) : { remove: w };
            },
            registerDefault: function () {
            }
        }, Hf = {
            children: !0,
            dangerouslySetInnerHTML: !0,
            autoFocus: !0,
            defaultValue: !0,
            defaultChecked: !0,
            innerHTML: !0,
            suppressContentEditableWarning: !0,
            style: !0
        }, ve = {
            MUST_USE_PROPERTY: 1,
            HAS_BOOLEAN_VALUE: 4,
            HAS_NUMERIC_VALUE: 8,
            HAS_POSITIVE_NUMERIC_VALUE: 24,
            HAS_OVERLOADED_BOOLEAN_VALUE: 32,
            HAS_STRING_BOOLEAN_VALUE: 64,
            injectDOMPropertyConfig: function (a) {
                var b = ve, c = a.Properties || {}, d = a.DOMAttributeNamespaces || {}, e = a.DOMAttributeNames || {};
                a = a.DOMMutationMethods || {};
                for (var f in c) {
                    aa.properties.hasOwnProperty(f) ? m('48', f) : void 0;
                    var g = f.toLowerCase(), h = c[f];
                    g = {
                        attributeName: g,
                        attributeNamespace: null,
                        propertyName: f,
                        mutationMethod: null,
                        mustUseProperty: ua(h, b.MUST_USE_PROPERTY),
                        hasBooleanValue: ua(h, b.HAS_BOOLEAN_VALUE),
                        hasNumericValue: ua(h, b.HAS_NUMERIC_VALUE),
                        hasPositiveNumericValue: ua(h, b.HAS_POSITIVE_NUMERIC_VALUE),
                        hasOverloadedBooleanValue: ua(h, b.HAS_OVERLOADED_BOOLEAN_VALUE),
                        hasStringBooleanValue: ua(h, b.HAS_STRING_BOOLEAN_VALUE)
                    };
                    1 >= g.hasBooleanValue + g.hasNumericValue + g.hasOverloadedBooleanValue ? void 0 : m('50', f);
                    e.hasOwnProperty(f) && (g.attributeName = e[f]);
                    d.hasOwnProperty(f) && (g.attributeNamespace = d[f]);
                    a.hasOwnProperty(f) && (g.mutationMethod = a[f]);
                    aa.properties[f] = g;
                }
            }
        }, aa = {
            ID_ATTRIBUTE_NAME: 'data-reactid',
            ROOT_ATTRIBUTE_NAME: 'data-reactroot',
            ATTRIBUTE_NAME_START_CHAR: ':A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD',
            ATTRIBUTE_NAME_CHAR: ':A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040',
            properties: {},
            shouldSetAttribute: function (a, b) {
                if (aa.isReservedProp(a) || !('o' !== a[0] && 'O' !== a[0] || 'n' !== a[1] && 'N' !== a[1]))
                    return !1;
                if (null === b)
                    return !0;
                switch (typeof b) {
                case 'boolean':
                    return aa.shouldAttributeAcceptBooleanValue(a);
                case 'undefined':
                case 'number':
                case 'string':
                case 'object':
                    return !0;
                default:
                    return !1;
                }
            },
            getPropertyInfo: function (a) {
                return aa.properties.hasOwnProperty(a) ? aa.properties[a] : null;
            },
            shouldAttributeAcceptBooleanValue: function (a) {
                if (aa.isReservedProp(a))
                    return !0;
                var b = aa.getPropertyInfo(a);
                if (b)
                    return b.hasBooleanValue || b.hasStringBooleanValue || b.hasOverloadedBooleanValue;
                a = a.toLowerCase().slice(0, 5);
                return 'data-' === a || 'aria-' === a;
            },
            isReservedProp: function (a) {
                return Hf.hasOwnProperty(a);
            },
            injection: ve
        }, A = aa, gf = A.ID_ATTRIBUTE_NAME, yd = { hasCachedChildNodes: 1 }, we = Math.random().toString(36).slice(2), M = '__reactInternalInstance$' + we, xe = '__reactEventHandlers$' + we, N = {
            getClosestInstanceFromNode: zd,
            getInstanceFromNode: function (a) {
                var b = a[M];
                if (b)
                    return 5 === b.tag || 6 === b.tag ? b : b._hostNode === a ? b : null;
                b = zd(a);
                return null != b && b._hostNode === a ? b : null;
            },
            getNodeFromInstance: function (a) {
                if (5 === a.tag || 6 === a.tag)
                    return a.stateNode;
                void 0 === a._hostNode ? m('33') : void 0;
                if (a._hostNode)
                    return a._hostNode;
                for (var b = []; !a._hostNode;)
                    b.push(a), a._hostParent ? void 0 : m('34'), a = a._hostParent;
                for (; b.length; a = b.pop())
                    lc(a, a._hostNode);
                return a._hostNode;
            },
            precacheChildNodes: lc,
            precacheNode: xd,
            uncacheNode: function (a) {
                var b = a._hostNode;
                b && (delete b[M], a._hostNode = null);
            },
            precacheFiberNode: function (a, b) {
                b[M] = a;
            },
            getFiberCurrentPropsFromNode: function (a) {
                return a[xe] || null;
            },
            updateFiberProps: function (a, b) {
                a[xe] = b;
            }
        }, fa = {
            remove: function (a) {
                a._reactInternalFiber = void 0;
            },
            get: function (a) {
                return a._reactInternalFiber;
            },
            has: function (a) {
                return void 0 !== a._reactInternalFiber;
            },
            set: function (a, b) {
                a._reactInternalFiber = b;
            }
        }, yc = { ReactCurrentOwner: Za.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner }, Oa = {
            isFiberMounted: function (a) {
                return 2 === mb(a);
            },
            isMounted: function (a) {
                return (a = fa.get(a)) ? 2 === mb(a) : !1;
            },
            findCurrentFiberUsingSlowPath: mc,
            findCurrentHostFiber: function (a) {
                a = mc(a);
                if (!a)
                    return null;
                for (var b = a;;) {
                    if (5 === b.tag || 6 === b.tag)
                        return b;
                    if (b.child)
                        b.child['return'] = b, b = b.child;
                    else {
                        if (b === a)
                            break;
                        for (; !b.sibling;) {
                            if (!b['return'] || b['return'] === a)
                                return null;
                            b = b['return'];
                        }
                        b.sibling['return'] = b['return'];
                        b = b.sibling;
                    }
                }
                return null;
            },
            findCurrentHostFiberWithNoPortals: function (a) {
                a = mc(a);
                if (!a)
                    return null;
                for (var b = a;;) {
                    if (5 === b.tag || 6 === b.tag)
                        return b;
                    if (b.child && 4 !== b.tag)
                        b.child['return'] = b, b = b.child;
                    else {
                        if (b === a)
                            break;
                        for (; !b.sibling;) {
                            if (!b['return'] || b['return'] === a)
                                return null;
                            b = b['return'];
                        }
                        b.sibling['return'] = b['return'];
                        b = b.sibling;
                    }
                }
                return null;
            }
        }, t = {
            _caughtError: null,
            _hasCaughtError: !1,
            _rethrowError: null,
            _hasRethrowError: !1,
            injection: {
                injectErrorUtils: function (a) {
                    'function' !== typeof a.invokeGuardedCallback ? m('197') : void 0;
                    td = a.invokeGuardedCallback;
                }
            },
            invokeGuardedCallback: function (a, b, c, d, e, f, g, h, k) {
                td.apply(t, arguments);
            },
            invokeGuardedCallbackAndCatchFirstError: function (a, b, c, d, e, f, g, h, k) {
                t.invokeGuardedCallback.apply(this, arguments);
                if (t.hasCaughtError()) {
                    var l = t.clearCaughtError();
                    t._hasRethrowError || (t._hasRethrowError = !0, t._rethrowError = l);
                }
            },
            rethrowCaughtError: function () {
                return ff.apply(t, arguments);
            },
            hasCaughtError: function () {
                return t._hasCaughtError;
            },
            clearCaughtError: function () {
                if (t._hasCaughtError) {
                    var a = t._caughtError;
                    t._caughtError = null;
                    t._hasCaughtError = !1;
                    return a;
                }
                m('198');
            }
        }, Cd = t, Cb, nc = {
            isEndish: function (a) {
                return 'topMouseUp' === a || 'topTouchEnd' === a || 'topTouchCancel' === a;
            },
            isMoveish: function (a) {
                return 'topMouseMove' === a || 'topTouchMove' === a;
            },
            isStartish: function (a) {
                return 'topMouseDown' === a || 'topTouchStart' === a;
            },
            executeDirectDispatch: function (a) {
                var b = a._dispatchListeners, c = a._dispatchInstances;
                Array.isArray(b) ? m('103') : void 0;
                a.currentTarget = b ? nc.getNodeFromInstance(c) : null;
                b = b ? b(a) : null;
                a.currentTarget = null;
                a._dispatchListeners = null;
                a._dispatchInstances = null;
                return b;
            },
            executeDispatchesInOrder: function (a, b) {
                var c = a._dispatchListeners, d = a._dispatchInstances;
                if (Array.isArray(c))
                    for (var e = 0; e < c.length && !a.isPropagationStopped(); e++)
                        Bd(a, b, c[e], d[e]);
                else
                    c && Bd(a, b, c, d);
                a._dispatchListeners = null;
                a._dispatchInstances = null;
            },
            executeDispatchesInOrderStopAtTrue: function (a) {
                a: {
                    var b = a._dispatchListeners;
                    var c = a._dispatchInstances;
                    if (Array.isArray(b))
                        for (var d = 0; d < b.length && !a.isPropagationStopped(); d++) {
                            if (b[d](a, c[d])) {
                                b = c[d];
                                break a;
                            }
                        }
                    else if (b && b(a, c)) {
                        b = c;
                        break a;
                    }
                    b = null;
                }
                a._dispatchInstances = null;
                a._dispatchListeners = null;
                return b;
            },
            hasDispatches: function (a) {
                return !!a._dispatchListeners;
            },
            getFiberCurrentPropsFromNode: function (a) {
                return Cb.getFiberCurrentPropsFromNode(a);
            },
            getInstanceFromNode: function (a) {
                return Cb.getInstanceFromNode(a);
            },
            getNodeFromInstance: function (a) {
                return Cb.getNodeFromInstance(a);
            },
            injection: {
                injectComponentTree: function (a) {
                    Cb = a;
                }
            }
        }, Ga = nc, nb = null, Pa = null, Qa = null, yb = {
            injection: {
                injectFiberControlledHostComponent: function (a) {
                    nb = a;
                }
            },
            enqueueStateRestore: function (a) {
                Pa ? Qa ? Qa.push(a) : Qa = [a] : Pa = a;
            },
            restoreStateIfNeeded: function () {
                if (Pa) {
                    var a = Pa, b = Qa;
                    Qa = Pa = null;
                    Dd(a);
                    if (b)
                        for (a = 0; a < b.length; a++)
                            Dd(b[a]);
                }
            }
        }, zc = !1, Ab = {
            batchedUpdates: function (a, b) {
                if (zc)
                    return kc(Ed, a, b);
                zc = !0;
                try {
                    return kc(Ed, a, b);
                } finally {
                    zc = !1, yb.restoreStateIfNeeded();
                }
            },
            injection: {
                injectStackBatchedUpdates: function (a) {
                    kc = a;
                },
                injectFiberBatchedUpdates: function (a) {
                    sd = a;
                }
            }
        }, Db = [], ia = {
            _enabled: !0,
            _handleTopLevel: null,
            setHandleTopLevel: function (a) {
                ia._handleTopLevel = a;
            },
            setEnabled: function (a) {
                ia._enabled = !!a;
            },
            isEnabled: function () {
                return ia._enabled;
            },
            trapBubbledEvent: function (a, b, c) {
                return c ? ue.listen(c, b, ia.dispatchEvent.bind(null, a)) : null;
            },
            trapCapturedEvent: function (a, b, c) {
                return c ? ue.capture(c, b, ia.dispatchEvent.bind(null, a)) : null;
            },
            dispatchEvent: function (a, b) {
                if (ia._enabled) {
                    var c = jb(b);
                    c = N.getClosestInstanceFromNode(c);
                    null === c || 'number' !== typeof c.tag || Oa.isFiberMounted(c) || (c = null);
                    if (Db.length) {
                        var d = Db.pop();
                        d.topLevelType = a;
                        d.nativeEvent = b;
                        d.targetInst = c;
                        a = d;
                    } else
                        a = {
                            topLevelType: a,
                            nativeEvent: b,
                            targetInst: c,
                            ancestors: []
                        };
                    try {
                        Ab.batchedUpdates(hf, a);
                    } finally {
                        a.topLevelType = null, a.nativeEvent = null, a.targetInst = null, a.ancestors.length = 0, 10 > Db.length && Db.push(a);
                    }
                }
            }
        }, G = ia, Ra = null, X = {
            injection: {
                injectEventPluginOrder: na.injectEventPluginOrder,
                injectEventPluginsByName: na.injectEventPluginsByName
            },
            getListener: function (a, b) {
                if ('number' === typeof a.tag) {
                    var c = a.stateNode;
                    if (!c)
                        return null;
                    var d = Ga.getFiberCurrentPropsFromNode(c);
                    if (!d)
                        return null;
                    c = d[b];
                    if (Fd(b, a.type, d))
                        return null;
                } else {
                    d = a._currentElement;
                    if ('string' === typeof d || 'number' === typeof d || !a._rootNodeID)
                        return null;
                    a = d.props;
                    c = a[b];
                    if (Fd(b, d.type, a))
                        return null;
                }
                c && 'function' !== typeof c ? m('231', b, typeof c) : void 0;
                return c;
            },
            extractEvents: function (a, b, c, d) {
                for (var e, f = na.plugins, g = 0; g < f.length; g++) {
                    var h = f[g];
                    h && (h = h.extractEvents(a, b, c, d)) && (e = sa(e, h));
                }
                return e;
            },
            enqueueEvents: function (a) {
                a && (Ra = sa(Ra, a));
            },
            processEventQueue: function (a) {
                var b = Ra;
                Ra = null;
                a ? Ha(b, ef) : Ha(b, df);
                Ra ? m('95') : void 0;
                Cd.rethrowCaughtError();
            }
        }, qd;
    z && (qd = document.implementation && document.implementation.hasFeature && !0 !== document.implementation.hasFeature('', ''));
    var ra = {
            animationend: ob('Animation', 'AnimationEnd'),
            animationiteration: ob('Animation', 'AnimationIteration'),
            animationstart: ob('Animation', 'AnimationStart'),
            transitionend: ob('Transition', 'TransitionEnd')
        }, jc = {}, pd = {};
    z && (pd = document.createElement('div').style, 'AnimationEvent' in window || (delete ra.animationend.animation, delete ra.animationiteration.animation, delete ra.animationstart.animation), 'TransitionEvent' in window || delete ra.transitionend.transition);
    var ye = {
            topAbort: 'abort',
            topAnimationEnd: ib('animationend') || 'animationend',
            topAnimationIteration: ib('animationiteration') || 'animationiteration',
            topAnimationStart: ib('animationstart') || 'animationstart',
            topBlur: 'blur',
            topCancel: 'cancel',
            topCanPlay: 'canplay',
            topCanPlayThrough: 'canplaythrough',
            topChange: 'change',
            topClick: 'click',
            topClose: 'close',
            topCompositionEnd: 'compositionend',
            topCompositionStart: 'compositionstart',
            topCompositionUpdate: 'compositionupdate',
            topContextMenu: 'contextmenu',
            topCopy: 'copy',
            topCut: 'cut',
            topDoubleClick: 'dblclick',
            topDrag: 'drag',
            topDragEnd: 'dragend',
            topDragEnter: 'dragenter',
            topDragExit: 'dragexit',
            topDragLeave: 'dragleave',
            topDragOver: 'dragover',
            topDragStart: 'dragstart',
            topDrop: 'drop',
            topDurationChange: 'durationchange',
            topEmptied: 'emptied',
            topEncrypted: 'encrypted',
            topEnded: 'ended',
            topError: 'error',
            topFocus: 'focus',
            topInput: 'input',
            topKeyDown: 'keydown',
            topKeyPress: 'keypress',
            topKeyUp: 'keyup',
            topLoadedData: 'loadeddata',
            topLoad: 'load',
            topLoadedMetadata: 'loadedmetadata',
            topLoadStart: 'loadstart',
            topMouseDown: 'mousedown',
            topMouseMove: 'mousemove',
            topMouseOut: 'mouseout',
            topMouseOver: 'mouseover',
            topMouseUp: 'mouseup',
            topPaste: 'paste',
            topPause: 'pause',
            topPlay: 'play',
            topPlaying: 'playing',
            topProgress: 'progress',
            topRateChange: 'ratechange',
            topScroll: 'scroll',
            topSeeked: 'seeked',
            topSeeking: 'seeking',
            topSelectionChange: 'selectionchange',
            topStalled: 'stalled',
            topSuspend: 'suspend',
            topTextInput: 'textInput',
            topTimeUpdate: 'timeupdate',
            topToggle: 'toggle',
            topTouchCancel: 'touchcancel',
            topTouchEnd: 'touchend',
            topTouchMove: 'touchmove',
            topTouchStart: 'touchstart',
            topTransitionEnd: ib('transitionend') || 'transitionend',
            topVolumeChange: 'volumechange',
            topWaiting: 'waiting',
            topWheel: 'wheel'
        }, Hd = {}, jf = 0, pb = '_reactListenersID' + ('' + Math.random()).slice(2), l = q({}, {
            handleTopLevel: function (a, b, c, d) {
                a = X.extractEvents(a, b, c, d);
                X.enqueueEvents(a);
                X.processEventQueue(!1);
            }
        }, {
            setEnabled: function (a) {
                G && G.setEnabled(a);
            },
            isEnabled: function () {
                return !(!G || !G.isEnabled());
            },
            listenTo: function (a, b) {
                var c = Gd(b);
                a = na.registrationNameDependencies[a];
                for (var d = 0; d < a.length; d++) {
                    var e = a[d];
                    c.hasOwnProperty(e) && c[e] || ('topWheel' === e ? Fa('wheel') ? G.trapBubbledEvent('topWheel', 'wheel', b) : Fa('mousewheel') ? G.trapBubbledEvent('topWheel', 'mousewheel', b) : G.trapBubbledEvent('topWheel', 'DOMMouseScroll', b) : 'topScroll' === e ? G.trapCapturedEvent('topScroll', 'scroll', b) : 'topFocus' === e || 'topBlur' === e ? (G.trapCapturedEvent('topFocus', 'focus', b), G.trapCapturedEvent('topBlur', 'blur', b), c.topBlur = !0, c.topFocus = !0) : 'topCancel' === e ? (Fa('cancel', !0) && G.trapCapturedEvent('topCancel', 'cancel', b), c.topCancel = !0) : 'topClose' === e ? (Fa('close', !0) && G.trapCapturedEvent('topClose', 'close', b), c.topClose = !0) : ye.hasOwnProperty(e) && G.trapBubbledEvent(e, ye[e], b), c[e] = !0);
                }
            },
            isListeningToAllDependencies: function (a, b) {
                b = Gd(b);
                a = na.registrationNameDependencies[a];
                for (var c = 0; c < a.length; c++) {
                    var d = a[c];
                    if (!b.hasOwnProperty(d) || !b[d])
                        return !1;
                }
                return !0;
            },
            trapBubbledEvent: function (a, b, c) {
                return G.trapBubbledEvent(a, b, c);
            },
            trapCapturedEvent: function (a, b, c) {
                return G.trapCapturedEvent(a, b, c);
            }
        }), Sa = {
            animationIterationCount: !0,
            borderImageOutset: !0,
            borderImageSlice: !0,
            borderImageWidth: !0,
            boxFlex: !0,
            boxFlexGroup: !0,
            boxOrdinalGroup: !0,
            columnCount: !0,
            columns: !0,
            flex: !0,
            flexGrow: !0,
            flexPositive: !0,
            flexShrink: !0,
            flexNegative: !0,
            flexOrder: !0,
            gridRow: !0,
            gridRowEnd: !0,
            gridRowSpan: !0,
            gridRowStart: !0,
            gridColumn: !0,
            gridColumnEnd: !0,
            gridColumnSpan: !0,
            gridColumnStart: !0,
            fontWeight: !0,
            lineClamp: !0,
            lineHeight: !0,
            opacity: !0,
            order: !0,
            orphans: !0,
            tabSize: !0,
            widows: !0,
            zIndex: !0,
            zoom: !0,
            fillOpacity: !0,
            floodOpacity: !0,
            stopOpacity: !0,
            strokeDasharray: !0,
            strokeDashoffset: !0,
            strokeMiterlimit: !0,
            strokeOpacity: !0,
            strokeWidth: !0
        }, If = [
            'Webkit',
            'ms',
            'Moz',
            'O'
        ];
    Object.keys(Sa).forEach(function (a) {
        If.forEach(function (b) {
            b = b + a.charAt(0).toUpperCase() + a.substring(1);
            Sa[b] = Sa[a];
        });
    });
    var Jf = {
            background: {
                backgroundAttachment: !0,
                backgroundColor: !0,
                backgroundImage: !0,
                backgroundPositionX: !0,
                backgroundPositionY: !0,
                backgroundRepeat: !0
            },
            backgroundPosition: {
                backgroundPositionX: !0,
                backgroundPositionY: !0
            },
            border: {
                borderWidth: !0,
                borderStyle: !0,
                borderColor: !0
            },
            borderBottom: {
                borderBottomWidth: !0,
                borderBottomStyle: !0,
                borderBottomColor: !0
            },
            borderLeft: {
                borderLeftWidth: !0,
                borderLeftStyle: !0,
                borderLeftColor: !0
            },
            borderRight: {
                borderRightWidth: !0,
                borderRightStyle: !0,
                borderRightColor: !0
            },
            borderTop: {
                borderTopWidth: !0,
                borderTopStyle: !0,
                borderTopColor: !0
            },
            font: {
                fontStyle: !0,
                fontVariant: !0,
                fontWeight: !0,
                fontSize: !0,
                lineHeight: !0,
                fontFamily: !0
            },
            outline: {
                outlineWidth: !0,
                outlineStyle: !0,
                outlineColor: !0
            }
        }, ze = !1;
    if (z) {
        var Kf = document.createElement('div').style;
        try {
            Kf.font = '';
        } catch (a) {
            ze = !0;
        }
    }
    var Ae = {
            createDangerousStringForStyles: function () {
            },
            setValueForStyles: function (a, b) {
                a = a.style;
                for (var c in b)
                    if (b.hasOwnProperty(c)) {
                        var d = 0 === c.indexOf('--');
                        var e = c;
                        var f = b[c];
                        e = null == f || 'boolean' === typeof f || '' === f ? '' : d || 'number' !== typeof f || 0 === f || Sa.hasOwnProperty(e) && Sa[e] ? ('' + f).trim() : f + 'px';
                        'float' === c && (c = 'cssFloat');
                        if (d)
                            a.setProperty(c, e);
                        else if (e)
                            a[c] = e;
                        else if (d = ze && Jf[c])
                            for (var g in d)
                                a[g] = '';
                        else
                            a[c] = '';
                    }
            }
        }, lf = new RegExp('^[' + A.ATTRIBUTE_NAME_START_CHAR + '][' + A.ATTRIBUTE_NAME_CHAR + ']*$'), Jd = {}, Id = {}, Ac = {
            setAttributeForID: function (a, b) {
                a.setAttribute(A.ID_ATTRIBUTE_NAME, b);
            },
            setAttributeForRoot: function (a) {
                a.setAttribute(A.ROOT_ATTRIBUTE_NAME, '');
            },
            getValueForProperty: function () {
            },
            getValueForAttribute: function () {
            },
            setValueForProperty: function (a, b, c) {
                var d = A.getPropertyInfo(b);
                if (d && A.shouldSetAttribute(b, c)) {
                    var e = d.mutationMethod;
                    e ? e(a, c) : null == c || d.hasBooleanValue && !c || d.hasNumericValue && isNaN(c) || d.hasPositiveNumericValue && 1 > c || d.hasOverloadedBooleanValue && !1 === c ? Ac.deleteValueForProperty(a, b) : d.mustUseProperty ? a[d.propertyName] = c : (b = d.attributeName, (e = d.attributeNamespace) ? a.setAttributeNS(e, b, '' + c) : d.hasBooleanValue || d.hasOverloadedBooleanValue && !0 === c ? a.setAttribute(b, '') : a.setAttribute(b, '' + c));
                } else
                    Ac.setValueForAttribute(a, b, A.shouldSetAttribute(b, c) ? c : null);
            },
            setValueForAttribute: function (a, b, c) {
                kf(b) && (null == c ? a.removeAttribute(b) : a.setAttribute(b, '' + c));
            },
            deleteValueForAttribute: function (a, b) {
                a.removeAttribute(b);
            },
            deleteValueForProperty: function (a, b) {
                var c = A.getPropertyInfo(b);
                c ? (b = c.mutationMethod) ? b(a, void 0) : c.mustUseProperty ? a[c.propertyName] = c.hasBooleanValue ? !1 : '' : a.removeAttribute(c.attributeName) : a.removeAttribute(b);
            }
        }, oa = Ac, Be = yc.ReactDebugCurrentFrame, Ta = {
            current: null,
            phase: null,
            resetCurrentFiber: function () {
                Be.getCurrentStack = null;
                Ta.current = null;
                Ta.phase = null;
            },
            setCurrentFiber: function (a, b) {
                Be.getCurrentStack = Kd;
                Ta.current = a;
                Ta.phase = b;
            },
            getCurrentFiberOwnerName: function () {
                return null;
            },
            getCurrentFiberStackAddendum: Kd
        }, Lf = Ta, Bc = {
            getHostProps: function (a, b) {
                var c = b.value, d = b.checked;
                return q({
                    type: void 0,
                    step: void 0,
                    min: void 0,
                    max: void 0
                }, b, {
                    defaultChecked: void 0,
                    defaultValue: void 0,
                    value: null != c ? c : a._wrapperState.initialValue,
                    checked: null != d ? d : a._wrapperState.initialChecked
                });
            },
            initWrapperState: function (a, b) {
                var c = b.defaultValue;
                a._wrapperState = {
                    initialChecked: null != b.checked ? b.checked : b.defaultChecked,
                    initialValue: null != b.value ? b.value : c,
                    controlled: 'checkbox' === b.type || 'radio' === b.type ? null != b.checked : null != b.value
                };
            },
            updateWrapper: function (a, b) {
                var c = b.checked;
                null != c && oa.setValueForProperty(a, 'checked', c || !1);
                c = b.value;
                if (null != c)
                    if (0 === c && '' === a.value)
                        a.value = '0';
                    else if ('number' === b.type) {
                        if (b = parseFloat(a.value) || 0, c != b || c == b && a.value != c)
                            a.value = '' + c;
                    } else
                        a.value !== '' + c && (a.value = '' + c);
                else
                    null == b.value && null != b.defaultValue && a.defaultValue !== '' + b.defaultValue && (a.defaultValue = '' + b.defaultValue), null == b.checked && null != b.defaultChecked && (a.defaultChecked = !!b.defaultChecked);
            },
            postMountWrapper: function (a, b) {
                switch (b.type) {
                case 'submit':
                case 'reset':
                    break;
                case 'color':
                case 'date':
                case 'datetime':
                case 'datetime-local':
                case 'month':
                case 'time':
                case 'week':
                    a.value = '';
                    a.value = a.defaultValue;
                    break;
                default:
                    a.value = a.value;
                }
                b = a.name;
                '' !== b && (a.name = '');
                a.defaultChecked = !a.defaultChecked;
                a.defaultChecked = !a.defaultChecked;
                '' !== b && (a.name = b);
            },
            restoreControlledState: function (a, b) {
                Bc.updateWrapper(a, b);
                var c = b.name;
                if ('radio' === b.type && null != c) {
                    for (b = a; b.parentNode;)
                        b = b.parentNode;
                    c = b.querySelectorAll('input[name=' + JSON.stringify('' + c) + '][type="radio"]');
                    for (b = 0; b < c.length; b++) {
                        var d = c[b];
                        if (d !== a && d.form === a.form) {
                            var e = N.getFiberCurrentPropsFromNode(d);
                            e ? void 0 : m('90');
                            Bc.updateWrapper(d, e);
                        }
                    }
                }
            }
        }, U = Bc, za = {
            validateProps: function () {
            },
            postMountWrapper: function (a, b) {
                null != b.value && a.setAttribute('value', b.value);
            },
            getHostProps: function (a, b) {
                a = q({ children: void 0 }, b);
                if (b = mf(b.children))
                    a.children = b;
                return a;
            }
        }, ja = {
            getHostProps: function (a, b) {
                return q({}, b, { value: void 0 });
            },
            initWrapperState: function (a, b) {
                var c = b.value;
                a._wrapperState = {
                    initialValue: null != c ? c : b.defaultValue,
                    wasMultiple: !!b.multiple
                };
            },
            postMountWrapper: function (a, b) {
                a.multiple = !!b.multiple;
                var c = b.value;
                null != c ? va(a, !!b.multiple, c) : null != b.defaultValue && va(a, !!b.multiple, b.defaultValue);
            },
            postUpdateWrapper: function (a, b) {
                a._wrapperState.initialValue = void 0;
                var c = a._wrapperState.wasMultiple;
                a._wrapperState.wasMultiple = !!b.multiple;
                var d = b.value;
                null != d ? va(a, !!b.multiple, d) : c !== !!b.multiple && (null != b.defaultValue ? va(a, !!b.multiple, b.defaultValue) : va(a, !!b.multiple, b.multiple ? [] : ''));
            },
            restoreControlledState: function (a, b) {
                var c = b.value;
                null != c && va(a, !!b.multiple, c);
            }
        }, Ce = {
            getHostProps: function (a, b) {
                null != b.dangerouslySetInnerHTML ? m('91') : void 0;
                return q({}, b, {
                    value: void 0,
                    defaultValue: void 0,
                    children: '' + a._wrapperState.initialValue
                });
            },
            initWrapperState: function (a, b) {
                var c = b.value, d = c;
                null == c && (c = b.defaultValue, b = b.children, null != b && (null != c ? m('92') : void 0, Array.isArray(b) && (1 >= b.length ? void 0 : m('93'), b = b[0]), c = '' + b), null == c && (c = ''), d = c);
                a._wrapperState = { initialValue: '' + d };
            },
            updateWrapper: function (a, b) {
                var c = b.value;
                null != c && (c = '' + c, c !== a.value && (a.value = c), null == b.defaultValue && (a.defaultValue = c));
                null != b.defaultValue && (a.defaultValue = b.defaultValue);
            },
            postMountWrapper: function (a) {
                var b = a.textContent;
                b === a._wrapperState.initialValue && (a.value = b);
            },
            restoreControlledState: function (a, b) {
                Ce.updateWrapper(a, b);
            }
        }, V = Ce, cf = q({ menuitem: !0 }, {
            area: !0,
            base: !0,
            br: !0,
            col: !0,
            embed: !0,
            hr: !0,
            img: !0,
            input: !0,
            keygen: !0,
            link: !0,
            meta: !0,
            param: !0,
            source: !0,
            track: !0,
            wbr: !0
        }), xa = {
            _getTrackerFromNode: function (a) {
                return a._valueTracker;
            },
            track: function (a) {
                a._valueTracker || (a._valueTracker = nf(a));
            },
            updateValueIfChanged: function (a) {
                if (!a)
                    return !1;
                var b = a._valueTracker;
                if (!b)
                    return !0;
                var c = b.getValue();
                var d = '';
                a && (d = Ld(a) ? a.checked ? 'true' : 'false' : a.value);
                a = d;
                return a !== c ? (b.setValue(a), !0) : !1;
            },
            stopTracking: function (a) {
                (a = a._valueTracker) && a.stopTracking();
            }
        }, Eb, Cc = function (a) {
            return 'undefined' !== typeof MSApp && MSApp.execUnsafeLocalFunction ? function (b, c, d, e) {
                MSApp.execUnsafeLocalFunction(function () {
                    return a(b, c, d, e);
                });
            } : a;
        }(function (a, b) {
            if ('http://www.w3.org/2000/svg' !== a.namespaceURI || 'innerHTML' in a)
                a.innerHTML = b;
            else
                for (Eb = Eb || document.createElement('div'), Eb.innerHTML = '<svg>' + b + '</svg>', b = Eb.firstChild; b.firstChild;)
                    a.appendChild(b.firstChild);
        }), Mf = /["'&<>]/;
    z && ('textContent' in document.documentElement || (od = function (a, b) {
        if (3 === a.nodeType)
            a.nodeValue = b;
        else {
            if ('boolean' === typeof b || 'number' === typeof b)
                b = '' + b;
            else {
                b = '' + b;
                var c = Mf.exec(b);
                if (c) {
                    var d = '', e, f = 0;
                    for (e = c.index; e < b.length; e++) {
                        switch (b.charCodeAt(e)) {
                        case 34:
                            c = '&quot;';
                            break;
                        case 38:
                            c = '&amp;';
                            break;
                        case 39:
                            c = '&#x27;';
                            break;
                        case 60:
                            c = '&lt;';
                            break;
                        case 62:
                            c = '&gt;';
                            break;
                        default:
                            continue;
                        }
                        f !== e && (d += b.substring(f, e));
                        f = e + 1;
                        d += c;
                    }
                    b = f !== e ? d + b.substring(f, e) : d;
                }
            }
            Cc(a, b);
        }
    }));
    var Dc = od, Ec = Lf.getCurrentFiberOwnerName, of = l.listenTo, Fb = na.registrationNameModules, Aa = {
            topAbort: 'abort',
            topCanPlay: 'canplay',
            topCanPlayThrough: 'canplaythrough',
            topDurationChange: 'durationchange',
            topEmptied: 'emptied',
            topEncrypted: 'encrypted',
            topEnded: 'ended',
            topError: 'error',
            topLoadedData: 'loadeddata',
            topLoadedMetadata: 'loadedmetadata',
            topLoadStart: 'loadstart',
            topPause: 'pause',
            topPlay: 'play',
            topPlaying: 'playing',
            topProgress: 'progress',
            topRateChange: 'ratechange',
            topSeeked: 'seeked',
            topSeeking: 'seeking',
            topStalled: 'stalled',
            topSuspend: 'suspend',
            topTimeUpdate: 'timeupdate',
            topVolumeChange: 'volumechange',
            topWaiting: 'waiting'
        }, I = {
            createElement: function (a, b, c, d) {
                c = 9 === c.nodeType ? c : c.ownerDocument;
                'http://www.w3.org/1999/xhtml' === d && (d = Sc(a));
                'http://www.w3.org/1999/xhtml' === d ? 'script' === a ? (a = c.createElement('div'), a.innerHTML = '<script></script>', a = a.removeChild(a.firstChild)) : a = 'string' === typeof b.is ? c.createElement(a, { is: b.is }) : c.createElement(a) : a = c.createElementNS(d, a);
                return a;
            },
            createTextNode: function (a, b) {
                return (9 === b.nodeType ? b : b.ownerDocument).createTextNode(a);
            },
            setInitialProperties: function (a, b, c, d) {
                var e = hc(b, c);
                switch (b) {
                case 'iframe':
                case 'object':
                    l.trapBubbledEvent('topLoad', 'load', a);
                    var f = c;
                    break;
                case 'video':
                case 'audio':
                    for (f in Aa)
                        Aa.hasOwnProperty(f) && l.trapBubbledEvent(f, Aa[f], a);
                    f = c;
                    break;
                case 'source':
                    l.trapBubbledEvent('topError', 'error', a);
                    f = c;
                    break;
                case 'img':
                case 'image':
                    l.trapBubbledEvent('topError', 'error', a);
                    l.trapBubbledEvent('topLoad', 'load', a);
                    f = c;
                    break;
                case 'form':
                    l.trapBubbledEvent('topReset', 'reset', a);
                    l.trapBubbledEvent('topSubmit', 'submit', a);
                    f = c;
                    break;
                case 'details':
                    l.trapBubbledEvent('topToggle', 'toggle', a);
                    f = c;
                    break;
                case 'input':
                    U.initWrapperState(a, c);
                    f = U.getHostProps(a, c);
                    l.trapBubbledEvent('topInvalid', 'invalid', a);
                    R(d, 'onChange');
                    break;
                case 'option':
                    za.validateProps(a, c);
                    f = za.getHostProps(a, c);
                    break;
                case 'select':
                    ja.initWrapperState(a, c);
                    f = ja.getHostProps(a, c);
                    l.trapBubbledEvent('topInvalid', 'invalid', a);
                    R(d, 'onChange');
                    break;
                case 'textarea':
                    V.initWrapperState(a, c);
                    f = V.getHostProps(a, c);
                    l.trapBubbledEvent('topInvalid', 'invalid', a);
                    R(d, 'onChange');
                    break;
                default:
                    f = c;
                }
                ic(b, f, Ec);
                var g = f, h;
                for (h in g)
                    if (g.hasOwnProperty(h)) {
                        var k = g[h];
                        'style' === h ? Ae.setValueForStyles(a, k) : 'dangerouslySetInnerHTML' === h ? (k = k ? k.__html : void 0, null != k && Cc(a, k)) : 'children' === h ? 'string' === typeof k ? Dc(a, k) : 'number' === typeof k && Dc(a, '' + k) : 'suppressContentEditableWarning' !== h && (Fb.hasOwnProperty(h) ? null != k && R(d, h) : e ? oa.setValueForAttribute(a, h, k) : null != k && oa.setValueForProperty(a, h, k));
                    }
                switch (b) {
                case 'input':
                    xa.track(a);
                    U.postMountWrapper(a, c);
                    break;
                case 'textarea':
                    xa.track(a);
                    V.postMountWrapper(a, c);
                    break;
                case 'option':
                    za.postMountWrapper(a, c);
                    break;
                case 'select':
                    ja.postMountWrapper(a, c);
                    break;
                default:
                    'function' === typeof f.onClick && (a.onclick = w);
                }
            },
            diffProperties: function (a, b, c, d, e) {
                var f = null;
                switch (b) {
                case 'input':
                    c = U.getHostProps(a, c);
                    d = U.getHostProps(a, d);
                    f = [];
                    break;
                case 'option':
                    c = za.getHostProps(a, c);
                    d = za.getHostProps(a, d);
                    f = [];
                    break;
                case 'select':
                    c = ja.getHostProps(a, c);
                    d = ja.getHostProps(a, d);
                    f = [];
                    break;
                case 'textarea':
                    c = V.getHostProps(a, c);
                    d = V.getHostProps(a, d);
                    f = [];
                    break;
                default:
                    'function' !== typeof c.onClick && 'function' === typeof d.onClick && (a.onclick = w);
                }
                ic(b, d, Ec);
                var g, h;
                a = null;
                for (g in c)
                    if (!d.hasOwnProperty(g) && c.hasOwnProperty(g) && null != c[g])
                        if ('style' === g)
                            for (h in b = c[g], b)
                                b.hasOwnProperty(h) && (a || (a = {}), a[h] = '');
                        else
                            'dangerouslySetInnerHTML' !== g && 'children' !== g && 'suppressContentEditableWarning' !== g && (Fb.hasOwnProperty(g) ? f || (f = []) : (f = f || []).push(g, null));
                for (g in d) {
                    var k = d[g];
                    b = null != c ? c[g] : void 0;
                    if (d.hasOwnProperty(g) && k !== b && (null != k || null != b))
                        if ('style' === g)
                            if (b) {
                                for (h in b)
                                    !b.hasOwnProperty(h) || k && k.hasOwnProperty(h) || (a || (a = {}), a[h] = '');
                                for (h in k)
                                    k.hasOwnProperty(h) && b[h] !== k[h] && (a || (a = {}), a[h] = k[h]);
                            } else
                                a || (f || (f = []), f.push(g, a)), a = k;
                        else
                            'dangerouslySetInnerHTML' === g ? (k = k ? k.__html : void 0, b = b ? b.__html : void 0, null != k && b !== k && (f = f || []).push(g, '' + k)) : 'children' === g ? b === k || 'string' !== typeof k && 'number' !== typeof k || (f = f || []).push(g, '' + k) : 'suppressContentEditableWarning' !== g && (Fb.hasOwnProperty(g) ? (null != k && R(e, g), f || b === k || (f = [])) : (f = f || []).push(g, k));
                }
                a && (f = f || []).push('style', a);
                return f;
            },
            updateProperties: function (a, b, c, d, e) {
                hc(c, d);
                d = hc(c, e);
                for (var f = 0; f < b.length; f += 2) {
                    var g = b[f], h = b[f + 1];
                    'style' === g ? Ae.setValueForStyles(a, h) : 'dangerouslySetInnerHTML' === g ? Cc(a, h) : 'children' === g ? Dc(a, h) : d ? null != h ? oa.setValueForAttribute(a, g, h) : oa.deleteValueForAttribute(a, g) : null != h ? oa.setValueForProperty(a, g, h) : oa.deleteValueForProperty(a, g);
                }
                switch (c) {
                case 'input':
                    U.updateWrapper(a, e);
                    xa.updateValueIfChanged(a);
                    break;
                case 'textarea':
                    V.updateWrapper(a, e);
                    break;
                case 'select':
                    ja.postUpdateWrapper(a, e);
                }
            },
            diffHydratedProperties: function (a, b, c, d, e) {
                switch (b) {
                case 'iframe':
                case 'object':
                    l.trapBubbledEvent('topLoad', 'load', a);
                    break;
                case 'video':
                case 'audio':
                    for (var f in Aa)
                        Aa.hasOwnProperty(f) && l.trapBubbledEvent(f, Aa[f], a);
                    break;
                case 'source':
                    l.trapBubbledEvent('topError', 'error', a);
                    break;
                case 'img':
                case 'image':
                    l.trapBubbledEvent('topError', 'error', a);
                    l.trapBubbledEvent('topLoad', 'load', a);
                    break;
                case 'form':
                    l.trapBubbledEvent('topReset', 'reset', a);
                    l.trapBubbledEvent('topSubmit', 'submit', a);
                    break;
                case 'details':
                    l.trapBubbledEvent('topToggle', 'toggle', a);
                    break;
                case 'input':
                    U.initWrapperState(a, c);
                    l.trapBubbledEvent('topInvalid', 'invalid', a);
                    R(e, 'onChange');
                    break;
                case 'option':
                    za.validateProps(a, c);
                    break;
                case 'select':
                    ja.initWrapperState(a, c);
                    l.trapBubbledEvent('topInvalid', 'invalid', a);
                    R(e, 'onChange');
                    break;
                case 'textarea':
                    V.initWrapperState(a, c), l.trapBubbledEvent('topInvalid', 'invalid', a), R(e, 'onChange');
                }
                ic(b, c, Ec);
                d = null;
                for (var g in c)
                    c.hasOwnProperty(g) && (f = c[g], 'children' === g ? 'string' === typeof f ? a.textContent !== f && (d = [
                        'children',
                        f
                    ]) : 'number' === typeof f && a.textContent !== '' + f && (d = [
                        'children',
                        '' + f
                    ]) : Fb.hasOwnProperty(g) && null != f && R(e, g));
                switch (b) {
                case 'input':
                    xa.track(a);
                    U.postMountWrapper(a, c);
                    break;
                case 'textarea':
                    xa.track(a);
                    V.postMountWrapper(a, c);
                    break;
                case 'select':
                case 'option':
                    break;
                default:
                    'function' === typeof c.onClick && (a.onclick = w);
                }
                return d;
            },
            diffHydratedText: function (a, b) {
                return a.nodeValue !== b;
            },
            warnForDeletedHydratableElement: function () {
            },
            warnForDeletedHydratableText: function () {
            },
            warnForInsertedHydratedElement: function () {
            },
            warnForInsertedHydratedText: function () {
            },
            restoreControlledState: function (a, b, c) {
                switch (b) {
                case 'input':
                    U.restoreControlledState(a, c);
                    break;
                case 'textarea':
                    V.restoreControlledState(a, c);
                    break;
                case 'select':
                    ja.restoreControlledState(a, c);
                }
            }
        }, Gb = void 0;
    if (z)
        if ('function' !== typeof requestIdleCallback) {
            var De = null, Fc = null, Gc = !1, Hc = !1, Hb = 0, Ib = 33, Ua = 33, Nf = {
                    timeRemaining: 'object' === typeof performance && 'function' === typeof performance.now ? function () {
                        return Hb - performance.now();
                    } : function () {
                        return Hb - Date.now();
                    }
                }, Ee = '__reactIdleCallback$' + Math.random().toString(36).slice(2);
            window.addEventListener('message', function (a) {
                a.source === window && a.data === Ee && (Gc = !1, a = Fc, Fc = null, null !== a && a(Nf));
            }, !1);
            var Of = function (a) {
                Hc = !1;
                var b = a - Hb + Ua;
                b < Ua && Ib < Ua ? (8 > b && (b = 8), Ua = b < Ib ? Ib : b) : Ib = b;
                Hb = a + Ua;
                Gc || (Gc = !0, window.postMessage(Ee, '*'));
                b = De;
                De = null;
                null !== b && b(a);
            };
            Gb = function (a) {
                Fc = a;
                Hc || (Hc = !0, requestAnimationFrame(Of));
                return 0;
            };
        } else
            Gb = requestIdleCallback;
    else
        Gb = function (a) {
            setTimeout(function () {
                a({
                    timeRemaining: function () {
                        return Infinity;
                    }
                });
            });
            return 0;
        };
    var Pf = Gb, pc = void 0, qc = void 0, ba = {}, bb = [], da = -1, Qf = Oa.isFiberMounted, ca = { current: ba }, S = { current: !1 }, cb = ba;
    if ('function' === typeof Symbol && Symbol['for']) {
        var Fe = Symbol['for']('react.coroutine');
        var Ge = Symbol['for']('react.yield');
    } else
        Fe = 60104, Ge = 60105;
    var Rf = Ge, Sf = Fe, Ic = 'function' === typeof Symbol && Symbol['for'] && Symbol['for']('react.portal') || 60106, te = {
            createPortal: function (a, b, c) {
                var d = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
                return {
                    $$typeof: Ic,
                    key: null == d ? null : '' + d,
                    children: a,
                    containerInfo: b,
                    implementation: c
                };
            },
            isPortal: function (a) {
                return 'object' === typeof a && null !== a && a.$$typeof === Ic;
            },
            REACT_PORTAL_TYPE: Ic
        }, sb = Sf, tb = Rf, ub = te.REACT_PORTAL_TYPE, $b = ad, vb = Array.isArray, Od = 'function' === typeof Symbol && Symbol.iterator, rb = 'function' === typeof Symbol && Symbol['for'] && Symbol['for']('react.element') || 60103, Xb = rc(!0, !0), Zb = rc(!1, !0), Yb = rc(!1, !1), bf = Object.prototype.hasOwnProperty, af = Oa.isMounted, Ze = yc.ReactCurrentOwner, Vb = null, Wb = null, qa = {}, db = yc.ReactCurrentOwner;
    sc._injectFiber = function (a) {
        $c = a;
    };
    var Tf = Oa.findCurrentHostFiber, Uf = Oa.findCurrentHostFiberWithNoPortals;
    sc._injectFiber(function (a) {
        var b;
        a: {
            Qf(a) && 2 === a.tag ? void 0 : m('170');
            for (b = a; 3 !== b.tag;) {
                if (Ea(b)) {
                    b = b.stateNode.__reactInternalMemoizedMergedChildContext;
                    break a;
                }
                (b = b['return']) ? void 0 : m('171');
            }
            b = b.stateNode.context;
        }
        return Ea(a) ? kd(a, b, !1) : b;
    });
    var Rb = null, He = {
            getOffsets: function (a) {
                var b = window.getSelection && window.getSelection();
                if (!b || 0 === b.rangeCount)
                    return null;
                var c = b.anchorNode, d = b.anchorOffset, e = b.focusNode, f = b.focusOffset, g = b.getRangeAt(0);
                try {
                    g.startContainer.nodeType, g.endContainer.nodeType;
                } catch (k) {
                    return null;
                }
                b = b.anchorNode === b.focusNode && b.anchorOffset === b.focusOffset ? 0 : g.toString().length;
                var h = g.cloneRange();
                h.selectNodeContents(a);
                h.setEnd(g.startContainer, g.startOffset);
                a = h.startContainer === h.endContainer && h.startOffset === h.endOffset ? 0 : h.toString().length;
                g = a + b;
                b = document.createRange();
                b.setStart(c, d);
                b.setEnd(e, f);
                c = b.collapsed;
                return {
                    start: c ? g : a,
                    end: c ? a : g
                };
            },
            setOffsets: function (a, b) {
                if (window.getSelection) {
                    var c = window.getSelection(), d = a[Xc()].length, e = Math.min(b.start, d);
                    b = void 0 === b.end ? e : Math.min(b.end, d);
                    !c.extend && e > b && (d = b, b = e, e = d);
                    d = Yc(a, e);
                    a = Yc(a, b);
                    if (d && a) {
                        var f = document.createRange();
                        f.setStart(d.node, d.offset);
                        c.removeAllRanges();
                        e > b ? (c.addRange(f), c.extend(a.node, a.offset)) : (f.setEnd(a.node, a.offset), c.addRange(f));
                    }
                }
            }
        }, Va = {
            hasSelectionCapabilities: function (a) {
                var b = a && a.nodeName && a.nodeName.toLowerCase();
                return b && ('input' === b && 'text' === a.type || 'textarea' === b || 'true' === a.contentEditable);
            },
            getSelectionInformation: function () {
                var a = Qb();
                return {
                    focusedElem: a,
                    selectionRange: Va.hasSelectionCapabilities(a) ? Va.getSelection(a) : null
                };
            },
            restoreSelection: function (a) {
                var b = Qb(), c = a.focusedElem;
                a = a.selectionRange;
                if (b !== c && Qd(document.documentElement, c)) {
                    Va.hasSelectionCapabilities(c) && Va.setSelection(c, a);
                    b = [];
                    for (a = c; a = a.parentNode;)
                        1 === a.nodeType && b.push({
                            element: a,
                            left: a.scrollLeft,
                            top: a.scrollTop
                        });
                    try {
                        c.focus();
                    } catch (d) {
                    }
                    for (c = 0; c < b.length; c++)
                        a = b[c], a.element.scrollLeft = a.left, a.element.scrollTop = a.top;
                }
            },
            getSelection: function (a) {
                return ('selectionStart' in a ? {
                    start: a.selectionStart,
                    end: a.selectionEnd
                } : He.getOffsets(a)) || {
                    start: 0,
                    end: 0
                };
            },
            setSelection: function (a, b) {
                var c = b.start, d = b.end;
                void 0 === d && (d = c);
                'selectionStart' in a ? (a.selectionStart = c, a.selectionEnd = Math.min(d, a.value.length)) : He.setOffsets(a, b);
            }
        }, vc = Va;
    ab._injectFiber = function (a) {
        Uc = a;
    };
    ab._injectStack = function (a) {
        Vc = a;
    };
    var wb = {
            isAncestor: function (a, b) {
                for (; b;) {
                    if (a === b || a === b.alternate)
                        return !0;
                    b = C(b);
                }
                return !1;
            },
            getLowestCommonAncestor: Rd,
            getParentInstance: function (a) {
                return C(a);
            },
            traverseTwoPhase: function (a, b, c) {
                for (var d = []; a;)
                    d.push(a), a = C(a);
                for (a = d.length; 0 < a--;)
                    b(d[a], 'captured', c);
                for (a = 0; a < d.length; a++)
                    b(d[a], 'bubbled', c);
            },
            traverseEnterLeave: function (a, b, c, d, e) {
                for (var f = a && b ? Rd(a, b) : null, g = []; a && a !== f;)
                    g.push(a), a = C(a);
                for (a = []; b && b !== f;)
                    a.push(b), b = C(b);
                for (b = 0; b < g.length; b++)
                    c(g[b], 'bubbled', d);
                for (b = a.length; 0 < b--;)
                    c(a[b], 'captured', e);
            }
        }, Td = X.getListener, la = {
            accumulateTwoPhaseDispatches: function (a) {
                Ha(a, pf);
            },
            accumulateTwoPhaseDispatchesSkipTarget: function (a) {
                Ha(a, qf);
            },
            accumulateDirectDispatches: function (a) {
                Ha(a, rf);
            },
            accumulateEnterLeaveDispatches: function (a, b, c, d) {
                wb.traverseEnterLeave(c, d, Ud, a, b);
            }
        }, Wa = null, Jc = null, Jb = null, Kc = {
            initialize: function (a) {
                Wa = a;
                Jc = Kc.getText();
                return !0;
            },
            reset: function () {
                Jb = Jc = Wa = null;
            },
            getData: function () {
                if (Jb)
                    return Jb;
                var a, b = Jc, c = b.length, d, e = Kc.getText(), f = e.length;
                for (a = 0; a < c && b[a] === e[a]; a++);
                var g = c - a;
                for (d = 1; d <= g && b[c - d] === e[f - d]; d++);
                return Jb = e.slice(a, 1 < d ? 1 - d : void 0);
            },
            getText: function () {
                return 'value' in Wa ? Wa.value : Wa[Xc()];
            }
        }, xb = Kc, Ie = 'dispatchConfig _targetInst nativeEvent isDefaultPrevented isPropagationStopped _dispatchListeners _dispatchInstances'.split(' '), Vf = {
            type: null,
            target: null,
            currentTarget: w.thatReturnsNull,
            eventPhase: null,
            bubbles: null,
            cancelable: null,
            timeStamp: function (a) {
                return a.timeStamp || Date.now();
            },
            defaultPrevented: null,
            isTrusted: null
        };
    q(Ka.prototype, {
        preventDefault: function () {
            this.defaultPrevented = !0;
            var a = this.nativeEvent;
            a && (a.preventDefault ? a.preventDefault() : 'unknown' !== typeof a.returnValue && (a.returnValue = !1), this.isDefaultPrevented = w.thatReturnsTrue);
        },
        stopPropagation: function () {
            var a = this.nativeEvent;
            a && (a.stopPropagation ? a.stopPropagation() : 'unknown' !== typeof a.cancelBubble && (a.cancelBubble = !0), this.isPropagationStopped = w.thatReturnsTrue);
        },
        persist: function () {
            this.isPersistent = w.thatReturnsTrue;
        },
        isPersistent: w.thatReturnsFalse,
        destructor: function () {
            var a = this.constructor.Interface, b;
            for (b in a)
                this[b] = null;
            for (a = 0; a < Ie.length; a++)
                this[Ie[a]] = null;
        }
    });
    Ka.Interface = Vf;
    Ka.augmentClass = function (a, b) {
        function c() {
        }
        c.prototype = this.prototype;
        var d = new c();
        q(d, a.prototype);
        a.prototype = d;
        a.prototype.constructor = a;
        a.Interface = q({}, this.Interface, b);
        a.augmentClass = this.augmentClass;
        Vd(a);
    };
    Vd(Ka);
    var O = Ka;
    O.augmentClass(Wd, { data: null });
    O.augmentClass(Xd, { data: null });
    var vf = [
            9,
            13,
            27,
            32
        ], tc = z && 'CompositionEvent' in window, Xa = null;
    z && 'documentMode' in document && (Xa = document.documentMode);
    var Wf = z && 'TextEvent' in window && !Xa && !uf(), be = z && (!tc || Xa && 8 < Xa && 11 >= Xa), ae = String.fromCharCode(32), ea = {
            beforeInput: {
                phasedRegistrationNames: {
                    bubbled: 'onBeforeInput',
                    captured: 'onBeforeInputCapture'
                },
                dependencies: [
                    'topCompositionEnd',
                    'topKeyPress',
                    'topTextInput',
                    'topPaste'
                ]
            },
            compositionEnd: {
                phasedRegistrationNames: {
                    bubbled: 'onCompositionEnd',
                    captured: 'onCompositionEndCapture'
                },
                dependencies: 'topBlur topCompositionEnd topKeyDown topKeyPress topKeyUp topMouseDown'.split(' ')
            },
            compositionStart: {
                phasedRegistrationNames: {
                    bubbled: 'onCompositionStart',
                    captured: 'onCompositionStartCapture'
                },
                dependencies: 'topBlur topCompositionStart topKeyDown topKeyPress topKeyUp topMouseDown'.split(' ')
            },
            compositionUpdate: {
                phasedRegistrationNames: {
                    bubbled: 'onCompositionUpdate',
                    captured: 'onCompositionUpdateCapture'
                },
                dependencies: 'topBlur topCompositionUpdate topKeyDown topKeyPress topKeyUp topMouseDown'.split(' ')
            }
        }, $d = !1, wa = !1, Xf = {
            eventTypes: ea,
            extractEvents: function (a, b, c, d) {
                var e;
                if (tc)
                    b: {
                        switch (a) {
                        case 'topCompositionStart':
                            var f = ea.compositionStart;
                            break b;
                        case 'topCompositionEnd':
                            f = ea.compositionEnd;
                            break b;
                        case 'topCompositionUpdate':
                            f = ea.compositionUpdate;
                            break b;
                        }
                        f = void 0;
                    }
                else
                    wa ? Yd(a, c) && (f = ea.compositionEnd) : 'topKeyDown' === a && 229 === c.keyCode && (f = ea.compositionStart);
                f ? (be && (wa || f !== ea.compositionStart ? f === ea.compositionEnd && wa && (e = xb.getData()) : wa = xb.initialize(d)), f = Wd.getPooled(f, b, c, d), e ? f.data = e : (e = Zd(c), null !== e && (f.data = e)), la.accumulateTwoPhaseDispatches(f), e = f) : e = null;
                (a = Wf ? wf(a, c) : xf(a, c)) ? (b = Xd.getPooled(ea.beforeInput, b, c, d), b.data = a, la.accumulateTwoPhaseDispatches(b)) : b = null;
                return [
                    e,
                    b
                ];
            }
        }, Oe = {
            color: !0,
            date: !0,
            datetime: !0,
            'datetime-local': !0,
            email: !0,
            month: !0,
            number: !0,
            password: !0,
            range: !0,
            search: !0,
            tel: !0,
            text: !0,
            time: !0,
            url: !0,
            week: !0
        }, de = {
            change: {
                phasedRegistrationNames: {
                    bubbled: 'onChange',
                    captured: 'onChangeCapture'
                },
                dependencies: 'topBlur topChange topClick topFocus topInput topKeyDown topKeyUp topSelectionChange'.split(' ')
            }
        }, La = null, Ma = null, Lc = !1;
    z && (Lc = Fa('input') && (!document.documentMode || 9 < document.documentMode));
    var Yf = {
        eventTypes: de,
        _isInputEventSupported: Lc,
        extractEvents: function (a, b, c, d) {
            var e = b ? N.getNodeFromInstance(b) : window, f = e.nodeName && e.nodeName.toLowerCase();
            if ('select' === f || 'input' === f && 'file' === e.type)
                var g = zf;
            else if (Tc(e))
                if (Lc)
                    g = Df;
                else {
                    g = Bf;
                    var h = Af;
                }
            else
                f = e.nodeName, !f || 'input' !== f.toLowerCase() || 'checkbox' !== e.type && 'radio' !== e.type || (g = Cf);
            if (g && (g = g(a, b)))
                return ce(g, c, d);
            h && h(a, e, b);
            'topBlur' === a && null != b && (a = b._wrapperState || e._wrapperState) && a.controlled && 'number' === e.type && (a = '' + e.value, e.getAttribute('value') !== a && e.setAttribute('value', a));
        }
    };
    O.augmentClass(ge, {
        view: function (a) {
            if (a.view)
                return a.view;
            a = jb(a);
            return a.window === a ? a : (a = a.ownerDocument) ? a.defaultView || a.parentWindow : window;
        },
        detail: function (a) {
            return a.detail || 0;
        }
    });
    var Y = ge, Ef = {
            Alt: 'altKey',
            Control: 'ctrlKey',
            Meta: 'metaKey',
            Shift: 'shiftKey'
        };
    Y.augmentClass(he, {
        screenX: null,
        screenY: null,
        clientX: null,
        clientY: null,
        pageX: null,
        pageY: null,
        ctrlKey: null,
        shiftKey: null,
        altKey: null,
        metaKey: null,
        getModifierState: Pb,
        button: null,
        buttons: null,
        relatedTarget: function (a) {
            return a.relatedTarget || (a.fromElement === a.srcElement ? a.toElement : a.fromElement);
        }
    });
    var ma = he, Mc = {
            mouseEnter: {
                registrationName: 'onMouseEnter',
                dependencies: [
                    'topMouseOut',
                    'topMouseOver'
                ]
            },
            mouseLeave: {
                registrationName: 'onMouseLeave',
                dependencies: [
                    'topMouseOut',
                    'topMouseOver'
                ]
            }
        }, Zf = {
            eventTypes: Mc,
            extractEvents: function (a, b, c, d) {
                if ('topMouseOver' === a && (c.relatedTarget || c.fromElement) || 'topMouseOut' !== a && 'topMouseOver' !== a)
                    return null;
                var e = d.window === d ? d : (e = d.ownerDocument) ? e.defaultView || e.parentWindow : window;
                'topMouseOut' === a ? (a = b, b = (b = c.relatedTarget || c.toElement) ? N.getClosestInstanceFromNode(b) : null) : a = null;
                if (a === b)
                    return null;
                var f = null == a ? e : N.getNodeFromInstance(a);
                e = null == b ? e : N.getNodeFromInstance(b);
                var g = ma.getPooled(Mc.mouseLeave, a, c, d);
                g.type = 'mouseleave';
                g.target = f;
                g.relatedTarget = e;
                c = ma.getPooled(Mc.mouseEnter, b, c, d);
                c.type = 'mouseenter';
                c.target = e;
                c.relatedTarget = f;
                la.accumulateEnterLeaveDispatches(g, c, a, b);
                return [
                    g,
                    c
                ];
            }
        }, $f = z && 'documentMode' in document && 11 >= document.documentMode, je = {
            select: {
                phasedRegistrationNames: {
                    bubbled: 'onSelect',
                    captured: 'onSelectCapture'
                },
                dependencies: 'topBlur topContextMenu topFocus topKeyDown topKeyUp topMouseDown topMouseUp topSelectionChange'.split(' ')
            }
        }, ya = null, wc = null, Na = null, uc = !1, ag = l.isListeningToAllDependencies, bg = {
            eventTypes: je,
            extractEvents: function (a, b, c, d) {
                var e = d.window === d ? d.document : 9 === d.nodeType ? d : d.ownerDocument;
                if (!e || !ag('onSelect', e))
                    return null;
                e = b ? N.getNodeFromInstance(b) : window;
                switch (a) {
                case 'topFocus':
                    if (Tc(e) || 'true' === e.contentEditable)
                        ya = e, wc = b, Na = null;
                    break;
                case 'topBlur':
                    Na = wc = ya = null;
                    break;
                case 'topMouseDown':
                    uc = !0;
                    break;
                case 'topContextMenu':
                case 'topMouseUp':
                    return uc = !1, ie(c, d);
                case 'topSelectionChange':
                    if ($f)
                        break;
                case 'topKeyDown':
                case 'topKeyUp':
                    return ie(c, d);
                }
                return null;
            }
        };
    O.augmentClass(ke, {
        animationName: null,
        elapsedTime: null,
        pseudoElement: null
    });
    O.augmentClass(le, {
        clipboardData: function (a) {
            return 'clipboardData' in a ? a.clipboardData : window.clipboardData;
        }
    });
    Y.augmentClass(me, { relatedTarget: null });
    var cg = {
            Esc: 'Escape',
            Spacebar: ' ',
            Left: 'ArrowLeft',
            Up: 'ArrowUp',
            Right: 'ArrowRight',
            Down: 'ArrowDown',
            Del: 'Delete',
            Win: 'OS',
            Menu: 'ContextMenu',
            Apps: 'ContextMenu',
            Scroll: 'ScrollLock',
            MozPrintableKey: 'Unidentified'
        }, dg = {
            8: 'Backspace',
            9: 'Tab',
            12: 'Clear',
            13: 'Enter',
            16: 'Shift',
            17: 'Control',
            18: 'Alt',
            19: 'Pause',
            20: 'CapsLock',
            27: 'Escape',
            32: ' ',
            33: 'PageUp',
            34: 'PageDown',
            35: 'End',
            36: 'Home',
            37: 'ArrowLeft',
            38: 'ArrowUp',
            39: 'ArrowRight',
            40: 'ArrowDown',
            45: 'Insert',
            46: 'Delete',
            112: 'F1',
            113: 'F2',
            114: 'F3',
            115: 'F4',
            116: 'F5',
            117: 'F6',
            118: 'F7',
            119: 'F8',
            120: 'F9',
            121: 'F10',
            122: 'F11',
            123: 'F12',
            144: 'NumLock',
            145: 'ScrollLock',
            224: 'Meta'
        };
    Y.augmentClass(ne, {
        key: function (a) {
            if (a.key) {
                var b = cg[a.key] || a.key;
                if ('Unidentified' !== b)
                    return b;
            }
            return 'keypress' === a.type ? (a = $a(a), 13 === a ? 'Enter' : String.fromCharCode(a)) : 'keydown' === a.type || 'keyup' === a.type ? dg[a.keyCode] || 'Unidentified' : '';
        },
        location: null,
        ctrlKey: null,
        shiftKey: null,
        altKey: null,
        metaKey: null,
        repeat: null,
        locale: null,
        getModifierState: Pb,
        charCode: function (a) {
            return 'keypress' === a.type ? $a(a) : 0;
        },
        keyCode: function (a) {
            return 'keydown' === a.type || 'keyup' === a.type ? a.keyCode : 0;
        },
        which: function (a) {
            return 'keypress' === a.type ? $a(a) : 'keydown' === a.type || 'keyup' === a.type ? a.keyCode : 0;
        }
    });
    ma.augmentClass(oe, { dataTransfer: null });
    Y.augmentClass(pe, {
        touches: null,
        targetTouches: null,
        changedTouches: null,
        altKey: null,
        metaKey: null,
        ctrlKey: null,
        shiftKey: null,
        getModifierState: Pb
    });
    O.augmentClass(qe, {
        propertyName: null,
        elapsedTime: null,
        pseudoElement: null
    });
    ma.augmentClass(re, {
        deltaX: function (a) {
            return 'deltaX' in a ? a.deltaX : 'wheelDeltaX' in a ? -a.wheelDeltaX : 0;
        },
        deltaY: function (a) {
            return 'deltaY' in a ? a.deltaY : 'wheelDeltaY' in a ? -a.wheelDeltaY : 'wheelDelta' in a ? -a.wheelDelta : 0;
        },
        deltaZ: null,
        deltaMode: null
    });
    var Je = {}, Ke = {};
    'abort animationEnd animationIteration animationStart blur cancel canPlay canPlayThrough click close contextMenu copy cut doubleClick drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error focus input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing progress rateChange reset scroll seeked seeking stalled submit suspend timeUpdate toggle touchCancel touchEnd touchMove touchStart transitionEnd volumeChange waiting wheel'.split(' ').forEach(function (a) {
        var b = a[0].toUpperCase() + a.slice(1), c = 'on' + b;
        b = 'top' + b;
        c = {
            phasedRegistrationNames: {
                bubbled: c,
                captured: c + 'Capture'
            },
            dependencies: [b]
        };
        Je[a] = c;
        Ke[b] = c;
    });
    var eg = {
        eventTypes: Je,
        extractEvents: function (a, b, c, d) {
            var e = Ke[a];
            if (!e)
                return null;
            switch (a) {
            case 'topAbort':
            case 'topCancel':
            case 'topCanPlay':
            case 'topCanPlayThrough':
            case 'topClose':
            case 'topDurationChange':
            case 'topEmptied':
            case 'topEncrypted':
            case 'topEnded':
            case 'topError':
            case 'topInput':
            case 'topInvalid':
            case 'topLoad':
            case 'topLoadedData':
            case 'topLoadedMetadata':
            case 'topLoadStart':
            case 'topPause':
            case 'topPlay':
            case 'topPlaying':
            case 'topProgress':
            case 'topRateChange':
            case 'topReset':
            case 'topSeeked':
            case 'topSeeking':
            case 'topStalled':
            case 'topSubmit':
            case 'topSuspend':
            case 'topTimeUpdate':
            case 'topToggle':
            case 'topVolumeChange':
            case 'topWaiting':
                var f = O;
                break;
            case 'topKeyPress':
                if (0 === $a(c))
                    return null;
            case 'topKeyDown':
            case 'topKeyUp':
                f = ne;
                break;
            case 'topBlur':
            case 'topFocus':
                f = me;
                break;
            case 'topClick':
                if (2 === c.button)
                    return null;
            case 'topDoubleClick':
            case 'topMouseDown':
            case 'topMouseMove':
            case 'topMouseUp':
            case 'topMouseOut':
            case 'topMouseOver':
            case 'topContextMenu':
                f = ma;
                break;
            case 'topDrag':
            case 'topDragEnd':
            case 'topDragEnter':
            case 'topDragExit':
            case 'topDragLeave':
            case 'topDragOver':
            case 'topDragStart':
            case 'topDrop':
                f = oe;
                break;
            case 'topTouchCancel':
            case 'topTouchEnd':
            case 'topTouchMove':
            case 'topTouchStart':
                f = pe;
                break;
            case 'topAnimationEnd':
            case 'topAnimationIteration':
            case 'topAnimationStart':
                f = ke;
                break;
            case 'topTransitionEnd':
                f = qe;
                break;
            case 'topScroll':
                f = Y;
                break;
            case 'topWheel':
                f = re;
                break;
            case 'topCopy':
            case 'topCut':
            case 'topPaste':
                f = le;
            }
            f ? void 0 : m('86', a);
            a = f.getPooled(e, b, c, d);
            la.accumulateTwoPhaseDispatches(a);
            return a;
        }
    };
    G.setHandleTopLevel(l.handleTopLevel);
    X.injection.injectEventPluginOrder('ResponderEventPlugin SimpleEventPlugin TapEventPlugin EnterLeaveEventPlugin ChangeEventPlugin SelectEventPlugin BeforeInputEventPlugin'.split(' '));
    Ga.injection.injectComponentTree(N);
    X.injection.injectEventPluginsByName({
        SimpleEventPlugin: eg,
        EnterLeaveEventPlugin: Zf,
        ChangeEventPlugin: Yf,
        SelectEventPlugin: bg,
        BeforeInputEventPlugin: Xf
    });
    var Kb = A.injection.MUST_USE_PROPERTY, r = A.injection.HAS_BOOLEAN_VALUE, Le = A.injection.HAS_NUMERIC_VALUE, Lb = A.injection.HAS_POSITIVE_NUMERIC_VALUE, Ya = A.injection.HAS_STRING_BOOLEAN_VALUE, fg = {
            Properties: {
                allowFullScreen: r,
                allowTransparency: Ya,
                async: r,
                autoPlay: r,
                capture: r,
                checked: Kb | r,
                cols: Lb,
                contentEditable: Ya,
                controls: r,
                'default': r,
                defer: r,
                disabled: r,
                download: A.injection.HAS_OVERLOADED_BOOLEAN_VALUE,
                draggable: Ya,
                formNoValidate: r,
                hidden: r,
                loop: r,
                multiple: Kb | r,
                muted: Kb | r,
                noValidate: r,
                open: r,
                playsInline: r,
                readOnly: r,
                required: r,
                reversed: r,
                rows: Lb,
                rowSpan: Le,
                scoped: r,
                seamless: r,
                selected: Kb | r,
                size: Lb,
                start: Le,
                span: Lb,
                spellCheck: Ya,
                style: 0,
                itemScope: r,
                acceptCharset: 0,
                className: 0,
                htmlFor: 0,
                httpEquiv: 0,
                value: Ya
            },
            DOMAttributeNames: {
                acceptCharset: 'accept-charset',
                className: 'class',
                htmlFor: 'for',
                httpEquiv: 'http-equiv'
            },
            DOMMutationMethods: {
                value: function (a, b) {
                    if (null == b)
                        return a.removeAttribute('value');
                    'number' !== a.type || !1 === a.hasAttribute('value') ? a.setAttribute('value', '' + b) : a.validity && !a.validity.badInput && a.ownerDocument.activeElement !== a && a.setAttribute('value', '' + b);
                }
            }
        }, Nc = A.injection.HAS_STRING_BOOLEAN_VALUE, Oc = {
            Properties: {
                autoReverse: Nc,
                externalResourcesRequired: Nc,
                preserveAlpha: Nc
            },
            DOMAttributeNames: {
                autoReverse: 'autoReverse',
                externalResourcesRequired: 'externalResourcesRequired',
                preserveAlpha: 'preserveAlpha'
            },
            DOMAttributeNamespaces: {
                xlinkActuate: 'http://www.w3.org/1999/xlink',
                xlinkArcrole: 'http://www.w3.org/1999/xlink',
                xlinkHref: 'http://www.w3.org/1999/xlink',
                xlinkRole: 'http://www.w3.org/1999/xlink',
                xlinkShow: 'http://www.w3.org/1999/xlink',
                xlinkTitle: 'http://www.w3.org/1999/xlink',
                xlinkType: 'http://www.w3.org/1999/xlink',
                xmlBase: 'http://www.w3.org/XML/1998/namespace',
                xmlLang: 'http://www.w3.org/XML/1998/namespace',
                xmlSpace: 'http://www.w3.org/XML/1998/namespace'
            }
        }, gg = /[\-\:]([a-z])/g;
    'accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode x-height xlink:actuate xlink:arcrole xlink:href xlink:role xlink:show xlink:title xlink:type xml:base xmlns:xlink xml:lang xml:space'.split(' ').forEach(function (a) {
        var b = a.replace(gg, Me);
        Oc.Properties[b] = 0;
        Oc.DOMAttributeNames[b] = a;
    });
    A.injection.injectDOMPropertyConfig(fg);
    A.injection.injectDOMPropertyConfig(Oc);
    var Gf = A.ROOT_ATTRIBUTE_NAME, hg = I.createElement, ig = I.createTextNode, jg = I.setInitialProperties, kg = I.diffProperties, lg = I.updateProperties, mg = I.diffHydratedProperties, ng = I.diffHydratedText, og = I.warnForDeletedHydratableElement, pg = I.warnForDeletedHydratableText, qg = I.warnForInsertedHydratedElement, rg = I.warnForInsertedHydratedText, Mb = N.precacheFiberNode, Pc = N.updateFiberProps;
    yb.injection.injectFiberControlledHostComponent(I);
    ab._injectFiber(function (a) {
        return B.findHostInstance(a);
    });
    var Qc = null, Rc = null, B = function (a) {
            var b = a.getPublicInstance;
            a = Pe(a);
            var c = a.scheduleUpdate, d = a.getPriorityContext;
            return {
                createContainer: function (a) {
                    var b = new F(3, null, 0);
                    a = {
                        current: b,
                        containerInfo: a,
                        isScheduled: !1,
                        nextScheduledRoot: null,
                        context: null,
                        pendingContext: null
                    };
                    return b.stateNode = a;
                },
                updateContainer: function (a, b, g, h) {
                    var e = b.current;
                    g = sc(g);
                    null === b.context ? b.context = g : b.pendingContext = g;
                    b = d(e, null != a && null != a.type && null != a.type.prototype && !0 === a.type.prototype.unstable_isAsyncReactComponent);
                    g = { element: a };
                    a = null === g.element;
                    h = {
                        priorityLevel: b,
                        partialState: g,
                        callback: void 0 === h ? null : h,
                        isReplace: !1,
                        isForced: !1,
                        isTopLevelUnmount: a,
                        next: null
                    };
                    g = hb(e, h);
                    if (a) {
                        a = pc;
                        var f = qc;
                        null !== a && null !== h.next && (h.next = null, a.last = h);
                        null !== f && null !== g && null !== g.next && (g.next = null, f.last = h);
                    }
                    c(e, b);
                },
                batchedUpdates: a.batchedUpdates,
                unbatchedUpdates: a.unbatchedUpdates,
                deferredUpdates: a.deferredUpdates,
                flushSync: a.flushSync,
                getPublicRootInstance: function (a) {
                    a = a.current;
                    if (!a.child)
                        return null;
                    switch (a.child.tag) {
                    case 5:
                        return b(a.child.stateNode);
                    default:
                        return a.child.stateNode;
                    }
                },
                findHostInstance: function (a) {
                    a = Tf(a);
                    return null === a ? null : a.stateNode;
                },
                findHostInstanceWithNoPortals: function (a) {
                    a = Uf(a);
                    return null === a ? null : a.stateNode;
                }
            };
        }({
            getRootHostContext: function (a) {
                if (9 === a.nodeType)
                    a = (a = a.documentElement) ? a.namespaceURI : Ob(null, '');
                else {
                    var b = 8 === a.nodeType ? a.parentNode : a;
                    a = b.namespaceURI || null;
                    b = b.tagName;
                    a = Ob(a, b);
                }
                return a;
            },
            getChildHostContext: function (a, b) {
                return Ob(a, b);
            },
            getPublicInstance: function (a) {
                return a;
            },
            prepareForCommit: function () {
                Qc = l.isEnabled();
                Rc = vc.getSelectionInformation();
                l.setEnabled(!1);
            },
            resetAfterCommit: function () {
                vc.restoreSelection(Rc);
                Rc = null;
                l.setEnabled(Qc);
                Qc = null;
            },
            createInstance: function (a, b, c, d, e) {
                a = hg(a, b, c, d);
                Mb(e, a);
                Pc(a, b);
                return a;
            },
            appendInitialChild: function (a, b) {
                a.appendChild(b);
            },
            finalizeInitialChildren: function (a, b, c, d) {
                jg(a, b, c, d);
                a: {
                    switch (b) {
                    case 'button':
                    case 'input':
                    case 'select':
                    case 'textarea':
                        a = !!c.autoFocus;
                        break a;
                    }
                    a = !1;
                }
                return a;
            },
            prepareUpdate: function (a, b, c, d, e) {
                return kg(a, b, c, d, e);
            },
            commitMount: function (a) {
                a.focus();
            },
            commitUpdate: function (a, b, c, d, e) {
                Pc(a, e);
                lg(a, b, c, d, e);
            },
            shouldSetTextContent: function (a, b) {
                return 'textarea' === a || 'string' === typeof b.children || 'number' === typeof b.children || 'object' === typeof b.dangerouslySetInnerHTML && null !== b.dangerouslySetInnerHTML && 'string' === typeof b.dangerouslySetInnerHTML.__html;
            },
            resetTextContent: function (a) {
                a.textContent = '';
            },
            shouldDeprioritizeSubtree: function (a, b) {
                return !!b.hidden;
            },
            createTextInstance: function (a, b, c, d) {
                a = ig(a, b);
                Mb(d, a);
                return a;
            },
            commitTextUpdate: function (a, b, c) {
                a.nodeValue = c;
            },
            appendChild: function (a, b) {
                a.appendChild(b);
            },
            appendChildToContainer: function (a, b) {
                8 === a.nodeType ? a.parentNode.insertBefore(b, a) : a.appendChild(b);
            },
            insertBefore: function (a, b, c) {
                a.insertBefore(b, c);
            },
            insertInContainerBefore: function (a, b, c) {
                8 === a.nodeType ? a.parentNode.insertBefore(b, c) : a.insertBefore(b, c);
            },
            removeChild: function (a, b) {
                a.removeChild(b);
            },
            removeChildFromContainer: function (a, b) {
                8 === a.nodeType ? a.parentNode.removeChild(b) : a.removeChild(b);
            },
            canHydrateInstance: function (a, b) {
                return 1 === a.nodeType && b === a.nodeName.toLowerCase();
            },
            canHydrateTextInstance: function (a, b) {
                return '' === b ? !1 : 3 === a.nodeType;
            },
            getNextHydratableSibling: function (a) {
                for (a = a.nextSibling; a && 1 !== a.nodeType && 3 !== a.nodeType;)
                    a = a.nextSibling;
                return a;
            },
            getFirstHydratableChild: function (a) {
                for (a = a.firstChild; a && 1 !== a.nodeType && 3 !== a.nodeType;)
                    a = a.nextSibling;
                return a;
            },
            hydrateInstance: function (a, b, c, d, e, f) {
                Mb(f, a);
                Pc(a, c);
                return mg(a, b, c, e, d);
            },
            hydrateTextInstance: function (a, b, c) {
                Mb(c, a);
                return ng(a, b);
            },
            didNotHydrateInstance: function (a, b) {
                1 === b.nodeType ? og(a, b) : pg(a, b);
            },
            didNotFindHydratableInstance: function (a, b, c) {
                qg(a, b, c);
            },
            didNotFindHydratableTextInstance: function (a, b) {
                rg(a, b);
            },
            scheduleDeferredCallback: Pf,
            useSyncScheduling: !0
        });
    Ab.injection.injectFiberBatchedUpdates(B.batchedUpdates);
    var sg = {
        createPortal: se,
        hydrate: function (a, b, c) {
            return Bb(null, a, b, !0, c);
        },
        render: function (a, b, c) {
            return Bb(null, a, b, !1, c);
        },
        unstable_renderSubtreeIntoContainer: function (a, b, c, d) {
            null != a && fa.has(a) ? void 0 : m('38');
            return Bb(a, b, c, !1, d);
        },
        unmountComponentAtNode: function (a) {
            xc(a) ? void 0 : m('40');
            return a._reactRootContainer ? (B.unbatchedUpdates(function () {
                Bb(null, null, a, !1, function () {
                    a._reactRootContainer = null;
                });
            }), !0) : !1;
        },
        findDOMNode: ab,
        unstable_createPortal: se,
        unstable_batchedUpdates: Ab.batchedUpdates,
        unstable_deferredUpdates: B.deferredUpdates,
        flushSync: B.flushSync,
        __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
            EventPluginHub: X,
            EventPluginRegistry: na,
            EventPropagators: la,
            ReactControlledComponent: yb,
            ReactDOMComponentTree: N,
            ReactDOMEventListener: G
        }
    };
    (function (a) {
        if ('undefined' === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__)
            return !1;
        var b = __REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!b.supportsFiber)
            return !0;
        try {
            var c = b.inject(a);
            Vb = Pd(function (a) {
                return b.onCommitFiberRoot(c, a);
            });
            Wb = Pd(function (a) {
                return b.onCommitFiberUnmount(c, a);
            });
        } catch (d) {
        }
        return !0;
    }({
        findFiberByHostInstance: N.getClosestInstanceFromNode,
        findHostInstanceByFiber: B.findHostInstance,
        bundleType: 0,
        version: '16.0.0',
        rendererPackageName: 'react-dom'
    }));
    return sg;
}
'object' === typeof exports && 'undefined' !== typeof module ? module.exports = Nb(require('react')) : 'function' === typeof define && define.amd ? define('react-dom@16.0.0#umd/react-dom.production.min', ['react'], Nb) : this.ReactDOM = Nb(this.React);
/*styled-components@2.2.3#dist/styled-components.min*/
!function (e, t) {
    'object' == typeof exports && 'undefined' != typeof module ? t(exports, require('react')) : 'function' == typeof define && define.amd ? define('styled-components@2.2.3#dist/styled-components.min', [
        'exports',
        'react'
    ], t) : t(e.styled = e.styled || {}, e.React);
}(this, function (e, t) {
    'use strict';
    function n(e) {
        return e.replace(g, '-$1').toLowerCase();
    }
    function r(e) {
        return v(e).replace(C, '-ms-');
    }
    function o(e) {
        return !0 === E(e) && '[object Object]' === Object.prototype.toString.call(e);
    }
    function a(e, t) {
        return t = { exports: {} }, e(t, t.exports), t.exports;
    }
    function i(e) {
        return function () {
            return e;
        };
    }
    function s(e, t, n, r, o, a, i, s) {
        if (te(t), !e) {
            var c;
            if (void 0 === t)
                c = new Error('Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.');
            else {
                var u = [
                        n,
                        r,
                        o,
                        a,
                        i,
                        s
                    ], l = 0;
                c = new Error(t.replace(/%s/g, function () {
                    return u[l++];
                })), c.name = 'Invariant Violation';
            }
            throw c.framesToPop = 1, c;
        }
    }
    function c(e) {
        return 'string' == typeof e;
    }
    function u(e) {
        return 'function' == typeof e && 'string' == typeof e.styledComponentId;
    }
    function l(e) {
        return e.displayName || e.name || 'Component';
    }
    function p(e) {
        var t = Ce.call(e);
        return '[object Function]' === t || 'function' == typeof e && '[object RegExp]' !== t || 'undefined' != typeof window && (e === window.setTimeout || e === window.alert || e === window.confirm || e === window.prompt);
    }
    function h(e, t) {
        for (var n = 1540483477, r = t ^ e.length, o = e.length, a = 0; o >= 4;) {
            var i = d(e, a);
            i = m(i, n), i ^= i >>> 24, i = m(i, n), r = m(r, n), r ^= i, a += 4, o -= 4;
        }
        switch (o) {
        case 3:
            r ^= f(e, a), r ^= e.charCodeAt(a + 2) << 16, r = m(r, n);
            break;
        case 2:
            r ^= f(e, a), r = m(r, n);
            break;
        case 1:
            r ^= e.charCodeAt(a), r = m(r, n);
        }
        return r ^= r >>> 13, r = m(r, n), (r ^= r >>> 15) >>> 0;
    }
    function d(e, t) {
        return e.charCodeAt(t++) + (e.charCodeAt(t++) << 8) + (e.charCodeAt(t++) << 16) + (e.charCodeAt(t) << 24);
    }
    function f(e, t) {
        return e.charCodeAt(t++) + (e.charCodeAt(t++) << 8);
    }
    function m(e, t) {
        return e |= 0, t |= 0, (65535 & e) * t + (((e >>> 16) * t & 65535) << 16) | 0;
    }
    var y = 'default' in t ? t.default : t, g = /([A-Z])/g, b = n, v = b, C = /^ms-/, k = r, w = 'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator ? function (e) {
            return typeof e;
        } : function (e) {
            return e && 'function' == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? 'symbol' : typeof e;
        }, x = function (e, t) {
            if (!(e instanceof t))
                throw new TypeError('Cannot call a class as a function');
        }, A = function () {
            function e(e, t) {
                for (var n = 0; n < t.length; n++) {
                    var r = t[n];
                    r.enumerable = r.enumerable || !1, r.configurable = !0, 'value' in r && (r.writable = !0), Object.defineProperty(e, r.key, r);
                }
            }
            return function (t, n, r) {
                return n && e(t.prototype, n), r && e(t, r), t;
            };
        }(), S = Object.assign || function (e) {
            for (var t = 1; t < arguments.length; t++) {
                var n = arguments[t];
                for (var r in n)
                    Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r]);
            }
            return e;
        }, T = function (e, t) {
            if ('function' != typeof t && null !== t)
                throw new TypeError('Super expression must either be null or a function, not ' + typeof t);
            e.prototype = Object.create(t && t.prototype, {
                constructor: {
                    value: e,
                    enumerable: !1,
                    writable: !0,
                    configurable: !0
                }
            }), t && (Object.setPrototypeOf ? Object.setPrototypeOf(e, t) : e.__proto__ = t);
        }, O = function (e, t) {
            var n = {};
            for (var r in e)
                t.indexOf(r) >= 0 || Object.prototype.hasOwnProperty.call(e, r) && (n[r] = e[r]);
            return n;
        }, j = function (e, t) {
            if (!e)
                throw new ReferenceError('this hasn\'t been initialised - super() hasn\'t been called');
            return !t || 'object' != typeof t && 'function' != typeof t ? e : t;
        }, I = function (e) {
            return null != e && 'object' === (void 0 === e ? 'undefined' : w(e)) && !Array.isArray(e);
        }, E = I, P = function (e) {
            var t, n;
            return !1 !== o(e) && ('function' == typeof (t = e.constructor) && (n = t.prototype, !1 !== o(n) && !1 !== n.hasOwnProperty('isPrototypeOf')));
        }, M = function e(t, n) {
            var r = Object.keys(t).filter(function (e) {
                var n = t[e];
                return void 0 !== n && null !== n && !1 !== n && '' !== n;
            }).map(function (n) {
                return P(t[n]) ? e(t[n], n) : k(n) + ': ' + t[n] + ';';
            }).join(' ');
            return n ? n + ' {\n  ' + r + '\n}' : r;
        }, N = function e(t, n) {
            return t.reduce(function (t, r) {
                return void 0 === r || null === r || !1 === r || '' === r ? t : Array.isArray(r) ? [].concat(t, e(r, n)) : r.hasOwnProperty('styledComponentId') ? [].concat(t, ['.' + r.styledComponentId]) : 'function' == typeof r ? n ? t.concat.apply(t, e([r(n)], n)) : t.concat(r) : t.concat(P(r) ? M(r) : r.toString());
            }, []);
        }, R = a(function (e, t) {
            !function (n) {
                'object' === (void 0 === t ? 'undefined' : w(t)) && void 0 !== e ? e.exports = n(null) : window.stylis = n(null);
            }(function e(t) {
                function n(e, t, o, s, l) {
                    for (var p, h, d = 0, y = 0, g = 0, b = 0, v = 0, C = 0, k = 0, w = 0, x = 0, A = 0, S = 0, I = 0, E = 0, P = 0, M = 0, N = 0, R = 0, F = 0, L = 0, te = o.length, Oe = te - 1, je = '', Me = '', Re = '', De = '', qe = '', Ve = ''; M < te;) {
                        if (k = o.charCodeAt(M), y + b + g + d === 0) {
                            if (M === Oe && (N > 0 && (Me = Me.replace(m, '')), Me.trim().length > 0)) {
                                switch (k) {
                                case J:
                                case Y:
                                case W:
                                case G:
                                case X:
                                    break;
                                default:
                                    Me += o.charAt(M);
                                }
                                k = W;
                            }
                            if (1 === R)
                                switch (k) {
                                case H:
                                case re:
                                    R = 0;
                                    break;
                                case Y:
                                case G:
                                case X:
                                case J:
                                    break;
                                default:
                                    M--, k = W;
                                }
                            switch (k) {
                            case H:
                                for (Me = Me.trim(), v = Me.charCodeAt(0), S = 1, L = ++M; M < te;) {
                                    switch (k = o.charCodeAt(M)) {
                                    case H:
                                        S++;
                                        break;
                                    case $:
                                        S--;
                                    }
                                    if (0 === S)
                                        break;
                                    M++;
                                }
                                switch (Re = o.substring(L, M), v === pe && (v = (Me = Me.replace(f, '').trim()).charCodeAt(0)), v) {
                                case Z:
                                    switch (N > 0 && (Me = Me.replace(m, '')), C = Me.charCodeAt(1)) {
                                    case ke:
                                    case me:
                                    case ye:
                                        p = t;
                                        break;
                                    default:
                                        p = Pe;
                                    }
                                    if (Re = n(t, p, Re, C, l + 1), L = Re.length, Ee > 0 && 0 === L && (L = Me.length), Ne > 0 && (p = r(Pe, Me, F), h = u(Ue, Re, p, t, xe, we, L, C, l), Me = p.join(''), void 0 !== h && 0 === (L = (Re = h.trim()).length) && (C = 0, Re = '')), L > 0)
                                        switch (C) {
                                        case ye:
                                            Me = Me.replace(D, i);
                                        case ke:
                                        case me:
                                            Re = Me + '{' + Re + '}';
                                            break;
                                        case fe:
                                            Me = Me.replace(T, '$1 $2' + (We > 0 ? $e : '')), Re = Me + '{' + Re + '}', Re = '@' + (Te > 0 ? _ + Re + '@' + Re : Re);
                                            break;
                                        default:
                                            Re = Me + Re;
                                        }
                                    else
                                        Re = '';
                                    break;
                                default:
                                    Re = n(t, r(t, Me, F), Re, s, l + 1);
                                }
                                qe += Re, I = 0, R = 0, P = 0, N = 0, F = 0, E = 0, Me = '', Re = '', k = o.charCodeAt(++M);
                                break;
                            case $:
                            case W:
                                if (Me = (N > 0 ? Me.replace(m, '') : Me).trim(), (L = Me.length) > 1)
                                    switch (0 === P && ((v = Me.charCodeAt(0)) === ee || v > 96 && v < 123) && (L = (Me = Me.replace(' ', ':')).length), Ne > 0 && void 0 !== (h = u(Le, Me, t, e, xe, we, De.length, s, l)) && 0 === (L = (Me = h.trim()).length) && (Me = '\0\0'), v = Me.charCodeAt(0), C = Me.charCodeAt(1), v + C) {
                                    case pe:
                                        break;
                                    case ve:
                                    case Ce:
                                        Ve += Me + o.charAt(M);
                                        break;
                                    default:
                                        if (Me.charCodeAt(L - 1) === oe)
                                            break;
                                        De += a(Me, v, C, Me.charCodeAt(2));
                                    }
                                I = 0, R = 0, P = 0, N = 0, F = 0, Me = '', k = o.charCodeAt(++M);
                            }
                        }
                        switch (k) {
                        case G:
                        case X:
                            if (y + b + g + d + Ie === 0)
                                switch (A) {
                                case q:
                                case ae:
                                case ie:
                                case Z:
                                case le:
                                case ce:
                                case ne:
                                case ue:
                                case se:
                                case ee:
                                case oe:
                                case re:
                                case W:
                                case H:
                                case $:
                                    break;
                                default:
                                    P > 0 && (R = 1);
                                }
                            y === se && (y = 0), Ne * ze > 0 && u(Fe, Me, t, e, xe, we, De.length, s, l), we = 1, xe++;
                            break;
                        case W:
                        case $:
                            if (y + b + g + d === 0) {
                                we++;
                                break;
                            }
                        default:
                            switch (we++, je = o.charAt(M), k) {
                            case Y:
                            case J:
                                if (b + d === 0)
                                    switch (w) {
                                    case re:
                                    case oe:
                                    case Y:
                                    case J:
                                        je = '';
                                        break;
                                    default:
                                        k !== J && (je = ' ');
                                    }
                                break;
                            case pe:
                                je = '\\0';
                                break;
                            case he:
                                je = '\\f';
                                break;
                            case de:
                                je = '\\v';
                                break;
                            case Q:
                                b + y + d === 0 && Se > 0 && (F = 1, N = 1, je = '\f' + je);
                                break;
                            case 108:
                                if (b + y + d + Ae === 0 && P > 0)
                                    switch (M - P) {
                                    case 2:
                                        w === ge && o.charCodeAt(M - 3) === oe && (Ae = w);
                                    case 8:
                                        x === be && (Ae = x);
                                    }
                                break;
                            case oe:
                                b + y + d === 0 && (P = M);
                                break;
                            case re:
                                y + g + b + d === 0 && (N = 1, je += '\r');
                                break;
                            case ie:
                            case ae:
                                0 === y && (b = b === k ? 0 : 0 === b ? k : b, M === Oe && (Oe++, te++));
                                break;
                            case V:
                                b + y + g === 0 && d++;
                                break;
                            case K:
                                b + y + g === 0 && d--;
                                break;
                            case q:
                                b + y + d === 0 && (M === Oe && (Oe++, te++), g--);
                                break;
                            case B:
                                if (b + y + d === 0) {
                                    if (0 === I)
                                        switch (2 * w + 3 * x) {
                                        case 533:
                                            break;
                                        default:
                                            S = 0, I = 1;
                                        }
                                    g++;
                                }
                                break;
                            case Z:
                                y + g + b + d + P + E === 0 && (E = 1);
                                break;
                            case ne:
                            case se:
                                if (b + d + g > 0)
                                    break;
                                switch (y) {
                                case 0:
                                    switch (2 * k + 3 * o.charCodeAt(M + 1)) {
                                    case 235:
                                        y = se;
                                        break;
                                    case 220:
                                        y = ne;
                                    }
                                    break;
                                case ne:
                                    k === se && w === ne && (je = '', y = 0);
                                }
                            }
                            if (0 === y) {
                                if (Se + b + d + E === 0 && s !== fe && k !== W)
                                    switch (k) {
                                    case re:
                                    case le:
                                    case ce:
                                    case ue:
                                    case q:
                                    case B:
                                        if (0 === I) {
                                            switch (w) {
                                            case Y:
                                            case J:
                                            case X:
                                            case G:
                                                je += '\0';
                                                break;
                                            default:
                                                je = '\0' + je + (k === re ? '' : '\0');
                                            }
                                            N = 1;
                                        } else
                                            switch (k) {
                                            case B:
                                                I = ++S;
                                                break;
                                            case q:
                                                0 == (I = --S) && (N = 1, je += '\0');
                                            }
                                        break;
                                    case J:
                                        switch (w) {
                                        case pe:
                                        case H:
                                        case $:
                                        case W:
                                        case re:
                                        case he:
                                        case Y:
                                        case J:
                                        case X:
                                        case G:
                                            break;
                                        default:
                                            0 === I && (N = 1, je += '\0');
                                        }
                                    }
                                Me += je, k !== J && (A = k);
                            }
                        }
                        x = w, w = k, M++;
                    }
                    if (L = De.length, Ee > 0 && 0 === L && 0 === qe.length && 0 === t[0].length == !1 && (s !== me || 1 === t.length && (Se > 0 ? He : Be) === t[0]) && (L = t.join(',').length + 2), L > 0) {
                        if (p = 0 === Se && s !== fe ? c(t) : t, Ne > 0 && void 0 !== (h = u(_e, De, p, e, xe, we, L, s, l)) && 0 === (De = h).length)
                            return Ve + De + qe;
                        if (De = p.join(',') + '{' + De + '}', Te * Ae > 0) {
                            switch (Ae) {
                            case be:
                                De = De.replace(j, ':' + U + '$1') + De;
                                break;
                            case ge:
                                De = De.replace(O, '::' + _ + 'input-$1') + De.replace(O, '::' + U + '$1') + De.replace(O, ':' + z + 'input-$1') + De;
                            }
                            Ae = 0;
                        }
                    }
                    return Ve + De + qe;
                }
                function r(e, t, n) {
                    var r = t.trim().split(w), a = r, i = r.length, s = e.length;
                    switch (s) {
                    case 0:
                    case 1:
                        for (var c = 0, u = 0 === s ? '' : e[0] + ' '; c < i; ++c)
                            a[c] = o(u, a[c], n, s).trim();
                        break;
                    default:
                        for (var c = 0, l = 0, a = []; c < i; ++c)
                            for (var p = 0; p < s; ++p)
                                a[l++] = o(e[p] + ' ', r[c], n, s).trim();
                    }
                    return a;
                }
                function o(e, t, n, r) {
                    var o = t, a = o.charCodeAt(0);
                    switch (a < 33 && (a = (o = o.trim()).charCodeAt(0)), a) {
                    case Q:
                        switch (Se + r) {
                        case 0:
                        case 1:
                            if (0 === e.trim().length)
                                break;
                        default:
                            return o.replace(x, '$1' + e.trim());
                        }
                        break;
                    case oe:
                        switch (o.charCodeAt(1)) {
                        case 103:
                            if (Oe > 0 && Se > 0)
                                return o.replace(A, '$1').replace(x, '$1' + Be);
                            break;
                        default:
                            return e.trim() + o;
                        }
                    default:
                        if (n * Se > 0 && o.indexOf('\f') > 0)
                            return o.replace(x, (e.charCodeAt(0) === oe ? '' : '$1') + e.trim());
                    }
                    return e + o;
                }
                function a(e, t, n, r) {
                    var o, a = 0, i = e + ';', c = 2 * t + 3 * n + 4 * r;
                    if (944 === c)
                        i = s(i);
                    else if (Te > 0)
                        switch (c) {
                        case 1015:
                            return i.charCodeAt(9) === ee ? _ + i + i : i;
                        case 951:
                            return 116 === i.charCodeAt(3) ? _ + i + i : i;
                        case 963:
                            return 110 === i.charCodeAt(5) ? _ + i + i : i;
                        case 969:
                        case 942:
                            return _ + i + i;
                        case 978:
                            return _ + i + U + i + i;
                        case 1019:
                        case 983:
                            return _ + i + U + i + z + i + i;
                        case 883:
                            return i.charCodeAt(8) === ee ? _ + i + i : i;
                        case 932:
                            return _ + i + z + i + i;
                        case 964:
                            return _ + i + z + 'flex-' + i + i;
                        case 1023:
                            return o = i.substring(i.indexOf(':', 15)).replace('flex-', '').replace('space-between', 'justify'), _ + 'box-pack' + o + _ + i + z + 'flex-pack' + o + i;
                        case 1005:
                            return g.test(i) ? i.replace(y, ':' + _) + i.replace(y, ':' + U) + i : i;
                        case 1000:
                            switch (o = i.substring(13).trim(), a = o.indexOf('-') + 1, o.charCodeAt(0) + o.charCodeAt(a)) {
                            case 226:
                                o = i.replace(R, 'tb');
                                break;
                            case 232:
                                o = i.replace(R, 'tb-rl');
                                break;
                            case 220:
                                o = i.replace(R, 'lr');
                                break;
                            default:
                                return i;
                            }
                            return _ + i + z + o + i;
                        case 1017:
                            if (-1 === i.indexOf('sticky', 9))
                                return i;
                        case 975:
                            switch (a = (i = e).length - 10, o = (33 === i.charCodeAt(a) ? i.substring(0, a) : i).substring(e.indexOf(':', 7) + 1).trim(), c = o.charCodeAt(0) + (0 | o.charCodeAt(7))) {
                            case 203:
                                if (o.charCodeAt(8) < 111)
                                    break;
                            case 115:
                                i = i.replace(o, _ + o) + ';' + i;
                                break;
                            case 207:
                            case 102:
                                i = i.replace(o, _ + (c > 102 ? 'inline-' : '') + 'box') + ';' + i.replace(o, _ + o) + ';' + i.replace(o, z + o + 'box') + ';' + i;
                            }
                            return i + ';';
                        case 938:
                            if (i.charCodeAt(5) === ee)
                                switch (i.charCodeAt(6)) {
                                case 105:
                                    return o = i.replace('-items', ''), _ + i + _ + 'box-' + o + z + 'flex-' + o + i;
                                case 115:
                                    return _ + i + z + 'flex-item-' + i.replace(L, '') + i;
                                default:
                                    return _ + i + z + 'flex-line-pack' + i.replace('align-content', '') + i;
                                }
                            break;
                        case 953:
                            if ((a = i.indexOf('-content', 9)) > 0 && 109 === i.charCodeAt(a - 3) && 45 !== i.charCodeAt(a - 4))
                                return o = i.substring(a - 3), 'width:' + _ + o + 'width:' + U + o + 'width:' + o;
                            break;
                        case 962:
                            if (i = _ + i + (102 === i.charCodeAt(5) ? z + i : '') + i, n + r === 211 && 105 === i.charCodeAt(13) && i.indexOf('transform', 10) > 0)
                                return i.substring(0, i.indexOf(';', 27) + 1).replace(b, '$1' + _ + '$2') + i;
                        }
                    return i;
                }
                function i(e, t) {
                    var n = a(t, t.charCodeAt(0), t.charCodeAt(1), t.charCodeAt(2));
                    return n !== t + ';' ? n.replace(F, ' or ($1)').substring(4) : '(' + t + ')';
                }
                function s(e) {
                    var t = e.length, n = e.indexOf(':', 9) + 1, r = e.substring(0, n).trim(), o = e.substring(n, t - 1).trim(), a = '';
                    if (e.charCodeAt(9) !== ee)
                        for (var i = o.split(v), s = 0, n = 0, t = i.length; s < t; n = 0, ++s) {
                            for (var c = i[s], u = c.split(C); c = u[n];) {
                                var l = c.charCodeAt(0);
                                if (1 === We && (l > Z && l < 90 || l > 96 && l < 123 || l === te || l === ee && c.charCodeAt(1) !== ee))
                                    switch (isNaN(parseFloat(c)) + (-1 !== c.indexOf('('))) {
                                    case 1:
                                        switch (c) {
                                        case 'infinite':
                                        case 'alternate':
                                        case 'backwards':
                                        case 'running':
                                        case 'normal':
                                        case 'forwards':
                                        case 'both':
                                        case 'none':
                                        case 'linear':
                                        case 'ease':
                                        case 'ease-in':
                                        case 'ease-out':
                                        case 'ease-in-out':
                                        case 'paused':
                                        case 'reverse':
                                        case 'alternate-reverse':
                                        case 'inherit':
                                        case 'initial':
                                        case 'unset':
                                        case 'step-start':
                                        case 'step-end':
                                            break;
                                        default:
                                            c += $e;
                                        }
                                    }
                                u[n++] = c;
                            }
                            a += (0 === s ? '' : ',') + u.join(' ');
                        }
                    else
                        a += 110 === e.charCodeAt(10) ? o + (1 === We ? $e : '') : o;
                    return a = r + a + ';', Te > 0 ? _ + a + a : a;
                }
                function c(e) {
                    for (var t, n, r = 0, o = e.length, a = Array(o); r < o; ++r) {
                        for (var i = e[r].split(k), s = '', c = 0, u = 0, l = 0, p = 0, h = i.length; c < h; ++c)
                            if (!(0 === (u = (n = i[c]).length) && h > 1)) {
                                if (l = s.charCodeAt(s.length - 1), p = n.charCodeAt(0), t = '', 0 !== c)
                                    switch (l) {
                                    case ne:
                                    case le:
                                    case ce:
                                    case ue:
                                    case J:
                                    case B:
                                        break;
                                    default:
                                        t = ' ';
                                    }
                                switch (p) {
                                case Q:
                                    n = t + He;
                                case le:
                                case ce:
                                case ue:
                                case J:
                                case q:
                                case B:
                                    break;
                                case V:
                                    n = t + n + He;
                                    break;
                                case oe:
                                    switch (2 * n.charCodeAt(1) + 3 * n.charCodeAt(2)) {
                                    case 530:
                                        if (Oe > 0) {
                                            n = t + n.substring(8, u - 1);
                                            break;
                                        }
                                    default:
                                        (c < 1 || i[c - 1].length < 1) && (n = t + He + n);
                                    }
                                    break;
                                case re:
                                    t = '';
                                default:
                                    n = u > 1 && n.indexOf(':') > 0 ? t + n.replace(N, '$1' + He + '$2') : t + n + He;
                                }
                                s += n;
                            }
                        a[r] = s.replace(m, '').trim();
                    }
                    return a;
                }
                function u(e, t, n, r, o, a, i, s, c) {
                    for (var u, l = 0, p = t; l < Ne; ++l)
                        switch (u = Me[l].call(d, e, p, n, r, o, a, i, s, c)) {
                        case void 0:
                        case !1:
                        case !0:
                        case null:
                            break;
                        default:
                            p = u;
                        }
                    switch (p) {
                    case void 0:
                    case !1:
                    case !0:
                    case null:
                    case t:
                        break;
                    default:
                        return p;
                    }
                }
                function l(e) {
                    return e.replace(m, '').replace(I, '').replace(E, '$1').replace(P, '$1').replace(M, ' ');
                }
                function p(e) {
                    switch (e) {
                    case void 0:
                    case null:
                        Ne = Me.length = 0;
                        break;
                    default:
                        switch (e.constructor) {
                        case Array:
                            for (var t = 0, n = e.length; t < n; ++t)
                                p(e[t]);
                            break;
                        case Function:
                            Me[Ne++] = e;
                            break;
                        case Boolean:
                            ze = 0 | !!e;
                        }
                    }
                    return p;
                }
                function h(e) {
                    for (var t in e) {
                        var n = e[t];
                        switch (t) {
                        case 'keyframe':
                            We = 0 | n;
                            break;
                        case 'global':
                            Oe = 0 | n;
                            break;
                        case 'cascade':
                            Se = 0 | n;
                            break;
                        case 'compress':
                            je = 0 | n;
                            break;
                        case 'prefix':
                            Te = 0 | n;
                            break;
                        case 'semicolon':
                            Ie = 0 | n;
                            break;
                        case 'preserve':
                            Ee = 0 | n;
                        }
                    }
                    return h;
                }
                function d(t, r) {
                    if (void 0 !== this && this.constructor === d)
                        return e(t);
                    var o = t, a = o.charCodeAt(0);
                    a < 33 && (a = (o = o.trim()).charCodeAt(0)), We > 0 && ($e = o.replace(S, a === V ? '' : '-')), a = 1, 1 === Se ? Be = o : He = o;
                    var i, s = [Be];
                    Ne > 0 && void 0 !== (i = u(De, r, s, s, xe, we, 0, 0, 0)) && 'string' == typeof i && (r = i);
                    var c = n(Pe, s, r, 0, 0);
                    return Ne > 0 && void 0 !== (i = u(Re, c, s, s, xe, we, c.length, 0, 0)) && 'string' != typeof (c = i) && (a = 0), $e = '', Be = '', He = '', Ae = 0, xe = 1, we = 1, je * a == 0 ? c : l(c);
                }
                var f = /^\0+/g, m = /[\0\r\f]/g, y = /: */g, g = /zoo|gra/, b = /([,: ])(transform)/g, v = /,+\s*(?![^(]*[)])/g, C = / +\s*(?![^(]*[)])/g, k = / *[\0] */g, w = /,\r+?/g, x = /([\t\r\n ])*\f?&/g, A = /:global\(((?:[^\(\)\[\]]*|\[.*\]|\([^\(\)]*\))*)\)/g, S = /\W+/g, T = /@(k\w+)\s*(\S*)\s*/, O = /::(place)/g, j = /:(read-only)/g, I = /\s+(?=[{\];=:>])/g, E = /([[}=:>])\s+/g, P = /(\{[^{]+?);(?=\})/g, M = /\s{2,}/g, N = /([^\(])(:+) */g, R = /[svh]\w+-[tblr]{2}/, D = /\(\s*([^]*?)\s*\)/g, F = /([^]*?);/g, L = /-self|flex-/g, _ = '-webkit-', U = '-moz-', z = '-ms-', W = 59, $ = 125, H = 123, B = 40, q = 41, V = 91, K = 93, X = 10, G = 13, Y = 9, Z = 64, J = 32, Q = 38, ee = 45, te = 95, ne = 42, re = 44, oe = 58, ae = 39, ie = 34, se = 47, ce = 62, ue = 43, le = 126, pe = 0, he = 12, de = 11, fe = 107, me = 109, ye = 115, ge = 112, be = 111, ve = 169, Ce = 163, ke = 100, we = 1, xe = 1, Ae = 0, Se = 1, Te = 1, Oe = 1, je = 0, Ie = 0, Ee = 0, Pe = [], Me = [], Ne = 0, Re = -2, De = -1, Fe = 0, Le = 1, _e = 2, Ue = 3, ze = 0, We = 1, $e = '', He = '', Be = '';
                return d.use = p, d.set = h, void 0 !== t && h(t), d;
            });
        }), D = new R({
            global: !1,
            cascade: !0,
            keyframe: !1,
            prefix: !0,
            compress: !1,
            semicolon: !0
        }), F = function (e, t, n) {
            var r = e.join('').replace(/^\s*\/\/.*$/gm, ''), o = t && n ? n + ' ' + t + ' { ' + r + ' }' : r;
            return D(n || !t ? '' : t, o);
        }, L = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), _ = L.length, U = function (e) {
            var t = '', n = void 0;
            for (n = e; n > _; n = Math.floor(n / _))
                t = L[n % _] + t;
            return L[n % _] + t;
        }, z = function (e, t) {
            return t.reduce(function (t, n, r) {
                return t.concat(n, e[r + 1]);
            }, [e[0]]);
        }, W = function (e) {
            for (var t = arguments.length, n = Array(t > 1 ? t - 1 : 0), r = 1; r < t; r++)
                n[r - 1] = arguments[r];
            return N(z(e, n));
        }, $ = function (e) {
            var t = '' + (e || ''), n = [];
            return t.replace(/^[^\S\n]*?\/\* sc-component-id:\s+(\S+)\s+\*\//gm, function (e, t, r) {
                return n.push({
                    componentId: t,
                    matchIndex: r
                }), e;
            }), n.map(function (e, r) {
                var o = e.componentId, a = e.matchIndex, i = n[r + 1];
                return {
                    componentId: o,
                    cssFromDOM: i ? t.slice(a, i.matchIndex) : t.slice(a)
                };
            });
        }, H = function () {
            return 'undefined' != typeof __webpack_nonce__ ? __webpack_nonce__ : null;
        }, B = function () {
            function e(t, n) {
                var r = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : '';
                x(this, e), this.el = t, this.isLocal = n, this.ready = !1;
                var o = $(r);
                this.size = o.length, this.components = o.reduce(function (e, t) {
                    return e[t.componentId] = t, e;
                }, {});
            }
            return e.prototype.isFull = function () {
                return this.size >= 40;
            }, e.prototype.addComponent = function (e) {
                if (this.ready || this.replaceElement(), this.components[e])
                    throw new Error('Trying to add Component \'' + e + '\' twice!');
                var t = {
                    componentId: e,
                    textNode: document.createTextNode('')
                };
                this.el.appendChild(t.textNode), this.size += 1, this.components[e] = t;
            }, e.prototype.inject = function (e, t, n) {
                this.ready || this.replaceElement();
                var r = this.components[e];
                if (!r)
                    throw new Error('Must add a new component before you can inject css into it');
                if ('' === r.textNode.data && r.textNode.appendData('\n/* sc-component-id: ' + e + ' */\n'), r.textNode.appendData(t), n) {
                    var o = this.el.getAttribute(V);
                    this.el.setAttribute(V, o ? o + ' ' + n : n);
                }
                var a = H();
                a && this.el.setAttribute('nonce', a);
            }, e.prototype.toHTML = function () {
                return this.el.outerHTML;
            }, e.prototype.toReactElement = function () {
                throw new Error('BrowserTag doesn\'t implement toReactElement!');
            }, e.prototype.clone = function () {
                throw new Error('BrowserTag cannot be cloned!');
            }, e.prototype.replaceElement = function () {
                var e = this;
                if (this.ready = !0, 0 !== this.size) {
                    var t = this.el.cloneNode();
                    if (t.appendChild(document.createTextNode('\n')), Object.keys(this.components).forEach(function (n) {
                            var r = e.components[n];
                            r.textNode = document.createTextNode(r.cssFromDOM), t.appendChild(r.textNode);
                        }), !this.el.parentNode)
                        throw new Error('Trying to replace an element that wasn\'t mounted!');
                    this.el.parentNode.replaceChild(t, this.el), this.el = t;
                }
            }, e;
        }(), q = {
            create: function () {
                for (var e = [], t = {}, n = document.querySelectorAll('[' + V + ']'), r = n.length, o = 0; o < r; o += 1) {
                    var a = n[o];
                    e.push(new B(a, 'true' === a.getAttribute(K), a.innerHTML));
                    var i = a.getAttribute(V);
                    i && i.trim().split(/\s+/).forEach(function (e) {
                        t[e] = !0;
                    });
                }
                return new Z(function (e) {
                    var t = document.createElement('style');
                    if (t.type = 'text/css', t.setAttribute(V, ''), t.setAttribute(K, e ? 'true' : 'false'), !document.head)
                        throw new Error('Missing document <head>');
                    return document.head.appendChild(t), new B(t, e);
                }, e, t);
            }
        }, V = 'data-styled-components', K = 'data-styled-components-is-local', X = '__styled-components-stylesheet__', G = null, Y = [], Z = function () {
            function e(t) {
                var n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : [], r = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
                x(this, e), this.hashes = {}, this.deferredInjections = {}, this.stylesCacheable = 'undefined' != typeof document, this.tagConstructor = t, this.tags = n, this.names = r, this.constructComponentTagMap();
            }
            return e.prototype.constructComponentTagMap = function () {
                var e = this;
                this.componentTags = {}, this.tags.forEach(function (t) {
                    Object.keys(t.components).forEach(function (n) {
                        e.componentTags[n] = t;
                    });
                });
            }, e.prototype.getName = function (e) {
                return this.hashes[e.toString()];
            }, e.prototype.alreadyInjected = function (e, t) {
                return !!this.names[t] && (this.hashes[e.toString()] = t, !0);
            }, e.prototype.hasInjectedComponent = function (e) {
                return !!this.componentTags[e];
            }, e.prototype.deferredInject = function (e, t, n) {
                this === G && Y.forEach(function (r) {
                    r.deferredInject(e, t, n);
                }), this.getOrCreateTag(e, t), this.deferredInjections[e] = n;
            }, e.prototype.inject = function (e, t, n, r, o) {
                this === G && Y.forEach(function (r) {
                    r.inject(e, t, n);
                });
                var a = this.getOrCreateTag(e, t), i = this.deferredInjections[e];
                i && (a.inject(e, i), delete this.deferredInjections[e]), a.inject(e, n, o), r && o && (this.hashes[r.toString()] = o);
            }, e.prototype.toHTML = function () {
                return this.tags.map(function (e) {
                    return e.toHTML();
                }).join('');
            }, e.prototype.toReactElements = function () {
                return this.tags.map(function (e, t) {
                    return e.toReactElement('sc-' + t);
                });
            }, e.prototype.getOrCreateTag = function (e, t) {
                var n = this.componentTags[e];
                if (n)
                    return n;
                var r = this.tags[this.tags.length - 1], o = !r || r.isFull() || r.isLocal !== t ? this.createNewTag(t) : r;
                return this.componentTags[e] = o, o.addComponent(e), o;
            }, e.prototype.createNewTag = function (e) {
                var t = this.tagConstructor(e);
                return this.tags.push(t), t;
            }, e.reset = function (t) {
                G = e.create(t);
            }, e.create = function () {
                return ((arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 'undefined' == typeof document) ? pe : q).create();
            }, e.clone = function (t) {
                var n = new e(t.tagConstructor, t.tags.map(function (e) {
                    return e.clone();
                }), S({}, t.names));
                return n.hashes = S({}, t.hashes), n.deferredInjections = S({}, t.deferredInjections), Y.push(n), n;
            }, A(e, null, [{
                    key: 'instance',
                    get: function () {
                        return G || (G = e.create());
                    }
                }]), e;
        }(), J = function () {
        };
    J.thatReturns = i, J.thatReturnsFalse = i(!1), J.thatReturnsTrue = i(!0), J.thatReturnsNull = i(null), J.thatReturnsThis = function () {
        return this;
    }, J.thatReturnsArgument = function (e) {
        return e;
    };
    var Q, ee = J, te = function (e) {
        }, ne = s, re = ee, oe = ne, ae = function () {
            function e() {
                oe(!1, 'Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types');
            }
            function t() {
                return e;
            }
            e.isRequired = e;
            var n = {
                array: e,
                bool: e,
                func: e,
                number: e,
                object: e,
                string: e,
                symbol: e,
                any: e,
                arrayOf: t,
                element: e,
                instanceOf: t,
                node: e,
                objectOf: t,
                oneOf: t,
                oneOfType: t,
                shape: t
            };
            return n.checkPropTypes = re, n.PropTypes = n, n;
        }, ie = a(function (e) {
            e.exports = ae();
        }), se = function (e) {
            function t() {
                return x(this, t), j(this, e.apply(this, arguments));
            }
            return T(t, e), t.prototype.getChildContext = function () {
                var e;
                return e = {}, e[X] = this.props.sheet, e;
            }, t.prototype.render = function () {
                return y.Children.only(this.props.children);
            }, t;
        }(t.Component);
    se.childContextTypes = (Q = {}, Q[X] = ie.oneOfType([
        ie.instanceOf(Z),
        ie.instanceOf(pe)
    ]).isRequired, Q);
    var ce, ue, le = function () {
            function e(t) {
                x(this, e), this.isLocal = t, this.components = {}, this.size = 0, this.names = [];
            }
            return e.prototype.isFull = function () {
                return !1;
            }, e.prototype.addComponent = function (e) {
                if (this.components[e])
                    throw new Error('Trying to add Component \'' + e + '\' twice!');
                this.components[e] = {
                    componentId: e,
                    css: ''
                }, this.size += 1;
            }, e.prototype.concatenateCSS = function () {
                var e = this;
                return Object.keys(this.components).reduce(function (t, n) {
                    return t + e.components[n].css;
                }, '');
            }, e.prototype.inject = function (e, t, n) {
                var r = this.components[e];
                if (!r)
                    throw new Error('Must add a new component before you can inject css into it');
                '' === r.css && (r.css = '/* sc-component-id: ' + e + ' */\n'), r.css += t.replace(/\n*$/, '\n'), n && this.names.push(n);
            }, e.prototype.toHTML = function () {
                var e = [
                        'type="text/css"',
                        V + '="' + this.names.join(' ') + '"',
                        K + '="' + (this.isLocal ? 'true' : 'false') + '"'
                    ], t = H();
                return t && e.push('nonce="' + t + '"'), '<style ' + e.join(' ') + '>' + this.concatenateCSS() + '</style>';
            }, e.prototype.toReactElement = function (e) {
                var t, n = (t = {}, t[V] = this.names.join(' '), t[K] = this.isLocal.toString(), t), r = H();
                return r && (n.nonce = r), y.createElement('style', S({
                    key: e,
                    type: 'text/css'
                }, n, { dangerouslySetInnerHTML: { __html: this.concatenateCSS() } }));
            }, e.prototype.clone = function () {
                var t = this, n = new e(this.isLocal);
                return n.names = [].concat(this.names), n.size = this.size, n.components = Object.keys(this.components).reduce(function (e, n) {
                    return e[n] = S({}, t.components[n]), e;
                }, {}), n;
            }, e;
        }(), pe = function () {
            function e() {
                x(this, e), this.instance = Z.clone(Z.instance);
            }
            return e.prototype.collectStyles = function (e) {
                if (this.closed)
                    throw new Error('Can\'t collect styles once you\'ve called getStyleTags!');
                return y.createElement(se, { sheet: this.instance }, e);
            }, e.prototype.getStyleTags = function () {
                return this.closed || (Y.splice(Y.indexOf(this.instance), 1), this.closed = !0), this.instance.toHTML();
            }, e.prototype.getStyleElement = function () {
                return this.closed || (Y.splice(Y.indexOf(this.instance), 1), this.closed = !0), this.instance.toReactElements();
            }, e.create = function () {
                return new Z(function (e) {
                    return new le(e);
                });
            }, e;
        }(), he = {
            children: !0,
            dangerouslySetInnerHTML: !0,
            key: !0,
            ref: !0,
            autoFocus: !0,
            defaultValue: !0,
            valueLink: !0,
            defaultChecked: !0,
            checkedLink: !0,
            innerHTML: !0,
            suppressContentEditableWarning: !0,
            onFocusIn: !0,
            onFocusOut: !0,
            className: !0,
            onCopy: !0,
            onCut: !0,
            onPaste: !0,
            onCompositionEnd: !0,
            onCompositionStart: !0,
            onCompositionUpdate: !0,
            onKeyDown: !0,
            onKeyPress: !0,
            onKeyUp: !0,
            onFocus: !0,
            onBlur: !0,
            onChange: !0,
            onInput: !0,
            onSubmit: !0,
            onReset: !0,
            onClick: !0,
            onContextMenu: !0,
            onDoubleClick: !0,
            onDrag: !0,
            onDragEnd: !0,
            onDragEnter: !0,
            onDragExit: !0,
            onDragLeave: !0,
            onDragOver: !0,
            onDragStart: !0,
            onDrop: !0,
            onMouseDown: !0,
            onMouseEnter: !0,
            onMouseLeave: !0,
            onMouseMove: !0,
            onMouseOut: !0,
            onMouseOver: !0,
            onMouseUp: !0,
            onSelect: !0,
            onTouchCancel: !0,
            onTouchEnd: !0,
            onTouchMove: !0,
            onTouchStart: !0,
            onScroll: !0,
            onWheel: !0,
            onAbort: !0,
            onCanPlay: !0,
            onCanPlayThrough: !0,
            onDurationChange: !0,
            onEmptied: !0,
            onEncrypted: !0,
            onEnded: !0,
            onError: !0,
            onLoadedData: !0,
            onLoadedMetadata: !0,
            onLoadStart: !0,
            onPause: !0,
            onPlay: !0,
            onPlaying: !0,
            onProgress: !0,
            onRateChange: !0,
            onSeeked: !0,
            onSeeking: !0,
            onStalled: !0,
            onSuspend: !0,
            onTimeUpdate: !0,
            onVolumeChange: !0,
            onWaiting: !0,
            onLoad: !0,
            onAnimationStart: !0,
            onAnimationEnd: !0,
            onAnimationIteration: !0,
            onTransitionEnd: !0,
            onCopyCapture: !0,
            onCutCapture: !0,
            onPasteCapture: !0,
            onCompositionEndCapture: !0,
            onCompositionStartCapture: !0,
            onCompositionUpdateCapture: !0,
            onKeyDownCapture: !0,
            onKeyPressCapture: !0,
            onKeyUpCapture: !0,
            onFocusCapture: !0,
            onBlurCapture: !0,
            onChangeCapture: !0,
            onInputCapture: !0,
            onSubmitCapture: !0,
            onResetCapture: !0,
            onClickCapture: !0,
            onContextMenuCapture: !0,
            onDoubleClickCapture: !0,
            onDragCapture: !0,
            onDragEndCapture: !0,
            onDragEnterCapture: !0,
            onDragExitCapture: !0,
            onDragLeaveCapture: !0,
            onDragOverCapture: !0,
            onDragStartCapture: !0,
            onDropCapture: !0,
            onMouseDownCapture: !0,
            onMouseEnterCapture: !0,
            onMouseLeaveCapture: !0,
            onMouseMoveCapture: !0,
            onMouseOutCapture: !0,
            onMouseOverCapture: !0,
            onMouseUpCapture: !0,
            onSelectCapture: !0,
            onTouchCancelCapture: !0,
            onTouchEndCapture: !0,
            onTouchMoveCapture: !0,
            onTouchStartCapture: !0,
            onScrollCapture: !0,
            onWheelCapture: !0,
            onAbortCapture: !0,
            onCanPlayCapture: !0,
            onCanPlayThroughCapture: !0,
            onDurationChangeCapture: !0,
            onEmptiedCapture: !0,
            onEncryptedCapture: !0,
            onEndedCapture: !0,
            onErrorCapture: !0,
            onLoadedDataCapture: !0,
            onLoadedMetadataCapture: !0,
            onLoadStartCapture: !0,
            onPauseCapture: !0,
            onPlayCapture: !0,
            onPlayingCapture: !0,
            onProgressCapture: !0,
            onRateChangeCapture: !0,
            onSeekedCapture: !0,
            onSeekingCapture: !0,
            onStalledCapture: !0,
            onSuspendCapture: !0,
            onTimeUpdateCapture: !0,
            onVolumeChangeCapture: !0,
            onWaitingCapture: !0,
            onLoadCapture: !0,
            onAnimationStartCapture: !0,
            onAnimationEndCapture: !0,
            onAnimationIterationCapture: !0,
            onTransitionEndCapture: !0
        }, de = {
            accept: !0,
            acceptCharset: !0,
            accessKey: !0,
            action: !0,
            allowFullScreen: !0,
            allowTransparency: !0,
            alt: !0,
            as: !0,
            async: !0,
            autoComplete: !0,
            autoPlay: !0,
            capture: !0,
            cellPadding: !0,
            cellSpacing: !0,
            charSet: !0,
            challenge: !0,
            checked: !0,
            cite: !0,
            classID: !0,
            className: !0,
            cols: !0,
            colSpan: !0,
            content: !0,
            contentEditable: !0,
            contextMenu: !0,
            controls: !0,
            coords: !0,
            crossOrigin: !0,
            data: !0,
            dateTime: !0,
            default: !0,
            defer: !0,
            dir: !0,
            disabled: !0,
            download: !0,
            draggable: !0,
            encType: !0,
            form: !0,
            formAction: !0,
            formEncType: !0,
            formMethod: !0,
            formNoValidate: !0,
            formTarget: !0,
            frameBorder: !0,
            headers: !0,
            height: !0,
            hidden: !0,
            high: !0,
            href: !0,
            hrefLang: !0,
            htmlFor: !0,
            httpEquiv: !0,
            icon: !0,
            id: !0,
            inputMode: !0,
            integrity: !0,
            is: !0,
            keyParams: !0,
            keyType: !0,
            kind: !0,
            label: !0,
            lang: !0,
            list: !0,
            loop: !0,
            low: !0,
            manifest: !0,
            marginHeight: !0,
            marginWidth: !0,
            max: !0,
            maxLength: !0,
            media: !0,
            mediaGroup: !0,
            method: !0,
            min: !0,
            minLength: !0,
            multiple: !0,
            muted: !0,
            name: !0,
            nonce: !0,
            noValidate: !0,
            open: !0,
            optimum: !0,
            pattern: !0,
            placeholder: !0,
            playsInline: !0,
            poster: !0,
            preload: !0,
            profile: !0,
            radioGroup: !0,
            readOnly: !0,
            referrerPolicy: !0,
            rel: !0,
            required: !0,
            reversed: !0,
            role: !0,
            rows: !0,
            rowSpan: !0,
            sandbox: !0,
            scope: !0,
            scoped: !0,
            scrolling: !0,
            seamless: !0,
            selected: !0,
            shape: !0,
            size: !0,
            sizes: !0,
            span: !0,
            spellCheck: !0,
            src: !0,
            srcDoc: !0,
            srcLang: !0,
            srcSet: !0,
            start: !0,
            step: !0,
            style: !0,
            summary: !0,
            tabIndex: !0,
            target: !0,
            title: !0,
            type: !0,
            useMap: !0,
            value: !0,
            width: !0,
            wmode: !0,
            wrap: !0,
            about: !0,
            datatype: !0,
            inlist: !0,
            prefix: !0,
            property: !0,
            resource: !0,
            typeof: !0,
            vocab: !0,
            autoCapitalize: !0,
            autoCorrect: !0,
            autoSave: !0,
            color: !0,
            itemProp: !0,
            itemScope: !0,
            itemType: !0,
            itemID: !0,
            itemRef: !0,
            results: !0,
            security: !0,
            unselectable: 0
        }, fe = {
            accentHeight: !0,
            accumulate: !0,
            additive: !0,
            alignmentBaseline: !0,
            allowReorder: !0,
            alphabetic: !0,
            amplitude: !0,
            arabicForm: !0,
            ascent: !0,
            attributeName: !0,
            attributeType: !0,
            autoReverse: !0,
            azimuth: !0,
            baseFrequency: !0,
            baseProfile: !0,
            baselineShift: !0,
            bbox: !0,
            begin: !0,
            bias: !0,
            by: !0,
            calcMode: !0,
            capHeight: !0,
            clip: !0,
            clipPath: !0,
            clipRule: !0,
            clipPathUnits: !0,
            colorInterpolation: !0,
            colorInterpolationFilters: !0,
            colorProfile: !0,
            colorRendering: !0,
            contentScriptType: !0,
            contentStyleType: !0,
            cursor: !0,
            cx: !0,
            cy: !0,
            d: !0,
            decelerate: !0,
            descent: !0,
            diffuseConstant: !0,
            direction: !0,
            display: !0,
            divisor: !0,
            dominantBaseline: !0,
            dur: !0,
            dx: !0,
            dy: !0,
            edgeMode: !0,
            elevation: !0,
            enableBackground: !0,
            end: !0,
            exponent: !0,
            externalResourcesRequired: !0,
            fill: !0,
            fillOpacity: !0,
            fillRule: !0,
            filter: !0,
            filterRes: !0,
            filterUnits: !0,
            floodColor: !0,
            floodOpacity: !0,
            focusable: !0,
            fontFamily: !0,
            fontSize: !0,
            fontSizeAdjust: !0,
            fontStretch: !0,
            fontStyle: !0,
            fontVariant: !0,
            fontWeight: !0,
            format: !0,
            from: !0,
            fx: !0,
            fy: !0,
            g1: !0,
            g2: !0,
            glyphName: !0,
            glyphOrientationHorizontal: !0,
            glyphOrientationVertical: !0,
            glyphRef: !0,
            gradientTransform: !0,
            gradientUnits: !0,
            hanging: !0,
            horizAdvX: !0,
            horizOriginX: !0,
            ideographic: !0,
            imageRendering: !0,
            in: !0,
            in2: !0,
            intercept: !0,
            k: !0,
            k1: !0,
            k2: !0,
            k3: !0,
            k4: !0,
            kernelMatrix: !0,
            kernelUnitLength: !0,
            kerning: !0,
            keyPoints: !0,
            keySplines: !0,
            keyTimes: !0,
            lengthAdjust: !0,
            letterSpacing: !0,
            lightingColor: !0,
            limitingConeAngle: !0,
            local: !0,
            markerEnd: !0,
            markerMid: !0,
            markerStart: !0,
            markerHeight: !0,
            markerUnits: !0,
            markerWidth: !0,
            mask: !0,
            maskContentUnits: !0,
            maskUnits: !0,
            mathematical: !0,
            mode: !0,
            numOctaves: !0,
            offset: !0,
            opacity: !0,
            operator: !0,
            order: !0,
            orient: !0,
            orientation: !0,
            origin: !0,
            overflow: !0,
            overlinePosition: !0,
            overlineThickness: !0,
            paintOrder: !0,
            panose1: !0,
            pathLength: !0,
            patternContentUnits: !0,
            patternTransform: !0,
            patternUnits: !0,
            pointerEvents: !0,
            points: !0,
            pointsAtX: !0,
            pointsAtY: !0,
            pointsAtZ: !0,
            preserveAlpha: !0,
            preserveAspectRatio: !0,
            primitiveUnits: !0,
            r: !0,
            radius: !0,
            refX: !0,
            refY: !0,
            renderingIntent: !0,
            repeatCount: !0,
            repeatDur: !0,
            requiredExtensions: !0,
            requiredFeatures: !0,
            restart: !0,
            result: !0,
            rotate: !0,
            rx: !0,
            ry: !0,
            scale: !0,
            seed: !0,
            shapeRendering: !0,
            slope: !0,
            spacing: !0,
            specularConstant: !0,
            specularExponent: !0,
            speed: !0,
            spreadMethod: !0,
            startOffset: !0,
            stdDeviation: !0,
            stemh: !0,
            stemv: !0,
            stitchTiles: !0,
            stopColor: !0,
            stopOpacity: !0,
            strikethroughPosition: !0,
            strikethroughThickness: !0,
            string: !0,
            stroke: !0,
            strokeDasharray: !0,
            strokeDashoffset: !0,
            strokeLinecap: !0,
            strokeLinejoin: !0,
            strokeMiterlimit: !0,
            strokeOpacity: !0,
            strokeWidth: !0,
            surfaceScale: !0,
            systemLanguage: !0,
            tableValues: !0,
            targetX: !0,
            targetY: !0,
            textAnchor: !0,
            textDecoration: !0,
            textRendering: !0,
            textLength: !0,
            to: !0,
            transform: !0,
            u1: !0,
            u2: !0,
            underlinePosition: !0,
            underlineThickness: !0,
            unicode: !0,
            unicodeBidi: !0,
            unicodeRange: !0,
            unitsPerEm: !0,
            vAlphabetic: !0,
            vHanging: !0,
            vIdeographic: !0,
            vMathematical: !0,
            values: !0,
            vectorEffect: !0,
            version: !0,
            vertAdvY: !0,
            vertOriginX: !0,
            vertOriginY: !0,
            viewBox: !0,
            viewTarget: !0,
            visibility: !0,
            widths: !0,
            wordSpacing: !0,
            writingMode: !0,
            x: !0,
            xHeight: !0,
            x1: !0,
            x2: !0,
            xChannelSelector: !0,
            xlinkActuate: !0,
            xlinkArcrole: !0,
            xlinkHref: !0,
            xlinkRole: !0,
            xlinkShow: !0,
            xlinkTitle: !0,
            xlinkType: !0,
            xmlBase: !0,
            xmlns: !0,
            xmlnsXlink: !0,
            xmlLang: !0,
            xmlSpace: !0,
            y: !0,
            y1: !0,
            y2: !0,
            yChannelSelector: !0,
            z: !0,
            zoomAndPan: !0
        }, me = RegExp.prototype.test.bind(new RegExp('^(data|aria)-[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$')), ye = {}.hasOwnProperty, ge = function (e) {
            return ye.call(de, e) || ye.call(fe, e) || me(e.toLowerCase()) || ye.call(he, e);
        }, be = function (e, t, n) {
            var r = n && e.theme === n.theme;
            return e.theme && !r ? e.theme : t;
        }, ve = p, Ce = Object.prototype.toString, ke = function (e) {
            function t(e) {
                i = e;
                for (var t in o) {
                    var n = o[t];
                    void 0 !== n && n(i);
                }
            }
            function n(e) {
                var t = a;
                return o[t] = e, a += 1, e(i), t;
            }
            function r(e) {
                o[e] = void 0;
            }
            var o = {}, a = 0, i = e;
            return {
                publish: t,
                subscribe: n,
                unsubscribe: r
            };
        }, we = '__styled-components__', xe = we + 'next__', Ae = ie.shape({
            getTheme: ie.func,
            subscribe: ie.func,
            unsubscribe: ie.func
        }), Se = function (e) {
            var t = !1;
            return function () {
                t || (t = !0, e());
            };
        }(function () {
            console.error('Warning: Usage of `context.' + we + '` as a function is deprecated. It will be replaced with the object on `.context.' + xe + '` in a future version.');
        }), Te = function (e) {
            function t() {
                x(this, t);
                var n = j(this, e.call(this));
                return n.unsubscribeToOuterId = -1, n.getTheme = n.getTheme.bind(n), n;
            }
            return T(t, e), t.prototype.componentWillMount = function () {
                var e = this, t = this.context[xe];
                void 0 !== t && (this.unsubscribeToOuterId = t.subscribe(function (t) {
                    e.outerTheme = t;
                })), this.broadcast = ke(this.getTheme());
            }, t.prototype.getChildContext = function () {
                var e, t = this;
                return S({}, this.context, (e = {}, e[xe] = {
                    getTheme: this.getTheme,
                    subscribe: this.broadcast.subscribe,
                    unsubscribe: this.broadcast.unsubscribe
                }, e[we] = function (e) {
                    Se();
                    var n = t.broadcast.subscribe(e);
                    return function () {
                        return t.broadcast.unsubscribe(n);
                    };
                }, e));
            }, t.prototype.componentWillReceiveProps = function (e) {
                this.props.theme !== e.theme && this.broadcast.publish(this.getTheme(e.theme));
            }, t.prototype.componentWillUnmount = function () {
                -1 !== this.unsubscribeToOuterId && this.context[xe].unsubscribe(this.unsubscribeToOuterId);
            }, t.prototype.getTheme = function (e) {
                var t = e || this.props.theme;
                if (ve(t)) {
                    var n = t(this.outerTheme);
                    if (!P(n))
                        throw new Error('[ThemeProvider] Please return an object from your theme function, i.e. theme={() => ({})}!');
                    return n;
                }
                if (!P(t))
                    throw new Error('[ThemeProvider] Please make your theme prop a plain object');
                return S({}, this.outerTheme, t);
            }, t.prototype.render = function () {
                return this.props.children ? y.Children.only(this.props.children) : null;
            }, t;
        }(t.Component);
    Te.childContextTypes = (ce = {}, ce[we] = ie.func, ce[xe] = Ae, ce), Te.contextTypes = (ue = {}, ue[xe] = Ae, ue);
    var Oe = {}, je = function e(t, n) {
            for (var r = 0; r < t.length; r += 1) {
                var o = t[r];
                if (Array.isArray(o) && !e(o))
                    return !1;
                if ('function' == typeof o && !u(o))
                    return !1;
            }
            if (void 0 !== n)
                for (var a in n) {
                    var i = n[a];
                    if ('function' == typeof i)
                        return !1;
                }
            return !0;
        }, Ie = [
            'a',
            'abbr',
            'address',
            'area',
            'article',
            'aside',
            'audio',
            'b',
            'base',
            'bdi',
            'bdo',
            'big',
            'blockquote',
            'body',
            'br',
            'button',
            'canvas',
            'caption',
            'cite',
            'code',
            'col',
            'colgroup',
            'data',
            'datalist',
            'dd',
            'del',
            'details',
            'dfn',
            'dialog',
            'div',
            'dl',
            'dt',
            'em',
            'embed',
            'fieldset',
            'figcaption',
            'figure',
            'footer',
            'form',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'head',
            'header',
            'hgroup',
            'hr',
            'html',
            'i',
            'iframe',
            'img',
            'input',
            'ins',
            'kbd',
            'keygen',
            'label',
            'legend',
            'li',
            'link',
            'main',
            'map',
            'mark',
            'marquee',
            'menu',
            'menuitem',
            'meta',
            'meter',
            'nav',
            'noscript',
            'object',
            'ol',
            'optgroup',
            'option',
            'output',
            'p',
            'param',
            'picture',
            'pre',
            'progress',
            'q',
            'rp',
            'rt',
            'ruby',
            's',
            'samp',
            'script',
            'section',
            'select',
            'small',
            'source',
            'span',
            'strong',
            'style',
            'sub',
            'summary',
            'sup',
            'table',
            'tbody',
            'td',
            'textarea',
            'tfoot',
            'th',
            'thead',
            'time',
            'title',
            'tr',
            'track',
            'u',
            'ul',
            'var',
            'video',
            'wbr',
            'circle',
            'clipPath',
            'defs',
            'ellipse',
            'g',
            'image',
            'line',
            'linearGradient',
            'mask',
            'path',
            'pattern',
            'polygon',
            'polyline',
            'radialGradient',
            'rect',
            'stop',
            'svg',
            'text',
            'tspan'
        ], Ee = function (e) {
            return e.replace(/\s|\\n/g, '');
        }, Pe = {
            childContextTypes: !0,
            contextTypes: !0,
            defaultProps: !0,
            displayName: !0,
            getDefaultProps: !0,
            mixins: !0,
            propTypes: !0,
            type: !0
        }, Me = {
            name: !0,
            length: !0,
            prototype: !0,
            caller: !0,
            arguments: !0,
            arity: !0
        }, Ne = 'function' == typeof Object.getOwnPropertySymbols, Re = function (e, t, n) {
            if ('string' != typeof t) {
                var r = Object.getOwnPropertyNames(t);
                Ne && (r = r.concat(Object.getOwnPropertySymbols(t)));
                for (var o = 0; o < r.length; ++o)
                    if (!(Pe[r[o]] || Me[r[o]] || n && n[r[o]]))
                        try {
                            e[r[o]] = t[r[o]];
                        } catch (e) {
                        }
            }
            return e;
        }, De = function (e) {
            var t, n = e.displayName || e.name || 'Component', r = u(e), o = function (t) {
                    function n() {
                        var e, r, o;
                        x(this, n);
                        for (var a = arguments.length, i = Array(a), s = 0; s < a; s++)
                            i[s] = arguments[s];
                        return e = r = j(this, t.call.apply(t, [this].concat(i))), r.state = {}, r.unsubscribeId = -1, o = e, j(r, o);
                    }
                    return T(n, t), n.prototype.componentWillMount = function () {
                        var e = this, t = this.constructor.defaultProps, n = this.context[xe], r = be(this.props, void 0, t);
                        if (void 0 === n && void 0 !== r)
                            this.setState({ theme: r });
                        else {
                            var o = n.subscribe;
                            this.unsubscribeId = o(function (n) {
                                var r = be(e.props, n, t);
                                e.setState({ theme: r });
                            });
                        }
                    }, n.prototype.componentWillReceiveProps = function (e) {
                        var t = this.constructor.defaultProps;
                        this.setState(function (n) {
                            return { theme: be(e, n.theme, t) };
                        });
                    }, n.prototype.componentWillUnmount = function () {
                        -1 !== this.unsubscribeId && this.context[xe].unsubscribe(this.unsubscribeId);
                    }, n.prototype.render = function () {
                        var t = this.props.innerRef, n = this.state.theme;
                        return y.createElement(e, S({ theme: n }, this.props, {
                            innerRef: r ? t : void 0,
                            ref: r ? void 0 : t
                        }));
                    }, n;
                }(y.Component);
            return o.displayName = 'WithTheme(' + n + ')', o.styledComponentId = 'withTheme', o.contextTypes = (t = {}, t[we] = ie.func, t[xe] = Ae, t), Re(o, e);
        }, Fe = function (e, t, n) {
            return function () {
                function r(e, t, n) {
                    if (x(this, r), this.rules = e, this.isStatic = je(e, t), this.componentId = n, !Z.instance.hasInjectedComponent(this.componentId)) {
                        Z.instance.deferredInject(n, !0, '');
                    }
                }
                return r.prototype.generateAndInjectStyles = function (r, o) {
                    var a = this.isStatic, i = this.lastClassName;
                    if (a && void 0 !== i)
                        return i;
                    var s = t(this.rules, r), c = h(this.componentId + s.join('')), u = o.getName(c);
                    if (void 0 !== u)
                        return o.stylesCacheable && (this.lastClassName = u), u;
                    var l = e(c);
                    if (o.stylesCacheable && (this.lastClassName = u), o.alreadyInjected(c, l))
                        return l;
                    var p = '\n' + n(s, '.' + l);
                    return o.inject(this.componentId, !0, p, c, l), l;
                }, r.generateName = function (t) {
                    return e(h(t));
                }, r;
            }();
        }(U, N, F), Le = function (e) {
            return function t(n, r) {
                var o = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
                if ('string' != typeof r && 'function' != typeof r)
                    throw new Error('Cannot create styled-component for component: ' + r);
                var a = function (t) {
                    for (var a = arguments.length, i = Array(a > 1 ? a - 1 : 0), s = 1; s < a; s++)
                        i[s - 1] = arguments[s];
                    return n(r, o, e.apply(void 0, [t].concat(i)));
                };
                return a.withConfig = function (e) {
                    return t(n, r, S({}, o, e));
                }, a.attrs = function (e) {
                    return t(n, r, S({}, o, { attrs: S({}, o.attrs || {}, e) }));
                }, a;
            };
        }(W), _e = function (e, n) {
            var r = {}, o = function (t, n) {
                    var o = 'string' != typeof t ? 'sc' : t.replace(/[[\].#*$><+~=|^:(),"'`]/g, '-').replace(/--+/g, '-'), a = (r[o] || 0) + 1;
                    r[o] = a;
                    var i = e.generateName(o + a), s = o + '-' + i;
                    return void 0 !== n ? n + '-' + s : s;
                }, a = function (e) {
                    function n() {
                        var t, r, o;
                        x(this, n);
                        for (var a = arguments.length, i = Array(a), s = 0; s < a; s++)
                            i[s] = arguments[s];
                        return t = r = j(this, e.call.apply(e, [this].concat(i))), r.attrs = {}, r.state = {
                            theme: null,
                            generatedClassName: ''
                        }, r.unsubscribeId = -1, o = t, j(r, o);
                    }
                    return T(n, e), n.prototype.unsubscribeFromContext = function () {
                        -1 !== this.unsubscribeId && this.context[xe].unsubscribe(this.unsubscribeId);
                    }, n.prototype.buildExecutionContext = function (e, t) {
                        var n = this.constructor.attrs, r = S({}, t, { theme: e });
                        return void 0 === n ? r : (this.attrs = Object.keys(n).reduce(function (e, t) {
                            var o = n[t];
                            return e[t] = 'function' == typeof o ? o(r) : o, e;
                        }, {}), S({}, r, this.attrs));
                    }, n.prototype.generateAndInjectStyles = function (e, t) {
                        var n = this.constructor, r = n.attrs, o = n.componentStyle, a = n.warnTooManyClasses, i = this.context[X] || Z.instance;
                        if (o.isStatic && void 0 === r)
                            return o.generateAndInjectStyles(Oe, i);
                        var s = this.buildExecutionContext(e, t), c = o.generateAndInjectStyles(s, i);
                        return void 0 !== a && a(c), c;
                    }, n.prototype.componentWillMount = function () {
                        var e = this, t = this.constructor.componentStyle, n = this.context[xe];
                        if (t.isStatic) {
                            var r = this.generateAndInjectStyles(Oe, this.props);
                            this.setState({ generatedClassName: r });
                        } else if (void 0 !== n) {
                            var o = n.subscribe;
                            this.unsubscribeId = o(function (t) {
                                var n = be(e.props, t, e.constructor.defaultProps), r = e.generateAndInjectStyles(n, e.props);
                                e.setState({
                                    theme: n,
                                    generatedClassName: r
                                });
                            });
                        } else {
                            var a = this.props.theme || {}, i = this.generateAndInjectStyles(a, this.props);
                            this.setState({
                                theme: a,
                                generatedClassName: i
                            });
                        }
                    }, n.prototype.componentWillReceiveProps = function (e) {
                        var t = this;
                        this.constructor.componentStyle.isStatic || this.setState(function (n) {
                            var r = be(e, n.theme, t.constructor.defaultProps);
                            return {
                                theme: r,
                                generatedClassName: t.generateAndInjectStyles(r, e)
                            };
                        });
                    }, n.prototype.componentWillUnmount = function () {
                        this.unsubscribeFromContext();
                    }, n.prototype.render = function () {
                        var e = this, n = this.props.innerRef, r = this.state.generatedClassName, o = this.constructor, a = o.styledComponentId, i = o.target, s = c(i), l = [
                                this.props.className,
                                a,
                                this.attrs.className,
                                r
                            ].filter(Boolean).join(' '), p = S({}, this.attrs, { className: l });
                        u(i) ? p.innerRef = n : p.ref = n;
                        var h = Object.keys(this.props).reduce(function (t, n) {
                            return 'innerRef' === n || 'className' === n || s && !ge(n) || (t[n] = e.props[n]), t;
                        }, p);
                        return t.createElement(i, h);
                    }, n;
                }(t.Component);
            return function t(r, i, s) {
                var u, p = i.displayName, h = void 0 === p ? c(r) ? 'styled.' + r : 'Styled(' + l(r) + ')' : p, d = i.componentId, f = void 0 === d ? o(i.displayName, i.parentComponentId) : d, m = i.ParentComponent, y = void 0 === m ? a : m, g = i.rules, b = i.attrs, v = i.displayName && i.componentId ? i.displayName + '-' + i.componentId : f, C = new e(void 0 === g ? s : g.concat(s), b, v), k = function (e) {
                        function o() {
                            return x(this, o), j(this, e.apply(this, arguments));
                        }
                        return T(o, e), o.withComponent = function (e) {
                            var n = i.componentId, r = O(i, ['componentId']), a = n && n + '-' + (c(e) ? e : l(e)), u = S({}, r, {
                                    componentId: a,
                                    ParentComponent: o
                                });
                            return t(e, u, s);
                        }, A(o, null, [{
                                key: 'extend',
                                get: function () {
                                    var e = i.rules, a = i.componentId, c = O(i, [
                                            'rules',
                                            'componentId'
                                        ]), u = void 0 === e ? s : e.concat(s), l = S({}, c, {
                                            rules: u,
                                            parentComponentId: a,
                                            ParentComponent: o
                                        });
                                    return n(t, r, l);
                                }
                            }]), o;
                    }(y);
                return k.contextTypes = (u = {}, u[we] = ie.func, u[xe] = Ae, u[X] = ie.oneOfType([
                    ie.instanceOf(Z),
                    ie.instanceOf(pe)
                ]), u), k.displayName = h, k.styledComponentId = v, k.attrs = b, k.componentStyle = C, k.warnTooManyClasses = void 0, k.target = r, k;
            };
        }(Fe, Le), Ue = function (e, t, n) {
            return function (r) {
                for (var o = arguments.length, a = Array(o > 1 ? o - 1 : 0), i = 1; i < o; i++)
                    a[i - 1] = arguments[i];
                var s = n.apply(void 0, [r].concat(a)), c = h(Ee(JSON.stringify(s))), u = Z.instance.getName(c);
                if (u)
                    return u;
                var l = e(c);
                if (Z.instance.alreadyInjected(c, l))
                    return l;
                var p = t(s, l, '@keyframes');
                return Z.instance.inject('sc-keyframes-' + l, !0, p, c, l), l;
            };
        }(U, F, W), ze = function (e, t) {
            return function (n) {
                for (var r = arguments.length, o = Array(r > 1 ? r - 1 : 0), a = 1; a < r; a++)
                    o[a - 1] = arguments[a];
                var i = t.apply(void 0, [n].concat(o)), s = h(JSON.stringify(i)), c = 'sc-global-' + s;
                Z.instance.hasInjectedComponent(c) || Z.instance.inject(c, !1, e(i));
            };
        }(F, W), We = function (e, t) {
            var n = function (n) {
                return t(e, n);
            };
            return Ie.forEach(function (e) {
                n[e] = n(e);
            }), n;
        }(_e, Le);
    e.default = We, e.css = W, e.keyframes = Ue, e.injectGlobal = ze, e.ThemeProvider = Te, e.withTheme = De, e.ServerStyleSheet = pe, e.StyleSheetManager = se, Object.defineProperty(e, '__esModule', { value: !0 });
});
/*steal-styled-components-bug@1.0.0#public/index*/
define('steal-styled-components-bug@1.0.0#public/index', [
    'react',
    'react-dom',
    'styled-components'
], function (_react, _reactDom, _styledComponents) {
    'use strict';
    var _react2 = _interopRequireDefault(_react);
    var _reactDom2 = _interopRequireDefault(_reactDom);
    var _styledComponents2 = _interopRequireDefault(_styledComponents);
    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
    }
    var _templateObject = _taggedTemplateLiteral(['\n\tfont-size: 2em;\n\tfont-weight: bold;\n\tcolor: green;\n'], ['\n\tfont-size: 2em;\n\tfont-weight: bold;\n\tcolor: green;\n']);
    function _taggedTemplateLiteral(strings, raw) {
        return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } }));
    }
    var HelloWorld = _styledComponents2.default.div(_templateObject);
    function AppComponent() {
        return _react2.default.createElement(HelloWorld, null, 'Hello World');
    }
    _reactDom2.default.render(_react2.default.createElement(AppComponent, null), document.getElementById('application'));
});
/*[import-main-module]*/
System["import"]("package.json!npm").then(function() {
	System["import"]("steal-styled-components-bug@1.0.0#public/index");
});
