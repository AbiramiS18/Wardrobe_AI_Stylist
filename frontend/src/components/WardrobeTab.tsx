import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Shirt, Footprints, Watch, ShoppingBag, Trash2, Upload, X, Layers, Logs, Sparkles } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { getItems, addItem, deleteItem, getImageUrl, analyzeItem, WardrobeItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const categories = [
  { value: 'Top', icon: Shirt, label: 'Tops' },
  { value: 'Bottom', icon: Layers, label: 'Bottoms' },
  { value: 'Dress', icon: Logs, label: 'Dresses/Sets' },
  { value: 'Saree', icon: Sparkles, label: 'Sarees' },
  { value: 'Shoes', icon: Footprints, label: 'Shoes' },
  { value: 'Accessory', icon: Watch, label: 'Accessories' },
  { value: 'Outerwear', icon: ShoppingBag, label: 'Outerwear' },
];

export function WardrobeTab() {
  const { currentProfile } = useProfile();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchItems = async () => {
    if (!currentProfile) return;
    try {
      const data = await getItems(currentProfile.id);
      setItems(data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [currentProfile]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto-analyze
      setIsAnalyzing(true);
      try {
        const analysis = await analyzeItem(file);
        if (analysis.name || analysis.category) {
          setNewItem({
            name: analysis.name || '',
            category: analysis.category || ''
          });
          toast.success(`AI identified: ${analysis.name} (${analysis.category})`);
        }
      } catch (error) {
        console.error('Analysis failed:', error);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleAddItem = async () => {
    if (!currentProfile) {
      toast.error('Please select a profile');
      return;
    }

    // Require either a name OR an image (VLM will generate name from image)
    if (!newItem.name.trim() && !imageFile) {
      toast.error('Please provide a name or upload an image');
      return;
    }

    setIsAdding(true);
    try {
      const response = await addItem(
        currentProfile.id,
        imageFile || undefined,
        newItem.name.trim() || undefined,
        newItem.category || undefined
      );
      
      await fetchItems();
      
      // Show appropriate message based on whether VLM was used
      if (response.auto_generated) {
        toast.success(`AI detected: ${response.item.name} (${response.item.category})`);
      } else {
        toast.success(`Added ${response.item.name} to your wardrobe!`);
      }
      
      setNewItem({ name: '', category: '' });
      setImageFile(null);
      setImagePreview(null);
      setIsAddOpen(false);
    } catch (error) {
      toast.error('Failed to add item');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteItem = async (itemName: string) => {
    if (!currentProfile) return;
    try {
      await deleteItem(itemName, currentProfile.id);
      await fetchItems();
      toast.success(`Removed ${itemName}`);
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const filteredItems = selectedCategory
    ? items.filter((item) => item.category === selectedCategory)
    : items;

  const groupedItems = categories.reduce((acc, cat) => {
    acc[cat.value] = filteredItems.filter((item) => item.category === cat.value);
    return acc;
  }, {} as Record<string, WardrobeItem[]>);

  return (
    <div className="space-y-4">
      {/* Sticky Header Container - top-28 accounts for header (4rem) + tab bar (3rem) */}
      <div className="sticky top-28 z-30 bg-background/95 backdrop-blur-sm pb-4 pt-2 -mt-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="font-display text-3xl font-semibold mb-1">Your Wardrobe</h1>
            <p className="text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'items'} in your collection
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>

              <Button className="gap-2 bg-black text-white hover:bg-black/90 border border-white/10 shadow-sm">
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Add New Item</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Upload a photo and AI will auto-detect the item details!
                </p>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* Image Upload - Now Primary */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Photo (AI will auto-detect name & category)
                  </label>
                  {imagePreview ? (
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-secondary">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full aspect-video rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/50 cursor-pointer transition-colors bg-primary/5">
                      <Upload className="w-8 h-8 text-primary/70 mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload an image</span>
                      <span className="text-xs text-muted-foreground/70 mt-1">AI will detect color, type & category</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                
                {isAnalyzing && (
                  <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
                     <Sparkles className="w-4 h-4" />
                     AI is analyzing your image...
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
                  </div>
                </div>

                <Input
                  placeholder="Item name (optional if image uploaded)"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />

                <Select
                  value={newItem.category}
                  onValueChange={(value) => setNewItem({ ...newItem, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category (optional if image uploaded)" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleAddItem}
                  disabled={isAdding}
                  className="w-full bg-black text-white hover:bg-black/90 border-0"
                >
                  {isAdding ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                      Adding...
                    </>
                  ) : (
                    'Add to Wardrobe'
                  )}
                </Button>
              </div>
            </DialogContent>

          </Dialog>

          <input
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            id="bulk-upload"
            onChange={async (e) => {
              const files = e.target.files;
              if (!files || files.length === 0) return;
              if (!currentProfile) {
                toast.error('Please select a profile');
                return;
              }

              const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
              if (imageFiles.length === 0) {
                toast.error('No images found in folder');
                return;
              }

              setIsAdding(true);
              const total = imageFiles.length;
              let successCount = 0;
              const toastId = toast.loading(`Starting upload of ${total} items...`);

              try {
                for (let i = 0; i < total; i++) {
                  toast.loading(`Processing ${i + 1}/${total}: ${imageFiles[i].name}`, { id: toastId });
                  try {
                    await addItem(currentProfile.id, imageFiles[i]);
                    successCount++;
                  } catch (err) {
                    console.error(`Failed to add ${imageFiles[i].name}`, err);
                  }
                }
                
                await fetchItems();
                toast.success(`Successfully added ${successCount} of ${total} items`, { id: toastId });
              } catch (error) {
                toast.error('Batch upload failed', { id: toastId });
              } finally {
                setIsAdding(false);
                // Reset input
                e.target.value = '';
              }
            }}
          />
          <Button 
            variant="elegant" 
            className="gap-2"
            onClick={() => document.getElementById('bulk-upload')?.click()}
            disabled={isAdding}
          >
             <Upload className="w-4 h-4" />
             Bulk Upload
          </Button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === null ? 'gold' : 'elegant'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? 'gold' : 'elegant'}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                className="gap-2"
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
              <div className="aspect-square bg-secondary rounded-lg mb-3" />
              <div className="h-4 bg-secondary rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
            <Shirt className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl mb-2">No items yet</h3>
          <p className="text-muted-foreground mb-4">
            Start building your wardrobe by adding your first item
          </p>
          <Button variant="gold" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Item
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, index) => (
              <motion.div
                key={`${item.profileId}-${item.name}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.03 }}
                className="group glass-card-hover rounded-xl overflow-hidden"
              >
                <div className="aspect-square bg-secondary relative">
                  {item.image ? (
                    <img
                      src={getImageUrl(item.image)}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Shirt className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <button
                    onClick={() => handleDeleteItem(item.name)}
                    className="absolute top-2 right-2 p-2 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
