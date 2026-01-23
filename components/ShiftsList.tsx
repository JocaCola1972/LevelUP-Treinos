
import React, { useState, useEffect } from 'react';
import { AppState, Shift, RecurrenceType, Role, User, TrainingSession } from '../types';
import { db } from '../services/db';
import { DAYS_OF_WEEK } from '../constants';

interface ShiftsListProps {
  state: AppState;
  refresh: () => void;
}

const ShiftsList: React.FC<ShiftsListProps> = ({ state, refresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(DAYS_OF_WEEK[0]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isFinalizing, setIsFinalizing] = useState<string | null>(null);
  
  const [clubs, setClubs] = useState<string[]>([]);
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [newClubName, setNewClubName] = useState<string>('');
  const [isAddingNewClub, setIsAddingNewClub] = useState(false);

  useEffect(() => {
    const loadClubs = async () => {
      const data = await db.clubs.getAll();
      setClubs(data);
    };
    loadClubs();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      if (editingShift) {
        setSelectedDay(editingShift.dayOfWeek);
        setSelectedDate(editingShift.startDate || '');
        setSelectedClub(editingShift.clubName || '');
        setIsAddingNewClub(false);
      } else {
        setSelectedDay(DAYS_OF_WEEK[0]);
        setSelectedDate(new Date().toISOString().split('T')[0]);
        setSelectedClub(clubs[0] || '');
        setIsAddingNewClub(false);
      }
    }
  }, [isModalOpen, editingShift, clubs]);

  const isStaff = state.currentUser?.role === Role.ADMIN || state.currentUser?.role === Role.COACH;
  const coaches = state.users.filter(u => u.role === Role.COACH || u.role === Role.ADMIN);
  const students = state.users.filter(u => u.role === Role.STUDENT);

  const getDayStringFromDate = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[date.getDay()];
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    setSelectedDate(dateValue);
    if (dateValue) {
      const dayName = getDayStringFromDate(dateValue);
      setSelectedDay(dayName);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    let finalClubName = selectedClub;
    if (isAddingNewClub && newClubName.trim()) {
      await db.clubs.save(newClubName.trim());
      finalClubName = newClubName.trim();
    }

    const shift: Shift = {
      id: editingShift?.id || Math.random().toString(36).substr(2, 9),
      dayOfWeek: selectedDay,
      startTime: formData.get('startTime') as string,
      durationMinutes: parseInt(formData.get('duration') as string),
      coachId: formData.get('coachId') as string,
      studentIds: Array.from(formData.getAll('studentIds')) as string[],
      recurrence: RecurrenceType.PONTUAL,
      startDate: selectedDate || undefined,
      clubName: finalClubName
    };
    await db.shifts.save(shift);
    refresh();
    setIsModalOpen(false);
    
    // Refresh clubs list
    const updatedClubs = await db.clubs.getAll();
    setClubs(updatedClubs);
  };

  const handleFinalizeSession = async (shift: Shift) => {
    if (!shift.startDate) return;
    if (!confirm('Deseja finalizar este treino? Ele será movido para o Histórico.')) return;
    
    setIsFinalizing(shift.id);
    try {
      const attendees = state.rsvps
        .filter(r => r.shiftId === shift.id && r.date === shift.startDate && r.attending)
        .map(r => r.userId);

      const existingSession = state.sessions.find(s => s.shiftId === shift.id && s.date.startsWith(shift.startDate!));

      const sessionData: TrainingSession = {
        id: existingSession?.id || Math.random().toString(36).substr(2, 9),
        shiftId: shift.id,
        date: `${shift.startDate}T${shift.startTime}`,
        isActive: false,
        completed: true,
        attendeeIds: attendees,
        notes: existingSession?.notes || 'Sessão finalizada via Agenda.',
        hiddenForUserIds: existingSession?.hiddenForUserIds || [],
        coachId: shift.coachId,
        turmaName: `${shift.dayOfWeek} (${shift.startTime})`,
        clubName: shift.clubName
      };

      await db.sessions.save(sessionData);
      await refresh();
    } catch (err: any) {
      alert(`Erro ao finalizar: ${err.message}`);
    } finally {
      setIsFinalizing(null);
    }
  };

  const StudentRSVPBadge: React.FC<{ student: User; shiftId: string; date: string }> = ({ student, shiftId, date }) => {
    const rsvp = state.rsvps.find(r => r.shiftId === shiftId && r.userId === student.id && r.date === date);

    if (!rsvp) return (
      <div className="relative group/avatar">
        <img src={student.avatar} className="w-7 h-7 rounded-full border border-white grayscale opacity-50" alt={student.name} title={student.name} />
        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-slate-400 rounded-full border border-white"></div>
      </div>
    );

    return (
      <div className="relative group/avatar">
        <img src={student.avatar} className={`w-7 h-7 rounded-full border border-white ${rsvp.attending ? 'ring-2 ring-padelgreen-200' : 'grayscale opacity-70'}`} alt={student.name} title={student.name} />
        <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${rsvp.attending ? 'bg-padelgreen-500' : 'bg-red-500'} rounded-full border border-white`}></div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-petrol-900">Agendamentos</h2>
            <p className="text-slate-500 text-xs md:text-sm">Treinos pontuais registados.</p>
          </div>
          <button onClick={refresh} className="text-[10px] font-black text-slate-400 hover:text-padelgreen-500 uppercase tracking-widest transition-colors mt-1">🔄 Sincronizar</button>
        </div>
        {state.currentUser?.role === Role.ADMIN && (
          <button 
            onClick={() => { setEditingShift(null); setIsModalOpen(true); }}
            className="w-full sm:w-auto bg-petrol-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-petrol-950 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-sm"
          >
            <span>+</span> Novo Treino
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {state.shifts
          .sort((a, b) => {
            const dateTimeA = `${a.startDate || '9999-12-31'}T${a.startTime || '23:59'}`;
            const dateTimeB = `${b.startDate || '9999-12-31'}T${b.startTime || '23:59'}`;
            return dateTimeA.localeCompare(dateTimeB);
          })
          .map(shift => {
          const coach = state.users.find(u => u.id === shift.coachId);
          const shiftStudents = state.users.filter(u => shift.studentIds.includes(u.id));
          const dateObj = shift.startDate ? new Date(shift.startDate) : null;
          const dayNum = dateObj?.getDate();
          const monthStr = dateObj?.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');
          
          const isCompleted = state.sessions.some(s => s.shiftId === shift.id && s.date.startsWith(shift.startDate!) && s.completed);

          return (
            <div key={shift.id} className={`bg-white rounded-[32px] border ${isCompleted ? 'border-slate-100 opacity-80' : 'border-slate-200'} overflow-hidden shadow-sm hover:shadow-md transition-all group relative`}>
              <div className="p-5 md:p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${isCompleted ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-padelgreen-50 border-padelgreen-100 text-petrol-900'}`}>
                      <span className="text-base font-black leading-none">{dayNum}</span>
                      <span className="text-[9px] font-bold uppercase tracking-tighter">{monthStr}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className={`text-lg font-black truncate leading-tight ${isCompleted ? 'text-slate-400 line-through' : 'text-petrol-900'}`}>{shift.dayOfWeek}</h3>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Início: {shift.startTime}</p>
                    </div>
                  </div>
                  {state.currentUser?.role === Role.ADMIN && !isCompleted && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingShift(shift); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-petrol-900 transition-all rounded-lg hover:bg-slate-50">✏️</button>
                      <button onClick={async () => { if(confirm('Remover?')) { await db.shifts.delete(shift.id); refresh(); }}} className="p-2 text-red-200 hover:text-red-500 transition-all rounded-lg hover:bg-red-50">🗑️</button>
                    </div>
                  )}
                </div>

                {/* Destaque do Clube/Local */}
                <div className={`mb-4 px-4 py-2.5 rounded-2xl border flex items-center gap-2.5 ${isCompleted ? 'bg-slate-50/50 border-slate-100 text-slate-400' : 'bg-petrol-900 text-white border-petrol-950 shadow-md'}`}>
                  <span className="text-lg">📍</span>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-60">Local do Treino</p>
                    <p className="text-xs font-black truncate uppercase tracking-tight">{shift.clubName || "Clube Não Definido"}</p>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border border-slate-50 ${isCompleted ? 'bg-slate-50/30' : 'bg-slate-50/80'} mb-4`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={coach?.avatar} className={`w-8 h-8 rounded-full border-2 border-white shadow-sm shrink-0 ${isCompleted ? 'grayscale opacity-40' : ''}`} alt="" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Coach</p>
                        <p className={`text-[11px] font-black truncate ${isCompleted ? 'text-slate-400' : 'text-petrol-800'}`}>{coach?.name}</p>
                      </div>
                    </div>
                    <div className="flex -space-x-2">
                      {shiftStudents.map(student => (
                        <StudentRSVPBadge key={student.id} student={student} shiftId={shift.id} date={shift.startDate!} />
                      ))}
                    </div>
                  </div>
                </div>

                {isStaff && (
                  <div className="flex justify-end">
                    {isCompleted ? (
                      <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-xl">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Concluído</span>
                        <span className="text-slate-200">✓</span>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleFinalizeSession(shift)}
                        disabled={isFinalizing === shift.id}
                        className="w-full py-3.5 bg-white border-2 border-padelgreen-400 text-petrol-900 hover:bg-padelgreen-400 hover:text-petrol-950 font-black rounded-2xl transition-all active:scale-95 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isFinalizing === shift.id ? (
                          <div className="w-3 h-3 border-2 border-petrol-900 border-t-transparent rounded-full animate-spin"></div>
                        ) : '✓'}
                        {isFinalizing === shift.id ? 'A Finalizar' : 'Finalizar Sessão'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[40px] sm:rounded-[32px] w-full max-w-lg p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8 sm:hidden"></div>
            <h3 className="text-2xl font-black text-petrol-900 mb-8">Configurar Treino</h3>
            <form onSubmit={handleSave} className="space-y-6">
              
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Clube / Localização</label>
                  {!isAddingNewClub ? (
                    <div className="flex gap-2">
                      <select 
                        value={selectedClub} 
                        onChange={(e) => {
                          if (e.target.value === 'NEW') {
                            setIsAddingNewClub(true);
                          } else {
                            setSelectedClub(e.target.value);
                          }
                        }}
                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-padelgreen-400 font-bold text-sm"
                      >
                        <option value="" disabled>Selecionar Clube...</option>
                        {clubs.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="NEW" className="text-padelgreen-600 font-black">+ Adicionar Novo Clube...</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="relative">
                        <input 
                          type="text" 
                          autoFocus
                          placeholder="Nome do novo clube..."
                          value={newClubName}
                          onChange={(e) => setNewClubName(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-padelgreen-400 rounded-xl outline-none ring-2 ring-padelgreen-50 font-bold text-sm"
                        />
                        <button 
                          type="button" 
                          onClick={() => { setIsAddingNewClub(false); setNewClubName(''); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 hover:text-red-500 uppercase"
                        >
                          Cancelar
                        </button>
                      </div>
                      <p className="text-[9px] text-padelgreen-600 font-bold italic">* Este clube será guardado na sua lista permanente.</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Data</label>
                    <input 
                      type="date" 
                      name="startDate"
                      required
                      value={selectedDate}
                      onChange={handleDateChange}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-padelgreen-400 font-bold text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Hora</label>
                    <input type="time" name="startTime" defaultValue={editingShift?.startTime || '18:00'} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-padelgreen-400 font-bold text-sm" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest ml-1">Treinador</label>
                  <select name="coachId" defaultValue={editingShift?.coachId || state.currentUser?.id} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-padelgreen-400 font-bold text-sm">
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest ml-1">Duração (Min)</label>
                  <input type="number" name="duration" defaultValue={editingShift?.durationMinutes || 60} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-padelgreen-400 font-bold text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest ml-1">Atletas Inscritos</label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-xs p-3 bg-white border border-slate-100 rounded-xl cursor-pointer hover:border-padelgreen-300 hover:shadow-sm transition-all font-bold">
                      <input 
                        type="checkbox" 
                        name="studentIds" 
                        value={s.id} 
                        defaultChecked={editingShift?.studentIds.includes(s.id)}
                        className="w-4 h-4 rounded text-padelgreen-500 focus:ring-padelgreen-400"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all text-[10px]">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-petrol-900 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-petrol-950 active:scale-95 transition-all text-[10px]">Confirmar Treino</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftsList;
