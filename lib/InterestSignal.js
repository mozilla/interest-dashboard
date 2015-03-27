//Interest Signal Functionality
const {data} = require("sdk/self");
const {Cc,Ci} = require("chrome");
const {getMostRecentBrowserWindow} = require('sdk/window/utils');
let window = getMostRecentBrowserWindow();
let {PopupNotifications, gBrowser} = window;
var pageMod = require("sdk/page-mod");
let pref = "extensions.firefox.interest.dashboard@up.mozilla.allowInterests";
let branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
let message = [
	"This page would like to know your interests. ",
	"----------------------------------------------------",
	" Interests are high-level categories calculated from your recent browsing history and don't contain any personal details. If you share them, the site can show you more relevant content without having to track you."
]

function calculateInterestSignal() {
	//Calculates which categories the user is interested in
	//Returns an object
	//Currently shows sample data. 
	interests = {
		list: [
			["sports", "baseball", 0.7],
			["sports", "golf", 0.65],
			["technology & computing", "video games", 0.333]
		],
		object: {
			"sports": {
				"baseball": 0.7,
				"golf": 0.65,
			},
			"technology & computing": {
				"video games": 0.333
			}
		}
	}
	return interests
}

//Page Modifier that attaches the functionality to each page opened
pageMod.PageMod({
	include: ["*", "file://*"],
	
	contentScriptFile: data.url("InterestSignalWorker.js"),
	contentScriptWhen: 'ready',
	onAttach: function(worker) {
	
		//Add the window.navigator.interests.getInterests() function to the DOM when the window has loaded
		//This lets a developer request permissions
		worker.port.emit("addInterestsFunction", "");
		
		//Return a calculated interest signal upon success
		worker.port.on("requestInterestsObject", function(){
			dump('\nInterests Object Requested')
			worker.port.emit("addInterestsObject", calculateInterestSignal())
		})
		
		//If there's a request for interests data, pop up the permissions dialog
		worker.port.on("askForPermissions", function() {
			
			PopupNotifications.show(
				gBrowser.selectedBrowser,
				"firefox-interest-dashboard",
				message.join(""),
				null,
				{
					label: "Share Interests",
					accessKey: "S",
					callback: function(){
						worker.port.emit("permissionsRequestResult", true)
					}
				},
				[
					{
						label: "Always Share",
						accessKey: "A",
						callback: function(){
							worker.port.emit("permissionsRequestResult", true)
						}
					},
					{
						label: "Never Share",
						accessKey: "N",
						callback: function(){
							worker.port.emit("permissionsRequestResult", false)
						}
					}
				],
				{
					eventCallback: function(event){
						if (event === "dismissed"){
							worker.port.emit("permissionsRequestResult", false)
							window.PopupNotifications.remove(self);
						}
					},
					persistWhileVisible: true,
					popupIconURL: data.url("css/devmenu/resources/Analyze_Data-65x65.svg")
				}
			);
		})
	}
});






