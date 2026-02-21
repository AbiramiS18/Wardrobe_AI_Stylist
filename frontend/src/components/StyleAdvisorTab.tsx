import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  MapPin,
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  Wind,
  Heart,
  Loader2,
  Shirt,
  AlertTriangle,
  Plus,
  X,
  History,
  ChevronRight,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { getStyleAdvice, getItems, saveFavorite, getImageUrl, StyleSuggestion, WardrobeItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// History item interface
interface StyleHistoryItem {
  id: string;
  occasion: string;
  city: string;
  suggestion: StyleSuggestion;
  timestamp: string;
}

const HISTORY_STORAGE_KEY = 'vestire_style_history';

const getWeatherIcon = (condition: string) => {
  const lower = condition.toLowerCase();
  if (lower.includes('rain') || lower.includes('drizzle')) return CloudRain;
  if (lower.includes('snow')) return Snowflake;
  if (lower.includes('cloud') || lower.includes('fog')) return Cloud;
  if (lower.includes('wind')) return Wind;
  return Sun;
};

// Save to history
const saveToHistory = (profileId: string, occasion: string, city: string, suggestion: StyleSuggestion) => {
  const historyKey = `${HISTORY_STORAGE_KEY}_${profileId}`;
  const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]') as StyleHistoryItem[];
  
  const newItem: StyleHistoryItem = {
    id: Date.now().toString(),
    occasion,
    city,
    suggestion,
    timestamp: new Date().toISOString(),
  };
  
  // Keep only last 20 items
  const updatedHistory = [newItem, ...existingHistory].slice(0, 20);
  localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
};

// Get history
const getHistory = (profileId: string): StyleHistoryItem[] => {
  const historyKey = `${HISTORY_STORAGE_KEY}_${profileId}`;
  return JSON.parse(localStorage.getItem(historyKey) || '[]');
};

