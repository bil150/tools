/* Boîte à rythmes : monte la boîte à rythmes commune (voir assets/js/musique/batterie.js) dans la page. */
(function () {
  'use strict';

  var M = window.Musique;
  M.Drums.mount(M.$('drumHost'));
})();
