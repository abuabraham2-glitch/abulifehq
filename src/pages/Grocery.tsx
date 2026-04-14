import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2, Plus, Minus, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

const SECTIONS_ORDER = [
  'Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery & Bread',
  'Pantry & Dry Goods', 'Frozen', 'Beverages', 'Spices/Condiments/Sauces',
  'Household', 'Personal Care', 'Other',
];

type GroceryItem = {
  id: string;
  item: string;
  section: string | null;
  checked: boolean | null;
  quantity: number;
  created_at: string | null;
};

export default function Grocery() {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState('');
  const [addingText, setAddingText] = useState(false);
  const [addingImage, setAddingImage] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [confirmClearChecked, setConfirmClearChecked] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['grocery_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as GroceryItem[];
    },
  });

  const toggleCheck = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase.from('grocery_items').update({ checked }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery_items'] }),
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from('grocery_items').update({ quantity }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery_items'] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('grocery_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery_items'] }),
  });

  const handleAddItem = async () => {
    const text = newItem.trim();
    if (!text) return;
    setAddingText(true);
    try {
      const res = await supabase.functions.invoke('grocery-ai', {
        body: { type: 'categorize', item: text },
      });
      if (res.error) throw res.error;
      const section = res.data?.section || 'Other';
      const { error } = await supabase.from('grocery_items').insert({ item: text, section });
      if (error) throw error;
      setNewItem('');
      queryClient.invalidateQueries({ queryKey: ['grocery_items'] });
      toast({ title: `Added "${text}" to ${section}` });
    } catch (e: any) {
      toast({ title: 'Error adding item', description: e.message, variant: 'destructive' });
    } finally {
      setAddingText(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await supabase.functions.invoke('grocery-ai', {
        body: { type: 'parse_image', image_base64: base64 },
      });
      if (res.error) throw res.error;
      const parsed = res.data?.items || [];
      if (parsed.length === 0) {
        toast({ title: 'No items found in image' });
        return;
      }
      const rows = parsed.map((p: { item: string; section: string }) => ({
        item: p.item,
        section: p.section || 'Other',
      }));
      const { error } = await supabase.from('grocery_items').insert(rows);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['grocery_items'] });
      toast({ title: `Added ${parsed.length} items from image` });
    } catch (e: any) {
      toast({ title: 'Error parsing image', description: e.message, variant: 'destructive' });
    } finally {
      setAddingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearChecked = async () => {
    const { error } = await supabase.from('grocery_items').delete().eq('checked', true);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['grocery_items'] });
      toast({ title: 'Checked items cleared' });
    }
    setConfirmClearChecked(false);
  };

  const handleClearAll = async () => {
    const { error } = await supabase.from('grocery_items').delete().gte('created_at', '1970-01-01');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['grocery_items'] });
      toast({ title: 'Grocery list cleared' });
    }
    setConfirmClearAll(false);
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };

  const grouped = useMemo(() => {
    const map: Record<string, GroceryItem[]> = {};
    items.forEach(item => {
      const sec = item.section || 'Other';
      if (!map[sec]) map[sec] = [];
      map[sec].push(item);
    });
    // Sort within sections: unchecked first, then checked
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0))
    );
    return map;
  }, [items]);

  const sortedSections = useMemo(() => {
    return SECTIONS_ORDER.filter(s => grouped[s]?.length > 0);
  }, [grouped]);

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-2xl font-bold text-foreground">🛒 Grocery List</h1>

      {/* Add Items Section */}
      <Card className="p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Add an item..."
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddItem()}
            disabled={addingText}
            className="flex-1"
          />
          <Button
            onClick={handleAddItem}
            disabled={addingText || !newItem.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[70px]"
          >
            {addingText ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Add</>}
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={addingImage}
            className="min-w-[44px] border-primary/30"
          >
            {addingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
      </Card>

      {/* Grocery List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="text-lg">Your grocery list is empty</p>
          <p className="text-sm mt-1">Add items above or scan a handwritten list</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedSections.map(section => {
            const sectionItems = grouped[section];
            const allChecked = sectionItems.every(i => i.checked);
            const uncheckedCount = sectionItems.filter(i => !i.checked).length;
            const isCollapsed = collapsedSections.has(section);

            return (
              <Card
                key={section}
                className={`overflow-hidden transition-opacity ${allChecked ? 'opacity-50' : ''}`}
              >
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-semibold text-foreground">{section}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${uncheckedCount > 0 ? 'font-bold text-[#16A34A] border border-[#16A34A] bg-transparent' : 'text-muted-foreground bg-muted'}`}>
                    {uncheckedCount > 0 ? `${uncheckedCount} left` : 'done'}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-border">
                    {sectionItems.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-border/50 transition-opacity ${
                          item.checked ? 'opacity-40' : ''
                        }`}
                      >
                        <Checkbox
                          checked={!!item.checked}
                          onCheckedChange={(checked) =>
                            toggleCheck.mutate({ id: item.id, checked: !!checked })
                          }
                          className="h-5 w-5"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity.mutate({ id: item.id, quantity: Math.max(1, (item.quantity ?? 1) - 1) })}
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[24px] min-h-[24px] flex items-center justify-center"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-medium text-muted-foreground min-w-[18px] text-center">{item.quantity ?? 1}</span>
                          <button
                            onClick={() => updateQuantity.mutate({ id: item.id, quantity: (item.quantity ?? 1) + 1 })}
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[24px] min-h-[24px] flex items-center justify-center"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span
                          className={`flex-1 text-sm ${
                            item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {item.item}
                        </span>
                        <button
                          onClick={() => deleteItem.mutate(item.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      {items.length > 0 && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setConfirmClearChecked(true)}
            disabled={!items.some(i => i.checked)}
          >
            Clear Checked
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmClearAll(true)}
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Confirm Clear Checked */}
      <AlertDialog open={confirmClearChecked} onOpenChange={setConfirmClearChecked}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all checked items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all checked items from your grocery list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearChecked}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Clear All */}
      <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear entire grocery list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your entire grocery list. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
