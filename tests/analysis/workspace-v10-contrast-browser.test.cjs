'use strict';
/* Regression: V10 light editor placeholders must meet WCAG AA contrast.
 * Measure real computed Chromium styles, not only design tokens.
 * This preview test does not run the external AI model.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const {serve, chrome} = require('../pdf-browser.test.js');

const widths = [320, 390, 768, 1440];
const languages = ['en', 'ar'];
const sample = 'An engineering researcher recorded field measurements before reviewing the structural report.';

function parseCssColor(color) {
  const match = String(color).match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  assert(match, 'Unsupported computed CSS color: ' + color);
  return {rgb: match.slice(1, 4).map(Number), alpha: match[4] === undefined ? 1 : Number(match[4])};
}
function luminance(rgb) {
  const channels = rgb.map(v => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function ratio(foreground, background, opacity) {
  const fg = parseCssColor(foreground), bg = parseCssColor(background);
  const alpha = Math.max(0, Math.min(1, opacity * fg.alpha));
  const mixed = fg.rgb.map((v, i) => v * alpha + bg.rgb[i] * (1 - alpha));
  const a = luminance(mixed), b = luminance(bg.rgb);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
async function inspect(page, selector, mode = 'placeholder') {
  return page.$eval(selector, (el, mode) => {
    const style = getComputedStyle(el);
    const foregroundStyle = mode === 'placeholder' ? getComputedStyle(el, '::placeholder') : style;
    return {
      foreground: foregroundStyle.color,
      background: style.backgroundColor,
      opacity: Number(foregroundStyle.opacity),
      visible: !!el.getClientRects().length,
      placeholder: el.getAttribute('placeholder') || ''
    };
  }, mode);
}
async function run() {
  const server = serve();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({
    headless: true, executablePath: chrome,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const metrics = [], errors = [];
  try {
    for (const width of widths) {
      for (const lang of languages) {
        const page = await browser.newPage();
        try {
          page.on('pageerror', error => errors.push(error.message));
          await page.setViewport({width, height: width < 500 ? 844 : 900});
          await page.goto('http://127.0.0.1:' + server.address().port + '/?v10preview=1', {waitUntil: 'load'});
          if (lang === 'ar') await page.click('#language');
          assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
          assert.equal(await page.evaluate(() => document.body.classList.contains('tis-v10')), true);

          const input = await inspect(page, '#source');
          assert(input.visible, 'Source editor hidden at ' + width + '/' + lang);
          assert(input.placeholder, 'Source placeholder missing at ' + width + '/' + lang);
          const inputRatio = ratio(input.foreground, input.background, input.opacity);
          metrics.push({width, lang, control: 'source', ratio: Number(inputRatio.toFixed(2)),
            foreground: input.foreground, background: input.background});
          assert(inputRatio >= 4.5, 'Source placeholder below WCAG AA: ' + JSON.stringify(metrics.at(-1)));

          await page.$eval('#source', (element, text) => {
            element.value = text;
            element.dispatchEvent(new Event('input', {bubbles: true}));
          }, sample);
          const revision = await page.evaluate(() => window.TISAnalysisApp.session.read().revision);
          await page.evaluate(rev => {
            window.TISWorkspaceV10.setAnalysisState({
              status: 'RESEARCH_SIGNAL', revision: rev, requestId: 'contrast-only',
              evidence: {
                kind: 'RESEARCH_SIGNAL', revision: rev, documentCoverageWordsPercent: 25,
                segments: [{start: 0, end: 17, signal: 55, words: 3, tokens: 4}]
              }
            });
          }, revision);
          await page.click('#tisV10Improve');
          assert.equal(await page.evaluate(() => document.body.dataset.v10Screen), 'writing');

          const revised = await inspect(page, '#tisRevisedText', 'text');
          assert(revised.visible, 'Revised editor hidden at ' + width + '/' + lang);
          const revisedRatio = ratio(revised.foreground, revised.background, revised.opacity);
          metrics.push({width, lang, control: 'revised-text', ratio: Number(revisedRatio.toFixed(2)),
            foreground: revised.foreground, background: revised.background});
          assert(revisedRatio >= 4.5, 'Revised editor text below WCAG AA: ' + JSON.stringify(metrics.at(-1)));
          if (revised.placeholder) {
            const revisedPlaceholder = await inspect(page, '#tisRevisedText', 'placeholder');
            const placeholderRatio = ratio(revisedPlaceholder.foreground, revisedPlaceholder.background, revisedPlaceholder.opacity);
            metrics.push({width, lang, control: 'revised-placeholder', ratio: Number(placeholderRatio.toFixed(2)),
              foreground: revisedPlaceholder.foreground, background: revisedPlaceholder.background});
            assert(placeholderRatio >= 4.5,
              'Revised placeholder below WCAG AA: ' + JSON.stringify(metrics.at(-1)));
          }
          assert((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 8,
            'Unexpected horizontal overflow at ' + width + '/' + lang);
        } finally { await page.close(); }
      }
    }
    assert.deepEqual(errors, [], 'Browser JS exceptions in contrast regression');
    console.log('V10 computed placeholder contrast ' + JSON.stringify(metrics));
    console.log('PASS V10 computed CSS contrast: source placeholder and revised editor text, EN/AR at 320/390/768/1440px');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
