/* Safely map JSON spans to UI colors without trusting returned HTML.
 * Use this module only in your authenticated backend-served frontend.
 */
export const COLORS = Object.freeze({
  HIGH_AI_SIGNAL: 'red', UNCERTAIN_MIXED: 'yellow',
  LOW_AI_SIGNAL: 'green', UNASSESSED: 'gray',
});
export function renderMarkers(container, sourceText, segments) {
  container.replaceChildren();
  // Python indexes Unicode code points, while JS String.slice indexes UTF-16 units.
  // Array.from preserves correct offsets for emoji and supplementary characters.
  const codepoints = Array.from(sourceText);
  let pos = 0;
  for (const seg of [...segments].sort((a,b)=>a.start-b.start)) {
    if (!Number.isInteger(seg.start) || !Number.isInteger(seg.end) ||
        seg.start < pos || seg.end < seg.start || seg.end > codepoints.length) continue;
    container.append(document.createTextNode(codepoints.slice(pos,seg.start).join("")));
    const mark = document.createElement('mark');
    mark.className = 'tis-tier-' + (COLORS[seg.tier] || 'gray');
    mark.textContent = codepoints.slice(seg.start,seg.end).join("");
    const confidence = seg.ai_probability_percent === null
      ? 'No validated segment score'
      : 'Calibrated model signal: ' + seg.ai_probability_percent + '%; ' + seg.confidence_level;
    mark.setAttribute('aria-label', seg.tier + ' — ' + confidence);
    mark.title = confidence + '. Not proof of authorship.';
    container.append(mark);
    pos = seg.end;
  }
  container.append(document.createTextNode(codepoints.slice(pos).join("")));
}
