var HomeView = Backbone.View.extend({
  template: _.template('<h1>Hello World!</h1><p>Random number: <span><%- number %></span> (click for another)</p><textarea>Notes...</textarea>'),
  events: {
    'click p': 'newNumber'
  },
  randomNumber: function() {
    return Math.round(Math.random() * 100)
  },
  newNumber: function(e) {
    this.$("span").html(this.randomNumber());
  },
  render: function() {
    this.$el.html(this.template({
      number: this.randomNumber()
    }));
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
