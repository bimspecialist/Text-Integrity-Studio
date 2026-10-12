/* Safely map JSON spans to UI colors without trusting returned HTML.
 * Use this module only in your authenticated backend-served frontend.
 */
export const COLORS = Object.freeze({
  HIGH_AI_SIGNAL: 'red', UNCERTAIN_MIXED: 'yellow',
  LOW_AI_SIGNAL: 'green', UNASSESSED: 'gray',
});
export function renderMarkers(container, sourceText, segments) {
  container.replaceChildren();
  let pos = 0;
  for (const seg of [...segments].sort((a,b)=>a.start-b.start)) {
    if (!Number.isInteger(seg.start) || !Number.isInteger(seg.end) ||
        seg.start < pos || seg.end < seg.start || seg.end > sourceText.length) continue;
    container.append(document.createTextNode(sourceText.slice(pos,seg.start)));
    const mark = document.createElement('mark');
    mark.className = 'tis-tier-' + (COLORS[seg.tier] || 'gray');
    mark.textContent = sourceText.slice(seg.start,seg.end);
    const confidence = seg.ai_probability_percent === null
      ? 'No validated segment score'
      : 'Calibrated model signal: ' + seg.ai_probability_percent + '%; ' + seg.confidence_level;
    mark.setAttribute('aria-label', seg.tier + ' — ' + confidence);
    mark.title = confidence + '. Not proof of authorship.';
    container.append(mark);
    pos = seg.end;
  }
  container.append(document.createTextNode(sourceText.slice(pos)));
}
