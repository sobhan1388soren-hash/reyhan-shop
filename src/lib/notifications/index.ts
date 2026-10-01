// Notifications module — public API.

export { buildNotificationMessage } from "./templates";
export type { NotificationTemplateKey, TemplateInput } from "./templates";

export { sendNotificationMessage } from "./sender";
export type { NotificationResult } from "./sender";

export {
  sendOrderPlacedNotification,
  sendOrderPaidNotification,
  sendOrderShippedNotification,
  sendPriceDropNotification,
  sendBackInStockNotification,
} from "./service";
