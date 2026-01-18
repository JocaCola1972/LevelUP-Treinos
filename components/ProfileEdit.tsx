
import React, { useState, useRef } from 'react';
import { User } from '../types';
import { db } from '../services/db';

interface ProfileEditProps {
  user: User;
  refresh: () => void;
  onNavigate: (view: any) => void;
  isAdminEspecial: boolean;
  currentAppLogo?: string;
}

const ProfileEdit: React.FC<ProfileEditProps> = ({ user, refresh, onNavigate, isAdminEspecial, currentAppLogo }) => {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newLogoUrl, setNewLogoUrl] = useState<string>(currentAppLogo || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
      // Salvar perfil do utilizador
      await db.users.save(updatedUser);
      localStorage.setItem('logged_user', JSON.stringify(updatedUser));

      // Se for admin especial, salvar também as configurações da marca
      if (isAdminEspecial && newLogoUrl) {
        await db.settings.saveLogo(newLogoUrl);
      }

      refresh();
      setMessage({ type: 'success', text: 'Perfil e configurações atualizados!' });
      setTimeout(() => onNavigate('dashboard'), 1500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar.' });
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100 pb-8">
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
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nova Password (Opcional)</label>
              <input 
                name="password" 
                type="password"
                placeholder="Deixe em branco para manter"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none transition-all font-bold"
              />
            </div>
          </div>

          {/* Secção exclusiva para o Admin Especial */}
          {isAdminEspecial && (
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg">🎨</span>
                <h3 className="text-sm font-black text-petrol-900 uppercase tracking-tight">Configurações da Marca (APP & Login)</h3>
              </div>
              
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="shrink-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Pré-visualização</p>
                  <div className="w-32 h-32 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-2 overflow-hidden">
                    <img src={newLogoUrl || 'logo.png'} className="max-w-full max-h-full object-contain" alt="Novo Logo" />
                  </div>
                </div>
                
                <div className="flex-1 space-y-4 w-full">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Upload de Logótipo</label>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full mt-1 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all shadow-sm"
                    >
                      Selecionar Nova Imagem...
                    </button>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ou URL da Imagem</label>
                    <input 
                      type="url"
                      value={newLogoUrl.startsWith('data:') ? '' : newLogoUrl}
                      onChange={(e) => setNewLogoUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-padelgreen-400"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 font-medium italic">Esta imagem será utilizada no ecrã de login, menu principal e cabeçalho para todos os utilizadores.</p>
            </div>
          )}

          <div className="flex gap-4 pt-4">
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
              {saving ? 'A guardar...' : 'Guardar Tudo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileEdit;
