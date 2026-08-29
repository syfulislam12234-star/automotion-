import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Bot, UserCheck, Package, Inbox, ShoppingCart } from 'lucide-react';
import { AuthService } from '../services/authService';
import { CrmCustomer, CrmMessage, CrmOrderStatus, CrmAgentMode, CrmPlatform } from '../types';

interface EcommerceCrmHubProps {
  onShowToast: (msg: string) => void;
}

const ORDER_STATUSES: { value: CrmOrderStatus; label: string }[] = [
  { value: 'pending', label: '⏳ Pending' },
  { value: 'confirmed', label: '✅ Confirmed' },
  { value: 'shipped', label: '🚚 Shipped' },
  { value: 'delivered', label: '📦 Delivered' },
];

const PLATFORM_META: Record<CrmPlatform, { label: string; icon: string }> = {
  messenger: { label: 'Messenger', icon: '💬' },
  whatsapp: { label: 'WhatsApp', icon: '🟢' },
  telegram: { label: 'Telegram', icon: '✈️' },
};

const STATUS_STYLES: Record<CrmOrderStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  confirmed: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  shipped: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  delivered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const formatRelative = (iso?: string): string => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const EcommerceCrmHub: React.FC<EcommerceCrmHubProps> = ({ onShowToast }) => {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | CrmOrderStatus>('all');
  const [orderDraft, setOrderDraft] = useState({ productName: '', quantity: '1', amount: '' });
  const pollRef = useRef<number | null>(null);
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

  const loadCustomers = useCallback(async (announceFailures = false) => {
    try {
      const res = await fetch('/api/crm/customers', { headers: authHeaders() });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && Array.isArray(data.customers)) {
        setCustomers(data.customers);
      } else if (announceFailures) {
        toastRef.current(data?.message || '⚠️ CRM client list is currently unavailable.');
      }
    } catch {
      if (announceFailures) toastRef.current('⚠️ CRM connection failed — auto-retrying.');
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  const loadMessages = useCallback(async (customerId?: string | null) => {
    try {
      const query = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
      const res = await fetch(`/api/crm/messages${query}`, { headers: authHeaders() });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch {
      /* inbox refresh is best-effort; the next poll retries automatically */
    }
  }, [authHeaders]);

  const refreshAll = useCallback(async (announce = false) => {
    await loadCustomers(announce);
    await loadMessages(selectedCustomerId);
  }, [loadCustomers, loadMessages, selectedCustomerId]);

  useEffect(() => {
    void refreshAll(true);
    pollRef.current = window.setInterval(() => {
      void refreshAll(false);
    }, 15000);
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [refreshAll]);

  const updateCustomer = (customerId: string, patch: Partial<CrmCustomer>) => {
    setCustomers((prev) => prev.map((customer) => (customer.id === customerId ? { ...customer, ...patch } : customer)));
  };

  const setOrderStatus = async (customer: CrmCustomer, status: CrmOrderStatus) => {
    updateCustomer(customer.id, { orderStatus: status });
    try {
      const res = await fetch('/api/crm/customer/status', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ customerId: customer.id, status }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.customer) {
        updateCustomer(customer.id, data.customer);
      } else {
        toastRef.current(data?.message || '⚠️ Order status update failed.');
      }
    } catch {
      toastRef.current('⚠️ Order status update failed — connection error.');
    }
  };

  const setAgentMode = async (customer: CrmCustomer, mode: CrmAgentMode) => {
    updateCustomer(customer.id, { agentMode: mode });
    try {
      const res = await fetch('/api/crm/customer/mode', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ customerId: customer.id, mode }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.customer) {
        updateCustomer(customer.id, data.customer);
        toastRef.current(mode === 'human' ? '🙋 Human agent takeover active for this client.' : '🤖 AI autopilot resumed for this client.');
      } else {
        toastRef.current(data?.message || '⚠️ Agent mode update failed.');
      }
    } catch {
      toastRef.current('⚠️ Agent mode update failed — connection error.');
    }
  };

  const addOrder = async (customer: CrmCustomer) => {
    const productName = orderDraft.productName.trim();
    if (!productName) {
      toastRef.current('📦 Enter the purchased product name first.');
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch('/api/crm/customer/order', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          customerId: customer.id,
          productName,
          quantity: Number(orderDraft.quantity) || 1,
          amount: Number(orderDraft.amount) || 0,
          currency: 'USD',
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setOrderDraft({ productName: '', quantity: '1', amount: '' });
        toastRef.current('🛒 Purchase logged to the lead history.');
        await loadCustomers(false);
      } else {
        toastRef.current(data?.message || '⚠️ Could not log the purchase.');
      }
    } catch {
      toastRef.current('⚠️ Purchase logging failed — connection error.');
    } finally {
      setIsSending(false);
    }
  };

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const visibleCustomers = statusFilter === 'all' ? customers : customers.filter((customer) => customer.orderStatus === statusFilter);
  const platformCounts = customers.reduce<Record<string, number>>((acc, customer) => {
    acc[customer.platform] = (acc[customer.platform] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4 text-xs">
      {/* Header */}
      <div className="p-3.5 bg-slate-950/70 rounded-xl border border-emerald-500/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-200 text-sm">🛒 E-commerce CRM Hub</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Live</span>
          </div>
          <button
            onClick={() => void refreshAll(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['messenger', 'whatsapp', 'telegram'] as CrmPlatform[]).map((platform) => (
            <span key={platform} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
              {PLATFORM_META[platform].icon} {PLATFORM_META[platform].label}: {platformCounts[platform] ?? 0}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1">
            {(['all', 'pending', 'confirmed', 'shipped', 'delivered'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2 py-0.5 rounded-full text-[10px] capitalize border cursor-pointer ${
                  statusFilter === filter
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
                }`}
              >
                {filter}
              </button>
            ))}
          </span>
        </div>
      </div>

      {isLoading && customers.length === 0 ? (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/60 text-center text-slate-500">Loading CRM clients…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Clients column */}
          <div className="lg:col-span-3 space-y-2">
            {visibleCustomers.length === 0 && (
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 text-center text-slate-500">
                No clients yet. New Messenger / WhatsApp / Telegram conversations appear here automatically.
              </div>
            )}
            {visibleCustomers.map((customer) => {
              const isSelected = customer.id === selectedCustomerId;
              const isExpanded = customer.id === expandedHistoryId;
              return (
                <div
                  key={customer.id}
                  onClick={() => {
                    const nextId = isSelected ? null : customer.id;
                    setSelectedCustomerId(nextId);
                    void loadMessages(nextId);
                  }}
                  className={`p-2.5 rounded-xl border space-y-2 cursor-pointer transition-colors ${
                    isSelected ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{PLATFORM_META[customer.platform]?.icon ?? '💬'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-200 truncate">{customer.name || 'Unnamed client'}</div>
                      <div className="text-[10px] text-slate-500">
                        {PLATFORM_META[customer.platform]?.label ?? customer.platform} · active {formatRelative(customer.lastActiveAt)}
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border capitalize ${STATUS_STYLES[customer.orderStatus] ?? ''}`}>
                      {customer.orderStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={customer.orderStatus}
                      onChange={(e) => void setOrderStatus(customer, e.target.value as CrmOrderStatus)}
                      className="px-1.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-white cursor-pointer"
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                    <div className="flex rounded-lg overflow-hidden border border-slate-700">
                      <button
                        onClick={() => void setAgentMode(customer, 'ai')}
                        className={`flex items-center gap-1 px-2 py-1 text-[10px] cursor-pointer ${
                          customer.agentMode === 'ai' ? 'bg-violet-500/25 text-violet-300' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'
                        }`}
                      >
                        <Bot className="w-3 h-3" />AI
                      </button>
                      <button
                        onClick={() => void setAgentMode(customer, 'human')}
                        className={`flex items-center gap-1 px-2 py-1 text-[10px] cursor-pointer border-l border-slate-700 ${
                          customer.agentMode === 'human' ? 'bg-amber-500/25 text-amber-300' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'
                        }`}
                      >
                        <UserCheck className="w-3 h-3" />Human
                      </button>
                    </div>
                    <button
                      onClick={() => setExpandedHistoryId(isExpanded ? null : customer.id)}
                      className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px] cursor-pointer"
                    >
                      <Package className="w-3 h-3" />Orders ({customer.purchaseHistory?.length ?? 0})
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="space-y-2 border-t border-slate-800 pt-2" onClick={(e) => e.stopPropagation()}>
                      {(customer.purchaseHistory ?? []).length === 0 ? (
                        <div className="text-[10px] text-slate-500">No purchases logged yet.</div>
                      ) : (
                        (customer.purchaseHistory ?? []).map((order) => (
                          <div key={order.id} className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="truncate">📦 {order.productName} × {order.quantity ?? 1}</span>
                            <span className="font-mono text-slate-300">
                              {order.currency ?? 'USD'} {Number(order.amount ?? 0).toFixed(2)} · <span className="capitalize">{order.status}</span>
                            </span>
                          </div>
                        ))
                      )}
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          value={orderDraft.productName}
                          onChange={(e) => setOrderDraft((draft) => ({ ...draft, productName: e.target.value }))}
                          placeholder="Product purchased"
                          className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-white"
                        />
                        <input
                          value={orderDraft.quantity}
                          onChange={(e) => setOrderDraft((draft) => ({ ...draft, quantity: e.target.value }))}
                          title="Quantity"
                          className="w-12 px-1.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-white text-center"
                        />
                        <input
                          value={orderDraft.amount}
                          onChange={(e) => setOrderDraft((draft) => ({ ...draft, amount: e.target.value }))}
                          placeholder="$"
                          title="Amount"
                          className="w-16 px-1.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-white text-center"
                        />
                        <button
                          onClick={() => void addOrder(customer)}
                          disabled={isSending}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          Log
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Unified Live Inbox column */}
          <div className="lg:col-span-2 p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center gap-2">
              <Inbox className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-semibold text-slate-200">Unified Live Inbox</span>
              <span className="ml-auto text-[10px] text-slate-500 truncate">{selectedCustomer ? selectedCustomer.name : 'All channels'}</span>
            </div>
            <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-[11px]">
                  No messages yet. Incoming Messenger / WhatsApp / Telegram chats stream here in real time.
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-2 rounded-lg border text-[11px] ${
                      message.direction === 'inbound' ? 'bg-slate-900/80 border-slate-800' : 'bg-emerald-950/30 border-emerald-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span>{PLATFORM_META[message.platform]?.icon ?? '💬'}</span>
                      <span className="font-semibold text-slate-300 truncate">{message.customerName || 'Client'}</span>
                      <span className="ml-auto text-[9px] text-slate-500">{message.direction === 'inbound' ? '← received' : '→ replied'}</span>
                    </div>
                    <div className="text-slate-300 break-words">{message.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EcommerceCrmHub;
