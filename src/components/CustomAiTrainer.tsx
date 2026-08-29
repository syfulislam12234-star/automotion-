import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrainCircuit, Save, Plus, Trash2, Package, HelpCircle, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import { AuthService } from '../services/authService';
import { KnowledgeProduct, KnowledgeFaq, StorePolicyInfo, StoreKnowledge } from '../types';

interface CustomAiTrainerProps {
  onShowToast: (msg: string) => void;
}

const EMPTY_POLICIES: StorePolicyInfo = {
  deliveryCharges: '',
  shippingTime: '',
  returnPolicy: '',
  refundPolicy: '',
};

const STOCK_OPTIONS: { value: KnowledgeProduct['stockStatus']; label: string }[] = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

const STOCK_STYLES: Record<KnowledgeProduct['stockStatus'], string> = {
  in_stock: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  low_stock: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  out_of_stock: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export const CustomAiTrainer: React.FC<CustomAiTrainerProps> = ({ onShowToast }) => {
  const [personaPrompt, setPersonaPrompt] = useState<string>('');
  const [policies, setPolicies] = useState<StorePolicyInfo>(EMPTY_POLICIES);
  const [products, setProducts] = useState<KnowledgeProduct[]>([]);
  const [faqs, setFaqs] = useState<KnowledgeFaq[]>([]);
  const [productDraft, setProductDraft] = useState({
    name: '',
    price: '',
    specs: '',
    stockStatus: 'in_stock' as KnowledgeProduct['stockStatus'],
  });
  const [faqDraft, setFaqDraft] = useState({ question: '', answer: '' });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const toastRef = useRef(onShowToast);

  useEffect(() => {
    toastRef.current = onShowToast;
  }, [onShowToast]);

  const authHeaders = useCallback((): Record<string, string> => {
    const session = AuthService.getCurrentSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadKnowledge = async () => {
      try {
        const res = await fetch('/api/crm/knowledge', { headers: authHeaders() });
        const data = await res.json().catch(() => null);
        if (!mounted || !res.ok || !data?.success) return;
        const knowledge = data.knowledge as Partial<StoreKnowledge> | undefined;
        setPersonaPrompt(knowledge?.personaPrompt ?? '');
        setPolicies({ ...EMPTY_POLICIES, ...(knowledge?.policies ?? {}) });
        setProducts(Array.isArray(knowledge?.products) ? knowledge.products : []);
        setFaqs(Array.isArray(knowledge?.faqs) ? knowledge.faqs : []);
        if (knowledge?.updatedAt) setLastSavedAt(knowledge.updatedAt);
      } catch {
        /* zero-break: the trainer simply starts empty until the server responds */
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void loadKnowledge();
    return () => {
      mounted = false;
    };
  }, [authHeaders]);

  const saveKnowledge = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/crm/knowledge', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ personaPrompt, products, faqs, policies }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setLastSavedAt(new Date().toISOString());
        toastRef.current('🧠 Store knowledge trained — injected into the Millisecond AI Failover Engine.');
      } else {
        toastRef.current(data?.message || '⚠️ Knowledge save failed.');
      }
    } catch {
      toastRef.current('⚠️ Knowledge save failed — connection error.');
    } finally {
      setIsSaving(false);
    }
  };

  const addProduct = () => {
    const name = productDraft.name.trim();
    if (!name) {
      toastRef.current('📦 Product name is required.');
      return;
    }
    setProducts((prev) => [
      ...prev,
      {
        id: `prd_${Date.now().toString(36)}`,
        name,
        price: productDraft.price.trim(),
        specs: productDraft.specs.trim(),
        stockStatus: productDraft.stockStatus,
      },
    ]);
    setProductDraft({ name: '', price: '', specs: '', stockStatus: 'in_stock' });
  };

  const addFaq = () => {
    const question = faqDraft.question.trim();
    const answer = faqDraft.answer.trim();
    if (!question || !answer) {
      toastRef.current('❓ Both question and answer are required.');
      return;
    }
    setFaqs((prev) => [...prev, { id: `faq_${Date.now().toString(36)}`, question, answer }]);
    setFaqDraft({ question: '', answer: '' });
  };

  const updatePolicy = (field: keyof StorePolicyInfo, value: string) => {
    setPolicies((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header */}
      <div className="p-3.5 bg-slate-950/70 rounded-xl border border-fuchsia-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-fuchsia-400" />
            <span className="font-bold text-slate-200 text-sm">🧠 Custom AI Store Trainer</span>
          </div>
          <button
            onClick={() => void saveKnowledge()}
            disabled={isSaving || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Training…' : 'Save & Train Bot'}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Train your bot without code — catalog, prices, stock, policies, FAQs and persona are injected into every AI reply across
          Messenger, WhatsApp and Telegram via the Millisecond Failover Engine.
          {lastSavedAt && <span className="text-emerald-400"> · Last trained {new Date(lastSavedAt).toLocaleString()}</span>}
        </p>
      </div>

      {/* Business Persona */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-fuchsia-500/20 space-y-1.5">
        <label className="text-[10px] font-semibold text-fuchsia-300">Business Persona / Custom System Prompt</label>
        <textarea
          rows={3}
          value={personaPrompt}
          onChange={(e) => setPersonaPrompt(e.target.value)}
          placeholder="e.g. You are 'StyleBD Fashion' — a friendly Dhaka-based fashion store assistant. Always reply warm, concise, and gently upsell bundles."
          className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white resize-none placeholder-slate-600"
        />
      </div>

      {/* Store Policies */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-emerald-500/20 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-200">Store Policies</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">Delivery Charges:</label>
            <input value={policies.deliveryCharges} onChange={(e) => updatePolicy('deliveryCharges', e.target.value)} placeholder="e.g. ৳60 inside Dhaka, ৳120 outside" className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Shipping Time:</label>
            <input value={policies.shippingTime} onChange={(e) => updatePolicy('shippingTime', e.target.value)} placeholder="e.g. 24-48h inside Dhaka, 3-5 days nationwide" className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Return Policy:</label>
            <input value={policies.returnPolicy} onChange={(e) => updatePolicy('returnPolicy', e.target.value)} placeholder="e.g. 7-day easy return, item unused" className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Refund Policy:</label>
            <input value={policies.refundPolicy} onChange={(e) => updatePolicy('refundPolicy', e.target.value)} placeholder="e.g. 100% refund within 3 days of return" className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white" />
          </div>
        </div>
      </div>
      {/* Product Catalog & Inventory */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-sky-500/20 space-y-2">
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold text-slate-200">Product Catalog &amp; Inventory ({products.length})</span>
        </div>
        {products.map((product, index) => (
          <div key={product.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/70 border border-slate-800">
            <span className="text-[10px] text-slate-500 w-5">{index + 1}.</span>
            <span className="flex-1 min-w-0 truncate text-slate-200">{product.name}</span>
            <span className="font-mono text-[10px] text-emerald-300">{product.price || '—'}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${STOCK_STYLES[product.stockStatus]}`}>
              {STOCK_OPTIONS.find((option) => option.value === product.stockStatus)?.label ?? 'In Stock'}
            </span>
            <button
              onClick={() => setProducts((prev) => prev.filter((item) => item.id !== product.id))}
              className="p-1 rounded bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
              title="Remove product"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          <input value={productDraft.name} onChange={(e) => setProductDraft((draft) => ({ ...draft, name: e.target.value }))} placeholder="Product name" className="flex-1 min-w-[120px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white" />
          <input value={productDraft.price} onChange={(e) => setProductDraft((draft) => ({ ...draft, price: e.target.value }))} placeholder="Price e.g. ৳1,250" className="w-28 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white" />
          <input value={productDraft.specs} onChange={(e) => setProductDraft((draft) => ({ ...draft, specs: e.target.value }))} placeholder="Specs (optional)" className="flex-1 min-w-[120px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white" />
          <select value={productDraft.stockStatus} onChange={(e) => setProductDraft((draft) => ({ ...draft, stockStatus: e.target.value as KnowledgeProduct['stockStatus'] }))} className="px-1.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white cursor-pointer">
            {STOCK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button onClick={addProduct} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold cursor-pointer">
            <Plus className="w-3 h-3" />Add
          </button>
        </div>
      </div>

      {/* FAQ Manager */}
      <div className="p-3 bg-slate-950/60 rounded-xl border border-amber-500/20 space-y-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-slate-200">FAQ Manager ({faqs.length})</span>
        </div>
        {faqs.map((faq) => (
          <div key={faq.id} className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-amber-200 text-[11px] font-semibold">Q: {faq.question}</span>
              <button
                onClick={() => setFaqs((prev) => prev.filter((item) => item.id !== faq.id))}
                className="p-1 rounded bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
                title="Remove FAQ"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="text-slate-300 text-[11px] break-words">A: {faq.answer}</div>
          </div>
        ))}
        <div className="space-y-1.5">
          <input value={faqDraft.question} onChange={(e) => setFaqDraft((draft) => ({ ...draft, question: e.target.value }))} placeholder="Customer question e.g. Do you deliver outside Dhaka?" className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white" />
          <div className="flex items-start gap-1.5">
            <textarea rows={2} value={faqDraft.answer} onChange={(e) => setFaqDraft((draft) => ({ ...draft, answer: e.target.value }))} placeholder="Official answer the bot must quote…" className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white resize-none" />
            <button onClick={addFaq} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold cursor-pointer">
              <Plus className="w-3 h-3" />Add
            </button>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-violet-500/20 bg-violet-950/20 text-[11px] text-violet-200">
        <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        <span>Trained context is auto-injected into the Millisecond AI Failover Engine — bot replies on all channels quote your exact products, prices, stock and policies.</span>
      </div>
    </div>
  );
};
