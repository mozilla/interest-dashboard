"use strict";

let consentMenu = angular.module("consentMenu", ["ui.bootstrap"]);
consentMenu.controller("consentCtrl", function($scope, $modal) {
  self.port.on("message", message => {
    $scope.$apply(_ => {
      $scope.$broadcast(message.content.topic, message.content.data);
    });
  });

  $scope.dispatchBatch = null;
  $scope.origin_testpilot = false;

  /** UI functionality **/
  $scope.acceptStudy = function() {
    self.port.emit("consented");
  }

  $scope.rejectStudy = function() {
    self.port.emit("uninstall");
  }

  $scope.openModalPreview = function() {
    let modal = $modal.open({
      templateUrl: "dataPreview.html",
      controller: ModalPreviewCtrl,
      resolve: {
        dispatchBatch: function() {
          return $scope.dispatchBatch;
        }
      }
    });
  }

  $scope.openModalFAQ = function() {
    let modal = $modal.open({
      templateUrl: "faq.html",
      controller: ModalNoticeCtrl,
    });

    modal.result.then(function(result) {
      // the FAQ may open other modals
      if (result && result.message == "openModal") {
        if (result.type == "preview") {
          $scope.openModalPreview();
        }
        else if (result.type == "privacy") {
          $scope.openModalPrivacyPolicy();
        }
      }
    });
  }

  $scope.openModalPrivacyPolicy = function() {
    let modal = $modal.open({
      templateUrl: "privacy-policy.html",
      controller: ModalNoticeCtrl,
    });
  }

  $scope.$on("dispatch_batch", function(evt, data) {
    if(data) {
      $scope.dispatchBatch = data;
    }
  });

  $scope.$on("download_source", function(evt, data) {
    if(data.indexOf("testpilot") != -1) {
      $scope.origin_testpilot = true;
    }
  });
});

let ModalPreviewCtrl = function($scope, $modalInstance, dispatchBatch) {
  $scope.dispatchBatch = dispatchBatch;
  $scope.prettified = false;

  $scope.done = function() {
    $modalInstance.close();
  }

  $scope.selectText = function() {
    let elem = document.querySelector("#previewText");
    if (elem) {
      let range = document.createRange();
      let sel = window.getSelection();
      range.selectNodeContents(elem);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

let ModalNoticeCtrl = function($scope, $modalInstance) {
  $scope.done = function() {
    $modalInstance.close();
  }

  $scope.switchToPreview = function() {
    $modalInstance.close({message: "openModal", type: "preview"});
  }

  $scope.switchToPrivacyPolicy = function() {
    $modalInstance.close({message: "openModal", type: "privacy"});
  }
}

angular.bootstrap(document, ['consentMenu']);

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});
