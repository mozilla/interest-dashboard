//Functionality to control interest signal

//Initially, we just set navigator.interests to a function that can ask for permission for interests
//If permissions are granted, navigator.interests is set to an object containing them.

var success;
var error;

self.port.on("addInterestsObject", function(interestsObject) {
	// Alters the navigator.interests function to contain an object
	return cloneInto(success(interestsObject), unsafeWindow, {cloneFunctions: true})
});

self.port.on("permissionsRequestResult", function(result){
	//On the result from /lib
	if (result === true) {
		self.port.emit("requestInterestsObject")
	}else{
		return cloneInto(error(), unsafeWindow, {cloneFunctions: true})
	}
})

self.port.on("addInterestsFunction", function() {
	//Add the requestInterests function to navigator.interests in the dom
	
	var requestInterests = function(successCallback, errorCallback){
		return function(successCallback, errorCallback){
			success = successCallback
			error = errorCallback
			self.port.emit("askForPermissions")
		}
	}
	
	unsafeWindow.navigator.interests = cloneInto({}, unsafeWindow);
    unsafeWindow.navigator.interests.getInterests = cloneInto(requestInterests(success, error), unsafeWindow, {cloneFunctions: true});
});
