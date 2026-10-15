import React from 'react';
import { GameSettings } from '../types/game';
import { X } from 'lucide-react';

interface SettingsPanelProps {
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onClose }) => {
  return (
    <div className="absolute inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800 border-2 border-slate-700 rounded-sm shadow-2xl p-4 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-white font-bold uppercase">Ayarlar</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 rounded-sm p-3 border-2 border-slate-700">
            <label className="text-xs text-slate-300 font-bold mb-2 block uppercase">Görüş Mesafesi:</label>
            <div className="grid grid-cols-3 gap-2">
              {[4, 8, 12].map((d) => (
                <button key={d} onClick={() => onSettingsChange({ ...settings, renderDistance: d })}
                  className={`py-2 rounded-sm text-xs font-bold border-2 ${settings.renderDistance === d ? 'bg-green-700 border-green-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                  {d === 4 ? 'Tiny' : d === 8 ? 'Short' : 'Normal'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-sm p-3 border-2 border-slate-700">
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-2 uppercase">
              <span>Hassasiyet:</span>
              <span className="text-white">{settings.mouseSensitivity}x</span>
            </div>
            <input type="range" min="0.5" max="3.0" step="0.1" value={settings.mouseSensitivity}
              onChange={(e) => onSettingsChange({ ...settings, mouseSensitivity: parseFloat(e.target.value) })}
              className="w-full h-4 bg-slate-800 accent-green-600 border-2 border-slate-600" />
          </div>

          <div className="bg-slate-900 rounded-sm p-3 border-2 border-slate-700">
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-2 uppercase">
              <span>Ses Düzeyi:</span>
              <span className="text-white">{settings.soundVolume}%</span>
            </div>
            <input type="range" min="0" max="100" value={settings.soundVolume}
              onChange={(e) => onSettingsChange({ ...settings, soundVolume: parseInt(e.target.value) })}
              className="w-full h-4 bg-slate-800 accent-green-600 border-2 border-slate-600" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => onSettingsChange({ ...settings, graphicsStyle: settings.graphicsStyle === 'fast' ? 'fancy' : 'fast' })}
              className={`py-3 rounded-sm text-xs font-bold border-2 ${settings.graphicsStyle === 'fancy' ? 'bg-green-700 border-green-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>
              Grafik: {settings.graphicsStyle.toUpperCase()}
            </button>
            <button onClick={() => onSettingsChange({ ...settings, allowCracked: !settings.allowCracked })}
              className={`py-3 rounded-sm text-xs font-bold border-2 ${settings.allowCracked ? 'bg-green-700 border-green-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>
              Cracked: {settings.allowCracked ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
