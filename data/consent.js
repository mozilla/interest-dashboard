"use strict";

let consentMenu = angular.module("consentMenu", ["ui.bootstrap"]);
consentMenu.controller("consentCtrl", function($scope, $modal) {
  self.port.on("message", message => {
    $scope.$apply(_ => {
      $scope.$broadcast(message.content.topic, message.content.data);
    });
  });

  $scope.dispatchBatch = null;

  /** UI functionality **/
  $scope.acceptStudy = function() {
    self.port.emit("survey_run");
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

  $scope.$on("dispatch_batch", function(evt, data) {
    if(data) {
      $scope.dispatchBatch = data;
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

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});
