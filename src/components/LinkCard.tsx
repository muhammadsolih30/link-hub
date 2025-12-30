import { useState } from 'react';
import { ExternalLink, Pencil, Trash2, Calendar, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

interface LinkCardProps {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  categoryName?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const LinkCard = ({ id, title, url, createdAt, categoryName, onEdit, onDelete }: LinkCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const getDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return url;
    }
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  return (
    <div
      className="glass rounded-xl p-4 glass-hover group animate-fade-in"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-4">
        {/* Favicon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
          {getFaviconUrl(url) ? (
            <img
              src={getFaviconUrl(url)!}
              alt={title}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <ExternalLink className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{title}</h3>
              <p className="text-sm text-muted-foreground truncate font-mono">{getDomain(url)}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass border-border">
                  <DropdownMenuItem onClick={() => onEdit(id)} className="cursor-pointer">
                    <Pencil className="w-4 h-4 mr-2" />
                    Tahrirlash
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(id)} className="cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    O'chirish
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-3">
            {categoryName && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                {categoryName}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(createdAt), 'dd.MM.yyyy')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkCard;
