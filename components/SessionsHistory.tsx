
import React, { useState, useEffect } from 'react';
import { AppState, Role, TrainingSession, Shift, User } from '../types';
import { db } from '../services/db';

interface SessionsHistoryProps {
  state: AppState;
  refresh: () => void;
}

const SessionsHistory: React.FC<SessionsHistoryProps> = ({ state, refresh }) => {
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [editBuffer, setEditBuffer] = useState<TrainingSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<TrainingSession | null>(null);
  const [isPastModalOpen, setIsPastModalOpen] = useState(false);
  const [isSavingPast, setIsSavingPast] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const userRole = state.currentUser?.role;
  const userId = state.currentUser?.id;
  const isAdmin = userRole === Role.ADMIN;
  const isStaff = userRole === Role.ADMIN || userRole === Role.COACH;

  const coaches = state.users.filter(u => u.role === Role.COACH || u.role === Role.ADMIN);
  const activeSession = state.sessions.find(s => s.isActive);

  useEffect(() => {
    if (selectedSession) {
      setEditBuffer({ ...selectedSession });
    } else {
      setEditBuffer(null);
    }
  }, [selectedSession]);

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

  const handleSaveEdit = async () => {
    if (!editBuffer) return;
    setIsSavingEdit(true);
    try {
      // Garantir que campos opcionais vazios sejam null para o Supabase
      const cleanSession = {
        ...editBuffer,
        turmaName: editBuffer.turmaName || null,
        coachId: editBuffer.coachId || null,
        notes: editBuffer.notes || null,
        youtubeUrl: editBuffer.youtubeUrl || null,
        aiInsights: editBuffer.aiInsights || null
      };

      await db.sessions.save(cleanSession);
      refresh();
      setSelectedSession(null);
    } catch (err: any) {
      console.error("Erro detalhado ao guardar sessão:", err);
      const errorDetail = err?.message || err?.details || "Erro de ligação ou permissões na base de dados.";
      
      if (errorDetail.includes('column') && (errorDetail.includes('turmaName') || errorDetail.includes('coachId'))) {
        alert("ERRO DE ESTRUTURA: A base de dados não tem as novas colunas. Por favor, execute o SQL de Reparação no Supabase.");
      } else {
        alert(`Não foi possível guardar: ${errorDetail}`);
      }
    } finally {
      setIsSavingEdit(false);
    }
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
    
    const turmaName = formData.get('turmaName') as string;
    const coachId = formData.get('coachId') as string;
    const dateStr = formData.get('date') as string;
    const timeStr = formData.get('time') as string;
    const attendeeIds = Array.from(formData.getAll('attendeeIds')) as string[];
    const notes = formData.get('notes') as string;
    const youtubeUrl = formData.get('youtubeUrl') as string;

    const combinedDate = new Date(`${dateStr}T${timeStr}`);

    const newPastSession: TrainingSession = {
      id: `past_${Math.random().toString(36).substr(2, 9)}`,
      shiftId: 'manual_entry',
      turmaName,
      coachId,
      date: combinedDate.toISOString(),
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
    } catch (err: any) {
      alert(`Erro ao registar: ${err.message || 'Erro de rede.'}`);
    } finally {
      setIsSavingPast(false);
    }
  };

  const updateBufferField = (field: keyof TrainingSession, value: any) => {
    if (!editBuffer) return;
    setEditBuffer({ ...editBuffer, [field]: value });
  };

  const updateBufferDateTime = (type: 'date' | 'time', value: string) => {
    if (!editBuffer) return;
    const current = new Date(editBuffer.date);
    let datePart = isNaN(current.getTime()) ? new Date().toISOString().split('T')[0] : current.toISOString().split('T')[0];
    let timePart = isNaN(current.getTime()) ? "18:00" : current.toTimeString().split(' ')[0].slice(0, 5);

    if (type === 'date') datePart = value;
    if (type === 'time') timePart = value;

    const combined = new Date(`${datePart}T${timePart}`);
    setEditBuffer({ ...editBuffer, date: combined.toISOString() });
  };

  const toggleBufferAttendee = (studentId: string, checked: boolean) => {
    if (!editBuffer) return;
    let newAttendees = [...editBuffer.attendeeIds];
    if (checked) {
      if (!newAttendees.includes(studentId)) newAttendees.push(studentId);
    } else {
      newAttendees = newAttendees.filter(id => id !== studentId);
    }
    setEditBuffer({ ...editBuffer, attendeeIds: newAttendees });
  };

  const historicalSessions = state.sessions.filter(s => {
    if (s.isActive || !s.completed) return false;
    if ((s.hiddenForUserIds || []).includes(userId || '')) return false;
    if (userRole === Role.ADMIN) return true;
    const shift = state.shifts.find(sh => sh.id === s.shiftId);
    if (userRole === Role.COACH) return (s.coachId === userId || shift?.coachId === userId);
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

      {/* History Grid */}
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
              const coach = state.users.find(u => u.id === (session.coachId || shift?.coachId));
              const displayTurma = session.turmaName || (shift ? `${shift.dayOfWeek} (${shift.startTime})` : 'Treino Manual');
              
              return (
                <div key={session.id} className="bg-white p-4 rounded-2xl border border-slate-200 relative hover:border-padelgreen-400 hover:shadow-md transition-all group/card flex flex-col">
                  {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); setDeletingSession(session); }} className="absolute top-3 right-3 p-1.5 bg-red-50 text-red-400 rounded-lg opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 z-10 text-xs">🗑️</button>
                  )}
                  <div onClick={() => setSelectedSession(session)} className="cursor-pointer flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2 pr-6">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate max-w-[100px]">{displayTurma}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-petrol-950 leading-none">{sessionDate.getDate()}</span>
                          <span className="text-[11px] font-bold text-petrol-700 capitalize">{sessionDate.toLocaleDateString('pt-PT', { month: 'short' })}</span>
                        </div>
                      </div>
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">OK</span>
                    </div>
                    
                    <div className="mb-3 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span>🕒</span> {sessionDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-1 opacity-60">
                        <img src={coach?.avatar} className="w-4 h-4 rounded-full" alt="" />
                        <span className="text-[8px] truncate max-w-[60px]">{coach?.name.split(' ')[0]}</span>
                      </div>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Nome da Turma</label>
                  <input name="turmaName" type="text" required placeholder="Ex: Turma Manhã, Clínica..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Treinador</label>
                  <select name="coachId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm">
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Data</label>
                  <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wider">Hora</label>
                  <input type="time" name="time" required defaultValue="18:00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
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
              <textarea name="notes" placeholder="Notas técnicas..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm h-24"></textarea>
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

      {/* Modal: Detalhes e Edição */}
      {selectedSession && editBuffer && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold text-petrol-900">{isAdmin ? 'Editar Treino' : 'Detalhes do Treino'}</h3>
              <button onClick={() => setSelectedSession(null)} className="hidden md:block text-slate-400 hover:text-slate-600 text-3xl">×</button>
            </div>
            
            <div className="space-y-6">
              {/* Turma e Treinador */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Turma / Identificação</p>
                  {isAdmin ? (
                    <input 
                      type="text" 
                      value={editBuffer.turmaName || ''} 
                      placeholder="Nome da Turma"
                      onChange={(e) => updateBufferField('turmaName', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-padelgreen-400"
                    />
                  ) : (
                    <p className="text-sm font-semibold">{editBuffer.turmaName || 'Treino Regular'}</p>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Treinador Responsável</p>
                  {isAdmin ? (
                    <select 
                      value={editBuffer.coachId || ''} 
                      onChange={(e) => updateBufferField('coachId', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-padelgreen-400"
                    >
                      <option value="">(Usar Treinador da Agenda)</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <img src={state.users.find(u => u.id === (editBuffer.coachId || state.shifts.find(sh => sh.id === editBuffer.shiftId)?.coachId))?.avatar} className="w-5 h-5 rounded-full" alt="" />
                      <p className="text-sm font-semibold">
                        {state.users.find(u => u.id === (editBuffer.coachId || state.shifts.find(sh => sh.id === editBuffer.shiftId)?.coachId))?.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Data e Hora */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Data e Hora do Treino</p>
                {isAdmin ? (
                  <div className="flex gap-2">
                    <input 
                      type="date" 
                      value={new Date(editBuffer.date).toISOString().split('T')[0]} 
                      onChange={(e) => updateBufferDateTime('date', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    />
                    <input 
                      type="time" 
                      value={new Date(editBuffer.date).toTimeString().split(' ')[0].slice(0, 5)} 
                      onChange={(e) => updateBufferDateTime('time', e.target.value)}
                      className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                ) : (
                  <p className="text-sm font-semibold">
                    {new Date(editBuffer.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })} às {new Date(editBuffer.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>

              {/* Alunos Presentes */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Alunos Presentes ({editBuffer.attendeeIds.length})</h4>
                {isAdmin ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto">
                    {state.users.filter(u => u.role === Role.STUDENT).map(student => (
                      <label key={student.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-padelgreen-200 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={editBuffer.attendeeIds.includes(student.id)} 
                          onChange={(e) => toggleBufferAttendee(student.id, e.target.checked)}
                          className="w-4 h-4 text-padelgreen-500 rounded" 
                        />
                        <span className="text-[11px] font-medium truncate">{student.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {editBuffer.attendeeIds.map(id => {
                      const student = state.users.find(u => u.id === id);
                      return (
                        <div key={id} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                          <img src={student?.avatar} className="w-5 h-5 rounded-full" alt="" />
                          <span className="text-xs font-semibold text-slate-700">{student?.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Notas Técnicas */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Notas Técnicas</h4>
                {isStaff ? (
                  <textarea 
                    value={editBuffer.notes || ''} 
                    onChange={(e) => updateBufferField('notes', e.target.value)} 
                    placeholder="Registe o foco técnico da sessão..."
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-padelgreen-400 h-32" 
                  />
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed italic">
                    {editBuffer.notes ? `"${editBuffer.notes}"` : "Sem notas registadas."}
                  </div>
                )}
              </div>

              {/* YouTube Link */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">Link da Gravação (YouTube)</h4>
                {isStaff ? (
                  <input 
                    type="url" 
                    placeholder="https://youtube.com/..." 
                    value={editBuffer.youtubeUrl || ''}
                    onChange={(e) => updateBufferField('youtubeUrl', e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-padelgreen-400 outline-none" 
                  />
                ) : editBuffer.youtubeUrl && (
                  <a href={editBuffer.youtubeUrl} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-3 p-4 bg-red-600 text-white rounded-2xl font-bold">
                    <span>📺</span> Ver Gravação do Treino
                  </a>
                )}
              </div>
            </div>

            {/* Ações do Modal */}
            <div className="flex gap-4 mt-8">
              {isAdmin ? (
                <>
                  <button onClick={() => setSelectedSession(null)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl">Cancelar</button>
                  <button 
                    onClick={handleSaveEdit} 
                    disabled={isSavingEdit}
                    className="flex-1 py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2"
                  >
                    {isSavingEdit ? 'A gravar...' : 'Guardar Alterações'}
                  </button>
                </>
              ) : (
                <button onClick={() => setSelectedSession(null)} className="w-full py-4 bg-petrol-900 text-white font-bold rounded-2xl shadow-lg">Fechar</button>
              )}
            </div>
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
              <button onClick={() => handleDeleteSession('all')} className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl shadow-lg">Apagar para todos</button>
              <button onClick={() => setDeletingSession(null)} className="w-full py-4 text-slate-400 font-bold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsHistory;
