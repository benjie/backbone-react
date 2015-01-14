# WARNING

This is **not** the true React way of doing things. This is a quick method of utilising React and its magic in your Backbone project without having to rebuild everything.

# Integrating React with your Router

Before:

```
var HomeView = Backbone.View.extend({
  template: _.template('<h1>Hello World!</h1><p>Random number: <span><%- number %></span> (click for another)</p><textarea>Notes...</textarea>'),
  events: {
    'click p': 'newNumber'
  },
  render: function() {
    this.$el.html(this.template({
      number: this.randomNumber()
    }));
  },
  randomNumber: function() {
    return Math.round(Math.random() * 100)
  },
  newNumber: function(e) {
    this.$("span").html(this.randomNumber());
  }
});

var AboutView = Backbone.View.extend({
  template: '<h1>About</h1><p><img src="http://www.reactiongifs.com/r/1gjdAX7.gif"></p>',
  render: function() {
    this.$el.html(this.template);
  }
});

var AppRouter = Backbone.Router.extend({
  routes: {
    '': 'homeRoute',
    'about': 'aboutRoute',
  },
  initialize: function() {
    this.$rootEl = $("#content");
    this.rootEl = this.$rootEl[0];
  },
  setView: function(view) {
    if (this.view) {
      this.view.remove();
    }
    this.view = view;
    this.view.render();
    this.$rootEl.append(this.view.el);
  },
  homeRoute: function() {
    this.setView(new HomeView())
  },
  aboutRoute: function() {
    this.setView(new AboutView())
  }
});

var appRouter = new AppRouter();
Backbone.history.start();
    
```

---

After:

```
var div = React.DOM.div,
  h1 = React.DOM.h1,
  p = React.DOM.p,
  textarea = React.DOM.textarea;

var HomeView = React.createClass({
  displayName: "HomeView",
  getInitialState: function() {
    return {
      randomNumber: this.randomNumber()
    };
  },
  randomNumber: function() {
    return Math.round(Math.random() * 100);
  },
  newNumber: function(e) {
    this.setState({
      randomNumber: this.randomNumber()
    });
  },
  render: function() {
    return div(null,
      h1(null, "Hello World"),
      p({
        onClick: this.newNumber
      }, "Random number: " + this.state.randomNumber + " (click for another)"),
      textarea(null, "Notes...")
    )
  }
});

var AboutView = Backbone.View.extend({
  template: _.template('<h1>About</h1><p><img src="http://www.reactiongifs.com/r/1gjdAX7.gif"></p>'),
  render: function() {
    this.$el.html(this.template());
  }
});

var AppRouter = Backbone.Router.extend({
  routes: {
    '': 'homeRoute',
    'about': 'aboutRoute'
  },
  initialize: function() {
    this.$rootEl = $("#content");
    this.rootEl = this.$rootEl[0];
  },
  setView: function(view) {
    if (this.view) {
      if (this.view instanceof Backbone.View) {
        this.view.remove();
      } else {
        React.unmountComponentAtNode(this.rootEl);
      }
    }
    this.view = view;
    if (this.view instanceof Backbone.View) {
      this.view.render();
      this.$rootEl.append(this.view.el);
    } else {
      React.render(this.view, this.rootEl);
    }
  },
  homeRoute: function() {
    this.setView(new HomeView())
  },
  aboutRoute: function() {
    this.setView(new AboutView())
  }
});

var appRouter = new AppRouter();
Backbone.history.start();
```

# Updating when models/collections change

This is where it gets interesting. We can use a simple React mixin to monitor Backbone events that trigger on any models/collections that exist in our `@state`

```
_ = require 'underscore'
Backbone = require 'backbone'
isServer = !window? # Isomorphic hack

BackboneListener = ->
_.extend BackboneListener.prototype, Backbone.Events

# This mixin automatically subscribes to events of models/collections found on state.
BackboneMixin =

  getInitialState: ->
    _backboneListener: new BackboneListener()

  componentDidMount: ->
    @_backboneSubscribeObjects @state
    return

  componentWillUpdate: (nextProps, nextState) ->
    @_backboneUnsubscribeObjects @state
    @_backboneSubscribeObjects nextState
    return

  componentWillUnmount: ->
    @state._backboneListener.stopListening()
    return

  # ---------------------------

  _subscribableObject: (p) ->
      p instanceof Backbone.Model or p instanceof Backbone.Collection

  _subscribableObjects: (props) =>
    _.filter props, @_subscribableObject

  _backboneCollectionUpdate: @_forceUpdateOnce

  _backboneModelUpdate: @_forceUpdateOnce

  _backboneSubscribeObjects: (props, unsubscribe = false) ->
    throw new Error("_backboneSubscribeObjects called on the server!") if isServer
    method = if unsubscribe then 'stopListening' else 'listenTo'
    @_subscribableObjects(props).forEach (obj) =>
      if obj instanceof Backbone.Model
        @state._backboneListener[method] obj, "change", @_backboneModelUpdate
      else if obj instanceof Backbone.Collection
        @state._backboneListener[method] obj, "add remove reset sort change destroy sync", @_backboneCollectionUpdate
      return
    return

  _backboneUnsubscribeObjects: (props) ->
    @_backboneSubscribeObjects(props, true)
    return

  _forceUpdateOnce: ->
    throw new Error("_forceUpdateOnce called on the server!") if isServer
    @_forceUpdateOnceTimer ?= setTimeout =>
      delete @_forceUpdateOnceTimer
      @forceUpdate() if @isMounted()
    , 0

  # ---------------------------

  listenTo: ->
    throw new Error("listenTo called on the server!") if isServer
    @state._backboneListener.listenTo.apply(@state._backboneListener, arguments)

  stopListening: ->
    throw new Error("stopListening called on the server!") if isServer
    @state._backboneListener.stopListening.apply(@state._backboneListener, arguments)

module.exports = BackboneMixin
```

# Moving our @props to @state

Since we want to automagically listen to changes on any top level props that are handed in, we use another mixin to move them to @state:

```
module.exports = BackbonePropsMixin =

  # Initially we set @state to be the same as @props, thereby subscribing to
  # collection/model events
  getInitialState: ->
    _.clone @props

  # Move relevant props onto state, updating state as necessary
  componentWillReceiveProps: (nextProps) ->
    changes = {}
    for k, v of nextProps when @state[k] isnt v and @props._subscribableObject(v)
      changes[k] = v
    for k, v of @props when @state[k] is v and !nextProps[k] and @props._subscribableObject(v)
      changes[k] = null
    @setState changes
```

# Don't over-subscribe!

Be careful to only use the former mixin where you have models on your @state that you'd like to listen to changes to, and only use the latter mixin on top level components. If you subscribe to the same model in multiple places then React will be forced to render multiple times due to the use of `@forceRender()` in the mixins.
