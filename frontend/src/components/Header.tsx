import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, User, ChevronDown, LogOut, Plus, Trash2, Users, Crown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfile } from '@/contexts/ProfileContext';
import { createProfile, deleteProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { currentProfile, profiles, setCurrentProfile, refreshProfiles } = useProfile();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [isOwner, setIsOwner] = useState(false);
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
      setNewName('');
      setIsOwner(false);
      setShowAddDialog(false);
      toast.success(`Profile "${profile.name}" created!`);
    } catch (error) {
      toast.error('Failed to create profile');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProfile = async (profileId: string, profileName: string) => {
    if (profileId === currentProfile?.id) {
      toast.error("You can't delete your own profile while logged in");
      return;
    }
    
    try {
      await deleteProfile(profileId);
      await refreshProfiles();
      toast.success(`Profile "${profileName}" deleted`);
    } catch (error) {
      toast.error('Failed to delete profile');
    }
  };

  const handleSignOut = () => {
    setCurrentProfile(null);
    localStorage.removeItem('vestire_logged_in');
    localStorage.removeItem('vestire_username');
    localStorage.removeItem('vestire_profile_id');
    window.location.reload();
  };

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/30"
      >
        <div className="container-wide section-padding">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <motion.a
              href="/"
              className="flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
            >
              <span className="font-display text-2xl font-semibold text-gradient-gold">
                Vestire
              </span>
            </motion.a>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-full"
              >
                <motion.div
                  key={theme}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5 text-primary" />
                  ) : (
                    <Moon className="h-5 w-5 text-primary" />
                  )}
                </motion.div>
              </Button>

              {/* Profile Dropdown */}
              {currentProfile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="elegant" className="gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary-foreground">
                          {currentProfile.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="hidden sm:inline">{currentProfile.name}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 glass-card">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{currentProfile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentProfile.isOwner ? 'Owner' : 'Family Member'}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    
                    {/* Switch to other profiles */}
                    {profiles
                      .filter((p) => p.id !== currentProfile.id)
                      .map((profile) => (
                        <DropdownMenuItem
                          key={profile.id}
                          onClick={() => {
                            setCurrentProfile(profile);
                            localStorage.setItem('vestire_profile_id', profile.id);
                            localStorage.setItem('vestire_username', profile.name);
                          }}
                          className="cursor-pointer"
                        >
                          <User className="mr-2 h-4 w-4" />
                          Switch to {profile.name}
                        </DropdownMenuItem>
                      ))}
                    
                    {profiles.length > 1 && <DropdownMenuSeparator />}
                    
                    {/* Add Profile */}
                    <DropdownMenuItem
                      onClick={() => setShowAddDialog(true)}
                      className="cursor-pointer text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Profile
                    </DropdownMenuItem>
                    
                    {/* Manage Profiles */}
                    {profiles.length > 1 && (
                      <DropdownMenuItem
                        onClick={() => setShowManageDialog(true)}
                        className="cursor-pointer"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Manage Profiles
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-muted-foreground"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Add Profile Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Add New Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Enter profile name"
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
                This is an owner profile
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

      {/* Manage Profiles Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Manage Profiles</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {profiles.map((profile) => (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      {profile.isOwner ? (
                        <Crown className="w-5 h-5 text-primary-foreground" />
                      ) : (
                        <User className="w-5 h-5 text-primary-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {profile.name}
                        {profile.id === currentProfile?.id && (
                          <span className="text-xs text-primary ml-2">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile.isOwner ? 'Owner' : 'Member'}
                      </p>
                    </div>
                  </div>
                  {profile.id !== currentProfile?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteProfile(profile.id, profile.name)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <Button
            onClick={() => {
              setShowManageDialog(false);
              setShowAddDialog(true);
            }}
            variant="outline"
            className="w-full mt-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Profile
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
