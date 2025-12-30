import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Link2, Zap, Shield, Layers, ArrowRight, Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const features = [
    {
      icon: Zap,
      title: 'Cheksiz linklar',
      description: 'Istalgancha link saqlang, hech qanday cheklov yo\'q!',
    },
    {
      icon: Layers,
      title: 'Kategoriyalar',
      description: 'Linklaringizni kategoriyalarga ajrating va tartibga soling.',
    },
    {
      icon: Shield,
      title: 'Xavfsiz saqlash',
      description: 'Barcha ma\'lumotlaringiz faqat sizga ko\'rinadi.',
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 glass border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-sm">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-gradient">LinkManager</span>
          </div>
          <Button variant="hero" onClick={() => navigate('/auth')}>
            Boshlash
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 py-20 lg:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-slide-up">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">Linklaringizni boshqaring</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Barcha linklaringiz{' '}
            <span className="text-gradient">bir joyda</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
            Saytlarni xatcho'plarga qo'shib yo'qotib qo'yish o'rniga, barcha 
            muhim linklaringizni tartibga soling va tez topib oling.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <Button variant="hero" size="lg" onClick={() => navigate('/auth')}>
              Bepul boshlash
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass rounded-2xl p-8 glass-hover animate-slide-up"
              style={{ animationDelay: `${0.4 + index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 glow-sm">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 container mx-auto px-4 py-20">
        <div className="glass rounded-3xl p-10 lg:p-16 text-center glow animate-slide-up" style={{ animationDelay: '0.7s' }}>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Hoziroq boshlang!
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Bepul ro'yxatdan o'ting va linklaringizni boshqarishni boshlang.
          </p>
          <Button variant="hero" size="lg" onClick={() => navigate('/auth')}>
            Ro'yxatdan o'tish
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 LinkManager. Barcha huquqlar himoyalangan.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
