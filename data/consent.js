"use strict";

let consentMenu = angular.module("consentMenu", ["ui.bootstrap", "gettext", "ngSanitize"]);

consentMenu.run(function (gettextCatalog) {
  var locale = navigator.language.replace("-", "_");
  gettextCatalog.currentLanguage = locale;
});

consentMenu.directive("compile", function($compile) {
  return function(scope, element, attrs) {
    scope.$watch(
      function(scope) {
        return scope.$eval(attrs.compile);
      },
      function(value) {
        element.html(value);
        $compile(element.contents())(scope);
      }
    );
  };
});
consentMenu.controller("consentCtrl", function($scope, $modal) {

  $scope.daysLeftStart = null;
  $scope.daysLeft = null;
  $scope.daysCompletion = 0;
  $scope.previewModal = null;

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
    $scope.previewModal = $modal.open({
      templateUrl: "dataPreview.html",
      controller: ModalPreviewCtrl,
      resolve: {
        dispatchBatch: function() {
          return $scope.dispatchBatch;
        }
      }
    });
    $scope.previewModal.result.then(function() {
      $scope.previewModal = null;
    });
  }

  $scope.openModalFAQ = function() {
    let modal = $modal.open({
      templateUrl: "faq.html",
      controller: ModalNoticeCtrl,
      resolve: {
        modalType: function() {
          return "faq";
        }
      }
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
      resolve: {
        modalType: function() {
          return "privacy";
        }
      }
    });
  }

  $scope.$on("dispatch_batch", function(evt, data) {
    if(data) {
      $scope.dispatchBatch = data;
    }
    if ($scope.previewModal) {
      $scope.previewModal.close();
      $scope.openModalPreview();
    }
  });

  $scope.$on("download_source", function(evt, data) {
    if(data.indexOf("testpilot") != -1) {
      $scope.origin_testpilot = true;
    }
  });

  $scope.$on("days_left", function(event, data) {
    if (!$scope.daysLeftStart) {
      $scope.daysLeftStart = data;
    }
    $scope.daysLeft = data;
    $scope.updateProgressBar();
  });

  $scope.updateProgressBar = function() {
    let elem = document.querySelector("#progressBar");
    let daysCompletion = (100 - Math.round($scope.daysLeft/$scope.daysLeftStart*100));
    elem.style.width = daysCompletion + "%";
    $scope.daysCompletion = daysCompletion;
  }
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

let ModalNoticeCtrl = function($scope, $modalInstance, modalType) {

  $scope.noticeBody = "";
  switch (modalType) {
    case "faq":
      $scope.noticeBody = angular.element(document.querySelector("#faqMarkup")).html();
      break;
    case "privacy":
      $scope.noticeBody = angular.element(document.querySelector("#privacyPolicyMarkup")).html();
      break;
  }

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

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});
