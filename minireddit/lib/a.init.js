//Base object to fetch, compile and store templates
window['base'] = {
  host:'http://www.reddit.com',
  _templates: {},
  template: function(name) {
    if (!(name in this._templates))
      this._templates[name] = Handlebars.compile(this.resource(name));
    return this._templates[name];
  },
  resource: function(url) {
    var response;
    $.ajax({
      url: url,
      success: function(v) { response = v; },
      async: false,
      dataType: 'text'
    });
    return response;
  },
  unescapeHTML: function(html) {
    return $("<div />").html(html).text();
  },
  stash: {
    _get_data: function() {
      return _($.jStorage.get('index', [])).chain().map(function(v) {
        return [v, $.jStorage.get(v)];
      }).reduce({}, function(acc, val) {
        acc[val[0]] = val[1]; return acc }).value();
    },
    _set_data: function(key, value) {
      $.jStorage.set('index', $.jStorage.get('index', []).concat([key]));
      $.jStorage.set(key, value);
    },
    all: function() { return base.stash._get_data(); },
    keys: function() { return _.keys(base.stash.all()) },
    get: function(k) { return base.stash.all()[k]; },
    set: function(k, v) { base.stash._set_data(k, v); },
    unset: function(k) {
      $.jStorage.set('index', _.without($.jStorage.get('index', []), k));
      return $.jStorage.deleteKey(k);
    },
    _clear: function() { $.jStorage.flush(); }
  },
  prettyDate: function (time) {
    var date = new Date();
    if (time) {
      date = new Date(time);
    }
    var diff = (((new Date()).getTime() - date.getTime()) / 1000),
    day_diff = Math.floor(diff / 86400);

    if (isNaN(day_diff) || day_diff < 0 || day_diff >= 31) {
      return date.toDateString();
    }

    return day_diff === 0 &&
      (diff < 60 && "just now" ||
       diff < 120 && "1 minute ago" ||
       diff < 3600 && Math.floor(diff / 60) + " min ago" ||
       diff < 7200 && "1 hour ago" ||
       diff < 86400 && Math.floor(diff / 3600) + " hours ago") ||
      day_diff === 1 && "yesterday" ||
      day_diff < 7 && day_diff + " days ago" ||
      day_diff < 31 && Math.ceil(day_diff / 7) + " weeks ago";
  }
};

//Base view to handle templating
BaseView = Backbone.View.extend({
  render: function(){
    var opts = this.model ? this.model.toJSON() : {};
    _.extend(opts, this.options || {});
    $(this.el).html(base.template(this.template)(opts));
    if(this._render) this._render();
    return this;
  },
  remove: function(){
    $(this.el).empty()
  }
});