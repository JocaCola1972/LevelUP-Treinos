
import React, { useState } from 'react';
import { AppState, Role, User } from '../types';
import { db } from '../services/db';

interface UsersListProps {
  state: AppState;
  refresh: () => void;
}

const UsersList: React.FC<UsersListProps> = ({ state, refresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Verificação do "Admin Especial" (Telefone 917772010)
  const isAdminEspecial = state.currentUser?.phone === '917772010';

  const handleDelete = async (id: string) => {
    if (confirm('Tem a certeza que deseja remover este utilizador?')) {
      try {
        await db.users.delete(id);
        refresh();
      } catch (err: any) {
        alert(`Erro ao apagar: ${err.message || 'Erro desconhecido'}`);
      }
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    
    const formData = new FormData(e.currentTarget);
    const phone = formData.get('phone') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as Role;
    
    if (!editingUser) {
      const exists = state.users.find(u => u.phone === phone);
      if (exists) {
        alert(`O número ${phone} já está registado para o utilizador ${exists.name}.`);
        setSaving(false);
        return;
      }
    }

    try {
      const userToSave: User = {
        id: editingUser?.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: name,
        role: role,
        phone: phone,
        password: (formData.get('password') as string) || editingUser?.password || '123',
        avatar: editingUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        active: true
      };

      await db.users.save(userToSave);
      await refresh();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Não foi possível guardar o utilizador: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-petrol-900">Comunidade</h2>
            <p className="text-slate-500 text-xs md:text-sm">Gestão de acessos e perfis.</p>
          </div>
          {isAdminEspecial && (
            <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-amber-200">
              Acesso Total Especial
            </span>
          )}
        </div>
        <button 
          onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
          className="w-full sm:w-auto bg-petrol-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-petrol-950 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 text-sm"
        >
          <span>+</span> Novo Utilizador
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
        {state.users.map(user => (
          <div key={user.id} className="bg-white rounded-2xl border border-slate-200 p-3 md:p-4 flex flex-col items-center text-center group hover:shadow-md transition-all hover:border-padelgreen-400 relative">
            <div className="relative mb-2">
              <img 
                src={user.avatar} 
                className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover ring-2 ring-slate-50 group-hover:ring-padelgreen-100 transition-all bg-slate-100" 
                alt="" 
              />
              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${user.active !== false ? 'bg-green-500' : 'bg-slate-300'}`}></div>
            </div>

            <h3 className="text-xs md:text-sm font-bold text-petrol-900 mb-0.5 line-clamp-1 w-full px-1">{user.name}</h3>
            
            <div className="flex items-center gap-1 mb-2">
              <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md ${
                user.role === Role.ADMIN ? 'bg-red-50 text-red-600' :
                user.role === Role.COACH ? 'bg-blue-50 text-blue-600' : 'bg-padelgreen-50 text-padelgreen-700'
              }`}>
                {user.role}
              </span>
            </div>
            
            <div className="w-full space-y-2 mt-auto">
              <div className="text-[10px] text-slate-500 font-medium py-1 bg-slate-50 rounded-lg truncate px-1">
                {user.phone}
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                  className="flex-1 py-1.5 text-[10px] font-bold text-petrol-700 bg-slate-50 hover:bg-petrol-50 rounded-lg transition-all active:scale-95"
                >
                  Editar
                </button>
                <button 
                  onClick={() => handleDelete(user.id)}
                  className="flex-1 py-1.5 text-[10px] font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-lg transition-all active:scale-95"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[40px] sm:rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom duration-300">
            <h3 className="text-xl md:text-2xl font-bold text-petrol-900 mb-6">{editingUser ? 'Ficha de Utilizador' : 'Novo Registo'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Nome Completo</label>
                <input required name="name" defaultValue={editingUser?.name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Telefone (Login)</label>
                <input required name="phone" type="tel" defaultValue={editingUser?.phone} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Nível de Acesso</label>
                <select name="role" defaultValue={editingUser?.role || Role.STUDENT} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none text-sm">
                  <option value={Role.STUDENT}>Aluno</option>
                  <option value={Role.COACH}>Treinador</option>
                  <option value={Role.ADMIN}>Administrador</option>
                </select>
              </div>
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Password / PIN</label>
                <div className="relative">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"}
                    placeholder={editingUser ? "Deixe vazio para manter" : "Padrão: 123"}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none text-sm" 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold uppercase">
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl hover:bg-petrol-950 transition-all shadow-lg text-sm">
                  {saving ? 'A guardar...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersList;
