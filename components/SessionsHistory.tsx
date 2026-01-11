
import React, { useState } from 'react';
import { AppState, Role, TrainingSession } from '../types';
import { db } from '../services/db';

interface SessionsHistoryProps {
  state: AppState;
  refresh: () => void;
}

const SessionsHistory: React.FC<SessionsHistoryProps> = ({ state, refresh }) => {
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<TrainingSession | null>(null);

  const activeSession = state.sessions.find(s => s.isActive);
  const userRole = state.currentUser?.role;
  const userId = state.currentUser?.id;
  const isAdmin = userRole === Role.ADMIN;
  const isStaff = userRole === Role.ADMIN || userRole === Role.COACH;

  const handleStartSession = async (shiftId: string) => {
    const newSession: TrainingSession = {
      id: Math.random().toString(36).substr(2, 9),
      shiftId,
      date: new Date().toISOString(),
      isActive: true,
      completed: false,
      attendeeIds: [],
      hiddenForUserIds: []
    };
    await db.sessions.save(newSession);
    refresh();
  };

  const handleFinishSession = async (session: TrainingSession) => {
    if (!isAdmin) {
      alert('Apenas o Administrador pode finalizar treinos.');
      return;
    }
    if (!confirm('Deseja finalizar esta sessão de treino? Todos os utilizadores verão este treino como concluído.')) return;
    const updated = { ...session, isActive: false, completed: true };
    await db.sessions.save(updated);
    refresh();
  };

  const handleDeleteSession = async (mode: 'me' | 'all') => {
    if (!deletingSession || !userId) return;

    if (mode === 'all') {
      if (confirm('TEM A CERTEZA? Esta ação apagará permanentemente o treino para TODOS os utilizadores.')) {
        await db.sessions.delete(deletingSession.id);
      }
    } else {
      const currentHidden = deletingSession.hiddenForUserIds || [];
      const updatedHidden = Array.from(new Set([...currentHidden, userId]));
      const updated = { ...deletingSession, hiddenForUserIds: updatedHidden };
      await db.sessions.save(updated);
    }
    
    setDeletingSession(null);
    refresh();
  };

  const historicalSessions = state.sessions.filter(s => 
    !s.isActive && 
    !(s.hiddenForUserIds || []).includes(userId || '')
  );

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Active Session Section */}
      {activeSession ? (
        <div className="bg-padelgreen-50 border-2 border-padelgreen-400 p-6 rounded-3xl shadow-lg shadow-padelgreen-400/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-16 h-16 bg-padelgreen-400 rounded-2xl animate-pulse flex items-center justify-center shrink-0 shadow-lg shadow-padelgreen-500/20 text-3xl">
              🎾
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-petrol-900 leading-tight">Treino em Curso</h3>
              <p className="text-sm text-petrol-700">A sessão está ativa. {isAdmin ? 'Pode finalizar quando terminar.' : 'A aguardar finalização pelo Administrador.'}</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => setSelectedSession(activeSession)}
              className="flex-1 md:flex-none px-6 py-3 bg-white text-petrol-900 border border-petrol-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95"
            >
              Ver Detalhes
            </button>
            {isAdmin && (
              <button 
                onClick={() => handleFinishSession(activeSession)}
                className="flex-1 md:flex-none px-8 py-3 bg-petrol-900 text-white rounded-2xl font-bold hover:bg-petrol-950 transition-all shadow-lg active:scale-95"
              >
                Finalizar
              </button>
            )}
          </div>
        </div>
      ) : (
        userRole !== Role.STUDENT && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-petrol-900 ml-2">Abrir Novo Treino</h3>
            <div className="overflow-x-auto pb-4 -mx-1 px-1">
              <div className="flex md:grid md:grid-cols-4 gap-4 min-w-[600px] md:min-w-0">
                {state.shifts.slice(0, 4).map(shift => (
                  <div key={shift.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-padelgreen-400 transition-all group flex-1 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{shift.dayOfWeek}</p>
                    <p className="text-lg font-bold text-petrol-900 mb-4">{shift.startTime}</p>
                    <button 
                      onClick={() => handleStartSession(shift.id)}
                      className="w-full py-2.5 rounded-xl bg-slate-50 text-slate-600 text-xs font-bold group-hover:bg-padelgreen-400 group-hover:text-petrol-900 transition-all"
                    >
                      Iniciar Agora
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {/* History Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between ml-2">
          <h3 className="text-lg font-bold text-petrol-900">Histórico de Treinos</h3>
          <button onClick={refresh} className="text-[10px] font-bold text-slate-400 hover:text-petrol-500 uppercase tracking-widest">
            🔄 Atualizar
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {historicalSessions.map(session => {
            const shift = state.shifts.find(s => s.id === session.shiftId);
            return (
              <div 
                key={session.id} 
                className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 relative hover:border-padelgreen-400 hover:shadow-lg transition-all group/card"
              >
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDeletingSession(session); }}
                    className="absolute top-4 right-4 p-2 bg-red-50 text-red-400 rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 z-10"
                  >
                    🗑️
                  </button>
                )}
                
                <div 
                  onClick={() => setSelectedSession(session)}
                  className="cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-4 pr-8">
                    <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{new Date(session.date).toLocaleDateString()}</span>
                    <span className={`text-[9px] md:text-[10px] font-bold px-2.5 py-1 rounded-full ${session.completed ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                      {session.completed ? 'CONCLUÍDO' : 'PENDENTE'}
                    </span>
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-petrol-900 mb-2 leading-tight">
                    {shift?.dayOfWeek} <span className="text-slate-400 font-medium">às {shift?.startTime}</span>
                  </h3>
                  <p className="text-xs md:text-sm text-slate-500 line-clamp-2 mb-4 h-8 md:h-10">
                    {session.notes || "Nenhuma nota registada."}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex -space-x-2">
                      {session.attendeeIds.slice(0, 4).map(id => (
                        <img key={id} src={state.users.find(u => u.id === id)?.avatar} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white" alt="" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Detalhes */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold text-petrol-900">
                {selectedSession.isActive ? 'Gestão de Treino' : 'Detalhes do Treino'}
              </h3>
              <button onClick={() => setSelectedSession(null)} className="hidden md:block text-slate-400 hover:text-slate-600 text-3xl">×</button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Data</p>
                  <p className="text-sm md:text-base font-semibold text-petrol-800">{new Date(selectedSession.date).toLocaleDateString()}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Presenças</p>
                  <p className="text-sm md:text-base font-semibold text-petrol-800">{selectedSession.attendeeIds.length} Alunos</p>
                </div>
              </div>

              {/* Seção de Notas */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Notas do Treinador</h4>
                {isStaff ? (
                  <textarea 
                    placeholder="Registe as observações técnicas aqui..."
                    defaultValue={selectedSession.notes}
                    onBlur={async (e) => {
                      const updated = { ...selectedSession, notes: e.target.value };
                      await db.sessions.save(updated);
                      refresh();
                    }}
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 text-sm focus:ring-2 focus:ring-padelgreen-400 outline-none h-32 transition-all"
                  />
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm md:text-base min-h-24 leading-relaxed">
                    {selectedSession.notes || "Sem notas disponíveis para este treino."}
                  </div>
                )}
              </div>

              {/* Seção de Vídeo (YouTube) */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Vídeo da Sessão (YouTube)</h4>
                {isStaff ? (
                  <div className="space-y-3">
                    <input 
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      defaultValue={selectedSession.youtubeUrl}
                      onBlur={async (e) => {
                        const updated = { ...selectedSession, youtubeUrl: e.target.value };
                        await db.sessions.save(updated);
                        refresh();
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-padelgreen-400 outline-none text-sm transition-all"
                    />
                    {selectedSession.youtubeUrl && (
                      <a 
                        href={selectedSession.youtubeUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 ml-1"
                      >
                        <span>▶️</span> Testar Link do Vídeo
                      </a>
                    )}
                  </div>
                ) : (
                  selectedSession.youtubeUrl ? (
                    <a 
                      href={selectedSession.youtubeUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex items-center justify-center md:justify-start gap-3 p-4 bg-red-50 text-red-700 rounded-2xl font-bold border border-red-100 hover:bg-red-100 transition-all active:scale-[0.98]"
                    >
                      <span className="text-xl">📺</span> Ver Gravação do Treino no YouTube
                    </a>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-sm italic">
                      Nenhum vídeo disponível para esta sessão.
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setSelectedSession(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
              >
                Fechar
              </button>
              {selectedSession.isActive && isAdmin && (
                <button 
                  onClick={() => { handleFinishSession(selectedSession); setSelectedSession(null); }}
                  className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl hover:bg-petrol-950 transition-all shadow-lg active:scale-[0.98]"
                >
                  Finalizar Treino
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Apagar */}
      {deletingSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-petrol-950/60 backdrop-blur-md">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-petrol-900 text-center mb-6">Remover Histórico</h3>
            <div className="space-y-3">
              <button 
                onClick={() => handleDeleteSession('me')}
                className="w-full py-4 bg-slate-100 text-petrol-900 font-bold rounded-2xl"
              >
                Esconder de mim
              </button>
              <button 
                onClick={() => handleDeleteSession('all')}
                className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl"
              >
                Apagar para todos
              </button>
              <button 
                onClick={() => setDeletingSession(null)}
                className="w-full py-4 text-slate-400 font-bold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsHistory;
