import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Loader2, Camera } from 'lucide-react';

const NOTE_TYPES = [
  'General', 'Movies & Shows', 'Books & Articles', 'Idea', 'Places & Activities',
  'Memory', 'Reminder', 'People', 'Family', 'Wish List', 'Business', 'Finance',
  'Home Info', 'Health & Medical', 'Quotes', 'Exercise Log', 'Logins & Codes', 'Reference',
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function AddNoteModal({ open, onOpenChange }: Props) {
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('General');
  const [saving, setSaving] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [categorized, setCategorized] = useState(false);

  // Photo state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('');
  const [processingImage, setProcessingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    setImageFile(file);
    setImageMime(file.type);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Full = reader.result as string;
      const base64Data = base64Full.split(',')[1];
      setImageBase64(base64Data);

      // Call vision AI
      try {
        const { data, error } = await supabase.functions.invoke('image-to-text', {
          body: { image_base64: base64Data, mime_type: file.type },
        });
        if (error) throw error;
        if (data?.text) {
          setContent(data.text);
          setCategorized(false);
        }
      } catch {
        toast({ title: 'Image processing failed', description: 'You can still type your note manually.', variant: 'destructive' });
      } finally {
        setProcessingImage(false);
      }
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const categorizeAndSave = async (withPhoto: boolean) => {
    if (!content.trim()) return;
    setSaving(true);

    // Step 1: AI categorize
    let finalType = noteType;
    try {
      const { data, error } = await supabase.functions.invoke('categorize-note', {
        body: { content: content.trim() },
      });
      if (!error && data?.note_type && NOTE_TYPES.includes(data.note_type)) {
        finalType = data.note_type;
      }
    } catch { /* use current noteType */ }

    // Step 2: Upload image if needed
    let imageUrl: string | null = null;
    if (withPhoto && imageFile) {
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(path, imageFile, { contentType: imageFile.type });
      if (uploadError) {
        toast({ title: 'Image upload failed', variant: 'destructive' });
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('note-images').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    // Step 3: Insert note
    try {
      const { error } = await supabase.from('notes').insert({
        content: content.trim(),
        note_type: finalType,
        image_url: imageUrl,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: 'Note saved ✓' });
      resetAndClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to save note.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTextOnly = () => categorizeAndSave(false);
  const handleSaveWithPhoto = () => categorizeAndSave(true);

  // Legacy flow for no-photo notes (categorize first, then confirm)
  const handleSave = async () => {
    if (!content.trim()) return;

    if (!categorized) {
      setCategorizing(true);
      try {
        const { data, error } = await supabase.functions.invoke('categorize-note', {
          body: { content: content.trim() },
        });
        if (error) throw error;
        const aiType = data?.note_type;
        if (aiType && NOTE_TYPES.includes(aiType)) {
          setNoteType(aiType);
        }
        setCategorized(true);
        toast({ title: `AI suggested: ${aiType || 'General'}`, description: 'Review the category and tap Save again to confirm.' });
      } catch {
        toast({ title: 'AI categorization failed', description: 'Defaulting to your selection. Tap Save again to confirm.', variant: 'destructive' });
        setCategorized(true);
      } finally {
        setCategorizing(false);
      }
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('notes').insert({ content: content.trim(), note_type: noteType });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: 'Note saved ✓' });
      resetAndClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to save note.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setContent('');
    setNoteType('General');
    setCategorized(false);
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
    setImageMime('');
    setProcessingImage(false);
    onOpenChange(false);
  };

  const hasImage = !!imagePreview && !processingImage;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md rounded-[18px]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">New Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Processing spinner */}
          {processingImage && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <Loader2 size={28} className="animate-spin" style={{ color: '#B8906C' }} />
              <p className="text-sm text-muted-foreground">Processing image…</p>
            </div>
          )}

          {/* Image preview thumbnail */}
          {hasImage && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#D4C5B0' }}>
              <img
                src={imagePreview!}
                alt="Uploaded"
                className="w-full max-h-[160px] object-cover"
              />
            </div>
          )}

          {!processingImage && (
            <>
              <div className="relative">
                <Textarea
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setCategorized(false); }}
                  placeholder="Write your note..."
                  rows={4}
                  className="resize-none pr-12"
                  disabled={categorizing}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute right-2 top-2 p-2 rounded-lg hover:bg-secondary min-w-[36px] min-h-[36px] flex items-center justify-center"
                  title="Upload photo"
                >
                  <Camera size={18} className="text-muted-foreground" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>

              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {categorized && !hasImage && (
                <p className="text-xs text-muted-foreground">
                  AI suggested <span className="font-semibold text-foreground">{noteType}</span> — change above if needed, then tap Save to confirm.
                </p>
              )}
            </>
          )}
        </div>

        {!processingImage && (
          <DialogFooter>
            {hasImage ? (
              <div className="flex gap-2 w-full">
                <Button
                  onClick={handleSaveTextOnly}
                  disabled={!content.trim() || saving}
                  className="flex-1 rounded-xl"
                  style={{ backgroundColor: '#B8906C' }}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Text Only'}
                </Button>
                <Button
                  onClick={handleSaveWithPhoto}
                  disabled={!content.trim() || saving}
                  variant="outline"
                  className="flex-1 rounded-xl"
                  style={{ borderColor: '#B8906C', color: '#B8906C' }}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save with Photo'}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleSave}
                disabled={!content.trim() || saving || categorizing}
                className="w-full rounded-xl"
                style={{ backgroundColor: '#B8906C' }}
              >
                {categorizing ? (
                  <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Categorizing…</span>
                ) : saving ? 'Saving...' : categorized ? 'Save' : 'Categorize & Save'}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
