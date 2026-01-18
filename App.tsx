
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
    appLogo: 'logo.png'
  });
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'users' | 'shifts' | 'sessions' | 'profile'>('dashboard');

  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setInitError("Configuração do Supabase (URL/KEY) não encontrada.");
      return;
    }

    try {
      setInitError(null);
      setLoading(true);
      
      const [users, shifts, sessions, rsvps, logo] = await Promise.all([
        db.users.getAll(),
        db.shifts.getAll(),
        db.sessions.getAll(),
        db.rsvps.getAll(),
        db.settings.getLogo()
      ]);
      
      let updatedCurrentUser = appState.currentUser;
      
      // Tentar recuperar do localStorage se o estado estiver vazio
      if (!updatedCurrentUser) {
        const savedUser = localStorage.getItem('logged_user');
        if (savedUser) {
          try {
            updatedCurrentUser = JSON.parse(savedUser);
          } catch (e) {
            localStorage.removeItem('logged_user');
          }
        }
      }

      // Validar o utilizador atual contra a lista fresca da DB
      if (updatedCurrentUser) {
        const freshUser = users.find(u => u.id === updatedCurrentUser?.id);
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
        currentUser: updatedCurrentUser,
        appLogo: logo || 'logo.png'
      }));
    } catch (err: any) {
      console.error("Erro crítico ao carregar dados:", err);
      const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      setInitError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [appState.currentUser?.id]);

  useEffect(() => {
    refreshData();
  }, []);

  const handleLogin = (user: User) => {
    localStorage.setItem('logged_user', JSON.stringify(user));
    setAppState(prev => ({ ...prev, currentUser: user }));
    refreshData();
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setAppState(prev => ({ ...prev, currentUser: null }));
  };

  // 1. Erro de Inicialização
  if (initError) {
    return (
      <div className="min-h-screen bg-petrol-950 flex items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-white rounded-[40px] p-8 md:p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">⚠️</div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-4">Erro de Ligação</h2>
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl mb-8">
            <p className="text-red-600 text-sm font-medium leading-relaxed break-words">
              {initError}
            </p>
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => { setInitError(null); refreshData(); }} 
              className="w-full py-4 bg-petrol-900 text-white font-black rounded-2xl hover:bg-petrol-950 transition-all active:scale-95 shadow-lg"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Estado de Carregamento Inicial (sem utilizador em cache)
  if (loading && !appState.currentUser) {
    return (
      <div className="min-h-screen bg-petrol-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-padelgreen-400 border-t-transparent rounded-full mb-6"></div>
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest animate-pulse">Iniciando TREINOS LEVELUP...</p>
      </div>
    );
  }

  // 3. Ecrã de Login (não autenticado)
  if (!appState.currentUser) {
    return <Auth onLogin={handleLogin} appLogo={appState.appLogo || 'logo.png'} />;
  }

  // 4. Interface Principal (apenas quando currentUser existe)
  const renderContent = () => {
    if (loading) return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="animate-spin w-10 h-10 border-4 border-padelgreen-400 border-t-transparent rounded-full"></div>
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest animate-pulse">Sincronizando...</p>
      </div>
    );

    switch (currentView) {
      case 'dashboard': return <Dashboard state={appState} refresh={refreshData} />;
      case 'users': return <UsersList state={appState} refresh={refreshData} />;
      case 'shifts': return <ShiftsList state={appState} refresh={refreshData} />;
      case 'sessions': return <SessionsHistory state={appState} refresh={refreshData} />;
      case 'profile': return <ProfileEdit user={appState.currentUser!} refresh={refreshData} onNavigate={setCurrentView} isAdminEspecial={appState.currentUser?.phone === '917772010'} currentAppLogo={appState.appLogo} />;
      default: return <Dashboard state={appState} refresh={refreshData} />;
    }
  };

  return (
    <Layout 
      user={appState.currentUser} 
      onLogout={handleLogout} 
      currentView={currentView}
      onNavigate={setCurrentView}
      appLogo={appState.appLogo || 'logo.png'}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
