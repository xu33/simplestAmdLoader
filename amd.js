(function() {
	var STATES = {
		INIT: 0,
		LOADING: 1,
		LOADED: 2,
		DEPS_LOADED: 3,
		READY: 4
	}

	var rootMod = null
	var cache = {}
	var queue = []

	var module = function(name) {
		this.name = name
		this.state = 0
		this.deps = []
		this.export = null
	}

	module.prototype.setState = function(state) {
		this.state = state
	}

	module.prototype.setFactory = function(factory) {
		this.factory = factory
	}

	module.prototype.fireFactory = function() {
		var args = []
		for (var i = 0; i < this.deps.length; i++) {
			var mod = this.deps[i]
			if (mod.state < 4) {
				mod.fireFactory()
			}

			args.push(mod.export)
		}

		// console.log(this.name, this.state, this.factory)
		this.export = this.factory.apply(null, args)
		this.state = 4
	}

	var clearCache = function() {
		for (var k in cache) {
			delete cache[k]
		}

		cache = {}
	}

	var _load = function() {
		while (queue.length > 0) {
			var name = queue.shift()
			if (cache[name].state < 1) {
				cache[name].setState(1)
				loadScript(name.concat('.js'))
			}
		}
	}

	var loadScript = function(url) {
		var head = document.head
		var script = document.createElement('script')
		script.onload = function() {
			var ready = true
			for (var k in cache) {
				if (cache[k].state < 2) {
					ready = false
				}
			}

			if (ready) {
				rootMod.fireFactory()
				console.log(cache, queue)
			}
		}
		script.setAttribute('src', url + '?nocache=' + Math.random())
		head.appendChild(script)
	}

	var rModId = /([^\/?]+?)(\.(?:js))?(\?.*)?$/
	var parseModName = function() {
		var script
		var stack

		try {
			makeError()
		} catch (e) {
			stack = e.stack
		}

		if (stack) {
			stack = stack.split(/[@ ]/g).pop()
			stack = stack[0] === '(' ? stack.slice(1, -1) : stack.replace(/\s/, '')
			return stack.replace(/(:\d+)?:\d+$/i, '').match(rModId)[1]
		}

		var scripts = head.getElementsByTagName('script');
		for (var i = scripts.length - 1; i >= 0; i--) {
			script = scripts[i];
			if (script.className === modClassName && script.readyState === 'interactive') {
				break;
			}
		}

		return script.src.match(rModId)[1];
	}

	var define = function(deps, factory) {
		var name = parseModName()
		var mod = cache[name]
		mod.factory = factory
		mod.setState(2)

		if (deps.length === 0) {
			mod.setState(3)
			mod.fireFactory()

			return mod
		}

		var depsLoaded = true
		for (var i = 0; i < deps.length; i++) {
			var name = deps[i]
			if (!cache.hasOwnProperty(name)) {
				cache[name] = new module(name)
				depsLoaded = false
			} else if (cache[name] && (cache[name].state < 3)) {
				depsLoaded = false
			}

			mod.deps.push(cache[name])
		}

		if (depsLoaded) {
			mod.setState(3)
			mod.fireFactory()
		} else {
			queue = queue.concat(deps)
			_load()
		}

		return mod
	}

	var require = function(mods, callback) {
		rootMod = new module('root')
		rootMod.state = 2
		rootMod.factory = callback

		for (var i = 0; i < mods.length; i++) {
			if (!cache.hasOwnProperty(mods[i])) {
				cache[mods[i]] = new module(mods[i])
			}

			rootMod.deps.push(cache[mods[i]])
		}

		queue = queue.concat(mods)
		_load()
	}

	define.amd = {}

	this.define = define
	this.require = require
}())