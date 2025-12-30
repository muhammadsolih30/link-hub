import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Sidebar from '@/components/Sidebar';
import MobileSidebar from '@/components/MobileSidebar';
import LinkCard from '@/components/LinkCard';
import AddLinkDialog from '@/components/AddLinkDialog';
import AddCategoryDialog from '@/components/AddCategoryDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Category {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface Link {
  id: string;
  title: string;
  url: string;
  category_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [showAddLink, setShowAddLink] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, linksRes] = await Promise.all([
        supabase.from('categories').select('*').order('created_at', { ascending: true }),
        supabase.from('links').select('*').order('created_at', { ascending: false }),
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (linksRes.data) setLinks(linksRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const linkCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach((link) => {
      if (link.category_id) {
        counts[link.category_id] = (counts[link.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [links]);

  const filteredLinks = useMemo(() => {
    let result = links;

    if (selectedCategory) {
      result = result.filter((link) => link.category_id === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (link) =>
          link.title.toLowerCase().includes(query) ||
          link.url.toLowerCase().includes(query)
      );
    }

    return result;
  }, [links, selectedCategory, searchQuery]);

  const handleSaveLink = async (data: { id?: string; title: string; url: string; category_id: string | null }) => {
    if (!user) return;

    try {
      if (data.id) {
        const { error } = await supabase
          .from('links')
          .update({ title: data.title, url: data.url, category_id: data.category_id })
          .eq('id', data.id);

        if (error) throw error;
        toast.success('Link yangilandi!');
      } else {
        const { error } = await supabase.from('links').insert({
          title: data.title,
          url: data.url,
          category_id: data.category_id,
          user_id: user.id,
        });

        if (error) throw error;
        toast.success('Link qo\'shildi!');
      }

      fetchData();
      setEditingLink(null);
    } catch (error) {
      console.error('Error saving link:', error);
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleDeleteLink = async () => {
    if (!deletingLink) return;

    try {
      const { error } = await supabase.from('links').delete().eq('id', deletingLink);
      if (error) throw error;
      toast.success('Link o\'chirildi!');
      fetchData();
    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setDeletingLink(null);
    }
  };

  const handleSaveCategory = async (name: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('categories').insert({
        name,
        user_id: user.id,
      });

      if (error) throw error;
      toast.success('Kategoriya qo\'shildi!');
      fetchData();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;

    try {
      const { error } = await supabase.from('categories').delete().eq('id', deletingCategory);
      if (error) throw error;
      toast.success('Kategoriya o\'chirildi!');
      if (selectedCategory === deletingCategory) {
        setSelectedCategory(null);
      }
      fetchData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setDeletingCategory(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return undefined;
    return categories.find((c) => c.id === categoryId)?.name;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onAddCategory={() => setShowAddCategory(true)}
          onDeleteCategory={(id) => setDeletingCategory(id)}
          userEmail={user?.email}
          onSignOut={handleSignOut}
          linkCounts={linkCounts}
          totalLinks={links.length}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-10 glass border-b border-border px-4 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <MobileSidebar
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onAddCategory={() => setShowAddCategory(true)}
              onDeleteCategory={(id) => setDeletingCategory(id)}
              userEmail={user?.email}
              onSignOut={handleSignOut}
              linkCounts={linkCounts}
              totalLinks={links.length}
            />

            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Linklar ichidan qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button variant="hero" onClick={() => setShowAddLink(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Yangi link</span>
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">
              {selectedCategory
                ? categories.find((c) => c.id === selectedCategory)?.name
                : 'Barcha linklar'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {filteredLinks.length} ta link topildi
            </p>
          </div>

          {filteredLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 animate-float">
                <Link2 className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Hali linklar yo'q</h2>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Birinchi linkingizni qo'shib boshlang. Barcha saytlaringiz bir joyda!
              </p>
              <Button variant="hero" onClick={() => setShowAddLink(true)}>
                <Plus className="w-4 h-4" />
                Birinchi linkni qo'shish
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredLinks.map((link) => (
                <LinkCard
                  key={link.id}
                  id={link.id}
                  title={link.title}
                  url={link.url}
                  createdAt={link.created_at}
                  categoryName={getCategoryName(link.category_id)}
                  onEdit={(id) => {
                    const linkToEdit = links.find((l) => l.id === id);
                    if (linkToEdit) {
                      setEditingLink(linkToEdit);
                      setShowAddLink(true);
                    }
                  }}
                  onDelete={(id) => setDeletingLink(id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <AddLinkDialog
        open={showAddLink}
        onClose={() => {
          setShowAddLink(false);
          setEditingLink(null);
        }}
        onSave={handleSaveLink}
        categories={categories}
        editData={editingLink}
      />

      <AddCategoryDialog
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSave={handleSaveCategory}
      />

      {/* Delete Link Confirmation */}
      <AlertDialog open={!!deletingLink} onOpenChange={() => setDeletingLink(null)}>
        <AlertDialogContent className="glass border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Linkni o'chirmoqchimisiz?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu amalni bekor qilib bo'lmaydi. Link butunlay o'chiriladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLink} className="bg-destructive hover:bg-destructive/90">
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <AlertDialogContent className="glass border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Kategoriyani o'chirmoqchimisiz?</AlertDialogTitle>
            <AlertDialogDescription>
              Kategoriya o'chirilganda, undagi linklar kategoriyasiz qoladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive hover:bg-destructive/90">
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
