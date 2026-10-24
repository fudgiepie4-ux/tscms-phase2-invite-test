
/* Fudgie 2026-10-14: Stats timestamp shows in viewer's timezone */
(function(){
  function updateStatsTz(){
    var el = document.getElementById('statsTimestampText');
    if(!el) return;
    // The stats were collected at this UTC time (Oct 14, 2026 4:55 PM CT = 21:55 UTC)
    var collectedUtc = new Date('2026-10-14T21:55:00Z');
    try {
      var viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
      var isCentral = viewerTz === 'America/Chicago' || viewerTz === 'US/Central';
      var formatted = new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZone: viewerTz, timeZoneName: 'short'
      }).format(collectedUtc);
      el.textContent = 'Stats last updated: ' + formatted;
    } catch(e) {
      // Keep the default CT text if timezone detection fails
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', updateStatsTz);
  } else {
    updateStatsTz();
  }
})();
