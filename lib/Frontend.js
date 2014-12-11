//Main frontend file
//Creates all the buttons, special url and inserts scripts/stylesheets.

const {Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm")
const {ActionButton} = require("sdk/ui/button/action");
const tabs = require("sdk/tabs");
const {data} = require("sdk/self");
const {Factory, Unknown} = require("sdk/platform/xpcom");
const {Class} = require("sdk/core/heritage")
const {PageMod} = require("sdk/page-mod")

function DashboardFrontend(){
	//This function creates the dashboard frontend.
	//There are various stages here. We need to have a special about: url,
	//a button to open the dashboard, and there's lots of enforced separation
	//between the scripts, stylesheets and html. So we have to insert the js
	//and css files from here.
	//With js files this is fairly straightforward, we can include them with
	//contentScriptFile, but with css files it is a little trickier since
	//we have to create a worker which sends them over. 
	
	//create the pagemod
	//this is necessary because extension html files can't contain the <script> tag
	let page = PageMod({
		include: ["about:you"],
		contentScriptFile: [
			//Basic frameworks
			data.url("frontend/js/jquery.min.js"),
			data.url("frontend/js/angular.min.js"), 
			
			//Utilities
			data.url("frontend/js/html4-defs.js"),
			data.url("frontend/js/html-sanitizer.js"),
			
			//Layout
			data.url("frontend/js/bootstrap.min.js"),
			data.url("frontend/js/jquery.dataTables.min.js"),
			
			//Charting
			data.url("frontend/js/d3.v3.min.js"),
			data.url("frontend/js/nv.d3.min.js"),
			data.url("frontend/js/ChartManager.js"),
			
			//Dashboard Specific
			data.url("frontend/js/dashboard_worker_functionality.js"),
			data.url("frontend/js/InterestDashboard.js"),
		],
		onAttach: function(worker){
			//add the stylesheets to the page
			//Normally, these would just be included with <link> tags but the src has to be a
			//computed resource:// link. Which requires data.url(). So we create a worker
			//and send over the locations
			console.log('attaching stylesheets')
			worker.port.emit("insert_stylesheet", data.url("frontend/css/bootstrap.min.css"));
			worker.port.emit("insert_stylesheet", data.url("frontend/css/bootstrap-responsive.min.css"));
			worker.port.emit("insert_stylesheet", data.url("frontend/css/tutorial.css"));
			worker.port.emit("insert_stylesheet", data.url("frontend/css/jquery.dataTables.css"));
			worker.port.emit("insert_stylesheet", data.url("frontend/css/styles.css"));
			worker.port.emit("insert_stylesheet", data.url("frontend/css/nv.d3.min.css"));
			worker.port.emit("insert_stylesheet", data.url("http://code.cdn.mozilla.net/fonts/fira.css"));
		}
	})
	
	//create the about:you channel url
	let factory = Factory({
		contract: "@mozilla.org/network/protocol/about;1?what=you",
		Component: Class({
			extends: Unknown,
			interfaces: ["nsIAboutModule"],
			newChannel: function(uri) {
				let channel = Services.io.newChannel(data.url("frontend/about-you.html"), null, null);
				channel.originalURI = uri;
				return channel;
			},
			getURIFlags: function(uri) {
				return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
			}
		})
	})
	//create a button
	let button = ActionButton({
		id: "interest-dashboard",
		label: "Interest Dashboard",
		icon: data.url('frontend/img/ID_Icon_Static.png'),
		onClick: function() {
			tabs.open({
				url: "about:you",
			})
		}
	})
}

exports.DashboardFrontend = DashboardFrontend;