'use strict';

function normalizeArabicStoreSearch(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function storeSearchEditDistance(a, b, limit) {
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

function matchesArabicStoreSearch(product, query) {
  const normalizedQuery = normalizeArabicStoreSearch(query);
  if (!normalizedQuery) return true;
  const fields = ['name', 'category', 'description', 'details', 'offerText', 'type', 'subscriptionDuration'];
  const haystack = normalizeArabicStoreSearch(fields.map(key => product?.[key] || '').join(' '));
  if (!haystack) return false;
  if (haystack.includes(normalizedQuery)) return true;
  const words = haystack.split(' ');
  const terms = normalizedQuery.split(' ');
  return terms.every(term => words.some(word => {
    if (word.includes(term) || term.includes(word)) return true;
    if (term.length < 4 || word.length < 4) return false;
    return storeSearchEditDistance(term, word, term.length >= 7 ? 2 : 1) <= (term.length >= 7 ? 2 : 1);
  }));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeArabicStoreSearch, matchesArabicStoreSearch, storeSearchEditDistance };
}
