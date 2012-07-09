/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011 the
 * Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const file = require("file");
const widgets = require("widget");
const tabs = require("tabs");
const request = require("request");
const timers = require("timers");
const windows = require("windows");
const simpleStorage = require("simple-storage");
const preferences = require("preferences-service");
const {PageMod} = require("page-mod");
const {data} = require("self");
const passwords = require("passwords");

const {Cc,Ci,Cm,Cr,Cu,components} = require("chrome");

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/PlacesUtils.jsm", this);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/Services.jsm", this);

const historyUtils = require("HistoryUtils");
const {Demographer} = require("Demographer");
const {GoogleMapper} = require("GoogleMapper");

function Profile() {
  let profile = this;

/***
  // not sure if we need that just yet
  Cm.registerFactory(
    AboutPancake.prototype.classID,
    AboutPancake.prototype.classDescription,
    AboutPancake.prototype.contractID,
    AboutPancakeFactory
  );
***/

  widgets.Widget({
    id: "profile",
    label: "Profile",
    contentURL: data.url("icon.png"),
    onClick: function() {
	    console.log("clicked");
	  profile.loadControls( );
    }
  });


  // create demographer
  this.demographer = new Demographer( "SiteToOdp.txt" , "demog2K.txt" );
  this.mapper = new GoogleMapper( "google.maps" , "google.apps" );

}

Profile.prototype = {

  loadControls: function ( ) {
  	  tabs.open( 
	    {
	  	  url: data.url( "profile.html"),
		  onReady: function ( tab ) {
  	  	        let worker = tab.attach({
    	 	   			contentScriptFile: [data.url("jquery-1.7.2.js"), data.url("profile.js")]
		  		});

			    function suggestApps( ) {
				   console.log( "getting apps" );
				   let apps = [];
				   for( let x=0; x < 3; x++) {
				   		apps.push( gProfile.mapper.suggest( ) );
				   }
				   worker.port.emit( "show_apps" , apps );
				};

				function loadData( ) {
				try {
						// compute Google Cats mapping
				    	gProfile.mapper.odpMap( gProfile.demographer.getInterests( ) );
						worker.port.emit( "show_controls" , gProfile.demographer.getTotalLimit( ) , 
															gProfile.demographer.getWeightFunctions( ) ,
															gProfile.demographer.getCurrentWeightFunction( ) ,
															gProfile.demographer.getCatDepth( )  ,
															gProfile.demographer.getFrecencyLimit( )  ,
															gProfile.demographer.getDayLimit( ) );

				   		worker.port.emit( "show_missing" , gProfile.demographer.getMissingSites( ) ); 
				   		worker.port.emit( "show_cats" , gProfile.demographer.getInterests( ) ,
						                                gProfile.demographer.getTotalAcross( ) ); 
				   		worker.port.emit( "show_demog" , gProfile.demographer.getDemographics( ) ); 
						worker.port.emit( "show_app_cats" , gProfile.mapper.getMappings( ));

						suggestApps( );

				} catch ( ex ) {
					console.log( "Error " + ex );
				}
			 };

			    worker.port.on( "donedoc" , loadData );
			    worker.port.on( "redo" , function( weightFunction , totalLimit , depth , frecency , days ) {
				    console.log( "REDOING +++++++++" );
					gProfile.demographer.setCurrentWeightFunction( weightFunction );
					gProfile.demographer.setTotalLimit( totalLimit );
					gProfile.demographer.setCatDepth( depth );
					gProfile.demographer.setFrecencyLimit( frecency );
					gProfile.demographer.setDayLimit( days );
					gProfile.demographer.rebuild( function() { loadData( ) ; });
				});

				worker.port.on( "getapps" , suggestApps );

		    },
	  	});
  },

  _debug: function(s) {
    if (this._trace) {
      console.debug(s);
    }
  },

};

const gProfile = new Profile();

exports.main = function(options, callbacks) {
  console.log(" in main ");
  gProfile._debug("Profile starting");
};

exports.onUnload = function(reason) {
/*** not sure we need it just yet
  gPancake.stop();
  Cm.unregisterFactory(
      AboutPancake.prototype.classID,
      AboutPancakeFactory
  );
  ***/
};

exports.getProfileForUnitTest = function() {
  return gProfile;
};
