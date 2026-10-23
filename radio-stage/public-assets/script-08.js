
/* Fudgie 2026-10-14 (corrected): Viewer's local time is PRIMARY, CT is the reference */
(function(){
  function initTzDisplay(){
    var viewerTz = 'America/Chicago';
    try {
      viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
    } catch(e) {}
    
    var isCentral = viewerTz === 'America/Chicago' || viewerTz === 'US/Central' || viewerTz === 'CST6CDT';
    
    // Get viewer's timezone abbreviation
    var tzAbbr = 'local';
    try {
      var parts = new Intl.DateTimeFormat('en-US', {timeZone: viewerTz, timeZoneName: 'short'}).formatToParts(new Date());
      for(var i = 0; i < parts.length; i++){
        if(parts[i].type === 'timeZoneName'){ tzAbbr = parts[i].value; break; }
      }
    } catch(e) {}
    
    // Update the "ALL TIMES CENTRAL" heading for non-Central viewers
    if(!isCentral){
      var headings = document.querySelectorAll('.calendar-rail, .upcoming-shows h2, .upcoming-shows .corner-eyebrow');
      for(var h=0; h<headings.length; h++){
        var ht = headings[h].textContent || '';
        if(ht.indexOf('ALL TIMES CENTRAL') !== -1){
          headings[h].textContent = ht.replace('ALL TIMES CENTRAL', 'ALL TIMES ' + tzAbbr.toUpperCase());
        }
      }
      // Also check for standalone heading elements
      var allEls = document.querySelectorAll('*');
      for(var k=0; k<allEls.length; k++){
        if(allEls[k].childNodes.length === 1 && allEls[k].childNodes[0].nodeType === 3){
          var t = allEls[k].textContent || '';
          if(t.trim() === 'ALL TIMES CENTRAL'){
            allEls[k].textContent = 'ALL TIMES ' + tzAbbr.toUpperCase();
          }
        }
      }
    }

    var events = document.querySelectorAll('a.show-event[data-start]');
    for(var i = 0; i < events.length; i++){
      var el = events[i];
      var iso = el.getAttribute('data-start');
      if(!iso) continue;
      if(el.getAttribute('data-tz-done') === '1') continue;
      
      try {
        var d = new Date(iso);
        
        // Viewer's local time (PRIMARY display)
        var localTime = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true, timeZone: viewerTz
        }).format(d);
        
        // Central time (reference)
        var ctTime = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago'
        }).format(d);
        
        var timeDiv = el.querySelector('.show-event-time');
        if(timeDiv){
          el.setAttribute('data-tz-done', '1');
          if(isCentral){
            // Central viewer: just show CT (unchanged from original)
            // Already displays correctly, no change needed
          } else {
            // Non-Central viewer: local time primary, CT as reference below
            // Replace the time display content
            timeDiv.innerHTML = localTime + ' <small>' + tzAbbr + '</small>' +
              '<div class="show-event-ct-ref" style="font-size:0.75em;opacity:0.85;margin-top:2px;">' +
              ctTime + ' CT</div>' +
              '<span aria-hidden="true"> \u2197</span>';
          }
        }
        
        // Update aria-label for accessibility
        var label = el.getAttribute('aria-label') || '';
        if(label && !isCentral && label.indexOf('your time') === -1){
          el.setAttribute('aria-label', label + ' (' + localTime + ' ' + tzAbbr + ' your time)');
        }
      } catch(e) {}
    }
  }
  
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initTzDisplay);
  } else {
    initTzDisplay();
  }
})();