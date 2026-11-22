import { Link2, Layers, Plus, Trash2, LogOut, User, Menu, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

interface Category {
  id: string;
  name: string;
}

interface MobileSidebarProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  onAddCategory: () => void;
  onDeleteCategory: (id: string) => void;
  userEmail?: string;
  onSignOut: () => void;
  onChangePassword: () => void;
  linkCounts: Record<string, number>;
  totalLinks: number;
}

const MobileSidebar = ({
  categories,
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  onDeleteCategory,
  userEmail,
  onSignOut,
  onChangePassword,
  linkCounts,
  totalLinks,
}: MobileSidebarProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (id: string | null) => {
    onSelectCategory(id);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 glass border-border">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-sm">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-gradient">LinkManager</span>
          </div>
        </div>

        {/* Categories */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
            Kategoriyalar
          </p>

          {/* All Links */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200',
              selectedCategory === null
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'hover:bg-secondary text-foreground'
            )}
          >
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4" />
              <span className="font-medium">Barcha linklar</span>
            </div>
            <span className="text-xs bg-secondary px-2 py-0.5 rounded-md">{totalLinks}</span>
          </button>

          {/* Category List */}
          {categories.map((category) => (
            <div
              key={category.id}
              className={cn(
                'group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer',
                selectedCategory === category.id
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'hover:bg-secondary text-foreground'
              )}
              onClick={() => handleSelect(category.id)}
            >
              <span className="font-medium truncate">{category.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-secondary px-2 py-0.5 rounded-md">
                  {linkCounts[category.id] || 0}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCategory(category.id);
                  }}
                  className="text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Add Category */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setOpen(false);
              onAddCategory();
            }}
          >
            <Plus className="w-4 h-4" />
            Kategoriya qo'shish
          </Button>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-3 p-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{userEmail}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive mt-2"
            onClick={onSignOut}
          >
            <LogOut className="w-4 h-4" />
            Chiqish
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 mt-1"
            onClick={() => { setOpen(false); onChangePassword(); }}
          >
            <KeyRound className="w-4 h-4" />
            Parolni yangilash
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileSidebar;
