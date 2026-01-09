
import React, { useState } from 'react';
import { AppState, Shift, RecurrenceType, Role } from '../types';
import { db } from '../services/db';
import { DAYS_OF_WEEK } from '../constants';

interface ShiftsListProps {
  state: AppState;
  refresh: () => void;
}

const ShiftsList: React.FC<ShiftsListProps> = ({ state, refresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const coaches = state.users.filter(u => u.role === Role.COACH);
  const students = state.users.filter(u => u.role === Role.STUDENT);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const shift: Shift = {
      id: editingShift?.id || '',
      dayOfWeek: formData.get('dayOfWeek') as string,
      startTime: formData.get('startTime') as string,
      durationMinutes: parseInt(formData.get('duration') as string),
      coachId: formData.get('coachId') as string,
      studentIds: Array.from(formData.getAll('studentIds')) as string[],
      recurrence: formData.get('recurrence') as RecurrenceType,
    };
    db.shifts.save(shift);
    refresh();
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-petrol-900">Agenda de Treinos</h2>
          <p className="text-slate-500 text-sm">Organize as aulas recorrentes e horários fixos.</p>
        </div>
        {state.currentUser?.role === Role.ADMIN && (
          <button 
            onClick={() => { setEditingShift(null); setIsModalOpen(true); }}
            className="bg-petrol-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-petrol-950 transition-all shadow-lg"
          >
            + Novo Horário
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Dia</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Hora</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Treinador</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Alunos</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Recorrência</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.shifts.map(shift => {
              const coach = state.users.find(u => u.id === shift.coachId);
              return (
                <tr key={shift.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-petrol-900">{shift.dayOfWeek}</td>
                  <td className="px-6 py-4">
                    <span className="bg-petrol-50 text-petrol-700 px-3 py-1 rounded-lg text-sm font-semibold">
                      {shift.startTime} ({shift.durationMinutes}m)
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <img src={coach?.avatar} className="w-6 h-6 rounded-full" alt="" />
                      <span className="text-sm font-medium">{coach?.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex -space-x-2">
                      {shift.studentIds.slice(0, 3).map(id => {
                        const student = state.users.find(u => u.id === id);
                        return <img key={id} src={student?.avatar} className="w-7 h-7 rounded-full border-2 border-white" alt="" title={student?.name} />;
                      })}
                      {shift.studentIds.length > 3 && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold">
                          +{shift.studentIds.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                      {shift.recurrence}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => { setEditingShift(shift); setIsModalOpen(true); }}
                      className="text-slate-400 hover:text-petrol-900 font-bold text-sm px-2"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => { if(confirm('Remover?')) { db.shifts.delete(shift.id); refresh(); }}}
                      className="text-red-300 hover:text-red-500 font-bold text-sm px-2"
                    >
                      X
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {state.shifts.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            Nenhum horário agendado ainda.
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-bold text-petrol-900 mb-6">Configurar Horário</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Dia da Semana</label>
                  <select name="dayOfWeek" defaultValue={editingShift?.dayOfWeek} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                    {DAYS_OF_WEEK.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Hora de Início</label>
                  <input type="time" name="startTime" defaultValue={editingShift?.startTime} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Duração (Minutos)</label>
                  <input type="number" name="duration" defaultValue={editingShift?.durationMinutes || 60} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Recorrência</label>
                  <select name="recurrence" defaultValue={editingShift?.recurrence || RecurrenceType.SEMANAL} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                    <option value={RecurrenceType.SEMANAL}>Semanal</option>
                    <option value={RecurrenceType.QUINZENAL}>Quinzenal</option>
                    <option value={RecurrenceType.PONTUAL}>Pontual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Treinador Responsável</label>
                <select name="coachId" defaultValue={editingShift?.coachId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                  {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Alunos Inscritos</label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-sm p-2 hover:bg-white rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="studentIds" 
                        value={s.id} 
                        defaultChecked={editingShift?.studentIds.includes(s.id)}
                        className="w-4 h-4 rounded text-padelgreen-500"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-petrol-900 text-white font-bold rounded-2xl hover:bg-petrol-950 transition-all">Guardar Horário</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftsList;
