import { useState, useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { Dashboard } from '@/components/Dashboard';
import { LoginPage } from '@/components/LoginPage';
import { getProfiles } from '@/lib/api';

const Index = () => {
  const { currentProfile, setCurrentProfile, isLoading } = useProfile();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const loggedIn = localStorage.getItem('vestire_logged_in') === 'true';
      const savedProfileId = localStorage.getItem('vestire_profile_id');
      
      setIsLoggedIn(loggedIn);
      
      if (loggedIn && savedProfileId && !currentProfile) {
        try {
          // Restore profile from saved ID
          const profiles = await getProfiles();
          const savedProfile = profiles.find((p) => p.id === savedProfileId);
          if (savedProfile) {
            setCurrentProfile(savedProfile);
          }
        } catch (error) {
          console.error('Failed to restore session:', error);
        }
      }
      setIsRestoring(false);
    };
    
    restoreSession();
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  // Show loading while restoring session
  if (isRestoring || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // If logged in but no profile (edge case), show login again
  if (!currentProfile) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard />;
};

export default Index;
