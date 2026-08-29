import { ServerDatabase } from './db';
import { StoreKnowledge } from '../src/types';

export const KNOWLEDGE_SYSTEM_MARKER = '[STORE_KNOWLEDGE_CONTEXT]';

/**
 * Custom AI Knowledge Base & Store Trainer Engine
 *
 * Business owners train their bot without coding through the Custom AI Store Trainer:
 * product catalog & inventory, store policies (delivery, shipping, returns, refunds),
 * FAQ manager and a custom business persona. The trained context is rendered into a
 * compact system-prompt block that is dynamically injected into the Millisecond AI
 * Failover Engine, so bot replies across Facebook Messenger, WhatsApp and Telegram
 * accurately quote real product details, prices, stock and store policies.
 */
export class StoreKnowledgeEngine {
  public static getKnowledge(workspaceId = 'default'): StoreKnowledge {
    return ServerDatabase.getStoreKnowledge(workspaceId);
  }

  public static saveKnowledge(update: Partial<StoreKnowledge>, workspaceId = 'default'): StoreKnowledge {
    return ServerDatabase.saveStoreKnowledge(update, workspaceId);
  }

  /** Returns null when nothing has been trained yet — zero-break for unconfigured workspaces. */
  public static buildSystemPromptBlock(workspaceId = 'default'): string | null {
    const knowledge = ServerDatabase.getStoreKnowledge(workspaceId);
    const sections: string[] = [];

    if (knowledge.personaPrompt.trim()) {
      sections.push(`BUSINESS PERSONA & TONE (adopt this identity in every reply):\n${knowledge.personaPrompt.trim().slice(0, 1200)}`);
    }

    if (knowledge.products.length > 0) {
      const productLines = knowledge.products.slice(0, 60).map((product, index) => {
        const stock = product.stockStatus === 'in_stock' ? 'In Stock' : product.stockStatus === 'low_stock' ? 'Low Stock (limited quantity)' : 'Out of Stock';
        const specs = product.specs ? ` | Specs: ${product.specs}` : '';
        return `${index + 1}. ${product.name} — Price: ${product.price || 'contact store'}${specs} | Availability: ${stock}`;
      });
      sections.push(`PRODUCT CATALOG & INVENTORY (quote these exact details):\n${productLines.join('\n')}`);
    }

    const policyLines = [
      knowledge.policies.deliveryCharges && `Delivery Charges: ${knowledge.policies.deliveryCharges}`,
      knowledge.policies.shippingTime && `Shipping Time: ${knowledge.policies.shippingTime}`,
      knowledge.policies.returnPolicy && `Return Policy: ${knowledge.policies.returnPolicy}`,
      knowledge.policies.refundPolicy && `Refund Policy: ${knowledge.policies.refundPolicy}`,
    ].filter(Boolean);
    if (policyLines.length > 0) {
      sections.push(`STORE POLICIES (always answer using these exact terms):\n${policyLines.join('\n')}`);
    }

    if (knowledge.faqs.length > 0) {
      const faqLines = knowledge.faqs.slice(0, 40).map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`);
      sections.push(`FREQUENTLY ASKED QUESTIONS (use these answers when relevant):\n${faqLines.join('\n')}`);
    }

    if (sections.length === 0) return null;

    return [
      KNOWLEDGE_SYSTEM_MARKER,
      'You are the official AI sales assistant for this business. Follow the trained store context below in every reply.',
      sections.join('\n\n'),
      'When customers ask about products, prices, stock, delivery, shipping, returns, refunds or store FAQ, answer ONLY with the trained details above. If a specific detail is missing, say politely that the team will confirm shortly. Never invent prices or policies.',
    ].join('\n\n');
  }
}