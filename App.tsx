
import React, { useState, useEffect, useCallback } from 'react';
import { User, Role, AppState } from './types';
import { db } from './services/db';
import { isSupabaseConfigured } from './services/supabase';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UsersList from './components/UsersList';
import ShiftsList from './components/ShiftsList';
import SessionsHistory from './components/SessionsHistory';
import ProfileEdit from './components/ProfileEdit';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    currentUser: null,
    users: [],
    shifts: [],
    sessions: [],
    rsvps: [],
    isOffline: false,
  });
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'users' | 'shifts' | 'sessions' | 'profile'>('dashboard');

  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setInitError(null);
      setLoading(true);
      const [users, shifts, sessions, rsvps] = await Promise.all([
        db.users.getAll(),
        db.shifts.getAll(),
        db.sessions.getAll(),
        db.rsvps.getAll()
      ]);
      
      // Se o utilizador atual estiver logado, atualizamos os dados dele a partir da DB
      let updatedCurrentUser = appState.currentUser;
      if (appState.currentUser) {
        const freshUser = users.find(u => u.id === appState.currentUser?.id);
        if (freshUser) {
          updatedCurrentUser = freshUser;
          localStorage.setItem('logged_user', JSON.stringify(freshUser));
        }
      }

      setAppState(prev => ({
        ...prev,
        users,
        shifts,
        sessions,
        rsvps,
        currentUser: updatedCurrentUser
      }));
    } catch (err: any) {
      console.error("Erro detectado na base de dados:", err);
      let msg = err?.message || "Erro desconhecido";
      setInitError(msg);
    } finally {
      setLoading(false);
    }
  }, [appState.currentUser?.id]);

  useEffect(() => {
    const savedUser = localStorage.getItem('logged_user');
    if (savedUser) {
      setAppState(prev => ({ ...prev, currentUser: JSON.parse(savedUser) }));
    }
    refreshData();
  }, []);

  const handleLogin = (user: User) => {
    localStorage.setItem('logged_user', JSON.stringify(user));
    setAppState(prev => ({ ...prev, currentUser: user }));
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setAppState(prev => ({ ...prev, currentUser: null }));
  };

  if (initError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-center">
        <div className="max-w-2xl w-full bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Erro de Base de Dados</h2>
          <p className="text-red-500 mb-6">{initError}</p>
          <button onClick={refreshData} className="w-full py-4 bg-petrol-900 text-white font-bold rounded-2xl">Tentar Novamente</button>
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return <div className="p-10 text-center">Configuração Supabase em falta.</div>;
  }

  if (!appState.currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  const renderContent = () => {
    if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-padelgreen-400 border-t-transparent rounded-full"></div></div>;

    switch (currentView) {
      case 'dashboard': return <Dashboard state={appState} refresh={refreshData} />;
      case 'users': return <UsersList state={appState} refresh={refreshData} />;
      case 'shifts': return <ShiftsList state={appState} refresh={refreshData} />;
      case 'sessions': return <SessionsHistory state={appState} refresh={refreshData} />;
      case 'profile': return <ProfileEdit user={appState.currentUser} refresh={refreshData} onNavigate={setCurrentView} />;
      default: return <Dashboard state={appState} refresh={refreshData} />;
    }
  };

  return (
    <Layout 
      user={appState.currentUser} 
      onLogout={handleLogout} 
      currentView={currentView}
      onNavigate={setCurrentView}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
