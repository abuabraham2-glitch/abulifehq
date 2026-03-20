import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

interface Props {
  planId: string | null;
}

export function PlanChatSection({ planId }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, planId }),
      });
      const rawText = await res.text();
      console.log('Raw webhook response:', rawText);

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        // Try extracting JSON from potential markdown wrapper
        const jsonStart = rawText.search(/[\{\[]/);
        const jsonEnd = rawText.lastIndexOf(jsonStart !== -1 && rawText[jsonStart] === '[' ? ']' : '}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          data = JSON.parse(rawText.substring(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('Could not parse response');
        }
      }
      console.log('Parsed webhook response:', data);

      const msg = data.message || 'Done.';

      if (data.action === 'revision') {
        setMessages((prev) => [...prev, { role: 'ai', text: msg }]);
        toast({ title: msg });
        queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
      } else if (data.action === 'answer') {
        setMessages((prev) => [...prev, { role: 'ai', text: msg }]);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: msg }]);
      }
    } catch (e) {
      console.error('Webhook error:', e);
      toast({ title: 'Error', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-3">
      {/* Chat history */}
      {messages.length > 0 && (
        <div className="space-y-2 max-h-[240px] overflow-y-auto px-1">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                style={
                  msg.role === 'user'
                    ? { backgroundColor: '#B8906C', color: '#fff' }
                    : { backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '0.5px solid rgba(0,0,0,0.06)' }
                }
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 rounded-full p-1.5" style={{ backgroundColor: '#fff', border: '1px solid #D4C5B0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Change your plan or add life context..."
          disabled={loading}
          className="plan-chat-input flex-1 rounded-full px-3.5 py-2 text-[16px] bg-transparent min-h-[40px] focus:outline-none border-none outline-none"
          style={{ color: 'hsl(var(--foreground))', caretColor: '#B8906C' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 min-w-[44px] min-h-[44px]"
          style={{ backgroundColor: '#B8906C', color: '#fff' }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
