
import React, { useState } from 'react';
import { AppState, AppMessage, Role } from '../types';
import { db } from '../services/db';

interface MessagingProps {
  state: AppState;
  refresh: () => void;
}

const Messaging: React.FC<MessagingProps> = ({ state, refresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedType, setSelectedType] = useState<'INFO' | 'ALERT'>('INFO');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(['all']);
  const [content, setContent] = useState('');
  const [schemaError, setSchemaError] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSaving(true);
    setSchemaError(false);

    try {
      const newMessage: AppMessage = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: state.currentUser?.id || 'admin',
        recipientIds: selectedRecipients,
        content: content.trim(),
        type: selectedType,
        createdAt: new Date().toISOString()
      };

      await db.messages.save(newMessage);
      setContent('');
      setIsModalOpen(false);
      refresh();
    } catch (err: any) {
      if (err.message?.includes('PGRST205') || err.message?.includes('42P01')) {
        setSchemaError(true);
      } else {
        alert(`Erro ao enviar: ${err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('Eliminar esta comunicação?')) return;
    try {
      await db.messages.delete(id);
      refresh();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const toggleRecipient = (id: string) => {
    if (id === 'all') {
      setSelectedRecipients(['all']);
      return;
    }
    
    let updated = selectedRecipients.filter(r => r !== 'all');
    if (updated.includes(id)) {
      updated = updated.filter(r => r !== id);
      if (updated.length === 0) updated = ['all'];
    } else {
      updated.push(id);
    }
    setSelectedRecipients(updated);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-petrol-900">Mensagens do Administrador</h2>
          <p className="text-slate-500 text-xs md:text-sm">Envie avisos e alertas para a comunidade.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto bg-petrol-900 text-white px-6 py-3 rounded-2xl font-black hover:bg-petrol-950 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 text-sm"
        >
          <span>✉️</span> Nova Mensagem
        </button>
      </div>

      <div className="space-y-4">
        {state.messages.length > 0 ? (
          state.messages.map(msg => (
            <div key={msg.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-4 group">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${msg.type === 'ALERT' ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-petrol-50 border-petrol-100 text-petrol-700'}`}>
                <span className="text-xl">{msg.type === 'ALERT' ? '⚠️' : '✉️'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${msg.type === 'ALERT' ? 'bg-amber-500 text-white' : 'bg-petrol-900 text-white'}`}>
                    {msg.type}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {new Date(msg.createdAt).toLocaleDateString('pt-PT')} às {new Date(msg.createdAt).toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-sm font-bold text-petrol-900 leading-relaxed mb-2">{msg.content}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Destinatários:</span>
                  {msg.recipientIds.includes('all') ? (
                    <span className="text-[9px] font-black text-padelgreen-600 uppercase">Todos os Utilizadores</span>
                  ) : (
                    msg.recipientIds.map(rid => {
                      const u = state.users.find(x => x.id === rid);
                      return <span key={rid} className="text-[9px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{u?.name || rid}</span>
                    })
                  )}
                </div>
              </div>
              <button 
                onClick={() => handleDeleteMessage(msg.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-3 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-2xl"
              >
                🗑️
              </button>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-[32px] p-20 text-center border border-slate-200">
            <span className="text-4xl mb-4 grayscale opacity-30">✉️</span>
            <p className="text-slate-400 font-medium italic">Não existem comunicações registadas.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[40px] sm:rounded-[32px] w-full max-w-xl p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom duration-300">
            <h3 className="text-2xl font-black text-petrol-900 mb-8">Redigir Comunicação</h3>
            
            {schemaError ? (
              <div className="bg-amber-50 border-2 border-amber-400 p-6 rounded-3xl mb-8 space-y-4">
                <h4 className="text-amber-900 font-black text-xs uppercase">🛠️ Configuração SQL Necessária</h4>
                <p className="text-amber-800 text-xs leading-relaxed">A tabela de mensagens ainda não existe. Execute isto no SQL Editor:</p>
                <div className="bg-slate-900 text-padelgreen-400 p-4 rounded-xl font-mono text-[9px] overflow-x-auto select-all">
                  CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, senderId TEXT, recipientIds TEXT[], content TEXT, type TEXT, createdAt TIMESTAMPTZ DEFAULT now());
                </div>
                <button onClick={() => setSchemaError(false)} className="w-full py-3 bg-amber-500 text-white font-black rounded-xl text-[10px] uppercase">OK</button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Tipo de Mensagem</label>
                  <div className="flex gap-4">
                    <button 
                      type="button" 
                      onClick={() => setSelectedType('INFO')}
                      className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${selectedType === 'INFO' ? 'bg-petrol-900 border-petrol-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      ✉️ Info Geral
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setSelectedType('ALERT')}
                      className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${selectedType === 'ALERT' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      ⚠️ Alerta Destaque
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Destinatários</label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button 
                      type="button" 
                      onClick={() => toggleRecipient('all')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedRecipients.includes('all') ? 'bg-padelgreen-400 border-padelgreen-500 text-petrol-950 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      Todos os Utilizadores
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    {state.users.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleRecipient(u.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${selectedRecipients.includes(u.id) ? 'bg-white border-padelgreen-400 shadow-sm ring-2 ring-padelgreen-50' : 'bg-white border-slate-100 text-slate-500'}`}
                      >
                        <img src={u.avatar} className="w-5 h-5 rounded-full" alt="" />
                        <span className="text-[10px] font-bold truncate">{u.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Conteúdo da Mensagem</label>
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    placeholder="Escreva aqui a sua mensagem..."
                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold min-h-[120px] outline-none focus:ring-2 focus:ring-padelgreen-400 transition-all"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-[10px]">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-petrol-900 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl text-[10px] flex items-center justify-center gap-2">
                    {isSaving ? 'A Enviar...' : 'Enviar Agora'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Messaging;
