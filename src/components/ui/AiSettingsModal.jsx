import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Key,
  Cpu,
  Check,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Zap,
  Shield,
  Layers,
} from 'lucide-react';
import { Button } from './Button.jsx';
import { getAiSettings, saveAiSettings, AI_ENGINES } from '../../lib/animeAiEngine.js';
import { playPop, playSuccess } from '../../lib/audio.js';

export const AiSettingsModal = ({ open, onClose }) => {
  const [settings, setSettings] = useState(getAiSettings());
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testStatus, setTestStatus] = useState('idle'); // 'idle' | 'testing' | 'success' | 'error'
  const [testMessage, setTestMessage] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (open) {
      const s = getAiSettings();
      setSettings(s);
      setApiKeyInput(s.geminiApiKey || '');
      setTestStatus('idle');
      setTestMessage('');
      setSavedNotice(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSelectEngine = (engineId) => {
    playPop();
    const updated = { ...settings, engine: engineId };
    setSettings(updated);
    saveAiSettings(updated);
  };

  const handleSaveApiKey = () => {
    playPop();
    const cleanKey = apiKeyInput.trim();
    const updated = { ...settings, geminiApiKey: cleanKey };
    if (cleanKey && settings.engine !== 'gemini') {
      updated.engine = 'gemini';
    }
    setSettings(updated);
    saveAiSettings(updated);
    setSavedNotice(true);
    playSuccess();
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTestKey = async () => {
    const key = apiKeyInput.trim() || settings.geminiApiKey;
    if (!key) {
      setTestStatus('error');
      setTestMessage('Please enter an API key to test.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Verifying key with Google Gemini API...');

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      if (res.ok) {
        setTestStatus('success');
        setTestMessage('Key verified successfully! Google Gemini models are available.');
        playSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setTestStatus('error');
        setTestMessage(data?.error?.message || 'Invalid API key or permission denied.');
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage('Network error while testing key. Please check your internet connection.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-[#140b1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#190f26]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl rgb-gradient flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">AI Engine & Gemini API Settings</h3>
              <p className="text-xs text-slate-400">Configure your image generation backends</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Engine Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
              Active Generation Engine
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {AI_ENGINES.map((eng) => {
                const isActive = settings.engine === eng.id;
                return (
                  <div
                    key={eng.id}
                    onClick={() => handleSelectEngine(eng.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                      isActive
                        ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-purple-400 uppercase tracking-wider">
                          {eng.badge}
                        </span>
                        {isActive && <Check size={14} className="text-purple-400" />}
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">{eng.name}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{eng.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gemini API Key Box */}
          <div className="p-4 rounded-xl border border-white/10 bg-[#1a1128] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Key size={16} className="text-purple-400" />
                Google Gemini API Key (Optional)
              </div>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
              >
                Get Free Key <ExternalLink size={12} />
              </a>
            </div>

            <p className="text-xs text-slate-400">
              Paste your free API key from Google AI Studio to unlock multimodal character analysis & Imagen 3 generation. Your key is stored locally in your browser.
            </p>

            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
              />
              <Button size="sm" variant="secondary" onClick={handleTestKey} disabled={testStatus === 'testing'}>
                {testStatus === 'testing' ? 'Testing...' : 'Test Key'}
              </Button>
              <Button size="sm" onClick={handleSaveApiKey}>
                Save Key
              </Button>
            </div>

            {/* Test Status Banner */}
            {testStatus === 'success' && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                <Check size={14} />
                <span>{testMessage}</span>
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle size={14} />
                <span>{testMessage}</span>
              </div>
            )}
            {savedNotice && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
                <Sparkles size={14} />
                <span>API Key saved locally. Gemini Engine activated.</span>
              </div>
            )}
          </div>

          {/* Privacy & Guarantee Info */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400">
            <Shield size={16} className="text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">100% Reliability Guarantee: </span>
              If any cloud service experiences rate limits or temporary downtime, AmiBuzz automatically switches to the high-speed fallback or on-device Neural Canvas Shader so your work is never interrupted.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2 bg-[#190f26]">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
