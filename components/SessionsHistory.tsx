
import React, { useState } from 'react';
import { AppState, Role, TrainingSession, Shift } from '../types';
import { db } from '../services/db';

interface SessionsHistoryProps {
  state: AppState;
  refresh: () => void;
}

const SessionsHistory: React.FC<SessionsHistoryProps> = ({ state, refresh }) => {
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<TrainingSession | null>(null);
  const [isPastModalOpen, setIsPastModalOpen] = useState(false);
  const [isSavingPast, setIsSavingPast] = useState(false);

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

  const handleSavePastSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingPast(true);
    const formData = new FormData(e.currentTarget);
    
    const shiftId = formData.get('shiftId') as string;
    const date = formData.get('date') as string;
    const attendeeIds = Array.from(formData.getAll('attendeeIds')) as string[];
    const notes = formData.get('notes') as string;
    const youtubeUrl = formData.get('youtubeUrl') as string;

    const newPastSession: TrainingSession = {
      id: `past_${Math.random().toString(36).substr(2, 9)}`,
      shiftId,
      date: new Date(date).toISOString(),
      isActive: false,
      completed: true,
      attendeeIds,
      notes,
      youtubeUrl,
      hiddenForUserIds: []
    };

    try {
      await db.sessions.save(newPastSession);
      refresh();
      setIsPastModalOpen(false);
    } catch (err) {
      alert("Erro ao registar treino passado.");
    } finally {
      setIsSavingPast(false);
    }
  };

  // Filtragem e Ordenação Decrescente
  const historicalSessions = state.sessions.filter(s => {
    if (s.isActive || !s.completed) return false;
    if ((s.hiddenForUserIds || []).includes(userId || '')) return false;
    if (userRole === Role.ADMIN) return true;
    const shift = state.shifts.find(sh => sh.id === s.shiftId);
    if (userRole === Role.COACH) return shift?.coachId === userId;
    if (userRole === Role.STUDENT) return s.attendeeIds.includes(userId || '');
    return false;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const todayStr = new Date().toISOString().split('T')[0];
  const availableShiftsToStart = state.shifts.filter(shift => {
    const isAlreadyFinishedToday = state.sessions.some(s => 
      s.shiftId === shift.id && 
      s.date.startsWith(todayStr) && 
      s.completed
    );
    return !isAlreadyFinishedToday;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Quick Actions Header */}
      <div className="flex flex-col md:flex-row gap-4">
        {activeSession ? (
          <div className="flex-1 bg-padelgreen-50 border-2 border-padelgreen-400 p-6 rounded-3xl shadow-lg shadow-padelgreen-400/10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="w-16 h-16 bg-padelgreen-400 rounded-2xl animate-pulse flex items-center justify-center shrink-0 shadow-lg shadow-padelgreen-500/20 text-3xl">🎾</div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-petrol-900 leading-tight">Treino em Curso</h3>
                <p className="text-sm text-petrol-700">A sessão está ativa.</p>
              </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button onClick={() => setSelectedSession(activeSession)} className="flex-1 md:flex-none px-6 py-3 bg-white text-petrol-900 border border-petrol-200 rounded-2xl font-bold transition-all active:scale-95">Ver Detalhes</button>
              {isAdmin && <button onClick={() => handleFinishSession(activeSession)} className="flex-1 md:flex-none px-8 py-3 bg-petrol-900 text-white rounded-2xl font-bold hover:bg-petrol-950 transition-all shadow-lg active:scale-95">Finalizar</button>}
            </div>
          </div>
        ) : (
          userRole !== Role.STUDENT && availableShiftsToStart.length > 0 && (
            <div className="flex-1 space-y-4">
              <h3 className="text-lg font-bold text-petrol-900 ml-2">Abrir Novo Treino</h3>
              <div className="overflow-x-auto pb-4 -mx-1 px-1">
                <div className="flex md:grid md:grid-cols-4 gap-4 min-w-[600px] md:min-w-0">
                  {availableShiftsToStart.slice(0, 4).map(shift => (
                    <div key={shift.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-padelgreen-400 transition-all group flex-1 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{shift.dayOfWeek}</p>
                      <p className="text-lg font-bold text-petrol-900 mb-4">{shift.startTime}</p>
                      <button onClick={() => handleStartSession(shift.id)} className="w-full py-2.5 rounded-xl bg-slate-50 text-slate-600 text-xs font-bold group-hover:bg-padelgreen-400 group-hover:text-petrol-900 transition-all">Iniciar Agora</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
        
        {isAdmin && (
          <div className="md:w-64 flex items-end mb-4">
            <button 
              onClick={() => setIsPastModalOpen(true)}
              className="w-full h-14 bg-white border border-petrol-200 text-petrol-800 rounded-2xl font-bold hover:bg-petrol-50 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span className="text-xl">📅</span> Registar Passado
            </button>
          </div>
        )}
      </div>

      {/* History Grid - Optimized for density */}
      <div className="space-y-4">
        <div className="flex items-center justify-between ml-2">
          <h3 className="text-lg font-bold text-petrol-900">Histórico de Treinos</h3>
          <button onClick={refresh} className="text-[10px] font-bold text-slate-400 hover:text-petrol-500 uppercase tracking-widest">🔄 Atualizar</button>
        </div>
        
        {historicalSessions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
            {historicalSessions.map(session => {
              const shift = state.shifts.find(s => s.id === session.shiftId);
              const sessionDate = new Date(session.date);
              
              return (
                <div key={session.id} className="bg-white p-4 rounded-2xl border border-slate-200 relative hover:border-padelgreen-400 hover:shadow-md transition-all group/card flex flex-col">
                  {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); setDeletingSession(session); }} className="absolute top-3 right-3 p-1.5 bg-red-50 text-red-400 rounded-lg opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 z-10 text-xs">🗑️</button>
                  )}
                  <div onClick={() => setSelectedSession(session)} className="cursor-pointer flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3 pr-6">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{sessionDate.toLocaleDateString('pt-PT', { weekday: 'short' })}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-petrol-950 leading-none">{sessionDate.getDate()}</span>
                          <span className="text-[11px] font-bold text-petrol-700 capitalize">{sessionDate.toLocaleDateString('pt-PT', { month: 'short' })}</span>
                        </div>
                      </div>
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">OK</span>
                    </div>
                    
                    <div className="mb-3 text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <span>🕒</span> {shift?.startTime}
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-4 italic leading-relaxed h-8">
                      {session.notes ? `"${session.notes}"` : "Sem notas."}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
                      <div className="flex -space-x-1.5">
                        {session.attendeeIds.slice(0, 3).map(id => (
                          <img key={id} src={state.users.find(u => u.id === id)?.avatar} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100" alt="" />
                        ))}
                        {session.attendeeIds.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-400">
                            +{session.attendeeIds.length - 3}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {session.youtubeUrl && (
                          <a 
                            href={session.youtubeUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-7 h-7 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            title="Abrir Vídeo"
                          >
                            <span className="text-[10px]">▶️</span>
                          </a>
                        )}
                        <span className="text-slate-300 text-xs flex items-center">→</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center">
            <p className="text-slate-400 font-medium">Nenhum treino encontrado no histórico.</p>
          </div>
        )}
      </div>

      {/* Modal: Registar Treino Passado */}
      {isPastModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
            <h3 className="text-xl md:text-2xl font-bold text-petrol-900 mb-6">Registar Treino Retroativo</h3>
            <form onSubmit={handleSavePastSession} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Horário</label>
                  <select name="shiftId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-padelgreen-400 transition-all text-sm">
                    {state.shifts.map(sh => (
                      <option key={sh.id} value={sh.id}>{sh.dayOfWeek} às {sh.startTime}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Data</label>
                  <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-padelgreen-400 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Alunos Presentes</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  {state.users.filter(u => u.role === Role.STUDENT).map(student => (
                    <label key={student.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer">
                      <input type="checkbox" name="attendeeIds" value={student.id} className="w-4 h-4 text-padelgreen-500 rounded" />
                      <span className="text-xs truncate">{student.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <textarea name="notes" placeholder="Notas técnicas..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm h-24"></textarea>
              <input type="url" name="youtubeUrl" placeholder="Link YouTube (Opcional)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsPastModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl">Cancelar</button>
                <button type="submit" disabled={isSavingPast} className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg">
                  {isSavingPast ? "A Guardar..." : "Registar Treino"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold text-petrol-900">Detalhes do Treino</h3>
              <button onClick={() => setSelectedSession(null)} className="hidden md:block text-slate-400 hover:text-slate-600 text-3xl">×</button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Data do Treino</p>
                  <p className="text-sm font-semibold">{new Date(selectedSession.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Presenças</p>
                  <p className="text-sm font-semibold">{selectedSession.attendeeIds.length} Alunos</p>
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Notas do Treinador</h4>
                {isStaff ? (
                  <textarea defaultValue={selectedSession.notes} onBlur={async (e) => { const updated = { ...selectedSession, notes: e.target.value }; await db.sessions.save(updated); refresh(); }} className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm focus:ring-2 focus:ring-padelgreen-400 outline-none h-32" />
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm">{selectedSession.notes || "Sem notas."}</div>
                )}
              </div>

              {selectedSession.youtubeUrl && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Análise de Vídeo</h4>
                  <a 
                    href={selectedSession.youtubeUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="w-full flex items-center justify-center gap-3 p-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg hover:bg-red-700 transition-all active:scale-[0.98]"
                  >
                    <span className="text-xl">📺</span> Abrir Gravação (Aplicação Externa)
                  </a>
                </div>
              )}
              
              {isStaff && !selectedSession.youtubeUrl && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Adicionar Vídeo (Link YouTube)</h4>
                  <input type="url" placeholder="https://..." onBlur={async (e) => { const updated = { ...selectedSession, youtubeUrl: e.target.value }; await db.sessions.save(updated); refresh(); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
                </div>
              )}
            </div>
            <button onClick={() => setSelectedSession(null)} className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl mt-8">Fechar</button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingSession && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-petrol-950/60 backdrop-blur-md">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-petrol-900 text-center mb-6">Remover Histórico</h3>
            <div className="space-y-3">
              <button onClick={() => handleDeleteSession('me')} className="w-full py-4 bg-slate-100 font-bold rounded-2xl">Esconder de mim</button>
              <button onClick={() => handleDeleteSession('all')} className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl">Apagar para todos</button>
              <button onClick={() => setDeletingSession(null)} className="w-full py-4 text-slate-400 font-bold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsHistory;
