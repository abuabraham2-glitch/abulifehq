import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Store = Tables<'stores'>;

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Store[];
    },
  });
}

/** Map of store_id -> unchecked item count */
export function useUncheckedCounts() {
  return useQuery({
    queryKey: ['stores', 'unchecked-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grocery_items')
        .select('store_id, checked');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        if (row.checked) return;
        if (!row.store_id) return;
        counts[row.store_id] = (counts[row.store_id] ?? 0) + 1;
      });
      return counts;
    },
  });
}

export function useAddStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Store name is required');

      // Duplicate check (case-insensitive)
      const { data: existing, error: selErr } = await supabase
        .from('stores')
        .select('id, name')
        .ilike('name', trimmed);
      if (selErr) throw selErr;
      if (existing && existing.length > 0) throw new Error('That store already exists');

      // Determine next sort_order
      const { data: maxRow } = await supabase
        .from('stores')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSort = (maxRow?.sort_order ?? 0) + 1;

      const { data, error } = await supabase
        .from('stores')
        .insert({ name: trimmed, sort_order: nextSort, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data as Store;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useRenameStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Store name is required');

      const { data: existing, error: selErr } = await supabase
        .from('stores')
        .select('id, name')
        .ilike('name', trimmed);
      if (selErr) throw selErr;
      const conflict = (existing ?? []).find((s: any) => s.id !== id);
      if (conflict) throw new Error('That store already exists');

      const { error } = await supabase.from('stores').update({ name: trimmed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stores'] });
      qc.invalidateQueries({ queryKey: ['grocery_items'] });
    },
  });
}
