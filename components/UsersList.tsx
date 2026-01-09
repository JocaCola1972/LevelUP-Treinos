
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

  const handleDelete = async (id: string) => {
    if (confirm('Tem a certeza que deseja remover este utilizador?')) {
      await db.users.delete(id);
      refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-petrol-900">Directório</h2>
          <p className="text-slate-500 text-sm">Gerencie coaches, alunos e administradores.</p>
        </div>
        <button 
          onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
          className="bg-petrol-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-petrol-950 transition-all flex items-center gap-2 shadow-lg shadow-petrol-900/20"
        >
          <span>+</span> Novo Utilizador
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.users.map(user => (
          <div key={user.id} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col items-center text-center group hover:shadow-xl transition-all hover:border-padelgreen-400">
            <div className="relative mb-4">
              <img src={user.avatar} className="w-24 h-24 rounded-full object-cover ring-4 ring-slate-50 group-hover:ring-padelgreen-100 transition-all" alt="" />
              <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-4 border-white ${user.active !== false ? 'bg-green-500' : 'bg-slate-300'}`}></div>
            </div>
            <h3 className="text-lg font-bold text-petrol-900 mb-1">{user.name}</h3>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4 ${
              user.role === Role.ADMIN ? 'bg-red-50 text-red-600' :
              user.role === Role.COACH ? 'bg-blue-50 text-blue-600' : 'bg-padelgreen-50 text-padelgreen-700'
            }`}>
              {user.role}
            </span>
            
            <div className="w-full space-y-2 mt-auto">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-2 bg-slate-50 rounded-xl mb-4">
                <span>📞</span> {user.phone}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                  className="flex-1 py-2 text-sm font-bold text-petrol-700 hover:bg-petrol-50 rounded-xl transition-all"
                >
                  Editar
                </button>
                <button 
                  onClick={() => handleDelete(user.id)}
                  className="flex-1 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  Apagar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-2xl font-bold text-petrol-900 mb-6">{editingUser ? 'Editar Perfil' : 'Criar Utilizador'}</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              const formData = new FormData(e.currentTarget);
              const newUser: User = {
                id: editingUser?.id || Math.random().toString(36).substr(2, 9),
                name: formData.get('name') as string,
                role: formData.get('role') as Role,
                phone: formData.get('phone') as string,
                avatar: editingUser?.avatar || `https://picsum.photos/seed/${Math.random()}/200`,
                active: true
              };
              await db.users.save(newUser);
              await refresh();
              setSaving(false);
              setIsModalOpen(false);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo</label>
                <input required name="name" defaultValue={editingUser?.name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Telefone</label>
                <input required name="phone" defaultValue={editingUser?.phone} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Função (Role)</label>
                <select name="role" defaultValue={editingUser?.role || Role.STUDENT} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none">
                  <option value={Role.STUDENT}>Aluno</option>
                  <option value={Role.COACH}>Treinador</option>
                  <option value={Role.ADMIN}>Administrador</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" disabled={saving} onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 bg-petrol-900 text-white font-bold rounded-2xl hover:bg-petrol-950 transition-all">
                  {saving ? 'A guardar...' : 'Guardar'}
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
