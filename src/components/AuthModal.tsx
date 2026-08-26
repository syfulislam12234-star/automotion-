import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  KeyRound,
  Zap,
  Server,
  X,
  Send,
  Fingerprint,
  Check,
  Info,
} from 'lucide-react';
import { AuthService } from '../services/authService';
import { UserAccount, AuthSession } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  isGateMode?: boolean; // When true, acts as the full-screen mandatory entrance gate
  initialTab?: 'login' | 'signup' | 'verify';
  onAuthenticated: (session: AuthSession) => void;
  onShowToast: (msg: string) => void;
  featureProtectedName?: string; // Optional context like "Admin Control Panel" or "VPS Manager"
  isAdminPortal?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  isGateMode = false,
  initialTab = 'login',
  onAuthenticated,
  onShowToast,
  featureProtectedName,
  isAdminPortal = false,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'verify'>(initialTab);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign up form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // OTP Verification state
  const [verifyEmail, setVerifyEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [lastGeneratedOtp, setLastGeneratedOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Reset states when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialTab]);

  // Resend cooldown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown(c => c - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!loginEmail.trim() || !loginEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await AuthService.logIn({ email: loginEmail, password: loginPassword });
      setIsLoading(false);

      if (res.requiresVerification && res.unverifiedUser) {
        setVerifyEmail(res.unverifiedUser.email);
        setLastGeneratedOtp(res.unverifiedUser.verificationCode || null);
        setActiveTab('verify');
        setErrorMessage(res.message);
        onShowToast('⚠️ Please verify your 6-digit email code to continue.');
        return;
      }

      if (!res.success || !res.session) {
        setErrorMessage(res.message);
        return;
      }

      if (isAdminPortal && res.session.user.role !== 'admin') {
        setErrorMessage('This portal is restricted to administrator accounts.');
        return;
      }

      setSuccessMessage(res.message);
      onShowToast(`🎉 ${res.message}`);
      onAuthenticated(res.session);
      if (onClose) onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Login error occurred.');
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    if (isAdminPortal) {
      setErrorMessage('Use the verified administrator email and password for this portal.');
      return;
    }
    setIsGoogleLoading(true);
    try {
      const result = await AuthService.signInWithGoogle();
      if (!result.success || !result.session) {
        setErrorMessage(result.message);
        return;
      }
      onShowToast(`Welcome, ${result.session.user.name}.`);
      onAuthenticated(result.session);
      if (onClose) onClose();
    } catch (error: any) {
      setErrorMessage(error?.code === 'auth/popup-closed-by-user' ? 'Google sign-in was cancelled.' : 'Google sign-in failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Handle Sign Up submission with Instant Automated Verification & Login
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!signupName.trim()) {
      setErrorMessage('Please enter your full name or developer handle.');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (signupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-type your password.');
      return;
    }
    if (!agreeTerms) {
      setErrorMessage('Please agree to the Security & Usage Guidelines.');
      return;
    }

    setIsLoading(true);
    try {
      const res = isAdminPortal
        ? await AuthService.adminSignUp({ name: signupName, email: signupEmail, password: signupPassword })
        : await AuthService.signUp({ name: signupName, email: signupEmail, password: signupPassword });
      setIsLoading(false);

      if (isAdminPortal && res.pending) {
        setVerifyEmail(res.email || signupEmail);
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(60);
        setActiveTab('verify');
        setSuccessMessage(res.message);
        return;
      }

      if (!res.success || !res.user) {
        setErrorMessage(res.message);
        return;
      }

      // Automated Instant Verification & Immediate Login
      if (res.session) {
        onShowToast(`🎉 Welcome, ${res.user.name}! Your account has been verified instantly.`);
        onAuthenticated(res.session);
        if (onClose) onClose();
        return;
      }

      // Fallback in case manual verification was flagged
      setVerifyEmail(res.user.email);
      setLastGeneratedOtp(res.verificationCode || null);
      setResendCooldown(60);
      setActiveTab('verify');
      setSuccessMessage(res.message);
      onShowToast('📩 Verification code sent! Please verify your email.');
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Sign up error occurred.');
    }
  };

  // Handle OTP digit changes
  const handleOtpChange = (index: number, val: string) => {
    // If pasted multi-character text
    if (val.length > 1) {
      const cleaned = val.replace(/\D/g, '').slice(0, 6);
      if (cleaned.length > 0) {
        const nextDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          nextDigits[i] = cleaned[i] || '';
        }
        setOtpDigits(nextDigits);
        const nextFocus = Math.min(cleaned.length, 5);
        otpInputRefs.current[nextFocus]?.focus();
      }
      return;
    }

    const singleDigit = val.replace(/\D/g, '');
    const nextDigits = [...otpDigits];
    nextDigits[index] = singleDigit;
    setOtpDigits(nextDigits);

    // Auto move to next input if digit entered
    if (singleDigit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle OTP Verification submission
  const handleVerifySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMessage('Please enter all 6 digits of your verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = isAdminPortal
        ? await AuthService.verifyAdminSignUp(verifyEmail, fullCode)
        : await AuthService.verifyEmailCode(verifyEmail, fullCode);
      setIsLoading(false);

      if (!res.success || !res.session) {
        setErrorMessage(res.message);
        return;
      }

      setSuccessMessage(res.message);
      onShowToast(`✅ ${res.message}`);
      onAuthenticated(res.session);
      if (onClose) onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Verification error occurred.');
    }
  };

  // Resend verification code handler
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      if (isAdminPortal) {
        setErrorMessage('Please start a new administrator registration to request another code.');
        return;
      }
      const res = await AuthService.resendVerificationCode(verifyEmail);
      if (res.success && res.code) {
        setLastGeneratedOtp(res.code);
        setResendCooldown(60);
        setSuccessMessage(`New code generated: ${res.code}`);
        onShowToast(`📬 New verification code sent to ${verifyEmail}`);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend code');
    }
  };

  // Quick autofill demo OTP
  const handleAutofillDemoOtp = () => {
    const code = lastGeneratedOtp;
    if (!code) return;
    const digits = code.split('').slice(0, 6);
    setOtpDigits(digits);
    setSuccessMessage(`Code ${code} filled into boxes! Click "Verify & Launch".`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-200 ring-1 ring-white/10 flex flex-col max-h-[94vh]">
        {/* Top Header Banner */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 border-b border-slate-800/80 shrink-0">
          {!isGateMode && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
              <Fingerprint className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white tracking-tight">
                  Security Gateway & Access Portal
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  SSL Secured
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {featureProtectedName ? (
                  <span className="text-amber-300/90 font-medium">
                    Authentication required to access {featureProtectedName}.
                  </span>
                ) : (
                  'Sign in or verify your developer credentials to manage cloud bots.'
                )}
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Log In vs Sign Up vs Verification) */}
          <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-2xl border border-slate-800/80 mt-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-slate-800 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-slate-800 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
                <span>{isAdminPortal ? 'Admin Sign Up' : 'Sign Up'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('verify');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'verify'
                  ? 'bg-slate-800 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Verify OTP</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Alerts Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* TAB 1: LOG IN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={isGoogleLoading || isLoading}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {isGoogleLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-sm font-black text-blue-600">G</span>}
                <span>{isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
              </button>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-600"><span className="h-px flex-1 bg-slate-800" /><span>or account login</span><span className="h-px flex-1 bg-slate-800" /></div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Email Address</span>
                  <span className="text-[10px] text-slate-500 font-normal">Registered Account</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyEmail(loginEmail);
                      setActiveTab('verify');
                      setSuccessMessage('Enter your 6-digit OTP code to verify credentials.');
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Forgot / Verify OTP?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Keep me logged in on this browser</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Log In & Enter Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>
          )}

          {/* TAB 2: SIGN UP */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Full Name / Organization</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Syful Islam"
                    className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
              </div>


              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="user@groqbot.io"
                    className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Password</label>
                  <div className="relative">
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition font-mono"
                    />
                  </div>
                </div>
              </div>


              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Instant automated verification enabled: no manual email link confirmation required.</span>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span>I accept secure token session persistence & usage terms</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating & Verifying Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account & Instant Log In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: 6-DIGIT OTP VERIFICATION GATE */}
          {activeTab === 'verify' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  <Send className="w-4 h-4 text-indigo-400" />
                  <span>Security Verification Step</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter the 6-digit confirmation code for <strong>{verifyEmail || loginEmail}</strong> to activate your session.
                </p>
                {lastGeneratedOtp && (
                  <div className="pt-2 flex items-center justify-between bg-indigo-950/60 p-2 rounded-xl border border-indigo-500/30">
                    <div className="text-xs font-mono text-indigo-200">
                      Simulated OTP: <strong className="text-amber-400">{lastGeneratedOtp}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutofillDemoOtp}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[11px] font-bold transition cursor-pointer"
                    >
                      Autofill Code
                    </button>
                  </div>
                )}
              </div>

              {/* 6-digit Pin Box Inputs */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block text-center">
                  Enter 6-Digit Code
                </label>
                <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={idx === 0 ? 6 : 1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono font-bold text-white bg-slate-950 border-2 border-slate-700 rounded-xl focus:border-cyan-400 focus:bg-slate-900 focus:outline-none transition shadow-inner"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Didn't get the code?</span>
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResendCode}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleVerifySubmit()}
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify & Launch Workspace</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Info */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Session persistence active in local storage</span>
          </div>
          <span className="font-mono">v3.4 SSL</span>
        </div>
      </div>
    </div>
  );
};
