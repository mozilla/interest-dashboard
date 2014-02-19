/**
 * Creates a new collection for headliner recommendations.
 *
 * <p><b>Require Path:</b> shared/data/collections/headliner</p>
 *
 * @module Shared
 * @submodule Shared.Data
 * @class Headliner
 * @constructor
 * @extends BaseCollection
**/
define('shared/data/collections/headliner',[
    'backbone/nyt',
    'foundation/collections/base-collection',
    'shared/data/models/article',
    'foundation/hosts',
    'underscore/nyt',
    'shared/data/helpers/collection-mixin'
], function (Backbone, BaseCollection, Article, hosts, _, collectionMixin) {
    'use strict';


    var Headliner = BaseCollection.extend(

        _.extend({}, collectionMixin, {

            model: Article,

            /**
             * Fetches the collection if it hasn't been fetched yet
             *
             * @private
             * @method isFetchingData
             * @return {Boolean} A determination of whether the data is being fetched.
             **/
            loadData: function() {
              if (this.length === 0 && !this.hasFetched && headlinerRibbonData) {
                this.hasFetched = true;
                this.add(headlinerRibbonData);
              }
              return this;
            },

            /**
             * Returns the query parameter that is used to identify what to load on the
             * next page view
             *
             * @private
             * @method getIdentifier
             * @return {String} A query parameter string
            **/
            getIdentifier: function () {
                return 'src=recmoz';
            }
        })
    );

    return Headliner;
});
/**
 * Creates a new instance of the headliner collection
 *
 * <p><b>Require Path:</b> shared/data/instances/headliner</p>
 *
 * @module Shared
 * @submodule Shared.Data
 * @class HeadlinerInstance
 * @static
**/
define('shared/data/instances/headliner',[
    'jquery/nyt',
    'foundation/views/page-manager',
    'shared/data/collections/headliner'
], function ($, pageManager, Headliner) {
    'use strict';

    return new Headliner();

});
/**
 * Creates an Article Collection that will be used to sync data for the Ribbon and the
 * Arrow buttons
 *
 * <p><b>Require Path:</b> shared/ribbon/collections/ribbon</p>
 *
 * @module Shared
 * @submodule Shared.Ribbon
 * @class Collection
 * @constructor
 * @extends BaseCollection
**/
define('shared/ribbon/collections/ribbon-headliner',[
    'backbone/nyt',
    'underscore/nyt',
    'shared/ribbon/collections/ribbon',
    'shared/data/models/article',
    'foundation/hosts',
    'foundation/models/user-data',
    'shared/data/instances/most-emailed',
    'shared/data/instances/recommendations',
    'shared/data/instances/context',
    'shared/data/instances/top-news',
    'shared/data/instances/section-origin',
    'shared/data/instances/headliner'
], function (Backbone, _, RibbonCollection, Article, Hosts, userData, mostEmailed, recommendations, context, topNews, sectionOrigin, headliner) {
    'use strict';

    var HeadlinerRibbonCollection = RibbonCollection.extend({

        initialize: function (settings) {
            _.bindAll(this, 'getMostEmailed', 'getContext', 'getTopNews', 'getRecommendations', 'getOrigin', 'getHeadliner');

            this.collectionLabels = [];

            this.feedSource = [
                { origin: this.getOrigin },
                { context: this.getContext },
                { mostEmailed: this.getMostEmailed },
                { homepage: this.getTopNews },
                { recommendations: this.getRecommendations },
                { headliner: this.getHeadliner },
                { world: Hosts.json + '/services/json/sectionfronts/world/index.jsonp' },
                { us: Hosts.json + '/services/json/sectionfronts/national/index.jsonp' },
                { business: Hosts.json + '/services/json/sectionfronts/business/index.jsonp' },
                { opinion: Hosts.json + '/services/json/sectionfronts/opinion/index.jsonp' },
                { technology: Hosts.json + '/services/json/sectionfronts/technology/index.jsonp' },
                { politics: Hosts.json + '/services/json/sectionfronts/politics/index.jsonp' },
                { sports: Hosts.json + '/services/json/sectionfronts/sports/index.jsonp' },
                { science: Hosts.json + '/services/json/sectionfronts/science/index.jsonp' },
                { health: Hosts.json + '/services/json/sectionfronts/health/index.jsonp' },
                { arts: Hosts.json + '/services/json/sectionfronts/arts/index.jsonp' },
                { style: Hosts.json + '/services/json/sectionfronts/style/index.jsonp' },
                { nyregion: Hosts.json + '/services/json/sectionfronts/nyregion/index.jsonp' }
            ];

            this.currentArticleUrl = settings.currentArticleUrl;
            this.originalLoadType = 'context';
            this.feedUrl = this.setFeedUrl(settings.sectionFeedUrl);

            this.setCurrentArticle();
            this.subscribe(this, 'sync', this.setCurrentArticle);
        },

        /**
         * Sets the currentArticle property based on the currentArticleUrl property
         *
         * @private
         * @method setCurrentArticle
        **/
        setCurrentArticle: function () {
            var feedCollection = this;

            this.currentArticle = this.find(function (article) {
                var url = article.get('link').match(/^[^\#\?]+/)[0];
                return url === feedCollection.currentArticleUrl;
            });

        },

        /**
         * Set the initial feed for the collection
         *
         * @private
         * @method setFeedUrl
         * @param sectionFeedUrl {String} the current default section feed
         * @return {String} the updated url
        **/
        setFeedUrl: function (sectionFeedUrl) {
            var ref, feedSrc, firstRibbonCollection;
            var collectionObj = this;
            var source = this.pageManager.getUrlParam('src') || '';
            var ribbonReference = this.pageManager.getUrlParam('rref');
            var loadType = 'origin';

            //user arrives from clicking on an item in the ribbon
            if (ribbonReference && ribbonReference !== 'homepage') {
                this.removeFeedByKey(ribbonReference);
                feedSrc = 'origin';

            //user arrives from home page or section front
            } else if (this.pageManager.getUrlParam('hp') === '' || ribbonReference === 'homepage') {
                feedSrc = 'homepage';

            //user arrives from section front
            } else if (this.pageManager.getUrlParam('ref')) {
                ref = this.createAnchor(document.referrer);

                //if nyt and a section front
                if (/.nytimes.com$/.test(ref.host) && /^\/pages/.test(ref.pathname)) {
                    feedSrc = 'origin';

                //otherwise load the collection in context
                } else {
                    feedSrc = 'context';
                    loadType = 'context';
                }

            //user arrives from most emailed
            } else if (source === 'me') {
                feedSrc = 'mostEmailed';

            //User arrives from rec engine
            } else if (source.indexOf('rec') === 0) {
                feedSrc = 'recommendations';

            //collection in context
            } else {
                feedSrc = 'context';
                loadType = 'context';
            }

            //The collection that should be loaded
            //If not empty, headliner recommendations should always be first
            headliner.loadData();
            if (headliner.length) {
              firstRibbonCollection = this.getFeedSourceValue("headliner");
            }
            else {
              firstRibbonCollection = this.getFeedSourceValue(feedSrc);
            }

            //set load type
            this.originalLoadType = loadType;

            //always remove the origin, context and the feed's src from the list
            this.removeFeedByKey('context');
            this.removeFeedByKey('origin');
            this.removeFeedByKey(feedSrc);

            //remove recommendations if the user is anonymous
            userData.ready(function () {
                if (!userData.isLoggedIn()) {
                    collectionObj.removeFeedByKey('recommendations');
                }
            });

            return firstRibbonCollection;
        },

        /**
         * Get Headliner recommendations so it can be added to the ribbon.
         *
         * @private
         * @method getHeadliner
         **/
        getHeadliner: function() {
          return this.importCollection({
              collection: headliner.loadData(),
              name: 'Recommended For You',
              url: '#',
              type: 'news',
              callback: {headliner: this.getHeadliner}
          });
        },
    });

    return HeadlinerRibbonCollection;
});
/**
 * Creates a new instance of the ribbon feed collection
 *
 * <p><b>Require Path:</b> shared/ribbon/instances/ribbon-data</p>
 *
 * @module Shared
 * @submodule Shared.Ribbon
 * @class RibbonDataInstance
 * @static
**/
define('shared/ribbon/instances/ribbon-data-headliner',[
    'jquery/nyt',
    'foundation/views/page-manager',
    'shared/ribbon/collections/ribbon-headliner'
], function ($, pageManager, Feed) {
    'use strict';

    //Create a new shared collection based on the current section
    var currentArticleUrl = $('head link[rel="canonical"]').attr('href');
    var sectionFeedUrl = pageManager.getMeta('article:collection');

    return new Feed({
        sectionFeedUrl: sectionFeedUrl,
        currentArticleUrl: currentArticleUrl
    });

});
define('shared/ribbon/templates-headliner', ['underscore/nyt'], function(_) {
  var templates = {};
  function cleanseBeforeInjection(data) {
    if (data == null) return '';
    return Bleach.clean(data, {strip: true, tags: []});
  };
  templates["ribbonPageNavTip"] = function (obj) {
    return '<div class="placeholder-button-group">\n<div class="placeholder-button"><div class="previous"></div></div>\n' +
           '<div class="placeholder-button"><div class="next"></div></div>\n</div>\n<h4>New!</h4>\n<p>Use your left and right arrow keys to browse articles.</p>';
  };
  templates["ribbonPageNavigationHeadliner"] = function (obj) {
    var results = '';
    with(obj || {}) {
      results += '<nav data-href="' + cleanseBeforeInjection(link) + '" data-queue-ad="' +
                 cleanseBeforeInjection(shouldQueueAd) + '" class="ribbon-page-navigation-headliner ' +
                 cleanseBeforeInjection(direction) + '" style="display:' +
                 cleanseBeforeInjection(display) + '; overflow:hidden;">\n<a href="' +
                 cleanseBeforeInjection(link) + '" >\n<article class="story theme-summary ';
      if (!image) {
        results += ' no-thumb ';
      }
      results += '" style="display:none;">\n';
      if (image) {
        results += '\n<div class="thumb">\n<img src="' + cleanseBeforeInjection(image.url) + '" />\n</div>\n';
      }
      results += '\n<div class="summary">\n';
      if (kicker) {
        results += '\n<h3 class="kicker">' + cleanseBeforeInjection(kicker) + '</h3>\n';
      }
      results += '\n<h2 title="' + cleanseBeforeInjection(title) + '" class="story-heading">' + cleanseBeforeInjection(title) + '</h2>\n</div>\n</article>\n<div class="arrow arrow-';
      if (direction === 'next') {
        results += 'right';
      } else {
        results += 'left';
      }
      results += '">\n<span class="visually-hidden">Go to the ' + cleanseBeforeInjection(direction) + ' story</span>\n<div class="arrow-conceal"></div>\n</div>\n</a>\n</nav>';
    }
    return results;
  };

  templates["storyCollection"] = function (obj) {
    var results = '';
    with(obj || {}) {
      results += '<li class="collection ' + cleanseBeforeInjection(collectionLabel.type) + '-collection">\n';
      if (collectionLabel.title) {
        results += '\n<div class="collection-marker">\n<h2 class="label"><a href="' +
                   cleanseBeforeInjection(collectionLabel.url) + '">' +
                   cleanseBeforeInjection(collectionLabel.title) + '</a></h2>\n</div>\n';
      }
      results += '\n<ol class="collection-menu">\n';
      _.each(articles, function (article, index, list) {
        results += '\n';
        var a = document.createElement("a");
        var newLink = article.get('link');
        a.href = newLink;
        if (a.hostname.indexOf('www') === 0 && window.location.hostname.indexOf('www') === 0) {
          newLink = a.pathname.indexOf('/') === 0 ? a.pathname : '/' + a.pathname;
        }
        newLink += /\?/.test(newLink) ? '&' : '?';
        var identifierRE = new RegExp(sectionId);
        if (!identifierRE.test(newLink)) {
          newLink += sectionId;
        }
        newLink += /\?/.test(newLink) ? '&' : '?';
        if (adPosition) {
          newLink += 'ribbon-ad-idx=' + adPosition;
        }
        var classString;
        var classList = [];
        if (article.get('link') === canonical && firstLoad) {
          classList.push('active');
        }
        if (index === list.length - 1) {
          classList.push('last-collection-item');
        }
        classString = classList.join(' ');
        results += '';
        if (article.get('isAd') !== true) {
          results += '' + cleanseBeforeInjection(articleTemplate({
            article: article,
            classString: classString,
            newLink: newLink
          }));
        } else {
          results += '' + cleanseBeforeInjection(adTemplate());
        }
        results += '';
        article.set('processed', true);
        results += '\n';
      });
      results += '\n</ol>\n</li>';
    }
    return results;
  };

  return templates;
});
/**
 * The headliner ribbon page navigation
 *
 * <p><b>Require Path:</b> shared/ribbon/views/ribbon-page-navigation-headliner</p>
 *
 * @module Shared
 * @submodule Shared.Ribbon
 * @namespace Ribbon.PageNavigation
 * @class View
 * @constructor
 * @extends foundation/views/base-view
**/
define('shared/ribbon/views/ribbon-page-navigation-headliner', [
    'jquery/nyt',
    'underscore/nyt',
    'shared/ribbon/views/ribbon-page-navigation',
    'foundation/views/page-manager',
    'shared/ribbon/instances/ribbon-data-headliner',
    'shared/ribbon/templates-headliner',
    'shared/modal/views/modal',
    'foundation/models/page-storage',
    'shared/ribbon/views/helpers/mixin'
], function ($, _, RibbonPageNavigation, pageManager, feed, templates, Modal, pageStorage, RibbonMixin) {
    'use strict';

    var HeadlinerRibbonPageNavigation = RibbonPageNavigation.extend({
      initialize: function () {
        _.bindAll(this, 'preventScroll', 'checkForFeed');

        this.feed = feed;
        this.subscribe('nyt:ads-fire-ribbon-interstitial', this.ribbonInterstitialFired);

        if (this.pageManager.isDomReady()) {
          this.handlePageReady();
        } else {
          this.subscribe('nyt:page-ready', this.handlePageReady);
        }

        this.trackingBaseData = {
          'module': 'ArrowsNav',
          'contentCollection': this.pageManager.getMeta('article:section')
        };

      },

      events: {
        'click .ribbon-page-navigation-headliner': 'changeArticle',
        'mouseenter .ribbon-page-navigation-headliner': 'showArticle',
        'mouseleave .ribbon-page-navigation-headliner': 'hideArticle',
        'mouseleave #ribbon-page-navigation-modal-headliner .modal': 'hideArticle'
      },

      handlePageReady: function () {
        this.restrict = false;
        this.createAdsDeferral(this.checkForFeed);
      },

      render: function () {
          var curArt = this.feed.currentArticle;
          var prev = this.feed.previous(curArt);
          var next = this.feed.next(curArt);

          this.activeStoryIndex = this.getStoryIndex(this.feed.models, this.feed.currentArticle);
          this.$arrows = $(this.createTemplate('previous', prev) + this.createTemplate('next', next));

          this.$shell.append(this.$arrows);
          this.adjustArrows();
          this.adjustText();

          this.pageManager.$document.undelegate('nyt:ribbon-left');
          this.pageManager.$document.undelegate('nyt:ribbon-right');
          this.subscribe('nyt:page-resize', this.adjustArrows);
          this.subscribe('nyt:ribbon-visiblility', this.restrictArrow);
          this.subscribe('nyt:ribbon-left', this.handleKeyboardLeftArrow);
          this.subscribe('nyt:ribbon-right', this.handleKeyboardRightArrow);

          if (this.pageManager.isMobile()) {
              this.$arrows.hide();
          }
      },

      createTemplate: function (dir, article) {
        var adRelationship, shouldQueueAd, adPosition;

        var data = {
          direction       : dir,
          display         : 'none',
          title           : '',
          image           : '',
          link            : '',
          kicker          : '',
          shouldQueueAd   : false
        };

        if (article) {
          // if there is an ad, find its position and determine whether it should be fired on click / arrow
          if (_.indexOf(this.pageManager.getMeta('ads_adNames'), 'Ribbon') >= 0) {
            adPosition = this.getAdIndex(this.activeStoryIndex);
            adRelationship = adPosition - _.indexOf(this.feed.models, article);
            shouldQueueAd = ((dir === 'previous' && adRelationship === 1) || (dir === 'next' && adRelationship === 0));
          }

          data = {
            direction       : dir,
            display         : 'block',
            title           : article.get('headline') || article.get('title'),
            image           : article.getCrop('thumbStandard'),
            link            : this.makeLinkRelative(article.get('link'), adPosition),
            kicker          : article.get('kicker'),
            shouldQueueAd   : shouldQueueAd
          };
        }

        return templates.ribbonPageNavigationHeadliner(data);

      },
      hideArticle: function (event) {
        var arrowsView = this;
        var $tooltip = $('#ribbon-page-navigation-modal-headliner').find('.modal');
        var $arrow = $tooltip.is(event.currentTarget) ? $('.ribbon-page-navigation-headliner.next') : $(event.currentTarget);

        clearTimeout(this.timeout);

        //when the nav isn't expanded and not moving on a tooltip exit out
        if (!this.expanded || $tooltip.has(event.relatedTarget).length > 0) {
          return;
        }

        $arrow.animate({
          width: arrowsView.origWidth
        }, {
          duration: this.speed,
          complete: function () {
            $arrow.css('width', '');
          }
        }).find('.story').hide();
        this.expanded = false;

      },
      addToolTip: function () {
        var ribbonObj = this;
        var openTimeout;

        var ribbonTip = new Modal({
          id: 'ribbon-page-navigation-modal-headliner',
          modalContent: templates.ribbonPageNavTip(),
          binding: '.ribbon-page-navigation-headliner.next',
          tailDirection: 'right',
          canOpenOnHover: true,
          width: '322px',
          mouseEnterDelay: 500,
          tailTopOffset: -5,
          tailLeftOffset: 9,
          closeOnMouseOut: true,
          openCallback: function () {
            pageStorage.save('ribbon_hasViewedTooltip', true);
            openTimeout = window.setTimeout(ribbonTip.close, 20000);
            ribbonObj.subscribeOnce('nyt:page-scroll', ribbonTip.close);
          },
          closeCallback: function () {
            ribbonTip.removeFromPage();
            window.clearTimeout(openTimeout);
          }
        });

        //Add modal to page
        ribbonTip.addToPage();
      }
    });
    return HeadlinerRibbonPageNavigation;
});
/**
 * Adds the ability to navigate through a ribbon on a page.
 *
 * <p><b>Require Path:</b> shared/ribbon/views/ribbon</p>
 *
 * @module Shared
 * @submodule Shared.Ribbon
 * @namespace Ribbon
 * @class View
 * @constructor
 * @extends foundation/views/base-view
**/
define('shared/ribbon/views/ribbon-headliner',[
    'jquery/nyt',
    'underscore/nyt',
    'shared/ribbon/views/ribbon',
    'shared/ribbon/templates-headliner',
    'shared/ribbon/views/ribbon-page-navigation-headliner',
    'shared/ribbon/instances/ribbon-data-headliner',
    'shared/ribbon/views/helpers/mixin'
], function ($, _, RibbonView, Templates, HeadlinerRibbonPageNavigation, feed, RibbonMixin) {
    'use strict';

    var HeadlinerRibbonView = RibbonView.extend({
        el: '#ribbon-headliner',
        collection: feed,
        
        /** collection of actions that allow rendering and data init
         *
         * @private
         * @method assignListenersAndLoad
        **/
        assignListenersAndLoad: function () {
            window.clearTimeout(this.adxTimeout);
            this.stopSubscribing('nyt:ads-rendered', this.assignListenersAndLoad);

            //fire on initial load
            this.listenTo(this.collection, 'sync', this.render);
            this.listenToOnce(this.collection, 'sync', this.renderFurniture);
            this.listenTo(this.collection, 'nyt:ribbon-custom-collection-loaded', this.render);
            this.collection.loadData();

            //create the page navigation arrows so they sit in the story body
            new HeadlinerRibbonPageNavigation();

        },
    });

    return HeadlinerRibbonView;
});

define('shared/ribbon/instances/ribbon-headliner', [
    'jquery/nyt',
    'shared/ribbon/views/ribbon-headliner',
    'backbone/nyt'
], function ($, Ribbon) {
  if ($('#ribbon-headliner').length > 0) {
    new Ribbon();
  }
});

require(['shared/ribbon/instances/ribbon-headliner']);
