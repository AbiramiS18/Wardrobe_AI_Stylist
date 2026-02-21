import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Trash2, Calendar, MapPin } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { getFavorites, deleteFavorite, FavoriteOutfit } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function FavoritesTab() {
  const { currentProfile } = useProfile();
  const [favorites, setFavorites] = useState<FavoriteOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFavorites = async () => {
    if (!currentProfile) return;
    try {
      const data = await getFavorites(currentProfile.id);
      setFavorites(data);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [currentProfile]);

  const handleDelete = async (favId: string) => {
    try {
      await deleteFavorite(favId);
      await fetchFavorites();
      toast.success('Removed from favorites');
    } catch (error) {
      toast.error('Failed to remove favorite');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold mb-1">Saved Outfits</h1>
        <p className="text-muted-foreground">
          Your favorite looks, curated and ready to wear
        </p>
      </div>

      {/* Favorites Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-secondary rounded w-1/2 mb-3" />
              <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
              <div className="h-4 bg-secondary rounded w-full" />
            </div>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
            <Heart className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl mb-2">No favorites yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Get styling advice and save your favorite outfit combinations here
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {favorites.map((fav, index) => (
              <motion.div
                key={fav.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                className="group glass-card-hover rounded-xl p-5 relative"
              >
                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(fav.id)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>

                {/* Occasion Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
                  <Heart className="w-3 h-3" />
                  {fav.occasion}
                </div>

                {/* Items List */}
                <div className="space-y-1 mb-4">
                  {fav.items.slice(0, 4).map((item, i) => (
                    <p key={i} className="text-sm text-foreground/80">
                      • {item}
                    </p>
                  ))}
                  {fav.items.length > 4 && (
                    <p className="text-sm text-muted-foreground">
                      +{fav.items.length - 4} more
                    </p>
                  )}
                </div>

                {/* Explanation Preview */}
                {fav.explanation && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {fav.explanation}
                  </p>
                )}

                {/* Saved Date */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {fav.savedAt}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
