import React, { useState } from 'react';
import { BotConfig } from '../types';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Rocket,
  Layers,
  Shield,
  Bot,
  Terminal,
  Server,
  Cpu,
} from 'lucide-react';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({
  isOpen,
  onClose,
  config,
}) => {
  const [platformTab, setPlatformTab] = useState<
    'platforms_setup' | 'koyeb' | 'hf' | 'fly' | 'railway' | 'zeabur_replit' | 'oracle_vps' | 'render' | 'serverless'
  >('platforms_setup');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base">
                Multi-Platform & 100% Zero-Credit-Card Cloud Hosting Guides
              </h2>
              <p className="text-xs text-slate-400">
                Setup Telegram, Discord, Slack & Host Free on Koyeb, HF Spaces, Fly.io, Railway, Zeabur, Replit, or Oracle VPS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selector Tabs */}
        <div className="px-6 pt-3 pb-2 bg-slate-950/80 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setPlatformTab('platforms_setup')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              platformTab === 'platforms_setup'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Tokens & Webhooks
          </button>

          <button
            onClick={() => setPlatformTab('koyeb')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              platformTab === 'koyeb'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Koyeb (No CC)
          </button>

          <button
            onClick={() => setPlatformTab('hf')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              platformTab === 'hf'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            HF Spaces (No CC)
          </button>

          <button
            onClick={() => setPlatformTab('fly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              platformTab === 'fly'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-violet-400"></span>
            Fly.io (fly.toml)
          </button>

          <button
            onClick={() => setPlatformTab('railway')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              platformTab === 'railway'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-pink-400"></span>
            Railway (railway.json)
          </button>

          <button
            onClick={() => setPlatformTab('zeabur_replit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              platformTab === 'zeabur_replit'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-teal-400"></span>
            Zeabur & Replit
          </button>

          <button
            onClick={() => setPlatformTab('oracle_vps')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              platformTab === 'oracle_vps'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-orange-400" />
            Oracle VPS (Lifetime Free)
          </button>

          <button
            onClick={() => setPlatformTab('render')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              platformTab === 'render'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Render
          </button>

          <button
            onClick={() => setPlatformTab('serverless')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              platformTab === 'serverless'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Serverless
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1">
          {/* Tab 0: Chat Platforms Credentials */}
          {platformTab === 'platforms_setup' && (
            <div className="space-y-4">
              {/* Discord Setup */}
              <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-indigo-300 text-sm flex items-center gap-1.5">
                    <span>👾</span> 1. Discord Bot & Admin Webhook Setup
                  </h4>
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 underline flex items-center gap-1"
                  >
                    Discord Dev Portal <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-300">
                  <li>Go to <strong>Discord Developer Portal</strong> $\rightarrow$ <strong>New Application</strong>.</li>
                  <li>Click <strong>Bot</strong> tab $\rightarrow$ <strong>Reset Token</strong> $\rightarrow$ Copy to <code>DISCORD_BOT_TOKEN</code>.</li>
                  <li><strong>CRITICAL:</strong> Scroll to <strong>Privileged Gateway Intents</strong> $\rightarrow$ Toggle <strong>MESSAGE CONTENT INTENT</strong> ON.</li>
                  <li>Go to <strong>OAuth2</strong> $\rightarrow$ <strong>URL Generator</strong> $\rightarrow$ Select <code>bot</code> $\rightarrow$ Invite to server.</li>
                  <li><strong>Discord Webhook for Alerts:</strong> Open Discord Server Settings $\rightarrow$ <strong>Integrations</strong> $\rightarrow$ <strong>Webhooks</strong> $\rightarrow$ Copy Webhook URL to <code>DISCORD_ADMIN_WEBHOOK_URL</code>.</li>
                </ol>
              </div>

              {/* Slack Setup */}
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-emerald-300 text-sm flex items-center gap-1.5">
                    <span>💬</span> 2. Slack App & Socket Mode Setup
                  </h4>
                  <a
                    href="https://api.slack.com/apps"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-400 underline flex items-center gap-1"
                  >
                    Slack API <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-300">
                  <li>Go to <strong>api.slack.com/apps</strong> $\rightarrow$ <strong>Create New App</strong> (From scratch).</li>
                  <li>Enable <strong>Socket Mode</strong> $\rightarrow$ Generate App Token starting with <code>xapp-</code> (<code>SLACK_APP_TOKEN</code>).</li>
                  <li>Under <strong>OAuth & Permissions</strong>, add Bot Scopes: <code>app_mentions:read</code>, <code>chat:write</code>, <code>commands</code>.</li>
                  <li>Install App to Workspace $\rightarrow$ Copy Bot Token starting with <code>xoxb-</code> (<code>SLACK_BOT_TOKEN</code>).</li>
                </ol>
              </div>

              {/* Telegram Setup */}
              <div className="p-3.5 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl space-y-2">
                <h4 className="font-bold text-cyan-300 text-sm flex items-center gap-1.5">
                  <span>✈️</span> 3. Telegram Bot Setup
                </h4>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-300">
                  <li>Message <strong>@BotFather</strong> on Telegram $\rightarrow$ <code>/newbot</code> $\rightarrow$ Copy to <code>TELEGRAM_BOT_TOKEN</code>.</li>
                  <li>Find your numeric ID with <strong>@userinfobot</strong> $\rightarrow$ Set <code>ADMIN_TELEGRAM_ID</code>.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Tab 1: Koyeb */}
          {platformTab === 'koyeb' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-emerald-300 text-sm">
                    Koyeb Free Micro Instance (0 Credit Card Required)
                  </h4>
                  <p className="text-[11px] text-emerald-200/70">
                    Runs 24/7 continuously using our universal Dockerfile and embedded keep-alive HTTP server on port 8080.
                  </p>
                </div>
                <a
                  href="https://www.koyeb.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-emerald-400 transition shrink-0"
                >
                  Open Koyeb <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <ol className="list-decimal pl-4 space-y-2">
                <li>
                  <strong>Sign up on Koyeb:</strong> Go to <a href="https://app.koyeb.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline">app.koyeb.com</a> and sign in with GitHub (No credit card requested).
                </li>
                <li>
                  <strong>Create App:</strong> Click <strong>"Create App"</strong> $\rightarrow$ Choose <strong>GitHub</strong> $\rightarrow$ Select repo.
                </li>
                <li>
                  <strong>Builder Type:</strong> Select <strong>Dockerfile</strong>.
                </li>
                <li>
                  <strong>Environment Variables:</strong> Add tokens for Telegram, Discord, Slack, and AI providers.
                </li>
                <li>
                  <strong>Port & Health Check:</strong> Set Port to <strong>8080</strong> and Health check path to <strong>/health</strong>.
                </li>
              </ol>
            </div>
          )}

          {/* Tab 2: Hugging Face Spaces */}
          {platformTab === 'hf' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-amber-300 text-sm">
                    Hugging Face Spaces (100% Free 24/7 Docker Space)
                  </h4>
                  <p className="text-[11px] text-amber-200/70">
                    Host your multi-platform bot on a free Docker Space with no credit card required.
                  </p>
                </div>
                <a
                  href="https://huggingface.co/new-space"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-amber-400 transition shrink-0"
                >
                  Create HF Space <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <ol className="list-decimal pl-4 space-y-2">
                <li>Go to <a href="https://huggingface.co/new-space" target="_blank" rel="noreferrer" className="text-cyan-400 underline">huggingface.co/new-space</a>.</li>
                <li>Select <strong>Docker (Blank)</strong> and push your repository.</li>
                <li>Add secrets under <strong>Settings</strong> $\rightarrow$ <strong>Variables and secrets</strong>.</li>
                <li>The space runs 24/7 with zero sleeping!</li>
              </ol>
            </div>
          )}

          {/* Tab 3: Fly.io */}
          {platformTab === 'fly' && (
            <div className="space-y-4">
              <div className="p-3 bg-violet-950/40 border border-violet-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-violet-300 text-sm">
                    Fly.io Free Allowance (fly.toml)
                  </h4>
                  <p className="text-[11px] text-violet-200/70">
                    Fly.io provides up to 3 shared-cpu-1x 256MB micro VMs on their global edge network.
                  </p>
                </div>
                <a
                  href="https://fly.io"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-violet-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-violet-400 transition shrink-0"
                >
                  Open Fly.io <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-2">
                <p className="text-slate-300 font-semibold">Deployment via Fly CLI:</p>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto space-y-1">
                  <div># 1. Install Fly CLI & login</div>
                  <div>curl -L https://fly.io/install.sh | sh</div>
                  <div>fly auth login</div>
                  <br />
                  <div># 2. Launch using included fly.toml</div>
                  <div>fly launch --no-deploy</div>
                  <br />
                  <div># 3. Set encrypted secrets</div>
                  <div>fly secrets set TELEGRAM_BOT_TOKEN="your_token" DISCORD_BOT_TOKEN="your_token" GROQ_API_KEY_1="gsk_..."</div>
                  <br />
                  <div># 4. Deploy</div>
                  <div>fly deploy</div>
                </pre>
              </div>
            </div>
          )}

          {/* Tab 4: Railway */}
          {platformTab === 'railway' && (
            <div className="space-y-4">
              <div className="p-3 bg-pink-950/40 border border-pink-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-pink-300 text-sm">
                    Railway Deployment (railway.json)
                  </h4>
                  <p className="text-[11px] text-pink-200/70">
                    Instant container builds with automated zero-downtime rollouts and failure recovery.
                  </p>
                </div>
                <a
                  href="https://railway.app"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-pink-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-pink-400 transition shrink-0"
                >
                  Open Railway <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <ol className="list-decimal pl-4 space-y-2">
                <li>Go to <a href="https://railway.app" target="_blank" rel="noreferrer" className="text-cyan-400 underline">railway.app</a> $\rightarrow$ Click <strong>New Project</strong>.</li>
                <li>Select <strong>Deploy from GitHub repo</strong> $\rightarrow$ Pick your repository.</li>
                <li>Railway automatically reads <code>railway.json</code> and builds the <code>Dockerfile</code>.</li>
                <li>Click <strong>Variables</strong> $\rightarrow$ Add variables from <code>.env.example</code>.</li>
                <li>Your bot starts immediately with live logging and auto-restart policy.</li>
              </ol>
            </div>
          )}

          {/* Tab 5: Zeabur & Replit */}
          {platformTab === 'zeabur_replit' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-teal-950/40 border border-teal-500/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-teal-300 text-sm">
                    1. Zeabur (One-Click Zero-Config Git Deploy)
                  </h4>
                  <a href="https://zeabur.com" target="_blank" rel="noreferrer" className="text-teal-400 underline text-xs flex items-center gap-1">
                    Zeabur <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-300">
                  Create a new project on Zeabur, link your GitHub repository, and paste your API keys. Zeabur reads <code>zeabur.json</code> and provisions the container within seconds.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200 text-sm">
                    2. Replit (Always-On Python Environment)
                  </h4>
                  <a href="https://replit.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline text-xs flex items-center gap-1">
                    Replit <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-300">
                  Import repository directly into Replit. The included <code>.replit</code> file configures Python 3.11 Nix dependencies. Add keys in Replit <strong>Secrets</strong> and click <strong>Run</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Tab 6: Oracle Cloud Always Free VPS */}
          {platformTab === 'oracle_vps' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-orange-950/40 border border-orange-500/30 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-orange-300 text-sm flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-orange-400" />
                    Oracle Cloud Always Free VPS (Lifetime 4 OCPUs ARM / 24GB RAM)
                  </h4>
                  <a
                    href="https://cloud.oracle.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-orange-400 underline flex items-center gap-1"
                  >
                    Oracle Cloud <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-[11px] text-orange-200/80 leading-relaxed">
                  Oracle provides a generous Always Free tier: 4 ARM Ampere OCPUs, 24 GB RAM, and 200 GB SSD storage with zero recurring costs.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-xs">Automated 1-Command Setup on Ubuntu VPS:</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        'chmod +x oracle-vps-setup.sh && ./oracle-vps-setup.sh',
                        'vps_cmd'
                      )
                    }
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'vps_cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'vps_cmd' ? 'Copied!' : 'Copy Script Command'}
                  </button>
                </div>

                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto space-y-1">
                  <div># 1. Connect to Oracle VPS</div>
                  <div>ssh ubuntu@&lt;YOUR_ORACLE_VPS_IP&gt;</div>
                  <br />
                  <div># 2. Clone repo and run the included setup script</div>
                  <div>git clone &lt;YOUR_REPO_URL&gt; bot && cd bot</div>
                  <div>chmod +x oracle-vps-setup.sh</div>
                  <div>./oracle-vps-setup.sh</div>
                  <br />
                  <div># 3. Configure API keys</div>
                  <div>nano /opt/universal-ai-bot/.env</div>
                  <div>sudo systemctl restart universal-bot</div>
                  <br />
                  <div># 4. Monitor live service logs</div>
                  <div>sudo journalctl -u universal-bot -f</div>
                </pre>
              </div>
            </div>
          )}

          {/* Tab 7: Render */}
          {platformTab === 'render' && (
            <div className="space-y-4">
              <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-cyan-300 text-sm">
                    Render.com (Free Background Worker / Web Service)
                  </h4>
                  <p className="text-[11px] text-cyan-200/70">
                    Runs natively as a long-polling Python background worker with the included <code>render.yaml</code>.
                  </p>
                </div>
                <a
                  href="https://dashboard.render.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-cyan-400 transition shrink-0"
                >
                  Open Render <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <ol className="list-decimal pl-4 space-y-2">
                <li>Push to GitHub and click <strong>"New Background Worker"</strong> or <strong>"New Web Service"</strong> in Render.</li>
                <li>Build Command: <code>pip install -r requirements.txt</code></li>
                <li>Start Command: <code>python bot.py</code></li>
                <li>If using Web Service, set healthcheck path to <code>/health</code>.</li>
              </ol>
            </div>
          )}

          {/* Tab 8: Serverless */}
          {platformTab === 'serverless' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl">
                <h4 className="font-bold text-purple-300 text-sm">
                  Google Cloud Run & AWS Lambda Serverless Webhooks
                </h4>
                <p className="text-[11px] text-purple-200/70 mt-0.5">
                  Execute on-demand with zero idle cost. Google Cloud Run includes 2 Million free requests per month!
                </p>
              </div>

              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
{`gcloud run deploy multi-platform-ai-bot \\
  --image gcr.io/YOUR_PROJECT_ID/multi-platform-bot \\
  --platform managed \\
  --region us-central1 \\
  --allow-unauthenticated \\
  --set-env-vars RUN_MODE=webhook`}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Credit-Card Free Tiers: Koyeb, Hugging Face, Zeabur, Replit & Oracle VPS</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
