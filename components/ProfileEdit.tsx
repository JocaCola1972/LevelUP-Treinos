
import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../services/db';

interface ProfileEditProps {
  user: User;
  refresh: () => void;
  onNavigate: (view: any) => void;
}

const ProfileEdit: React.FC<ProfileEditProps> = ({ user, refresh, onNavigate }) => {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const updatedUser: User = {
      ...user,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      password: formData.get('password') as string || user.password,
    };

    try {
      await db.users.save(updatedUser);
      // Atualizar no localStorage para manter a sessão
      localStorage.setItem('logged_user', JSON.stringify(updatedUser));
      refresh();
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      setTimeout(() => onNavigate('dashboard'), 1500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-10 border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="relative group">
            <img 
              src={user.avatar} 
              className="w-24 h-24 rounded-full object-cover ring-4 ring-padelgreen-400 shadow-xl"
              alt={user.name}
            />
            <div className="absolute inset-0 rounded-full bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-xs font-bold">Foto</span>
            </div>
          </div>
          <h2 className="text-2xl font-black text-petrol-900 mt-4">{user.name}</h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-padelgreen-600 bg-padelgreen-50 px-3 py-1 rounded-full mt-2">
            {user.role}
          </span>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-2xl text-sm font-bold text-center border ${
            message.type === 'success' ? 'bg-padelgreen-50 border-padelgreen-200 text-padelgreen-700' : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            {message.type === 'success' ? '✅ ' : '❌ '}{message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome Público</label>
              <input 
                name="name" 
                required 
                defaultValue={user.name}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Telemóvel</label>
              <input 
                name="phone" 
                required 
                defaultValue={user.phone}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none transition-all font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nova Password (Opcional)</label>
            <input 
              name="password" 
              type="password"
              placeholder="Deixe em branco para manter a atual"
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none transition-all font-bold"
            />
          </div>

          <div className="flex gap-4 pt-6">
            <button 
              type="button" 
              onClick={() => onNavigate('dashboard')}
              className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg hover:bg-petrol-950 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              {saving ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileEdit;
