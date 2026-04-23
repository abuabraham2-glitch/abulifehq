import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const N8N_WEBHOOK = 'https://bottlesandprint.app.n8n.cloud/webhook/life-hq-summarize-article';

function extractUrl(params: URLSearchParams): string | null {
  const url = params.get('url');
  if (url && /^https?:\/\//i.test(url)) return url;

  const text = params.get('text');
  if (text && /^https?:\/\//i.test(text.trim())) return text.trim();
  if (text) {
    const match = text.match(/https?:\/\/\S+/);
    if (match) return match[0];
  }

  const title = params.get('title');
  if (title) {
    const match = title.match(/https?:\/\/\S+/);
    if (match) return match[0];
  }

  return null;
}

export default function ShareReceiver() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [success, setSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    const url = extractUrl(params);

    if (!url) {
      setSuccess(false);
      const t = setTimeout(() => navigate('/reading-list', { replace: true }), 2500);
      return () => clearTimeout(t);
    }

    (async () => {
      const { data, error } = await supabase
        .from('reading_queue')
        .insert({ url, status: 'queued', source: 'android_share' })
        .select('id')
        .single();

      if (error || !data) {
        setSuccess(false);
        return;
      }

      // Fire-and-forget webhook
      fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue_id: data.id, url }),
      }).catch(() => {});

      setSuccess(true);
    })();
  }, [params, navigate]);

  useEffect(() => {
    if (success === true) {
      const t = setTimeout(() => navigate('/reading-list', { replace: true }), 1500);
      return () => clearTimeout(t);
    }
    if (success === false) {
      const t = setTimeout(() => navigate('/reading-list', { replace: true }), 2500);
      return () => clearTimeout(t);
    }
  }, [success, navigate]);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#F5F0E8' }}
    >
      {success === false ? (
        <>
          <X size={64} color="#C44" strokeWidth={2.5} />
          <p className="mt-4 text-lg font-bold" style={{ color: '#5C3D1E' }}>
            Couldn't read the shared link
          </p>
          <p className="mt-2 text-sm" style={{ color: '#8B7355' }}>
            Open Life HQ and try sharing again
          </p>
        </>
      ) : (
        <>
          <Check size={64} color="#B8906C" strokeWidth={2.5} />
          <p className="mt-4 text-lg font-bold" style={{ color: '#5C3D1E' }}>
            Article saved
          </p>
          <p className="mt-2 text-sm" style={{ color: '#8B7355' }}>
            Summarizing now...
          </p>
        </>
      )}
    </div>
  );
}
