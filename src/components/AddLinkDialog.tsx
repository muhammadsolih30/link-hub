import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link2, Globe, Loader2 } from 'lucide-react';
import { z } from 'zod';

interface Category {
  id: string;
  name: string;
}

interface LinkData {
  id?: string;
  title: string;
  url: string;
  category_id: string | null;
}

interface AddLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: LinkData) => Promise<void>;
  categories: Category[];
  editData?: LinkData | null;
}

const linkSchema = z.object({
  title: z.string().trim().min(1, 'Nom kiritish shart').max(100, 'Nom juda uzun'),
  url: z.string().trim().url('To\'g\'ri URL manzil kiriting'),
});

const AddLinkDialog = ({ open, onClose, onSave, categories, editData }: AddLinkDialogProps) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string>('none');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});

  useEffect(() => {
    if (editData) {
      setTitle(editData.title);
      setUrl(editData.url);
      setCategoryId(editData.category_id || 'none');
    } else {
      setTitle('');
      setUrl('');
      setCategoryId('none');
    }
    setErrors({});
  }, [editData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = linkSchema.safeParse({ title, url });
    if (!validation.success) {
      const fieldErrors: { title?: string; url?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'title') fieldErrors.title = err.message;
        if (err.path[0] === 'url') fieldErrors.url = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await onSave({
        id: editData?.id,
        title: title.trim(),
        url: url.trim(),
        category_id: categoryId === 'none' ? null : categoryId,
      });
      onClose();
    } catch (error) {
      console.error('Error saving link:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            {editData ? 'Linkni tahrirlash' : 'Yangi link qo\'shish'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Sayt nomi</Label>
            <Input
              id="title"
              placeholder="Masalan: Google"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL manzil</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10"
              />
            </div>
            {errors.url && <p className="text-sm text-destructive">{errors.url}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Kategoriya</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Kategoriya tanlang" />
              </SelectTrigger>
              <SelectContent className="glass border-border">
                <SelectItem value="none">Kategoriyasiz</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Bekor qilish
            </Button>
            <Button type="submit" variant="hero" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saqlanmoqda...
                </>
              ) : editData ? (
                'Saqlash'
              ) : (
                'Qo\'shish'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLinkDialog;
