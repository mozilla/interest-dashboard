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

            this.subscribe(this, 'sync', this.setCurrentArticle);
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
            firstRibbonCollection = this.getFeedSourceValue("headliner");

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
              url: 'https://www.mozilla.org',
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
    'shared/ribbon/templates',
    'shared/ribbon/views/ribbon-page-navigation',
    'shared/ribbon/instances/ribbon-data-headliner',
    'shared/ribbon/views/helpers/mixin'
], function ($, _, RibbonView, Templates, RibbonPageNavigation, feed, RibbonMixin) {
    'use strict';

    var HeadlinerRibbonView = RibbonView.extend({
        el: '#ribbon-headliner',
        collection: feed,
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
