import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Plus, Minus, Loader2, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useStores, useUncheckedCounts, useAddStore, useRenameStore, useDeleteStore, type Store,
} from '@/hooks/useStores';
import { AddStoreModal, RenameStoreModal, DeleteStoreDialog, StoreActionSheet } from '@/components/StoreModals';

const SECTIONS_ORDER = [
  'Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery & Bread',
  'Pantry & Dry Goods', 'Frozen', 'Beverages', 'Spices/Condiments/Sauces',
  'Household', 'Personal Care', 'Other',
];

const LAST_STORE_KEY = 'shopping_last_store_id';
const GROCERIES_NAME = 'Groceries';
const LONG_PRESS_MS = 500;

type ShopItem = {
  id: string;
  item: string;
  section: string | null;
  checked: boolean | null;
  quantity: number;
  store_id: string | null;
  created_at: string | null;
};

export default function Shopping() {
  const qc = useQueryClient();
  const { data: stores = [], isLoading: loadingStores } = useStores();
  const { data: unchecked = {} } = useUncheckedCounts();

  const addStore = useAddStore();
  const renameStore = useRenameStore();
  const deleteStore = useDeleteStore();

  const [activeId, setActiveId] = useState<string | null>(() => {
    return localStorage.getItem(LAST_STORE_KEY);
  });

  // Pick a valid active store when stores load / change
  useEffect(() => {
    if (stores.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !stores.find((s) => s.id === activeId)) {
      setActiveId(stores[0].id);
    }
  }, [stores, activeId]);

  useEffect(() => {
    if (activeId) localStorage.setItem(LAST_STORE_KEY, activeId);
  }, [activeId]);

  const activeStore = useMemo(() => stores.find((s) => s.id === activeId) ?? null, [stores, activeId]);
  const isGroceries = activeStore?.name === GROCERIES_NAME;

  // Modals
  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionSheetStore, setActionSheetStore] = useState<Store | null>(null);
  const [confirmClearAllOpen, setConfirmClearAllOpen] = useState(false);

  // Add item
  const [newItem, setNewItem] = useState('');
  const [addingText, setAddingText] = useState(false);
  const [addingImage, setAddingImage] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['grocery_items', activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('store_id', activeId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ShopItem[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['grocery_items'] });
    qc.invalidateQueries({ queryKey: ['stores', 'unchecked-counts'] });
  };

  const toggleCheck = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase.from('grocery_items').update({ checked }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from('grocery_items').update({ quantity }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const performDelete = async (item: ShopItem) => {
    const snapshot = { ...item };
    await supabase.from('grocery_items').delete().eq('id', item.id);
    invalidateAll();
    toast(`Deleted: ${item.item}`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          const { id, created_at, ...rest } = snapshot as any;
          await supabase.from('grocery_items').insert({ ...rest, id });
          invalidateAll();
        },
      },
    });
  };

  const handleAddItem = async () => {
    const text = newItem.trim();
    if (!text || !activeStore) return;
    setAddingText(true);
    try {
      let section: string | null = null;
      if (isGroceries) {
        try {
          const res = await supabase.functions.invoke('grocery-ai', {
            body: { type: 'categorize', item: text },
          });
          if (!res.error) section = res.data?.section || 'Other';
          else section = 'Other';
        } catch {
          section = 'Other';
        }
      }
      const { error } = await supabase.from('grocery_items').insert({
        item: text,
        section,
        store_id: activeStore.id,
        checked: false,
      });
      if (error) throw error;
      setNewItem('');
      invalidateAll();
    } catch (e: any) {
      toast.error(e?.message || 'Error adding item');
    } finally {
      setAddingText(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeStore) return;
    setAddingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await supabase.functions.invoke('grocery-ai', {
        body: { type: 'parse_image', image_base64: base64 },
      });
      if (res.error) throw res.error;
      const parsed = res.data?.items || [];
      if (parsed.length === 0) {
        toast('No items found in image');
        return;
      }
      const rows = parsed.map((p: { item: string; section: string }) => ({
        item: p.item,
        section: isGroceries ? (p.section || 'Other') : null,
        store_id: activeStore.id,
        checked: false,
      }));
      const { error } = await supabase.from('grocery_items').insert(rows);
      if (error) throw error;
      invalidateAll();
      toast.success(`Added ${parsed.length} items`);
    } catch (e: any) {
      toast.error(e?.message || 'Error parsing image');
    } finally {
      setAddingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearChecked = async () => {
    if (!activeStore) return;
    await supabase.from('grocery_items').delete().eq('store_id', activeStore.id).eq('checked', true);
    invalidateAll();
    toast('Checked items cleared');
  };

  const handleClearAll = async () => {
    if (!activeStore) return;
    await supabase.from('grocery_items').delete().eq('store_id', activeStore.id);
    invalidateAll();
    setConfirmClearAllOpen(false);
    toast('All items cleared');
  };

  const handleAddStore = async (name: string) => {
    const created = await addStore.mutateAsync(name);
    setActiveId(created.id);
  };

  const handleRenameStore = async (name: string) => {
    if (!activeStore) return;
    await renameStore.mutateAsync({ id: activeStore.id, name });
  };

  const handleDeleteStore = async () => {
    if (!activeStore) return;
    if (stores.length <= 1) {
      toast('You need at least one store.');
      setDeleteOpen(false);
      return;
    }
    const deletedId = activeStore.id;
    await deleteStore.mutateAsync(deletedId);
    const remaining = stores.filter((s) => s.id !== deletedId);
    if (remaining.length > 0) setActiveId(remaining[0].id);
    setDeleteOpen(false);
  };

  // Long-press handling
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const startLongPress = (store: Store) => {
    longPressed.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setActionSheetStore(store);
    }, LONG_PRESS_MS);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const grouped = useMemo(() => {
    if (!isGroceries) return null;
    const map: Record<string, ShopItem[]> = {};
    items.forEach((item) => {
      const sec = item.section || 'Other';
      if (!map[sec]) map[sec] = [];
      map[sec].push(item);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0))
    );
    return map;
  }, [items, isGroceries]);

  const sortedSections = useMemo(() => {
    if (!grouped) return [] as string[];
    return SECTIONS_ORDER.filter((s) => grouped[s]?.length > 0);
  }, [grouped]);

  // Auto-collapse empty sections (Groceries view)
  useEffect(() => {
    if (!grouped) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      SECTIONS_ORDER.forEach((s) => {
        const has = (grouped[s]?.length ?? 0) > 0;
        if (!has) next.add(s);
        // sections with items remain whatever the user set them to (default not collapsed)
      });
      return next;
    });
  }, [grouped]);

  const toggleSection = (s: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const hasChecked = items.some((i) => i.checked);

  return (
    <div className="space-y-4 pb-32">
      <h1 className="text-[22px] md:text-[28px] font-medium text-foreground">Shopping List</h1>

      {/* Tab strip */}
      {loadingStores ? (
        <div className="h-10 flex items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex items-end gap-1 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
          {stores.map((store) => {
            const isActive = store.id === activeId;
            const count = unchecked[store.id] ?? 0;
            return (
              <button
                key={store.id}
                onClick={() => {
                  if (longPressed.current) { longPressed.current = false; return; }
                  setActiveId(store.id);
                }}
                onTouchStart={() => startLongPress(store)}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onMouseDown={() => startLongPress(store)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onContextMenu={(e) => { e.preventDefault(); setActionSheetStore(store); }}
                className="flex-shrink-0 px-3 py-2.5 text-[14px] whitespace-nowrap min-h-[44px]"
                style={{
                  color: isActive ? '#5C3D1E' : '#8B7355',
                  fontWeight: isActive ? 700 : 500,
                  borderBottom: isActive ? '2px solid #B8906C' : '2px solid transparent',
                }}
              >
                {store.name} ({count})
              </button>
            );
          })}
          <button
            onClick={() => setAddStoreOpen(true)}
            className="flex-shrink-0 ml-1 mb-1 w-8 h-8 rounded-full text-white text-[16px] font-medium flex items-center justify-center"
            style={{ backgroundColor: '#B8906C' }}
            aria-label="Add store"
          >
            +
          </button>
        </div>
      )}

      {/* Per-store action buttons */}
      {activeStore && (
        <div className="flex justify-end gap-3 -mt-1">
          <button
            onClick={handleClearChecked}
            disabled={!hasChecked}
            className="text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-40 px-1 py-1 min-h-[32px]"
          >
            Clear Checked
          </button>
          <button
            onClick={() => setConfirmClearAllOpen(true)}
            disabled={items.length === 0}
            className="text-[12px] text-destructive hover:text-destructive/80 disabled:opacity-40 px-1 py-1 min-h-[32px]"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Items */}
      {loadingItems ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[14px] bg-card p-6 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
          <p className="text-[14px] text-muted-foreground">
            {activeStore ? `No items yet in ${activeStore.name}` : 'No store selected'}
          </p>
        </div>
      ) : isGroceries && grouped ? (
        <div className="space-y-2">
          {sortedSections.map((section) => {
            const sectionItems = grouped[section];
            const allChecked = sectionItems.every((i) => i.checked);
            const uncheckedCount = sectionItems.filter((i) => !i.checked).length;
            const isCollapsed = collapsed.has(section);
            return (
              <div
                key={section}
                className={`rounded-[14px] bg-card overflow-hidden transition-opacity ${allChecked ? 'opacity-50' : ''}`}
                style={{ border: '0.5px solid rgba(0,0,0,0.06)' }}
              >
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between p-3 text-left min-h-[44px]"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    <span className="text-[14px] font-semibold text-foreground">{section}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {uncheckedCount > 0 ? `${uncheckedCount} left` : 'done'}
                  </span>
                </button>
                {!isCollapsed && (
                  <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                    {sectionItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={(checked) => toggleCheck.mutate({ id: item.id, checked })}
                        onQty={(quantity) => updateQuantity.mutate({ id: item.id, quantity })}
                        onDelete={() => performDelete(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[14px] bg-card overflow-hidden" style={{ border: '0.5px solid rgba(0,0,0,0.06)' }}>
          {items.map((item, i) => (
            <div key={item.id} style={i > 0 ? { borderTop: '0.5px solid rgba(0,0,0,0.06)' } : undefined}>
              <ItemRow
                item={item}
                onToggle={(checked) => toggleCheck.mutate({ id: item.id, checked })}
                onQty={(quantity) => updateQuantity.mutate({ id: item.id, quantity })}
                onDelete={() => performDelete(item)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Fixed bottom add bar */}
      {activeStore && (
        <div
          className="fixed bottom-[60px] left-0 right-0 z-40 border-t"
          style={{ backgroundColor: '#F5F0E8', borderColor: 'rgba(0,0,0,0.06)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="max-w-lg md:max-w-[1000px] mx-auto px-4 py-2.5 flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              disabled={addingText}
              placeholder={`Add to ${activeStore.name}…`}
              className="flex-1 rounded-full bg-card min-h-[44px]"
            />
            <button
              onClick={handleAddItem}
              disabled={addingText || !newItem.trim()}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"
              style={{ backgroundColor: '#B8906C' }}
              aria-label="Add item"
            >
              {addingText ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={addingImage}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-card disabled:opacity-40 flex-shrink-0"
              style={{ border: '1px solid #D4C5B0', color: '#5C3D1E' }}
              aria-label="Add from photo"
            >
              {addingImage ? <Loader2 size={16} className="animate-spin" /> : <Camera size={18} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <AddStoreModal open={addStoreOpen} onOpenChange={setAddStoreOpen} onSubmit={handleAddStore} />
      <RenameStoreModal open={renameOpen} onOpenChange={setRenameOpen} store={activeStore} onSubmit={handleRenameStore} />
      <DeleteStoreDialog open={deleteOpen} onOpenChange={setDeleteOpen} store={activeStore} onConfirm={handleDeleteStore} />
      <StoreActionSheet
        open={!!actionSheetStore}
        onOpenChange={(o) => !o && setActionSheetStore(null)}
        store={actionSheetStore}
        onRename={() => { setActiveId(actionSheetStore!.id); setRenameOpen(true); }}
        onDelete={() => { setActiveId(actionSheetStore!.id); setDeleteOpen(true); }}
      />
      <AlertDialog open={confirmClearAllOpen} onOpenChange={setConfirmClearAllOpen}>
        <AlertDialogContent className="max-w-[340px] rounded-[18px]" style={{ backgroundColor: '#F5F0E8' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px]">Clear all items in {activeStore?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              This will permanently delete every item in this store. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleClearAll(); }}
              className="rounded-xl min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============= Item row with swipe-to-delete =============

const SWIPE_REVEAL = 80;
const SWIPE_THRESHOLD = 40;

function ItemRow({
  item,
  onToggle,
  onQty,
  onDelete,
}: {
  item: ShopItem;
  onToggle: (checked: boolean) => void;
  onQty: (q: number) => void;
  onDelete: () => void;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const swiping = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!swiping.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) swiping.current = true;
      else return;
    }
    const base = revealed ? -SWIPE_REVEAL : 0;
    let next = base + dx;
    if (next > 0) next = 0;
    if (next < -SWIPE_REVEAL * 1.5) next = -SWIPE_REVEAL * 1.5;
    setTranslateX(next);
  };
  const onTouchEnd = () => {
    if (translateX < -SWIPE_THRESHOLD) {
      setTranslateX(-SWIPE_REVEAL);
      setRevealed(true);
    } else {
      setTranslateX(0);
      setRevealed(false);
    }
    startX.current = null;
    startY.current = null;
    swiping.current = false;
  };

  const handleRowClick = () => {
    if (revealed) {
      setTranslateX(0);
      setRevealed(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-0 right-0 bottom-0 flex items-center justify-center text-white"
        style={{ width: SWIPE_REVEAL, backgroundColor: '#C44' }}
        aria-label="Delete item"
        tabIndex={revealed ? 0 : -1}
      >
        <Trash2 size={16} />
      </button>
      <div
        className={`flex items-center gap-3 px-4 py-2.5 bg-card transition-opacity ${item.checked ? 'opacity-50' : ''}`}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: startX.current !== null ? 'none' : 'transform 0.18s ease-out',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleRowClick}
      >
        <Checkbox
          checked={!!item.checked}
          onCheckedChange={(c) => onToggle(!!c)}
          className="h-5 w-5"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onQty(Math.max(1, (item.quantity ?? 1) - 1)); }}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground min-w-[24px] min-h-[24px] flex items-center justify-center"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-xs font-medium text-muted-foreground min-w-[18px] text-center">{item.quantity ?? 1}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onQty((item.quantity ?? 1) + 1); }}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground min-w-[24px] min-h-[24px] flex items-center justify-center"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <span className={`flex-1 text-[14px] ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {item.item}
        </span>
      </div>
    </div>
  );
}
