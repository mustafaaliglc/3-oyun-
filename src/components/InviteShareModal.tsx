import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Share2,
  X,
  Globe,
  Wifi,
  Sparkles,
} from 'lucide-react';

interface InviteShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onlineCount: number;
}

export const InviteShareModal: React.FC<InviteShareModalProps> = ({
  isOpen,
  onClose,
  onlineCount,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Use the canonical shared preview URL or current window URL
  const shareUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-jaxzdqfvfbyasow7e62gec-426751961660.europe-west1.run.app';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          aria-label="Kapat"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white tracking-tight">
              Gerçek Oyuncularla Oyna
            </h3>
            <p className="text-xs text-slate-400">
              Bu bağlantıyı arkadaşlarına gönder, aynı haritada buluşun!
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 mb-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-200 font-bold flex items-center gap-1.5">
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                Socket.io v4
              </span>
              Sunucu Aktif
            </span>
          </div>
          <span className="text-emerald-400 font-mono font-bold">
            {onlineCount} Kişi Çevrimiçi
          </span>
        </div>

        {/* Share Link Box */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 font-medium mb-1.5 block">
            Davet Bağlantısı (Tıkla ve Kopyala):
          </label>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <Globe className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="bg-transparent text-xs text-slate-200 w-full focus:outline-none font-mono select-all"
            />
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                copied
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-pink-600 hover:bg-pink-500 text-white shadow'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Kopyalandı!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Kopyala
                </>
              )}
            </button>
          </div>
        </div>

        {/* How it works info */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/50 space-y-2 text-xs text-slate-400 mb-5">
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Arkadaşınız bu linki tarayıcısında (bilgisayar veya telefon) açtığında doğrudan aynı 3D dünyaya bağlanır.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              Birbirinizi haritada anlık olarak görür, korna çalar ve yarışabilirsiniz.
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
        >
          Oyuna Geri Dön
        </button>
      </div>
    </div>
  );
};
