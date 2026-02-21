import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shirt, Sparkles, Heart, Plus } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { Header } from '@/components/Header';
import { WardrobeTab } from '@/components/WardrobeTab';
import { StyleAdvisorTab } from '@/components/StyleAdvisorTab';
import { FavoritesTab } from '@/components/FavoritesTab';

type Tab = 'wardrobe' | 'advisor' | 'favorites';

const tabs = [
  { id: 'wardrobe' as Tab, label: 'Wardrobe', icon: Shirt },
  { id: 'advisor' as Tab, label: 'Style Advisor', icon: Sparkles },
  { id: 'favorites' as Tab, label: 'Favorites', icon: Heart },
];

export function Dashboard() {
  const { currentProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<Tab>('wardrobe');

  if (!currentProfile) return null;

  return (
    <div className="min-h-screen pt-16">
      <Header />

      {/* Tab Navigation */}
      <div className="sticky top-16 z-40 glass-card border-b border-border/30">
        <div className="container-wide section-padding">
          <nav className="flex gap-1 py-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <main className="container-wide section-padding py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'wardrobe' && <WardrobeTab />}
            {activeTab === 'advisor' && <StyleAdvisorTab />}
            {activeTab === 'favorites' && <FavoritesTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
