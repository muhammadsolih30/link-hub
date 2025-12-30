import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Email manzil noto\'g\'ri').max(255, 'Email juda uzun'),
  password: z.string().min(6, 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak').max(72, 'Parol juda uzun'),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Email yoki parol noto\'g\'ri');
          } else {
            setError(error.message);
          }
        } else {
          toast.success('Muvaffaqiyatli kirdingiz!');
          navigate('/dashboard');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('Bu email allaqachon ro\'yxatdan o\'tgan');
          } else {
            setError(error.message);
          }
        } else {
          toast.success('Ro\'yxatdan muvaffaqiyatli o\'tdingiz!');
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setError('Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 glow-sm mb-4">
            <Link2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">LinkManager</h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Akkauntingizga kiring' : 'Yangi akkaunt yarating'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email manzil"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Parol"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11"
                required
              />
            </div>
          </div>

          <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Yuklanmoqda...
              </>
            ) : isLogin ? (
              'Kirish'
            ) : (
              'Ro\'yxatdan o\'tish'
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? (
                <>Akkauntingiz yo'qmi? <span className="text-primary font-medium">Ro'yxatdan o'ting</span></>
              ) : (
                <>Allaqachon akkauntingiz bormi? <span className="text-primary font-medium">Kirish</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth;
