'use strict';

const ADMIN_NOTIFICATION_CATEGORIES = Object.freeze([
  { key: 'client_registration', label: 'تسجيل عميل جديد', types: ['admin_new_client'] },
  { key: 'client_activity', label: 'دخول وخروج العميل', types: ['admin_client_login', 'admin_client_logout'] },
  { key: 'technician_registration', label: 'تسجيل فني جديد', types: ['admin_new_technician'] },
  { key: 'technician_activity', label: 'دخول وخروج الفني', types: ['admin_fanni_login', 'admin_fanni_logout'] },
  { key: 'technician_profile', label: 'تعديلات بيانات الفني', types: ['admin_fanni_profile_edit'] },
  { key: 'orders', label: 'الطلبات والعروض والتقييمات', types: ['admin_new_order', 'admin_order_offer_accepted', 'admin_order_cancelled', 'admin_order_completed', 'admin_fanni_offer', 'admin_price_change_requested', 'admin_client_rating'] },
  { key: 'store_orders', label: 'طلبات المتجر', types: ['admin_store_order'] },
  { key: 'subscriptions', label: 'الاشتراكات وتجديدها', types: ['admin_subscription_request', 'admin_subscription_renewed', 'admin_subscription_expiry'] },
  { key: 'password_recovery', label: 'استعادة كلمة المرور', types: ['admin_password_recovery', 'admin_password_recovery_message'] },
  { key: 'support_complaints', label: 'الدعم والشكاوى', types: ['admin_support_request', 'admin_support_followup', 'admin_new_complaint'] },
  { key: 'wallet_topups', label: 'طلبات شحن المحفظة', types: ['admin_new_topup', 'admin_client_topup'] },
  { key: 'service_payments', label: 'حجز قيمة الخدمة والمدفوعات', types: ['admin_service_payment_held'] }
]);

const ADMIN_NOTIFICATION_CATEGORY_KEYS = ADMIN_NOTIFICATION_CATEGORIES.map(item => item.key);
const ADMIN_NOTIFICATION_CATEGORY_BY_TYPE = new Map(
  ADMIN_NOTIFICATION_CATEGORIES.flatMap(category => category.types.map(type => [type, category.key]))
);

function adminNotificationCategoryForType(type) {
  return ADMIN_NOTIFICATION_CATEGORY_BY_TYPE.get(String(type || '')) || null;
}

function isAdminNotificationEnabled(type, preferences = {}) {
  const category = adminNotificationCategoryForType(type);
  if (!category) return true;
  return preferences?.[category] !== false;
}

module.exports = {
  ADMIN_NOTIFICATION_CATEGORIES,
  ADMIN_NOTIFICATION_CATEGORY_KEYS,
  adminNotificationCategoryForType,
  isAdminNotificationEnabled
};
