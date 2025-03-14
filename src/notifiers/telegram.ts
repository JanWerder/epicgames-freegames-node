import axios from 'axios';
import logger from '../common/logger.js';
import { NotifierService } from './notifier-service.js';
import { TelegramConfig } from '../common/config/index.js';
import { NotificationReason } from '../interfaces/notification-reason.js';
import { OfferInfo } from '../interfaces/types.js';

export class TelegramNotifier extends NotifierService {
  private config: TelegramConfig;

  constructor(config: TelegramConfig) {
    super();

    this.config = config;
  }

  /**
   * @ignore
   */
  async sendNotification(account: string, reason: NotificationReason, url: string, offers?: OfferInfo[]): Promise<void> {
    const L = logger.child({ user: account, reason });
    L.trace('Sending telegram notification');

    let message = `epicgames-freegames-node\nreason: ${reason},\naccount: ${account}`;
    
    // Add game information if available and it's a purchase notification
    if (reason === NotificationReason.PURCHASE && offers && offers.length > 0) {
      message += '\n\nFree Games:';
      for (const offer of offers) {
        message += `\n- ${offer.productName}`;
        if (offer.tags && offer.tags.length > 0) {
          const tagNames = offer.tags.map(tag => tag.name).join(', ');
          message += `\n  Tags: ${tagNames}`;
        }
      }
    }
    
    message += `\nurl: [Click here](${url})`;
    
    // https://stackoverflow.com/a/60145565/5037239
    const escapedMessage = message.replace(
      /(\[[^\][]*]\(http[^()]*\))|[_*[\]()~>#+=|{}.!-]/gi,
      (x, y) => y || `\\${x}`,
    );
    const jsonPayload = {
      chat_id: this.config.chatId,
      text: escapedMessage,
      disable_web_page_preview: true,
      parse_mode: 'MarkdownV2',
    };

    L.trace({ jsonPayload }, 'Sending json payload');

    try {
      const apiUrl = this.config.apiUrl || 'https://api.telegram.org';
      
      // If there's a single game with a cover image, send it as a photo with caption
      if (reason === NotificationReason.PURCHASE && 
          offers && 
          offers.length === 1 && 
          offers[0] && 
          offers[0].coverImage) {
        const offer = offers[0];
        const caption = `epicgames-freegames-node\nreason: ${reason},\naccount: ${account}\n\nFree Game: ${offer.productName}`;
        
        // Add tags if available
        let captionWithTags = caption;
        if (offer.tags && offer.tags.length > 0) {
          const tagNames = offer.tags.map(tag => tag.name).join(', ');
          captionWithTags += `\nTags: ${tagNames}`;
        }
        
        // Add URL
        captionWithTags += `\n\nurl: [Click here](${url})`;
        
        // Escape special characters for MarkdownV2
        const escapedCaption = captionWithTags.replace(
          /(\[[^\][]*]\(http[^()]*\))|[_*[\]()~>#+=|{}.!-]/gi,
          (x, y) => y || `\\${x}`,
        );
        
        // Send photo with caption
        await axios.post(`${apiUrl}/bot${this.config.token}/sendPhoto`, {
          chat_id: this.config.chatId,
          photo: offer.coverImage,
          caption: escapedCaption,
          parse_mode: 'MarkdownV2',
        }, {
          responseType: 'json',
        });
      } 
      // If there are multiple games with cover images, send them as a media group
      else if (reason === NotificationReason.PURCHASE && 
               offers && 
               offers.length > 1 && 
               offers.some(offer => offer && offer.coverImage)) {
        
        // First send the text message with all game details
        await axios.post(`${apiUrl}/bot${this.config.token}/sendMessage`, jsonPayload, {
          responseType: 'json',
        });
        
        // Then send all game images as a media group
        const media = offers
          .filter(offer => offer && offer.coverImage)
          .map((offer, index) => ({
            type: 'photo',
            media: offer.coverImage,
            caption: index === 0 ? `Free Games from Epic Games Store` : undefined,
            parse_mode: index === 0 ? 'MarkdownV2' : undefined,
          }));
        
        if (media.length > 0) {
          await axios.post(`${apiUrl}/bot${this.config.token}/sendMediaGroup`, {
            chat_id: this.config.chatId,
            media: media,
          }, {
            responseType: 'json',
          });
        }
      } 
      else {
        // Send regular text message
        await axios.post(`${apiUrl}/bot${this.config.token}/sendMessage`, jsonPayload, {
          responseType: 'json',
        });
      }
    } catch (err) {
      L.error(err);
      L.error({ chatId: this.config.chatId }, `Failed to send message`);
      throw err;
    }
  }
}
