$("document").ready(function(){
$(".loading").ajaxStart(function(){$("img", this).show()});
$(".loading").ajaxStop(function(){$("img", this).hide()});

var RedditThing = Backbone.Model.extend({
  initialize: function(data){
    _.bindAll(this, "up", "down");
    this.set(data);
  },
  up: function(){
    this.set({myscore: this.attributes.data.score + 1});
    var up = base.stash.get("upvoted");
    var down = base.stash.get("downvoted");
    up.push(this.get("data").name);
    down = _.without(down, this.get("data").name)
    base.stash.set("upvoted", _.uniq(up));
    base.stash.set("downvoted", down);
  },
  down: function(){
    this.set({myscore: this.attributes.data.score - 1});
    var up = base.stash.get("upvoted");
    var down = base.stash.get("downvoted");
    down.push(this.get("data").name);
    up = _.without(up, this.get("data").name)
    base.stash.set("downvoted", _.uniq(down));
    base.stash.set("upvoted", up);
  }
});

//Document list collection
var DocumentList = Backbone.Collection.extend({
  model: RedditThing,
  url: function(){
    return base.host + this.subdir() +"/.json?jsonp=?"+ this.params()
  },
  initialize: function(models, options){
    _.bindAll(this, 'url', 'subdir', 'params', 'clearFetch');
    this.options = options?options:{};
    this.allData=[];
  },
  subdir: function(){
    var subdir = ""
    if(this.subreddit){
      subdir+="/r/"+this.subreddit
    }
    if(this.tag){
      subdir+="/"+this.tag
    }
    return subdir;
  },
  params: function(){
    var keys = ["before", "after", "count", 'q'], self = this, p = "";
    _.each(keys, function(key){
      if(self.options[key]){
        p += "&"+key+"="+self.options[key];
      }
    });
    return p?p:"";
  },
  parse: function(resp){
    this.options = {
      "modhash": resp.data.modhash,
      "before": resp.data.before,
      "after": resp.data.after
    };
    this.allData = this.allData.concat(resp.data.children);
    return this.allData;
  },
  clearFetch: function(){
    this.allData = [];
    this.options = {};
    this.fetch();
  }
});

//Document view
var ListItem = BaseView.extend({
  tagName: "li",
  template: "html/listitem.html",
  events: {
    "click .vote .up, .vote .down": "loginCheck",
    "click a.save": "save",
    "click .self-expand, .media-expand": "expand",
    "click .hide": "hide"},
  initialize: function(opts){
    _.bindAll(this, "_render", 'loginCheck', 'save', 'expand', 'hide');
    if(opts.template) this.template = opts.template;
    var time = this.model.get("data").created_utc*1000;
    this.model.set({"readable_time": base.prettyDate(time)});
    if(this.model.get("data").selftext) 
      this.model.set({"html": base.unescapeHTML(this.model.get("data").selftext_html)})
    if(this.model.get("data").media) 
      this.model.set({"embed": base.unescapeHTML(this.model.get("data").media_embed.content)})
    this.model.set({'saved':false});
    if(_.indexOf(base.stash.get("saved-things"), this.model.get("data").name) !== -1) 
      this.model.set({'saved':true});
  },
  _render: function(){
    if(_.indexOf(base.stash.get("upvoted"), this.model.get("data").name) !== -1) 
      this.vote("up")
    if(_.indexOf(base.stash.get("downvoted"), this.model.get("data").name) !== -1) 
      this.vote("down")  
  },
  loginCheck: function(e){
    if(!$(this.el).hasClass("vote-"+$(e.currentTarget).attr("class"))){
      this.model.trigger("login-check");
      if(base.stash.get("logged_in")){
        this.vote($(e.currentTarget).attr("class"));
      }
    }
  },
  vote: function(type){
    this.model[type]();
    $(this.el).removeClass("vote-up vote-down");
    $(this.el).addClass("vote-"+type)
    this.$(".score").text(this.model.get("myscore"));
  },
  save: function(e){
    var saved = base.stash.get("saved");
    var things = base.stash.get("saved-things");
    saved.push(this.model.toJSON());
    things.push(this.model.get("data").name);
    base.stash.set("saved", saved);
    $(e.currentTarget).text("saved").attr("class", "saved")
  },
  expand:function(e){
    $(e.currentTarget).toggleClass("expanded");
    this.$(".selftext").slideToggle("fast")
  },
  hide: function(){
    $(this.el).hide();
    var hidden = base.stash.get("hidden");
    hidden.push(this.model.get("data").name);
    base.stash.set("hidden", hidden);
    this.model.trigger("hidden");
  }
});

//Document list view
var AppView = Backbone.View.extend({
  el: $("body"),
  events: {
    "click .login h3 a": "formToggle",
    "focus input": "inputFocus", 
    "blur input": "inputBlur",
    "click #more": "fetch",
    "click .tags li.tag": "switchTag",
    "click .tags li.saved": "saved",
    "click a.subreddit": "switchSubreddit",
    'click .close': "loginClose",
    'keypress': 'search',
    'click .right': 'nextFeature',
    'click .left': 'prevFeature',
    'click button.login, button.signup': 'pretendAuth',
    "click a.logout":"logout"
  },
  initialize: function(){
    _.bindAll(this, 'add', 'refresh', 'formToggle', 'inputFocus', 'inputBlur', 
      'scrollPos', 'fetch', 'search', 'loginCheck', 'loginClose', 'save', 
      'nextFeature', 'prevFeature', 'restyle');
    this.list = new DocumentList();
    this.list.bind("add", this.add);
    this.list.bind("refresh", this.refresh);
    this.list.fetch();
    _.each(['hidden', 'upvoted', 'downvoted', 'saved', 'saved-things'], function(tag){
      if(_.indexOf(base.stash.keys(), tag)==-1){ 
        base.stash.set(tag, []);
      }
    });
    if(_.indexOf(base.stash.keys(), "logged_in")==-1){ 
      base.stash.set("logged_in", false);
    }
  },
  render: function(){
    if(base.stash.get("logged_in")){
      this.$(".sidebar div.login").css("display", "none");
      this.$(".header div.user").css("display", "block");
    }
    var self = this;
    _.each(featured_links, function(f){ 
      var m = new RedditThing(f);
      m.unbind("all");
      m.bind("login-check", self.loginCheck)
      self.$("#featured ul").append(new ListItem({model: m, "template":"html/featured.html"}).render().el)
    });
    this.$("#featured > ul > li:first").addClass("on")
  },
  add: function(item){
    if(_.indexOf(base.stash.get("hidden"), item.get("data").name) === -1){
      item.unbind("all");
      item.bind("login-check", this.loginCheck);
      item.bind("hidden", this.restyle);
      this.$("ul.items").append(new ListItem({model: item}).render().el)
      if(this.$("ul.items > li").length % 2 !== 0) 
        this.$("ul.items > li:last").addClass("odd")
    }
  },
  refresh: function(){
    this.$("ul.items").empty();
    this.list.each(this.add);
    this.$("#more").show();
  },
  restyle: function(){
    this.$("ul.items > li:visible").each(function(i, li){
      $(li).removeClass("odd");
      if(i%2==0) $(li).addClass("odd")
    });
  },
  loginCheck: function(){
    if(!base.stash.get("logged_in")){
      $(this.el).toggleClass("login-req")
      this.$("div.login").animate({"width":"600px", "left":"-300px", 'padding':'5px'}, 100)
      _.delay(function(){$(".message").show()}, 50);
    }
  },
  loginClose: function(){
    $(this.el).removeClass("login-req")
    $(".message").show()
    this.$("div.login").animate({"width":"295px", "left":"0px", 'padding':'5px 5px 5px 0'}, 100)
    this.$(".message").hide()
  },
  fetch: function(){this.list.fetch();},
  formToggle: function(){
    $("div.login > h3, button").toggle();
    $("input.signup").slideToggle("fast") 
  },
  inputFocus: function(e){
    //set the default value if it hasn't been
    if(!$(e.currentTarget).attr("default"))
      $(e.currentTarget).attr("default", $(e.currentTarget).val())
    //clear the field
    if($(e.currentTarget).attr("default")==$(e.currentTarget).val())
      $(e.currentTarget).val("")      
  },
  inputBlur: function(e){
    if(!$(e.currentTarget).val())
      $(e.currentTarget).val($(e.currentTarget).attr("default"));
  },
  scrollPos: function(e){
    if($(window).scrollTop() > $(".header").height()+$("div.login").position().top){
      $(".sidebar").addClass("fixed");
      return true
    }
    $(".sidebar").removeClass("fixed");
  },  
  switchTag: function(e){
    this.$(".tags li").removeClass("on")
    $(e.currentTarget).addClass("on")
    this.list.tag = $(e.currentTarget).attr("tag");
    this.list.clearFetch();
  },
  switchSubreddit: function(e){
    this.list.subreddit = $(e.currentTarget).attr("tag");
    this.list.clearFetch();
    this.$("#featured").hide();

    this.$("h1.subreddit a")
      .text("r/"+$(e.currentTarget).attr('tag'))
      .attr("tag", $(e.currentTarget).attr('tag'));
    this.$("h1.subreddit").show();
  },
  search: function(e){    
    if(e.which == 13 && this.$(".search input").val()){
      this.list.options = {'q':encodeURIComponent(this.$(".search input").val())}
      this.list.tag = "search";
      this.list.allData = [];
      this.list.fetch();
    }
  },
  saved: function(e){ 
    this.$(".tags li").removeClass("on")
    $(e.currentTarget).addClass("on")
    this.list.refresh(base.stash.get("saved"))
  },
  nextFeature: function(){
    var next = this.$("#featured li.on").next("li");
    if(!next.length) next=this.$("#featured li:first");
    this.$("#featured li.on").removeClass("on");
    next.addClass("on");
  },
  prevFeature: function(){
    var prev = this.$("#featured li.on").prev("li")
    if(!prev.length) prev = this.$("#featured li:last")
    this.$("#featured li.on").removeClass("on");
    prev.addClass("on");
  },
  pretendAuth: function(){
    this.loginClose();
    base.stash.set("logged_in", true);
    this.$("div.login").hide();
    this.$("div.user").show();
  },
  logout: function(){
    base.stash.set("logged_in", false);
    this.$("div.login").show();
    this.$("div.user").hide();
  }
});

//Document model

var home = new AppView();
home.render();
$(window).scroll(home.scrollPos);
});