
import React, { useState } from 'react';
import { Send, Bot, User, AlertCircle } from 'lucide-react';

export const ClaudeChat: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input }),
      });
      const data = await response.json();

      if (!data.success) throw new Error(data.error || 'Failed to get response');

      setMessages((prev) => [...prev, { role: 'assistant', text: data.response }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-64 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {m.role === 'assistant' ? <Bot className="w-5 h-5 text-emerald-400 mt-1" /> : <User className="w-5 h-5 text-blue-400 mt-1" />}
            <div className={`p-2 rounded ${m.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {error && <div className="text-red-400 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4"/>{error}</div>}
      </div>
      <div className="p-2 border-t border-slate-700 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask Claude..."
          className="flex-1 bg-slate-800 text-white rounded p-2 text-sm"
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading} className="bg-emerald-600 p-2 rounded text-white">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
