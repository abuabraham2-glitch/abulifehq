import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReadingQueueRow {
  id: string;
  url: string;
  title: string | null;
  bottom_line: string | null;
  bullets: string[] | null;
  status: 'queued' | 'summarizing' | 'summarized' | 'failed';
  source: string | null;
  shared_at: string;
  summary_generated_at: string | null;
  error_message: string | null;
  created_at: string;
}

export function useReadingQueue() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('reading_queue_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reading_queue' },
        () => {
          qc.invalidateQueries({ queryKey: ['reading_queue'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: ['reading_queue'],
    queryFn: async (): Promise<ReadingQueueRow[]> => {
      const { data, error } = await supabase
        .from('reading_queue')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReadingQueueRow[];
    },
  });
}

export function useReadingQueueCount() {
  const { data } = useReadingQueue();
  return (data ?? []).filter((r) => r.status !== 'failed').length;
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
