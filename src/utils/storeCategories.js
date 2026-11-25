'use strict';

function normalizeStoreCategoryName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function buildStoreCategories(products = [], configuredCategories = [], { includeEmpty = false } = {}) {
  const categories = new Map();
  (Array.isArray(configuredCategories) ? configuredCategories : []).forEach((entry) => {
    const name = normalizeStoreCategoryName(entry?.name);
    if (!name) return;
    const imageFileId = entry?.imageFileId ? String(entry.imageFileId) : null;
    const customImageUrl = imageFileId ? '/api/store/media/' + imageFileId : String(entry?.imageUrl || '').trim();
    categories.set(name, {
      name,
      imageUrl: customImageUrl,
      customImageUrl,
      imageFileId,
      fallbackImageUrl: '',
      productCount: 0,
      hasCustomImage: !!customImageUrl
    });
  });

  (Array.isArray(products) ? products : []).forEach((product) => {
    const name = normalizeStoreCategoryName(product?.category) || 'غير مصنف';
    if (!categories.has(name)) {
      categories.set(name, {
        name, imageUrl: '', customImageUrl: '', imageFileId: null,
        fallbackImageUrl: '', productCount: 0, hasCustomImage: false
      });
    }
    const category = categories.get(name);
    category.productCount += 1;
    if (!category.fallbackImageUrl) {
      category.fallbackImageUrl = product?.imageFileId
        ? '/api/store/media/' + String(product.imageFileId)
        : String(product?.imageUrl || '').trim();
    }
  });

  return Array.from(categories.values())
    .filter(category => includeEmpty || category.productCount > 0)
    .map(category => ({
      ...category,
      imageUrl: category.customImageUrl || category.fallbackImageUrl || ''
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

module.exports = { normalizeStoreCategoryName, buildStoreCategories };
