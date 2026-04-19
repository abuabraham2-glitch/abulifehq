import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { Store } from '@/hooks/useStores';

interface AddProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
}

export function AddStoreModal({ open, onOpenChange, onSubmit }: AddProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const handleAdd = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Could not add store');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-[340px] rounded-[18px]" style={{ backgroundColor: '#F5F0E8' }}>
        <DialogHeader>
          <DialogTitle className="text-[16px]">Add a store</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Store name"
            className="rounded-xl bg-card min-h-[44px]"
            autoFocus
          />
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy} className="rounded-xl flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!name.trim() || busy}
            className="rounded-xl flex-1 sm:flex-none text-white"
            style={{ backgroundColor: '#5C3D1E' }}
          >
            {busy && <Loader2 size={14} className="animate-spin mr-1" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RenameProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  store: Store | null;
  onSubmit: (name: string) => Promise<void>;
}

export function RenameStoreModal({ open, onOpenChange, store, onSubmit }: RenameProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && store) {
      setName(store.name);
      setError(null);
      setBusy(false);
    }
  }, [open, store]);

  const handleSave = async () => {
    if (!name.trim() || busy) return;
    if (store && name.trim() === store.name) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Could not rename store');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-[340px] rounded-[18px]" style={{ backgroundColor: '#F5F0E8' }}>
        <DialogHeader>
          <DialogTitle className="text-[16px]">Rename store</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="rounded-xl bg-card min-h-[44px]"
            autoFocus
          />
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy} className="rounded-xl flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || busy}
            className="rounded-xl flex-1 sm:flex-none text-white"
            style={{ backgroundColor: '#5C3D1E' }}
          >
            {busy && <Loader2 size={14} className="animate-spin mr-1" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  store: Store | null;
  onConfirm: () => Promise<void>;
}

export function DeleteStoreDialog({ open, onOpenChange, store, onConfirm }: DeleteProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[340px] rounded-[18px]" style={{ backgroundColor: '#F5F0E8' }}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[16px]">Delete '{store?.name}'?</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px]">
            Delete '{store?.name}' and all its items? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl min-h-[44px]">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className="rounded-xl min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ActionSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  store: Store | null;
  onRename: () => void;
  onDelete: () => void;
}

export function StoreActionSheet({ open, onOpenChange, store, onRename, onDelete }: ActionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[20px]" style={{ backgroundColor: '#F5F0E8' }}>
        <SheetHeader className="text-left">
          <SheetTitle className="text-[15px]">{store?.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 mt-4 pb-4">
          <button
            onClick={() => { onOpenChange(false); onRename(); }}
            className="w-full px-4 py-3 rounded-[12px] bg-card text-left text-[15px] font-medium text-foreground min-h-[48px]"
            style={{ border: '1px solid #E8D5B8' }}
          >
            Rename store
          </button>
          <button
            onClick={() => { onOpenChange(false); onDelete(); }}
            className="w-full px-4 py-3 rounded-[12px] bg-card text-left text-[15px] font-medium text-destructive min-h-[48px]"
            style={{ border: '1px solid #E8D5B8' }}
          >
            Delete store
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="w-full px-4 py-3 rounded-[12px] text-center text-[14px] text-muted-foreground min-h-[48px]"
          >
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
