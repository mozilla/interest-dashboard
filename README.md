Firefox Interest Dashboard
==========================

Complete refactor of the code.

__/lib__
* main.js - handler file that gets called at the start
* Frontend.js - builds the frontend
* Functionality.js - functionality for the frontend, that isn't included in any workers
* LICA.js - code for the current LICA algorithm used to classify things
* Pipeline.js - algorithm testing
* Utils.js - useful auxiliary functions used everywhere
* /streams - currently unclear exactly what this does but it is essential for the frontend to load. Hoping to refactor this

__/data__
* about-you.html - the HTML file for the dashboard page. Built using AngularJS
* /img
* /js
 * InterestDashboard.js - I think this generates charts. Needs to be cleaned up. 
 * dashboard_worker_functionality.js - performs some of the functionality on the dashboard that requires workers. 
* /css


Add-on Page: https://addons.mozilla.org/firefox/addon/firefox-interest-dashboard/

File bugs at https://bugzilla.mozilla.org/enter_bug.cgi?product=Content%20Services&component=Interest%20Dashboard

Build with Add-on SDK