export function StyleAdvisorTab() {
  const { currentProfile } = useProfile();
  const [occasion, setOccasion] = useState('');
  const [city, setCity] = useState('Chennai');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<StyleSuggestion | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isWardrobeEmpty, setIsWardrobeEmpty] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [currentOccasion, setCurrentOccasion] = useState('');
  
  // History state
  const [showHistoryPage, setShowHistoryPage] = useState(false);
  const [history, setHistory] = useState<StyleHistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<StyleHistoryItem | null>(null);

  // Load history on mount
  useEffect(() => {
    if (currentProfile) {
      setHistory(getHistory(currentProfile.id));
    }
  }, [currentProfile]);

  const handleGetAdvice = async () => {
    if (!currentProfile || !occasion.trim()) {
      toast.error('Please enter an occasion');
      return;
    }

    setIsLoading(true);
    setSuggestion(null);
    setIsWardrobeEmpty(false);
    setCurrentOccasion(occasion.trim());

    try {
      // First check if wardrobe has items
      const wardrobeItems = await getItems(currentProfile.id);
      
      if (wardrobeItems.length === 0) {
        setIsWardrobeEmpty(true);
        setIsLoading(false);
        toast.warning('Your wardrobe is empty! Add some items first to get AI styling advice.', {
          duration: 5000,
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        });
        return;
      }

      // Fetch style advice
      const result = await getStyleAdvice(occasion.trim(), currentProfile.id, city);
      
      // Parse item names from the suggestion text
      const suggestionText = result.suggestion || '';
      const categoryPrefixes = ['Top:', 'Bottom:', 'Shoes:', 'Accessory:', 'Outerwear:'];
      
      const parsedItems: WardrobeItem[] = [];
      
      const lines = suggestionText.split('\n');
      for (const line of lines) {
        for (const prefix of categoryPrefixes) {
          if (line.includes(prefix)) {
            const afterPrefix = line.split(prefix)[1];
            if (afterPrefix) {
              let itemName = afterPrefix.split('(')[0].trim();
              
              const matchedItem = wardrobeItems.find((wardrobeItem) => {
                const normalizedSuggested = itemName.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
                const normalizedWardrobe = wardrobeItem.name.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
                return normalizedSuggested === normalizedWardrobe || 
                       normalizedSuggested.includes(normalizedWardrobe) || 
                       normalizedWardrobe.includes(normalizedSuggested);
              });
              
              if (matchedItem) {
                parsedItems.push(matchedItem);
              }
            }
          }
        }
      }
      
      const finalItems = parsedItems.length > 0 ? parsedItems : result.items;
      
      const finalSuggestion = {
        ...result,
        items: finalItems
      };
      
      setSuggestion(finalSuggestion);
      setShowResultModal(true);
      
      // Save to history
      saveToHistory(currentProfile.id, occasion.trim(), city, finalSuggestion);
      setHistory(getHistory(currentProfile.id));
      
    } catch (error) {
      toast.error('Failed to get styling advice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFavorite = async () => {
    if (!currentProfile || !suggestion) return;

    setIsSaving(true);
    try {
      const itemNames = suggestion.items.map((item) => item.name);
      await saveFavorite(currentProfile.id, currentOccasion, itemNames, suggestion.suggestion);
      toast.success('Outfit saved to favorites!');
    } catch (error) {
      toast.error('Failed to save favorite');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setShowResultModal(false);
    setOccasion('');
  };

  const handleViewHistoryItem = (item: StyleHistoryItem) => {
    setSelectedHistoryItem(item);
  };

  const handleBackToHistory = () => {
    setSelectedHistoryItem(null);
  };

  const WeatherIcon = suggestion?.weather ? getWeatherIcon(suggestion.weather.condition) : Sun;

  // History Page View
  if (showHistoryPage) {
    return (
      <div className="space-y-6">
        {/* History Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowHistoryPage(false);
              setSelectedHistoryItem(null);
            }}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="font-display text-2xl font-semibold">Style History</h1>
        </div>

        {selectedHistoryItem ? (
          // Selected History Item Detail View
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToHistory}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to History
            </Button>

            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedHistoryItem.timestamp).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <h2 className="font-display text-xl font-semibold mt-1">
                    {selectedHistoryItem.occasion}
                  </h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" />
                    {selectedHistoryItem.city}
                  </p>
                </div>
              </div>

              {/* Weather */}
              {selectedHistoryItem.suggestion.weather && (
                <div className="glass-card rounded-xl p-4 mb-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {(() => {
                      const Icon = getWeatherIcon(selectedHistoryItem.suggestion.weather.condition);
                      return <Icon className="w-6 h-6 text-primary" />;
                    })()}
                  </div>
                  <div>
                    <p className="text-2xl font-display font-semibold">
                      {selectedHistoryItem.suggestion.weather.temp}°C
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedHistoryItem.suggestion.weather.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Outfit Items */}
              {selectedHistoryItem.suggestion.items.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3">Suggested Items</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {selectedHistoryItem.suggestion.items.map((item) => (
                      <div key={item.name} className="flex-shrink-0 w-24">
                        <div className="w-24 h-24 rounded-lg bg-secondary overflow-hidden mb-2">
                          {item.image ? (
                            <img
                              src={getImageUrl(item.image)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                              <Shirt className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-center truncate">{item.name}</p>
                        <p className="text-xs text-center text-muted-foreground">{item.category}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Response */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h3 className="text-sm font-medium mb-3">Style Advice</h3>
                <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed bg-secondary/30 rounded-lg p-4">
                  {selectedHistoryItem.suggestion.suggestion}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          // History List
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                  <History className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl mb-2">No History Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Get some style advice to see your history here
                </p>
                <Button variant="gold" onClick={() => setShowHistoryPage(false)}>
                  Get Style Advice
                </Button>
              </div>
            ) : (
              history.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleViewHistoryItem(item)}
                  className="glass-card rounded-xl p-4 cursor-pointer hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{item.occasion}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {item.city}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm mb-4"
        >
          <Sparkles className="w-4 h-4" />
          AI-Powered Styling
        </motion.div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-3">
          Your Personal Style Advisor
        </h1>
        <p className="text-muted-foreground">
          Tell me the occasion and your location — I'll suggest the perfect outfit from your wardrobe,
          considering the weather.
        </p>
      </div>

      {/* History Button */}
      <div className="flex justify-center">
        <Button
          variant="elegant"
          onClick={() => setShowHistoryPage(true)}
          className="gap-2"
        >
          <History className="w-4 h-4" />
          View History ({history.length})
        </Button>
      </div>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-xl mx-auto glass-card rounded-2xl p-6"
      >
        <div className="space-y-4">
          {/* Occasion/Query Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Describe what you want to wear</label>
            <Textarea
              placeholder="e.g., 'I need a red dress for a party', 'Something casual for a movie', or 'Blue shirt with jeans'..."
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="resize-none h-24"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGetAdvice();
                }
              }}
            />
          </div>

          {/* City Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Your location
            </label>
            <Input
              placeholder="City name"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <Button
            onClick={handleGetAdvice}
            disabled={isLoading}
            variant="gold"
            size="lg"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating your look...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Get Style Advice
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Loading Overlay */}
      {createPortal(
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-md"
            >
              <div className="text-center">
                <div className="relative w-28 h-28 mx-auto mb-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 rounded-full border-2 border-dashed border-primary/40"
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-3 rounded-full border border-gold/30"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-5 rounded-full bg-primary/15 flex items-center justify-center shadow-lg"
                  >
                    <motion.div
                      animate={{ rotateY: [0, 180, 360] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Shirt className="w-12 h-12 text-primary" />
                    </motion.div>
                  </motion.div>
                  <motion.div
                    animate={{ y: [-5, 5, -5], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    className="absolute -top-2 -right-2"
                  >
                    <div className="w-7 h-7 rounded-full bg-gold/25 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-gold" />
                    </div>
                  </motion.div>
                </div>
                <motion.p 
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-xl font-display font-semibold text-primary"
                >
                  Checking your wardrobe...
                </motion.p>
                <p className="mt-2 text-sm text-muted-foreground">Finding the perfect pieces for you</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Empty Wardrobe Warning */}
      <AnimatePresence>
        {isWardrobeEmpty && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-xl mx-auto"
          >
            <div className="glass-card rounded-2xl p-8 text-center border-2 border-dashed border-amber-500/30 bg-amber-500/5">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center"
              >
                <AlertTriangle className="w-10 h-10 text-amber-500" />
              </motion.div>
              <h3 className="font-display text-xl font-semibold mb-2 text-amber-600 dark:text-amber-400">
                Your Wardrobe is Empty!
              </h3>
              <p className="text-muted-foreground mb-6">
                Add some clothing items to your wardrobe first, then come back for personalized AI styling advice.
              </p>
              <Button
                variant="gold"
                onClick={() => {
                  const wardrobeTab = document.querySelector('[data-tab="wardrobe"]') as HTMLElement;
                  if (wardrobeTab) {
                    wardrobeTab.click();
                  }
                }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Go to Wardrobe & Add Items
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-Page Result Modal */}
      {createPortal(
        <AnimatePresence>
          {showResultModal && suggestion && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-lg overflow-y-auto"
            >
              {/* Close Button */}
              <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-background/50 backdrop-blur-sm border-b border-border/30">
                <h2 className="font-display text-lg font-semibold">Your Style Advice</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseModal}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="max-w-3xl mx-auto p-6 space-y-6">
                {/* Occasion Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                    <Sparkles className="w-4 h-4" />
                    {currentOccasion}
                  </span>
                </motion.div>

                {/* Weather Card */}
                {suggestion.weather && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <WeatherIcon className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{suggestion.weather.city}</p>
                        <p className="text-2xl font-display font-semibold">
                          {suggestion.weather.temp}°C
                        </p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {suggestion.weather.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Humidity: {suggestion.weather.humidity}%</p>
                    </div>
                  </motion.div>
                )}

                {/* Outfit Items */}
                {suggestion.items.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card rounded-2xl p-6"
                  >
                    <h3 className="font-display text-lg font-semibold mb-4">Your Outfit</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {suggestion.items.map((item, index) => (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3 + index * 0.1 }}
                          className="text-center"
                        >
                          <div className="aspect-square rounded-xl bg-secondary overflow-hidden mb-2 shadow-lg">
                            {item.image ? (
                              <img
                                src={getImageUrl(item.image)}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                <Shirt className="w-12 h-12" />
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* AI Response */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card rounded-2xl p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-display text-lg font-semibold">Styling Tips</h3>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={handleSaveFavorite}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Heart className={`w-4 h-4 ${isSaving ? 'animate-pulse' : ''}`} />
                      Save to Favorites
                    </Button>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                      {suggestion.suggestion}
                    </div>
                  </div>
                </motion.div>

                {/* Close Button at Bottom */}
                <div className="flex justify-center pb-8">
                  <Button
                    variant="elegant"
                    size="lg"
                    onClick={handleCloseModal}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Get Another Advice
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
