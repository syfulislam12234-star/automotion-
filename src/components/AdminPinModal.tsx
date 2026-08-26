import React, { useState } from 'react';
import { AuthService } from '../services/authService';
import { ShieldCheck, Lock, Unlock, AlertCircle, X } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string) => void;
  successMessage?: string;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onShowToast,
  successMessage = '🔓 Admin access verified: Code & Architecture Studio unlocked.',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    void AuthService.verifyAdminPassword(pin).then((authorized) => {
      if (authorized) {
        setIsSubmitting(false);
        setPin('');
        onSuccess();
        onShowToast(successMessage);
        onClose();
      } else {
        setIsSubmitting(false);
        setError('Administrator authorization failed.');
      }
    });
  };

  const handleKeypadClick = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative">
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Administrator authorization required</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Protected Area
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Verify administrator access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Secure administrator session</span>
            </div>
              <p className="text-slate-400 leading-relaxed">
              Administrator controls require the configured master password. Verification applies only to this active session.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Master password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter master password"
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl tracking-widest font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadClick(digit)}
                  className="py-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:bg-slate-800 hover:border-slate-700 text-slate-200 font-mono text-sm font-semibold transition active:scale-95 cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="py-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:bg-slate-800 text-slate-400 font-mono text-xs font-semibold transition cursor-pointer"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeypadClick('0')}
                className="py-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:bg-slate-800 hover:border-slate-700 text-slate-200 font-mono text-sm font-semibold transition active:scale-95 cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="py-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:bg-slate-800 text-slate-400 font-mono text-xs font-semibold transition cursor-pointer"
              >
                ⌫
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!pin || isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-cyan-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Verifying...</span>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Verify administrator access</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
