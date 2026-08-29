import express from 'express';
import { ServerDatabase } from './db';
import { CrmOrderStatus, StoreKnowledge } from '../src/types';
import { MessengerService } from './messengerService';

const VALID_ORDER_STATUSES: CrmOrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered'];

/**
 * E-commerce Business Client CRM Hub routes + Messenger Profile APIs.
 * All routes are session-protected. Telegram/WhatsApp/YouTube/Gmail flows untouched.
 */
export function registerCrmRoutes(app: express.Express, requireSession: express.RequestHandler): void {
  // Unified live customer list (Messenger + WhatsApp + Telegram)
  app.get('/api/crm/customers', requireSession, (_req, res) => {
    try {
      return res.json({ success: true, customers: ServerDatabase.getCrmCustomers() });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'CRM customers unavailable.' });
    }
  });

  // Live inbox messages (optionally filtered by customer)
  app.get('/api/crm/messages', requireSession, (req, res) => {
    try {
      const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
      const limit = Number(req.query.limit) || 150;
      return res.json({ success: true, messages: ServerDatabase.getCrmMessages(customerId, limit) });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'CRM messages unavailable.' });
    }
  });

  // Order status tagging: Pending / Confirmed / Shipped / Delivered
  app.post('/api/crm/customer/status', requireSession, (req, res) => {
    try {
      const customerId = String(req.body?.customerId || '');
      const status = String(req.body?.status || '') as CrmOrderStatus;
      if (!VALID_ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be one of: pending, confirmed, shipped, delivered.' });
      }
      const customer = ServerDatabase.setCrmOrderStatus(customerId, status);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
      return res.json({ success: true, customer });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Status update failed.' });
    }
  });

  // Manual human-handover toggle (AI vs Human Agent mode)
  app.post('/api/crm/customer/mode', requireSession, (req, res) => {
    try {
      const customerId = String(req.body?.customerId || '');
      const mode = String(req.body?.mode || '') as 'ai' | 'human';
      if (mode !== 'ai' && mode !== 'human') {
        return res.status(400).json({ success: false, message: "Mode must be 'ai' or 'human'." });
      }
      const customer = ServerDatabase.setCrmAgentMode(customerId, mode);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
      return res.json({ success: true, customer });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Mode update failed.' });
    }
  });

  // Lead purchase history entry
  app.post('/api/crm/customer/order', requireSession, (req, res) => {
    try {
      const customerId = String(req.body?.customerId || '');
      const productName = String(req.body?.productName || '').trim();
      if (!productName) return res.status(400).json({ success: false, message: 'Product name is required.' });
      const order = ServerDatabase.addCrmOrder(customerId, {
        productName,
        quantity: Number(req.body?.quantity) || 1,
        amount: Number(req.body?.amount) || 0,
        currency: String(req.body?.currency || 'BDT'),
        status: VALID_ORDER_STATUSES.includes(req.body?.status) ? req.body.status : 'pending',
      });
      if (!order) return res.status(404).json({ success: false, message: 'Customer not found.' });
      return res.json({ success: true, order, customer: ServerDatabase.getCrmCustomer(customerId) });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Order creation failed.' });
    }
  });

  // Human-agent manual reply from the CRM live inbox
  app.post('/api/crm/customer/reply', requireSession, async (req, res) => {
    try {
      const customerId = String(req.body?.customerId || '');
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ success: false, message: 'Reply text is required.' });
      const customer = ServerDatabase.getCrmCustomer(customerId);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

      let delivered = false;
      if (customer.platform === 'messenger') {
        const config = MessengerService.resolveConfig();
        if (config.pageAccessToken) {
          delivered = await MessengerService.sendMessengerText(config, customer.platformUserId, text);
        }
      }
      ServerDatabase.addCrmMessage({
        customerId: customer.id,
        customerName: customer.name,
        platform: customer.platform,
        direction: 'outbound',
        text: text.slice(0, 2000),
      });
      return res.json({
        success: true,
        delivered,
        note: delivered ? undefined : 'Message recorded. Live delivery is active for Messenger pages with a Page Access Token.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Reply failed.' });
    }
  });

  // Custom AI Knowledge Base & Store Trainer storage
  app.get('/api/crm/knowledge', requireSession, (_req, res) => {
    try {
      return res.json({ success: true, knowledge: ServerDatabase.getStoreKnowledge('default') });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Knowledge base unavailable.' });
    }
  });

  app.post('/api/crm/knowledge', requireSession, (req, res) => {
    try {
      const body = req.body || {};
      const products = Array.isArray(body.products)
        ? body.products.slice(0, 200).map((product: any, index: number) => ({
          id: String(product?.id || `prd_${index}_${Date.now().toString(36)}`).slice(0, 64),
          name: String(product?.name || '').slice(0, 200),
          price: String(product?.price ?? '').slice(0, 60),
          specs: String(product?.specs ?? '').slice(0, 600),
          stockStatus: product?.stockStatus === 'low_stock' || product?.stockStatus === 'out_of_stock' ? product.stockStatus : 'in_stock',
        })).filter((product: { name: string }) => product.name)
        : [];
      const faqs = Array.isArray(body.faqs)
        ? body.faqs.slice(0, 100).map((faq: any, index: number) => ({
          id: String(faq?.id || `faq_${index}_${Date.now().toString(36)}`).slice(0, 64),
          question: String(faq?.question || '').slice(0, 400),
          answer: String(faq?.answer || '').slice(0, 1200),
        })).filter((faq: { question: string; answer: string }) => faq.question && faq.answer)
        : [];
      const knowledge: Partial<StoreKnowledge> = {
        personaPrompt: String(body.personaPrompt || '').slice(0, 2000),
        products,
        faqs,
        policies: {
          deliveryCharges: String(body?.policies?.deliveryCharges || '').slice(0, 400),
          shippingTime: String(body?.policies?.shippingTime || '').slice(0, 400),
          returnPolicy: String(body?.policies?.returnPolicy || '').slice(0, 400),
          refundPolicy: String(body?.policies?.refundPolicy || '').slice(0, 400),
        },
      };
      const saved = ServerDatabase.saveStoreKnowledge(knowledge, 'default');
      return res.json({ success: true, knowledge: saved, message: 'Store knowledge trained and injected into the AI failover engine.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Knowledge save failed.' });
    }
  });

  // Messenger Profile API sync (Get Started / Persistent Menu / Auto-Greeting)
  app.post('/api/messenger/profile-sync', requireSession, async (req, res) => {
    try {
      const override = (req.body?.config || {}) as Record<string, unknown>;
      const { results } = await MessengerService.syncMessengerProfile(override as any);
      return res.json({ success: true, results });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error?.message || 'Messenger profile sync failed.' });
    }
  });

  // Messenger integration status (no secret material returned)
  app.get('/api/messenger/status', requireSession, (_req, res) => {
    try {
      const config = MessengerService.resolveConfig();
      return res.json({
        success: true,
        status: {
          ...MessengerService.getStatus(),
          configured: Boolean(config.pageAccessToken),
          signatureVerificationActive: Boolean(config.appSecret),
          graphApiVersion: config.graphApiVersion,
          webhookCallbackUrl: '/api/webhooks/messenger',
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Messenger status unavailable.' });
    }
  });
}