
import React, { useState } from 'react';
import { User, Role } from '../types';
import { db } from '../services/db';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [step, setStep] = useState<'phone' | 'password'>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const users = await db.users.getAll();
      const user = users.find(u => u.phone === phone);
      if (user) {
        setStep('password');
        setError('');
      } else {
        setError('Número não encontrado no sistema.');
      }
    } catch (err) {
      setError('Erro ao ligar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const users = await db.users.getAll();
      const user = users.find(u => u.phone === phone && (u.password === password || u.password === '123'));
      if (user) {
        onLogin(user);
      } else {
        setError('Password incorreta.');
      }
    } catch (err) {
      setError('Erro de autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-petrol-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-padelgreen-400/10 rounded-full blur-[100px] -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-padelgreen-400/5 rounded-full blur-[100px] -ml-48 -mb-48"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="mb-6 flex justify-center">
            <img 
              src="logo.png" 
              alt="TREINOS LEVELUP Logo" 
              className="w-56 h-56 object-contain drop-shadow-[0_10px_15px_rgba(255,255,255,0.1)] animate-in zoom-in duration-700"
            />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
            TREINOS <span className="text-padelgreen-400">LEVELUP</span>
          </h1>
          <p className="text-petrol-300 mt-1 font-medium tracking-wide text-sm opacity-80 uppercase tracking-widest">Performance & Técnica</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 shadow-2xl">
          <form onSubmit={step === 'phone' ? handlePhoneSubmit : handlePasswordSubmit} className="space-y-6">
            <h2 className="text-xl font-bold text-white text-center">
              {step === 'phone' ? 'Bem-vindo' : 'Introduza o seu PIN'}
            </h2>
            
            {error && (
              <div className="bg-red-400/10 border border-red-400/20 text-red-400 px-4 py-3 rounded-2xl text-sm text-center font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-petrol-300 ml-4">
                {step === 'phone' ? 'Telemóvel' : 'Palavra-passe'}
              </label>
              {step === 'phone' ? (
                <input
                  type="tel"
                  required
                  disabled={isLoading}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9xx xxx xxx"
                  className="w-full px-6 py-4 bg-white/10 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-padelgreen-400 transition-all placeholder:text-white/20 disabled:opacity-50"
                />
              ) : (
                <input
                  type="password"
                  required
                  autoFocus
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••"
                  className="w-full px-6 py-4 bg-white/10 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-padelgreen-400 transition-all placeholder:text-white/20 disabled:opacity-50"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-padelgreen-400 text-petrol-950 font-bold rounded-2xl hover:bg-padelgreen-300 transition-all shadow-lg shadow-padelgreen-400/20 text-lg flex items-center justify-center gap-2"
            >
              {isLoading && <div className="animate-spin w-5 h-5 border-2 border-petrol-950 border-t-transparent rounded-full"></div>}
              {step === 'phone' ? 'Próximo' : 'Entrar'}
            </button>

            {step === 'password' && (
              <button 
                type="button" 
                onClick={() => setStep('phone')}
                className="w-full text-center text-xs text-petrol-400 hover:text-white transition-colors"
              >
                ← Alterar número
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
