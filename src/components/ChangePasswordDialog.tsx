import { FormEvent, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, saveToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

const ChangePasswordDialog = ({ open, onClose }: ChangePasswordDialogProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8 || newPassword.length > 72) return setError('Yangi parol 8–72 ta belgidan iborat bo‘lsin.');
    if (newPassword !== confirmPassword) return setError('Yangi parollar bir xil emas.');
    setLoading(true);
    try {
      const result = await apiRequest<{ token?: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (result.token) saveToken(result.token);
      toast.success('Parolingiz yangilandi. Saytdan foydalanishda davom etishingiz mumkin.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parolni yangilab bo‘lmadi.');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !loading) onClose(); }}>
      <DialogContent className="glass border-border sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Parolni yangilash</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="mt-3 space-y-4">
          <Input type="password" autoComplete="current-password" placeholder="Amaldagi parol" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          <Input type="password" autoComplete="new-password" placeholder="Yangi parol (kamida 8 belgi)" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} maxLength={72} />
          <Input type="password" autoComplete="new-password" placeholder="Yangi parolni takrorlang" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} maxLength={72} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saqlanmoqda...</> : 'Parolni saqlash'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
