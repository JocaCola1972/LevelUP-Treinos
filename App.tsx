
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

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    currentUser: null,
    users: [],
    shifts: [],
    sessions: [],
    isOffline: false,
  });
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'users' | 'shifts' | 'sessions'>('dashboard');

  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setInitError(null);
      setLoading(true);
      const [users, shifts, sessions] = await Promise.all([
        db.users.getAll(),
        db.shifts.getAll(),
        db.sessions.getAll()
      ]);
      setAppState(prev => ({
        ...prev,
        users,
        shifts,
        sessions,
      }));
    } catch (err: any) {
      console.error("Erro detalhado do Supabase:", err);
      // Extrair mensagem de erro legível
      const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      
      if (msg.includes('relation "users" does not exist') || msg.includes('42P01')) {
        setInitError("Tabelas não encontradas no Supabase. É necessário criar a estrutura da base de dados.");
      } else {
        setInitError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('logged_user');
    if (savedUser) {
      setAppState(prev => ({ ...prev, currentUser: JSON.parse(savedUser) }));
    }
    refreshData();
  }, [refreshData]);

  const handleLogin = (user: User) => {
    localStorage.setItem('logged_user', JSON.stringify(user));
    setAppState(prev => ({ ...prev, currentUser: user }));
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_user');
    setAppState(prev => ({ ...prev, currentUser: null }));
  };

  // Ecrã de erro para tabelas em falta ou falhas de ligação
  if (initError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-2xl bg-white rounded-[40px] p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 text-4xl mb-6 mx-auto">
            ❌
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Erro na Base de Dados</h2>
          <p className="text-red-500 font-medium mb-6">{initError}</p>
          
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-left text-sm mb-6">
            <p className="font-bold text-slate-700 mb-4">Para corrigir, executa este SQL no SQL Editor do teu Dashboard do Supabase:</p>
            <pre className="bg-slate-900 text-padelgreen-400 p-4 rounded-xl text-[10px] overflow-x-auto leading-relaxed font-mono">
{`CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  phone TEXT UNIQUE NOT NULL,
  password TEXT,
  active BOOLEAN DEFAULT true
);

CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  "dayOfWeek" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "studentIds" TEXT[] DEFAULT '{}',
  "coachId" TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  "startDate" TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  "shiftId" TEXT NOT NULL,
  date TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  "attendeeIds" TEXT[] DEFAULT '{}',
  "youtubeUrl" TEXT,
  notes TEXT,
  "aiInsights" TEXT
);

-- Inserir admin inicial
INSERT INTO users (id, name, role, avatar, phone, password, active)
VALUES ('admin-1', 'Admin Especial', 'ADMIN', 'https://picsum.photos/seed/admin917/200', '917772010', '123', true)
ON CONFLICT (phone) DO NOTHING;`}
            </pre>
          </div>
          
          <button 
            onClick={refreshData}
            className="w-full py-4 bg-petrol-900 text-white font-bold rounded-2xl hover:bg-petrol-950 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            🔄 Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Se o Supabase não estiver configurado
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white rounded-[40px] p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center text-amber-600 text-4xl mb-6 mx-auto">
            ⚠️
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Configuração Necessária</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Para ligar a base de dados, tens de definir as variáveis de ambiente <code className="bg-slate-100 px-2 py-1 rounded text-pink-600 font-mono text-sm">SUPABASE_URL</code> e <code className="bg-slate-100 px-2 py-1 rounded text-pink-600 font-mono text-sm">SUPABASE_ANON_KEY</code>.
          </p>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left text-sm space-y-3 mb-4">
            <p className="font-bold text-slate-700">Como resolver:</p>
            <ol className="list-decimal ml-4 text-slate-500 space-y-2">
              <li>Acede ao teu projeto no <strong>Supabase</strong>.</li>
              <li>Vai a <strong>Project Settings > API</strong>.</li>
              <li>Copia o URL e a chave 'anon' public.</li>
              <li>Adiciona-os aos segredos/ambiente deste editor.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (!appState.currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  const renderContent = () => {
    if (loading) return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-padelgreen-400 border-t-transparent rounded-full"></div>
      </div>
    );

    switch (currentView) {
      case 'dashboard': return <Dashboard state={appState} refresh={refreshData} />;
      case 'users': return <UsersList state={appState} refresh={refreshData} />;
      case 'shifts': return <ShiftsList state={appState} refresh={refreshData} />;
      case 'sessions': return <SessionsHistory state={appState} />;
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
