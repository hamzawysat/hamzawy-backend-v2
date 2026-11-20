'use strict';

/* Shared Arabic area/search matching, ported from hamzawy-app/src/utils/area-helpers.js. */
(function attachAreaSearch(global) {
  function normalizeAreaSearchText(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u064B-\u065F\u0670\u0640\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ؤ]/g, 'و')
      .replace(/[ئ]/g, 'ي')
      .replace(/[ى]/g, 'ي')
      .replace(/[ة]/g, 'ه')
      .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('ar-EG');
  }

  function isReservedAreaLabel(value) {
    const normalized = normalizeAreaSearchText(value).replace(/\s+/g, '');
    return normalized === normalizeAreaSearchText('جميع المناطق').replace(/\s+/g, '');
  }

  function areaSearchEditDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        rowMin = Math.min(rowMin, current[j]);
      }
      if (rowMin > limit) return limit + 1;
      previous = current;
    }
    return previous[b.length];
  }

  function areaMatchScore(value, query) {
    const words = normalizeAreaSearchText(value).split(' ').filter(Boolean);
    const terms = normalizeAreaSearchText(query).split(' ').filter(Boolean);
    if (!terms.length) return 0;
    let total = 0;
    for (const term of terms) {
      let best = Infinity;
      for (const word of words) {
        if (word.includes(term) || term.includes(word)) {
          best = Math.min(best, 0);
          continue;
        }
        if (Math.min(term.length, word.length) < 3) continue;
        const limit = term.length >= 7 ? 2 : 1;
        const distance = areaSearchEditDistance(term, word, limit);
        if (distance <= limit) best = Math.min(best, distance + 0.25);
      }
      if (!Number.isFinite(best)) return Infinity;
      total += best;
    }
    return total;
  }

  function matchesAreaSearch(value, query) {
    return areaMatchScore(value, query) !== Infinity;
  }

  function filterAreaOptions(options, query) {
    const source = Array.isArray(options) ? options : [];
    const normalizedQuery = normalizeAreaSearchText(query);
    return source
      .map((area, index) => ({ area, index, score: areaMatchScore(area, normalizedQuery) }))
      .filter(item => !isReservedAreaLabel(item.area) && Number.isFinite(item.score))
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .map(item => item.area);
  }

  const api = { normalizeAreaSearchText, matchesAreaSearch, filterAreaOptions };
  Object.assign(global, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
