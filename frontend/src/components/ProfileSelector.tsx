import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, User, Crown, Trash2 } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { createProfile, deleteProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export function ProfileSelector() {
  const { profiles, setCurrentProfile, refreshProfiles, isLoading } = useProfile();
  const [newName, setNewName] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProfile = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setIsCreating(true);
    try {
      const profile = await createProfile(newName.trim(), isOwner);
      await refreshProfiles();
      setCurrentProfile(profile);
      setNewName('');
      setIsOwner(false);
      setIsOpen(false);
      toast.success(`Welcome, ${profile.name}!`);
    } catch (error) {
      toast.error('Failed to create profile');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProfile = async (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    try {
      await deleteProfile(profileId);
      await refreshProfiles();
      toast.success('Profile deleted');
    } catch (error) {
      toast.error('Failed to delete profile');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center section-padding">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold mb-4">
          <span className="text-gradient-gold">Vestire</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto">
          Your personal AI-powered wardrobe curator & styling companion
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-2xl"
      >
        <h2 className="font-display text-xl text-center mb-6 text-muted-foreground">
          Who's styling today?
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <AnimatePresence mode="popLayout">
            {profiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                <button
                  onClick={() => setCurrentProfile(profile)}
                  className="w-full glass-card-hover rounded-xl p-6 text-center"
                >
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    {profile.isOwner ? (
                      <Crown className="w-7 h-7 text-primary-foreground" />
                    ) : (
                      <User className="w-7 h-7 text-primary-foreground" />
                    )}
                  </div>
                  <p className="font-medium text-foreground">{profile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profile.isOwner ? 'Owner' : 'Member'}
                  </p>
                </button>
                <button
                  onClick={(e) => handleDeleteProfile(e, profile.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full bg-destructive/10 hover:bg-destructive/20"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add Profile Card */}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: profiles.length * 0.05 }}
                className="glass-card-hover rounded-xl p-6 text-center border-2 border-dashed border-border/50 hover:border-primary/30"
              >
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-secondary flex items-center justify-center">
                  <Plus className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">Add Profile</p>
              </motion.button>
            </DialogTrigger>
            <DialogContent className="glass-card sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Create Profile</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input
                  placeholder="Enter your name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                />
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isOwner"
                    checked={isOwner}
                    onCheckedChange={(checked) => setIsOwner(checked as boolean)}
                  />
                  <label
                    htmlFor="isOwner"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    This is the main owner of the wardrobe
                  </label>
                </div>
                <Button
                  onClick={handleCreateProfile}
                  disabled={isCreating}
                  variant="gold"
                  className="w-full"
                >
                  {isCreating ? 'Creating...' : 'Create Profile'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>
    </div>
  );
}
