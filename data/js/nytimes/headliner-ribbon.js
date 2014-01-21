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
    'shared/ribbon/collections/ribbon'
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
    'foundation/views/base-view',
    'shared/ribbon/templates',
    'shared/ribbon/views/ribbon-page-navigation',
    'shared/ribbon/instances/ribbon-data-headliner',
    'shared/ribbon/views/helpers/mixin'
], function ($, _, BaseView, Templates, RibbonPageNavigation, feed, RibbonMixin) {
    'use strict';

    var RibbonView = BaseView.registerView('ribbon').extend(
        _.extend({}, RibbonMixin, {

            el: '#ribbon-headliner',

            collection: feed,

            template: Templates.storyCollection,

            articleTemplate: Templates.article,

            adTemplate: Templates.ad,

            isRibbonVisible: false,

            firstLoad: true,

            toggleDisabled: 0,

            oldScrollTop: 0,

            animationDistance: 100,

            minDownDistance: 100,

            minUpDistance: 300,

            speed: 200,

            hammerSettings: {
                drag_block_vertical: true,
                swipe_velocity: 0.7,
                drag_min_distance: 3
            },

            events: {
                'click .collection-menu li a': 'handleArticleClick',
                'click .ribbon-navigation-container .next': 'handleNextArrow',
                'click .ribbon-navigation-container .previous': 'handlePreviousArrow',
                'mouseenter': 'handleRibbonMouseEnter',
                'mouseleave': 'handleRibbonMouseOut',

                // touch events
                'touch': 'handleTouch',
                'tap': 'handleArticleClick',
                'hold': 'handleTouchHold',
                'dragstart': 'handleTouchDragStart',
                'drag': 'handleRibbonDrag',
                'swipe': 'handleRibbonSwipe'

            },

            nytEvents: {
                'nyt:page-resize': 'resizeRibbon',
                'nyt:messaging-critical-alerts-move-furniture': 'moveRibbonForAlerts',
                'nyt:messaging-suggestions-move-furniture': 'moveRibbonForAlerts',
                'nyt:messaging-message-critical-alerts-closed': 'enableRibbonToggle',
                'nyt:messaging-message-suggestions-closed': 'enableRibbonToggle',
                'nyt:comments-panel-opened': 'disableRibbonToggle',
                'nyt:comments-panel-closed': 'enableRibbonToggle'

            },


            /**
             * Initialize the ribbon
             *
             * @public
             * @method constructor
            **/
            initialize: function () {
                _.bindAll(this,
                    'handleMouseMove',
                    'handleArticleClick',
                    'handleRibbonAdClick',
                    'hideCollectionMarkers',
                    'pollHiddenCollections',
                    'pollShowingTabs',
                    'revertRibbon',
                    'handleRibbonSwipe',
                    'handleRibbonDrag',
                    'handleTouch',
                    'handleTouchHold',
                    'handleTouchDragStart',
                    'applyTranslateToRibbon',
                    'assignListenersAndLoad'
                );

                this.isDesktop = this.pageManager.isDesktop();
                this.canonical = this.pageManager.getCanonical();

                this.trackingBaseData = {
                    'module': 'Ribbon',
                    'version': this.collection.originalLoadType,
                    'region': 'Header'
                };

                this.listenToOnce(this.collection, 'sync', _.bind(function () {
                    this.trackingTriggerImpression('ribbon-first-load', {
                        'eventName': 'impression',
                        'action': 'impression',
                        'contentCollection': this.collection.collectionLabels[0].title
                    });
                }, this));
            },

            /**
             * Renders the ribbon on dom ready
             *
             * @private
             * @method handlePageReady
            **/
            handleDomReady: function () {
                this.$loader = this.$('.ribbon-loader');

                //set ribbon variables
                this.ribbonMarginTop = parseInt(this.$el.css('margin-top'), 10);
                this.ribbonMarginBottom = parseInt(this.$el.css('margin-bottom'), 10);
                this.ribbonHeight = this.$el.height();
                this.mastheadHeight = $('#masthead').height() - 1;
                this.toggleDisabled = false;

                //assign ribbon selectors
                this.$ribbonMenu = this.$el.find('.ribbon-menu');
                this.$ribbonNavigation = this.$el.find('.ribbon-navigation-container');
                this.$previousArrow = this.$ribbonNavigation.find('.previous');
                this.$nextArrow = this.$ribbonNavigation.find('.next');

                //prime the visibility check
                this.isRibbonVisible = this.pageManager.isComponentVisible(this.$el);

                //throw an event when the ribbon comes in and out of view
                this.listenTo(this.pageManager, 'nyt:page-scroll', this.handleScroll);

                this.createAdsDeferral(this.assignListenersAndLoad);
            },

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
                new RibbonPageNavigation();

            },

            /**
             * Renders new content for the Ribbon each time we hear the collection has updated.
             *
             * @private
             * @method render
            **/
            render: function () {
                var modelsToProcess, collectionLabel, $html, containerWidth, adIndex, adData, $ribbonAd, ribbonLink;
                var initialUnitWidth = this.collectionStoryWidth + this.animationDistance;
                var ribbonAdFromMeta = _.indexOf(this.pageManager.getMeta('ads_adNames'), 'Ribbon') >= 0;

                //Render the items in the collection that are not in display
                modelsToProcess = this.collection.where({processed: false});

                // leave render if there are no new models to process
                if (modelsToProcess.length === 0) {
                    return;
                }

                if ((ribbonAdFromMeta || this.pageManager.getUrlParam('ribbon-ad-idx')) && this.firstLoad === true) {
                    adData = this.returnRibbonAdData(modelsToProcess, ribbonAdFromMeta);
                    adIndex = adData.index;
                    if (adData.model) {
                        modelsToProcess.splice(adData.index, 0, adData.model);
                    }
                }

                //Use the first model in the collection to derive the collection label information
                collectionLabel = this.collection.collectionLabels[modelsToProcess[0].get('collectionId')];

                //if the collection label doesn't exist. Exit
                if (!collectionLabel) {
                    return;
                }

                //generate a list for an individual collection
                $html = $(this.template({
                    firstLoad: this.firstLoad,
                    canonical: this.canonical,
                    articles: modelsToProcess,
                    adTemplate: this.adTemplate,
                    articleTemplate: this.articleTemplate,
                    collectionLabel: collectionLabel,
                    adPosition: adIndex,
                    sectionId: this.collection.getIdentifier()
                }));

                //set the entire menu's width based on the number of collection items, adding the number of collections to account their border
                containerWidth = (this.collection.length * initialUnitWidth) + this.$loader.width() + this.collection.collectionLabels.length;
                this.$ribbonMenu.css('width', containerWidth);

                //append the collection to the ribbon
                this.$loader.before($html);

                // always animate on a secondary load
                // only animate on a primary load if the referrer is not an article
                if ((this.firstLoad && !this.referredFromArticle()) || !this.firstLoad) {
                    this.animateRibbonStories($html);
                }

                // if there is a Ribbon placehoder in the dom, fire a new ads placement event
                $ribbonAd = this.$el.find('#Ribbon');
                if ($ribbonAd.length > 0 && this.firstLoad === true) {
                    this.broadcast('nyt:ads-new-placement', 'Ribbon');

                    //add the ribbon reference to all branded content ribbon links
                    //so that the page will use the collection of origin if there is a ribbon
                    ribbonLink = $ribbonAd.find('> a');
                    if (ribbonLink.length) {
                        ribbonLink.attr('href', ribbonLink.attr('href') + '?' + this.collection.getIdentifier());
                    }

                    this.assignHandlerToIframeClick($ribbonAd.find('iframe'), this.handleRibbonAdClick);
                }

                this.assignSyncedHtmlToView();

                //manipulate the ribbon data so it fits properly in the view
                this.updateCollectionValues();
                this.firstLoad = false;
                this.broadcast('nyt:ribbon-rendered');
            },

            /**
             * Allow clicks inside an iFrame to be detected in the parent document
             *
             * @private
             * @method assignHandlerToIframeClick
             * @param $element {Object} iframe wrapped in jQuery object
             * @param handler {Function} the method to assign to the click
            **/
            assignHandlerToIframeClick: function ($element, handler) {
                var iframe, iframeDoc;

                if (!$element.length) {
                    return;
                }

                iframe = $element.get(0);
                iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                if (typeof iframeDoc.addEventListener !== 'undefined') {
                    iframeDoc.addEventListener('click', handler, false);
                } else if (typeof iframeDoc.attachEvent !== 'undefined') {
                    iframeDoc.attachEvent ('onclick', handler);
                }
            },

            /**
             * Insert ad models into the ribbon collection and return the modified collection
             *
             * @private
             * @method returnRibbonAdData
             * @param modelsToProcess {Object} the original collection of story models
             * @return {Object} the index of the ad and an ad model
            **/
            returnRibbonAdData: function (modelsToProcess, adIndexFromMeta) {
                var ribbonView = this;
                var smallScreenBreakpoint = 1030;
                var adPosition, adModel, activeStoryIndex;

                activeStoryIndex = this.getStoryIndex(modelsToProcess);
                adPosition = this.getAdIndex(activeStoryIndex);

                if (adIndexFromMeta) {
                    adModel = this.collection.getAdModel();
                }

                return {
                    index: adPosition,
                    model: adModel
                };
            },

            /**
             * tests whether the user came from an article page
             *
             * @private
             * @method referredFromArticle
             * @return {Boolean} the result of the test. defaults to false if no document.referrer is found
            **/
            referredFromArticle: function () {
                var anchorTag = document.createElement('a');
                var referrerPathname;

                if (document.referrer) {
                    anchorTag.href = document.referrer;
                    referrerPathname = anchorTag.pathname;
                    return anchorTag.hostname.indexOf('nytimes.com') > -1 && /^(\/\w+)?\/\d+/.test(referrerPathname);
                }

                return false;
            },

            /**
             * On the initial load of the collection, render the supporting Ribbon items
             *
             * @private
             * @method renderFurniture
            **/
            renderFurniture: function () {
                var index = -this.$el.find('.active').index();
                this.ribbonAnimation(index, true);

                // if the initial collection end is visible, get more stories
                if (this.testForCollectionEnd()) {
                    this.collection.loadFeed();
                }

                // show/hide arrows in desktop mode
                if (!Modernizr.touch) {
                    this.collectionMarkerTimeout = setTimeout(this.hideCollectionMarkers, 2000);
                } else {
                    this.assignCustomEasing();
                }
            },

            /**
             * give a custom easing method to jQuery easing for the swipes
             *
             * @private
             * @method assignCustomEasing
             * @return {Object} the ribbon view object for chaining purposes
            **/
            assignCustomEasing: function () {
                $.easing.easeOutCirc = function (x, t, b, c, d) {
                    return c * Math.sqrt(1 - (t=t/d-1)*t) + b;
                };

                return this;
            },

            /**
             * return an Array of matrix values
             *
             * @private
             * @method matrixToArray
             * @param {String} matrix the matrix to transform
             * @return {Array} the matrix values in array format
            **/
            matrixToArray: function (matrix)  {
                return matrix.substr(7, matrix.length - 8).split(', ');
            },

            /**
             * return the transform x value if available. if not fall back to position.left
             *
             * @method returnStartingXForTransfrom
             * @return {String} the left or transformX position
            **/
            returnXForTransform: function () {
                var transformProperty = this.$ribbonMenu.css('-webkit-transform');
                return (transformProperty === 'none') ? this.$ribbonMenu.position().left : parseInt(this.matrixToArray(transformProperty)[4], 10);
            },

            /**
             * put the translate3d CSS propery on the ribbonMenu
             *
             * @private
             * @method applyTranslateToRibbon
             * @param {Number} xValue the value to apply
             * @return {Object} jQuery
            **/
            applyTranslateToRibbon: function (xValue) {
                var translateProperty;
                if (!isNaN(xValue)) {
                    translateProperty = 'translate3d(' + xValue + 'px, 0, 0)';
                    return this.$ribbonMenu.css({
                                'transform': translateProperty,
                                '-webkit-transform': translateProperty,
                                'msTransform': translateProperty
                            });
                }
            },

            /**
             * actions for the ribbon drag event
             * @private
             * @method handleRibbonDrag
             * @param event {Object} the touch event
            **/
            handleRibbonDrag: function (e) {
                if (!e.gesture) {
                    return;
                }

                e.gesture.preventDefault();

                var totalDistanceTraveled, changeToApply, pixelsToShift, endVisibleUponEvent, newXPosition, translateProperty;
                var currentXPosition = this.returnXForTransform();

                // find the distance covered in previous iterations
                totalDistanceTraveled = this.startDragLocation - currentXPosition;
                pixelsToShift = (totalDistanceTraveled === 0) ? e.gesture.deltaX : e.gesture.deltaX + totalDistanceTraveled;
                newXPosition = this.handleRibbonEdges(currentXPosition + pixelsToShift);
                endVisibleUponEvent = this.testForCollectionEnd(this.startDragLocation);

                this.applyTranslateToRibbon(newXPosition);

                // if the new position has exposed the end of the collections, get more stories
                if (this.testForCollectionEnd() && !endVisibleUponEvent) {
                    this.collection.loadFeed();
                }

                if (e.gesture.deltaX < 0) {
                    this.pollShowingTabs();
                } else {
                    this.pollHiddenCollections();
                }
            },

            /**
             * return the transform x value if available. if not fall back to position.left
             *
             * @method returnStartingXForTransfrom
             * @return {String} the left or transformX position
            **/
            returnStartingXForTransform: function () {
                var transformProperty = this.$ribbonMenu.css('transform');
                return (transformProperty === 'none') ? this.$ribbonMenu.position().left : parseInt(this.matrixToArray(transformProperty)[4], 10);
            },

            /**
             * actions for the ribbon swipe event
             * @private
             * @method handleRibbonSwipe
             * @param {Object} the touch event
            **/
            handleRibbonSwipe: function (event) {
                var ribbonView = this;
                var coreDuration = 2000;
                var ribbonSwipe, distanceMultiplier, deltaDistance, checkedLeftValue, swipeDuration, swipeAnimationPolling;

                event.gesture.preventDefault();
                distanceMultiplier = 1 + (event.gesture.distance / ribbonView.$el.width());
                deltaDistance = event.gesture.deltaX * distanceMultiplier;

                swipeDuration = coreDuration / event.gesture.velocityX;
                checkedLeftValue = ribbonView.handleRibbonEdges(ribbonView.returnXForTransform() + deltaDistance);

                swipeAnimationPolling = _.throttle(function () {
                    if (event.gesture.direction === 'left') {
                        ribbonView.pollShowingTabs();
                    } else {
                        ribbonView.pollHiddenCollections();
                    }
                });

                var options = {
                    duration: swipeDuration,
                    easing: 'easeOutCirc',
                    step: ribbonView.applyTranslateToRibbon,
                    progress: swipeAnimationPolling,
                    always: function () {
                        // fire this even if the animation is stopped by another swipe
                        if (ribbonView.testForCollectionEnd(checkedLeftValue)) {
                            ribbonView.collection.loadFeed();
                        }
                        swipeAnimationPolling();
                    }
                };

                this.animateSwipe(checkedLeftValue, options);
            },

            /**
             * handle touch events
             *
             * @private
             * @method handleTouch
             * @param {Object} the touch event
            **/
            handleTouch: function (event) {
                event.gesture.preventDefault();
            },

            /**
             * handle hold events
             *
             * @private
             * @method handleTouchHold
             * @param {Object} the touch event
            **/
            handleTouchHold: function (event) {
                this.stopSwipeAnimation();
            },

            /**
             * handle dragstart events
             *
             * @private
             * @method handleTouchDragStart
             * @param {Object} the touch event
            **/
            handleTouchDragStart: function (event) {
                this.stopSwipeAnimation();
                this.startDragLocation = this.returnXForTransform();
            },

            /**
             * helper to stop swipe animations without erros
             *
             * @private
             * @method stopSwipeAnimation
            **/
            stopSwipeAnimation: function () {
                if (this.$swipeAnimationElement) {
                    this.$swipeAnimationElement.stop();
                }
            },

            /**
             * Handle the behavior for when the mouse hovers over the ribbon container
             *
             * @private
             * @method handleRibbonMouseOver
            **/
            handleRibbonMouseEnter: function () {
                if (!Modernizr.touch && typeof this.$ribbonMenu !== 'undefined') {
                    this.$el.on('mousemove', this.handleMouseMove);

                    clearTimeout(this.collectionMarkerTimeout);

                    if (this.$collectionMarkers) {
                        this.$collectionMarkers.show();
                    }

                    if (this.$firstCollectionMarker) {
                        this.$firstCollectionMarker.show();
                    }
                }
            },

            /**
             * Handles the mouse movement inside of the ribbon and shows the appropriate
             * navigation buttons depending on where the cursor.
             *
             * @private
             * @method handleMouseMove
            **/
            handleMouseMove: _.throttle(function (e) {
                this.checkForActiveNavigation(e.clientX, e.clientY);
            }),

            /**
             * Handle the behavior for when the mouse leaves the ribbon container
             *
             * @private
             * @method handleRibbonMouseOut
            **/
            handleRibbonMouseOut: function () {
                var ribbonView = this;

                if (!Modernizr.touch) {
                    this.$el.off('mousemove', this.handleMouseMove);
                    this.hideRibbonArrows();
                    this.hideCollectionMarkers();
                }
            },

            /**
             * Handle the behavior when the previous button is clicked
             *
             * @private
             * @method handleNextArrow
            **/
            handleNextArrow: function (e) {
                if (!$(e.currentTarget).hasClass('inactive')) {
                    this.trackingTrigger('ribbon-page-right', {
                        'eventName': 'ScrollRight',
                        'contentCollection': this.getSectionInView(),
                        'action': 'click'
                    });

                    this.$previousArrow.removeClass('inactive');
                    this.shiftRibbonLeft();
                }
            },

            /**
             * Handle the behavior when the next button is clicked
             *
             * @private
             * @method handlePreviousArrow
            **/
            handlePreviousArrow: function (e) {
                if (!$(e.currentTarget).hasClass('inactive')) {
                    this.trackingTrigger('ribbon-page-left', {
                        'eventName': 'ScrollLeft',
                        'contentCollection': this.getSectionInView(),
                        'action': 'click'
                    });

                    this.$nextArrow.removeClass('inactive');
                    this.shiftRibbonRight();
                }
            },

            /**
             * broadcast an event to open the ribbon interstitial
             *
             * @private
             * @method handleRibbonAdClick
             * @param e {Object} the event object
            **/
            handleRibbonAdClick: function (e) {
                var $ribbonAdContainer;
                this.broadcast('nyt:ads-fire-ribbon-interstitial');
                $ribbonAdContainer = this.$el.find('.ribbon-ad-container');
                this.animateRibbon($ribbonAdContainer);
                // Keep preventDefault from throwing errors in IE8
                if (e.preventDefault) {
                    e.preventDefault();
                } else {
                    return false;
                }
            },

            /**
              * calculate the distance that the ribbon needs to move to bring active asset into position.
              * Then move asset into new position
              *
              * @private
              * @method animateRibbon
              * @param ribbonAsset the ribbon asset to be moved
            **/
            animateRibbon: function ($ribbonAsset) {
                var unitsToMove, xPosition, animationDeferred;
                xPosition = !Modernizr.touch ? $ribbonAsset.offset().left : this.returnXForTransform() * -1;
                unitsToMove = Math.floor(xPosition / this.collectionStoryWidth) * -1;
                animationDeferred = this.ribbonAnimation(unitsToMove);
                return animationDeferred;
            },

            /**
             * Animate the ribbon when an article is clicked.
             *
             * @private
             * @method animateRibbonClick
            **/
            handleArticleClick: function (e) {
                var unitsToMove, animationDeferred, $clickLink, targetHref, xPosition, desiredChange, newLeftValue;
                var $eventTarget = $(e.target);
                var $storyParent = $eventTarget.parents('li.collection-item');

                if ($storyParent.length > 0) {
                    //safe ribbon ads behave the same as normal stories
                    $clickLink = $storyParent.find('> a, #Ribbon > a');
                    targetHref = $clickLink.attr('href');

                    targetHref = this.trackingAppendParams(targetHref, {
                        'action': 'click',
                        'contentCollection': this.getCollectionByArticleElement($storyParent)
                    });

                    if (e.metaKey !== true) {
                        e.preventDefault();

                        // remove any active designation and reassign
                        this.$el.find('.collection-item').removeClass('active');
                        $storyParent.addClass('active');

                        if (e.type === 'tap') {
                            desiredChange =  (this.collectionStoryWidth*0.25) - $storyParent.offset().left;
                            newLeftValue = this.returnXForTransform() + desiredChange;
                            animationDeferred = this.animateSwipe(newLeftValue);
                        } else {
                            xPosition = $storyParent.offset().left;
                            unitsToMove = Math.floor(xPosition / this.collectionStoryWidth);
                            animationDeferred = this.ribbonAnimation(-unitsToMove);
                        }

                        animationDeferred.done(function () {
                            window.location.href = targetHref;
                        });
                    }
                    else {
                        $clickLink.attr('href', targetHref);
                    }
                } else if ($eventTarget.parents('.collection-marker').length > 0) {
                    window.location.href = e.target.href;
                }
            },

            /**
             * Handles what is triggered when the page is scrolled
             *
             * @private
             * @method handleViewportChange
            **/
            handleScroll: function () {
                var top = this.pageManager.getViewport().top;

                this.toggleRibbon(top);
                this.checkRibbonVisibility();
            },

            /**
             * hide all the collection markers
             *
             * @private
             * @method hideCollectionMarkers
            **/
            hideCollectionMarkers: function () {

                if (this.$collectionMarkers) {
                    this.$collectionMarkers.hide();
                }

                if (this.$firstCollectionMarker) {
                    this.$firstCollectionMarker.hide();
                }
            },

            /**
             * Move the collection markers to the left
             *
             * @private
             * @method slideCollectionMarkers
             * @return {Object} the promise for the slide
            **/
            slideCollectionMarkers: function () {
                var collectionMarkerWidth = this.$firstCollectionMarker.outerWidth();
                var $markersGroup = this.$el.find('.first-collection-marker');
                return $markersGroup.eq(0).animate({marginLeft: -collectionMarkerWidth}, 100).promise();
            },

            /**
             * check the collections that are not showing to see if they have slid into view
             *
             * @private
             * @method pollHiddenCollections
            **/
            pollHiddenCollections: function () {
                var ribbonView = this;
                var $notShowingMarkers = this.$collectionMarkers.filter('.past-left-border');
                var leftCollectionEdge, $currentElement, $markerToClone, $newFirstMarker;

                $notShowingMarkers.each(function (index, element) {
                    $currentElement = $(element);
                    leftCollectionEdge = $currentElement.offset().left;

                    // -1 to account for the border on the end of each collection
                    if (leftCollectionEdge - (ribbonView.$el.offset().left + 1) > ribbonView.collectionStoryWidth * 0.25) {
                        $currentElement.removeClass('past-left-border');
                        $markerToClone = $currentElement.closest('.collection').prev().find('.collection-marker');
                        $newFirstMarker = ribbonView.createFirstCollectionMarker($markerToClone, true);
                        ribbonView.$firstCollectionMarker.last().remove();
                        ribbonView.$firstCollectionMarker = ribbonView.$el.find('.first-collection-marker');
                    }
                });
            },

            /**
             * check the tabs that are on the right side of the left ribbon border
             *
             * @private
             * @method pollShowingTabs
            **/
            pollShowingTabs: function () {
                var ribbonView = this;
                var $showingTabs = this.$collectionMarkers.not('.past-left-border');

                $showingTabs.each(function (index, element) {
                    ribbonView.testForNewMarker($(element));
                });
            },

            /**
             * check if marker passed has gone beyond the left ribbon border
             *
             * @private
             * @method testForNewMarker
            **/
            testForNewMarker: function ($currentElement) {
                var $newFirstMarker;
                var ribbonView = this;
                var $currentFirstMarker = this.$firstCollectionMarker;
                // detect if the current element is inside the right border of the partially obscured first story
                if ($currentElement.offset().left - (ribbonView.$el.offset().left + 1) <= this.collectionStoryWidth * 0.25) {
                    $newFirstMarker = this.createFirstCollectionMarker($currentElement);
                    var slideDeferred = this.slideCollectionMarkers();
                    slideDeferred.done(function () {
                        $currentFirstMarker.remove();
                        ribbonView.$firstCollectionMarker = ribbonView.$el.find('.first-collection-marker');
                    });
                }
            },

            /**
             * make a new first collection marker
             *
             * @private
             * @method createFirstCollectionMarker
             * @param $markerElement {Object} jquery Object to clone and place
             * @param previous {Boolean} whether the ribbon moving to previous collections
             * @return $markerElement {Object} the modified marker element
            **/
            createFirstCollectionMarker: function ($markerElement, previous) {
                var $newFirstMarker = $markerElement
                                        .clone()
                                        .addClass('first-collection-marker');

                if (previous === true) {
                    $newFirstMarker.removeClass('past-left-border');
                    this.$firstCollectionMarker.before($newFirstMarker);
                } else {
                    $markerElement.addClass('past-left-border');
                    $newFirstMarker.appendTo(this.$el);
                }

                return $markerElement;
            },

            /**
             * Handle moving the ribbon by units and animate
             *
             * @private
             * @method ribbonAnimation
             * @param unitsToMove {Integer} the number of units for shifting
            **/
            ribbonAnimation: function (unitsToMove, noAnimation) {
                var ribbonView = this;
                var currentLeftValue = this.$ribbonMenu.position().left;
                var newLeftValue, translateProperty, checkForMarkerActions;

                if (currentLeftValue === 0) {
                    currentLeftValue = this.collectionStoryWidth * 0.25;
                }

                newLeftValue = currentLeftValue + (unitsToMove * this.collectionStoryWidth);
                newLeftValue = this.handleRibbonEdges(newLeftValue);
                this.checkArrowsAgainstRibbonBoundaries(newLeftValue);

                if (noAnimation) {
                    if (!Modernizr.touch) {
                        return this.$ribbonMenu.css({left: newLeftValue});
                    } else {
                        return this.applyTranslateToRibbon(newLeftValue);
                    }
                } else {
                    if (!Modernizr.touch) {
                        checkForMarkerActions = _.throttle(function () {
                            if (unitsToMove < 0) {
                                ribbonView.pollShowingTabs();
                            } else {
                                ribbonView.pollHiddenCollections();
                            }
                        }, 75);

                        return this.$ribbonMenu
                                    .stop()
                                    .animate({
                                        left: newLeftValue
                                    }, {
                                        step: checkForMarkerActions
                                    })
                                    .promise();
                    } else {
                        return this.animateSwipe(newLeftValue);
                    }
                }
            },

            /**
             * encapsulates the animation for swiping
             *
             * @private
             * @method animateSwipe
             * @param newLeftValue {Integer}
             * @return {Object} a jquery promise for the animation
            **/
            animateSwipe: function (newLeftValue, options) {
                var ribbonView = this;
                if (!options) {
                    options = {
                        step: this.applyTranslateToRibbon
                    };
                }

                this.stopSwipeAnimation();
                this.$swipeAnimationElement = $({animateDummyProperty: ribbonView.returnXForTransform()});

                return this.$swipeAnimationElement.animate({
                            animateDummyProperty: newLeftValue
                        }, options)
                        .promise();

            },

            /**
             * see if the border contents are flush with the ribbon boundaries and turn off the appropriate arrow
             *
             * @private
             * @method checkArrowsAgainstRibbonBoundaries
             * @param ribbonLeftValue {Integer} the current or proposed value for $ribbonMenu's left position
            **/
            checkArrowsAgainstRibbonBoundaries: function (ribbonLeftValue) {

                if (ribbonLeftValue === this.$el.width() - this.getCollectionsWidth()) {
                    this.$nextArrow.addClass('inactive');
                } else if (ribbonLeftValue === 0) {
                    this.$previousArrow.addClass('inactive');
                }

            },

            /**
             * check if the end of the collection will be visible given a specific left value
             *
             * @private
             * @method testForCollectionEnd
             * @leftValueToTest {Number} desired left value
            **/
            testForCollectionEnd: function (leftValueToTest) {
                if (typeof leftValueToTest === 'undefined') {
                    leftValueToTest = this.$ribbonMenu.position().left;
                }
                return leftValueToTest + this.getCollectionsWidth() < this.$el.width();
            },

            /**
             * handle any actions the ribbon needs to take when it runs of out stories on either side
             *
             * @private
             * @method handleRibbonEdges
             * @param newLeftValue {Integer} the new proposed value of the collectionMenu's left property
             * @returns newLeftValue {Integer} any changes to the proposed value
            **/
            handleRibbonEdges: function (newLeftValue) {
                var leftInCollection;

                // make adjustments if it's scrolled back to the first item
                if (newLeftValue > 0) {
                    newLeftValue = 0;
                }

                // the total collection Width - the element width
                // how much is to the right of the left border
                if (this.testForCollectionEnd(newLeftValue)) {

                    if (this.collection.feedSource.length === 0) {
                        newLeftValue = this.$el.width() - this.getCollectionsWidth();
                    }
                }

                this.$el.toggleClass('ribbon-start', newLeftValue === 0);

                return newLeftValue;
            },


            /**
             * Determine how to position the ribbon when moving to the right
             *
             * @private
             * @method shiftRibbonRight
            **/
            shiftRibbonRight: function () {
                var ribbonView = this;
                var storyUnitsAvailable = this.storyUnitsInView();
                var ribbonDeferred = ribbonView.ribbonAnimation(storyUnitsAvailable);

                ribbonDeferred.done(function () {
                    //check one last time
                    ribbonView.pollHiddenCollections();
                    ribbonView.broadcast('nyt:ribbon-animation-finished');
                });
            },

            /**
             * Determine how to position the ribbon when moving to the left
             *
             * @private
             * @method shiftRibbonLeft
            **/
            shiftRibbonLeft: function () {
                var ribbonView = this;
                var storyUnitsAvailable = this.storyUnitsInView();
                var ribbonDeferred = this.ribbonAnimation(-storyUnitsAvailable);

                ribbonDeferred.done(function () {
                    if (ribbonView.testForCollectionEnd()) {
                        ribbonView.collection.loadFeed();
                    }
                    ribbonView.pollShowingTabs();
                    ribbonView.broadcast('nyt:ribbon-animation-finished');
                });
            },

            /**
             * Assign new HTML to the Object
             *
             * @private
             * @method assignSyncedHtmlToView
            **/
            assignSyncedHtmlToView: function () {
                this.$collectionMarkers = this.$ribbonMenu.find('.collection-marker');

                // create a first collection marker if there is none
                if (this.$el.find('.first-collection-marker').length === 0) {
                    this.createFirstCollectionMarker(this.$collectionMarkers.eq(0));
                }

                this.$firstCollectionMarker = this.$el.find('.first-collection-marker').eq(0);
            },

            /**
             * Update the content in the ribbon
             *
             * @private
             * @method updateCollectionValues
            **/
            updateCollectionValues: function () {
                var ribbonView = this;

                //truncate the headlines so the headline is only 48px tall
                this.$ribbonMenu.find('.story').each(function () {
                    var $el = $(this);
                    var $headline = $el.find('.story-heading');
                    //when there is no kicker, show 4 lines of text.
                    ribbonView.truncateText($headline, $el.find('.kicker').length ? 48 : 64);

                    //add a class when there are 4 lines of headline
                    $headline.toggleClass('long-story-heading', $headline.height() > 48);
                });
            },

            /**
             * checks to see if the mouse pointer location warrants a display of the nav arrows
             *
             * @private
             * @method checkForActiveNavigation
             * @param xPosition {Integer} mouse cursor x position
             * @param yPosition {Integer} mouse cursor y position
            **/
            checkForActiveNavigation: function (xPosition, yPosition) {
                var ribbonWidth = this.$el.width();
                var deadZoneBorderLeft = Math.ceil(0.4 * ribbonWidth);
                var deadZoneBorderRight = Math.ceil(0.6 * ribbonWidth);
                var leftIsActive = xPosition <= deadZoneBorderLeft;
                var rightIsActive = xPosition >= deadZoneBorderRight;
                var menuTop = this.$ribbonMenu.offset().top;
                var menuBottom = this.$ribbonMenu.height() + menuTop;
                var navigationContainerCss;

                if (leftIsActive) {
                    navigationContainerCss = {
                        left: '10px',
                        right: 'auto'
                    };
                } else if (rightIsActive) {
                    navigationContainerCss = {
                        left: 'auto',
                        right: '10px'
                    };
                }

                if (leftIsActive || rightIsActive) {
                    this.$ribbonNavigation.css(navigationContainerCss);
                    this.showRibbonArrows();
                } else {
                    this.hideRibbonArrows();
                }
            },

            /**
             * Resizes the ribbon based on a width calculated
             * in the getWidth method
             *
             * @private
             * @method resizeRibbon
            **/
            resizeRibbon: function () {
                this.$el.css('width', this.getWidth());
            },

            /**
             * Get the width that the ribbon should be set to
             * which is a combination of the shell width minus
             * the left margin of the ribbon
             *
             * @private
             * @method getWidth
             * @return {Number} the width value to set the ribbon to
            **/
            getWidth: function () {
                var marginLeft = parseInt(this.$el.css('margin-left'), 10);
                return this.$shell.width() - marginLeft;
            },

            /**
             * show the ribbon arrows
             *
             * @private
             * @method showRibbonArrows
            **/
            showRibbonArrows: function () {
                this.$ribbonNavigation.show();
            },

            /**
             * hide the ribbon arrows
             *
             * @private
             * @method hideRibbonArrows
            **/
            hideRibbonArrows: function () {
                if (this.$ribbonNavigation) {
                    this.$ribbonNavigation.hide();
                }
            },

            /**
             * return the width of all the collections that have been returned
             *
             * @private
             * @method getCollectionsWidth
            **/
            getCollectionsWidth: function () {
                return this.collection.length * this.collectionStoryWidth;
            },

            /**
             * This is an event handler that passes in a method
             * to animate the ribbon
             *
             * @private
             * @method moveRibbonForAlerts
             * @param animate {Function} A method to execute that will animate an element passed in
            **/
            moveRibbonForAlerts: function (animate) {
                this.disableRibbonToggle();
                animate(this.$el);
            },


            /**
             * Disable the ribbon toggling functionality
             *
             * @private
             * @method disableRibbonToggle
            **/
            disableRibbonToggle: function () {
                this.toggleDisabled += 1;
                this.revertRibbon();
            },

            /**
             * Sets the toggleDisabled property to false
             *
             * @private
             * @method enableRibbonToggle
            **/
            enableRibbonToggle: function () {
                this.toggleDisabled -= 1;
            },

            /**
             * Animate the ribbon stories on page load
             *
             * @private
             * @method animateRibbonStories
            **/
            animateRibbonStories: function ($collection) {
                var time = 200;
                var index = $collection.find('.active').index();
                index = index < 0 ? 0 : index;

                $collection.find('.collection-item')
                    .slice(index)
                    .css({
                        'opacity': 0,
                        'margin-left': this.animationDistance
                    }).each(function (index, element) {
                        time += 200;

                        $(this).animate({
                            'opacity': 1,
                            'margin-left': 0
                        }, time);
                    });
            },

            /**
             * Checks if the ribbon is visible and triggers an event
             * if the visibility of the ribbon has changed
             *
             * @private
             * @method checkRibbonVisibility
            **/
            checkRibbonVisibility: function () {
                var visible = this.pageManager.isComponentVisible(this.$el);
                if (visible !== this.isRibbonVisible) {
                    this.isRibbonVisible = visible;

                    /**
                     * Fired when there is a change in the ribbon view when scrolling
                     *
                     * @event nyt:ribbon-visiblility
                    **/
                    this.broadcast('nyt:ribbon-visiblility', visible);
                }
            },

            /**
             * Revert the ribbon to its original state
             *
             * @private
             * @method revertRibbon
            **/
            revertRibbon: function () {
                // return if the ribbon is already reverted
                if (!this.ribbonFixed) {
                    return;
                }

                this.ribbonFixed = false;
                this.$shell.css('padding-top', '');
                this.$el
                    .stop(true)
                    .css({
                        'position': '',
                        'margin-top': '',
                        'width': '',
                        'top': ''
                    });
            },

            /**
             * Slides the ribbon down in a fixed position and adds padding to
             * the shell element to fill the empty space
             *
             * @private
             * @method slideRibbonDown
            **/
            slideRibbonDown: function () {
                var ribbonDisplacement = this.ribbonHeight + this.ribbonMarginTop + this.ribbonMarginBottom;

                this.ribbonFixed = true;
                this.$shell.css('padding-top', ribbonDisplacement);
                this.$el.stop(true)
                    .css({
                        'position': 'fixed',
                        'margin-top': 0,
                        'width': this.getWidth(),
                        'top': -this.ribbonHeight
                    })
                    .animate({
                        'top' : this.mastheadHeight
                    }, this.speed);
            },

            /**
             * Slides the ribbon up and returns it to its original position
             *
             * @private
             * @method slideRibbonUp
            **/
            slideRibbonUp: function () {
                this.$el.stop(true).animate({
                    'top': -this.ribbonHeight
                }, this.speed, this.revertRibbon);
            },

            /**
             * Show or hide the ribbon depending on the speed of the scroll
             *
             * @private
             * @method toggleRibbon
             * @param top {Number} number of px between top of viewport and top of document
            **/
            toggleRibbon: function (scrollTop) {
                var styles;
                var atTop = scrollTop <= 0;
                var movingDown = scrollTop > this.oldScrollTop;
                var movingUp = scrollTop < this.oldScrollTop;
                var distance = Math.abs(scrollTop - this.oldScrollTop);

                // check if ribbon toggle behavior has been disabled
                if (this.toggleDisabled > 0) { return; }

                // revert the ribbon if the user
                // has reached the top of the page
                if (atTop) {
                    this.oldScrollTop = scrollTop;
                    this.revertRibbon();
                    return;
                }

                // check if user has moved down and the
                // ribbon is fixed to the top of the browser
                if (movingDown && this.ribbonFixed) {

                    // only hide ribbon if user has scrolled down a certain distance
                    if (distance < this.minDownDistance) { return; }

                    this.slideRibbonUp();
                    this.broadcast('nyt:ribbon-visiblility', false);

                // check if the user has moved up and
                // if the ribbon is not fixed to the browser
                } else if (movingUp && !this.ribbonFixed) {

                    // only hide ribbon if user has scrolled up at a certain speed
                    if (distance < this.minUpDistance) {
                        this.oldScrollTop = scrollTop;
                        return;
                    }

                    this.slideRibbonDown();
                    this.broadcast('nyt:ribbon-visiblility', true);
                }

                // store the scroll value to check in later
                // executions of this method
                this.oldScrollTop = scrollTop;
            },

            /**
            * Function to get the section currently in view in the ribbon
            *
            * @method getSectionInView
            * @return {String} the title of the section in view in the ribbon
            */
            getSectionInView: function () {
                return $.trim(this.$el.find('.first-collection-marker').text());
            },

            getCollectionByArticleElement: function ($elem) {
                return $.trim($elem.parents('.collection-menu').prev('.collection-marker').text());
            }

        })
    );

    return RibbonView;
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
