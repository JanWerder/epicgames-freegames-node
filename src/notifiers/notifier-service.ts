import { NotificationReason } from '../interfaces/notification-reason.js';
import { OfferInfo } from '../interfaces/types.js';

export abstract class NotifierService {
  abstract sendNotification(
    account: string,
    reason: NotificationReason,
    url: string,
    offers?: OfferInfo[],
  ): Promise<void>;
}
