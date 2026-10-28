// SPA deep-link support: a static host that serves 404.html for unknown paths
// stores the requested path here and hands it back to the router.
(function () {
  try {
    var r = sessionStorage.getItem('hana-hrm-redirect');
    if (r) {
      sessionStorage.removeItem('hana-hrm-redirect');
      history.replaceState(null, '', r);
    }
  } catch (e) {}
})();
