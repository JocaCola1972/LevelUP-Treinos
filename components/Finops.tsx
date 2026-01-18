
import React, { useState, useMemo } from 'react';
import { AppState, TrainingSession, User } from '../types';
import { db } from '../services/db';

interface FinopsProps {
  state: AppState;
  refresh: () => void;
}

const Finops: React.FC<FinopsProps> = ({ state, refresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const isAdminEspecial = state.currentUser?.phone === '917772010';

  const sessions = useMemo(() => {
    return [...state.sessions]
      .filter(s => s.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.sessions]);

  const stats = useMemo(() => {
    let totalReceived = 0;
    let totalPendingCount = 0;
    
    sessions.forEach(s => {
      s.attendeeIds.forEach(attId => {
        const payment = s.payments?.[attId];
        if (payment?.paid) {
          totalReceived += payment.amount;
        } else {
          totalPendingCount++;
        }
      });
    });

    return { totalReceived, totalPendingCount };
  }, [sessions]);

  const handleUpdatePayment = async (session: TrainingSession, userId: string, paid: boolean, amount: number) => {
    setSavingId(`${session.id}-${userId}`);
    try {
      const updatedPayments = {
        ...(session.payments || {}),
        [userId]: { paid, amount }
      };

      const updatedSession = {
        ...session,
        payments: updatedPayments
      };

      await db.sessions.save(updatedSession);
      refresh();
    } catch (err) {
      console.error("Erro ao atualizar pagamento:", err);
    } finally {
      setSavingId(null);
    }
  };

  if (!isAdminEspecial) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <span className="text-6xl mb-4">🚫</span>
        <h2 className="text-xl font-black text-petrol-900">Acesso Restrito</h2>
        <p className="text-slate-500 mt-2">Este separador é exclusivo para a administração financeira.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Recebido</p>
            <h3 className="text-3xl font-black text-padelgreen-600">{stats.totalReceived.toFixed(2)}€</h3>
          </div>
          <div className="w-12 h-12 bg-padelgreen-50 rounded-2xl flex items-center justify-center text-2xl">💶</div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pagamentos Pendentes</p>
            <h3 className="text-3xl font-black text-red-500">{stats.totalPendingCount}</h3>
          </div>
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-2xl">⏳</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-petrol-900 self-start md:self-center">Registo de Cobranças</h2>
        <div className="relative w-full md:w-64">
          <input 
            type="text" 
            placeholder="Pesquisar sessão..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-padelgreen-400"
          />
        </div>
      </div>

      <div className="space-y-4">
        {sessions
          .filter(s => !searchTerm || (s.turmaName || '').toLowerCase().includes(searchTerm.toLowerCase()))
          .map(session => {
            const date = new Date(session.date);
            const attendees = state.users.filter(u => session.attendeeIds.includes(u.id));
            const sessionTotal = Object.values(session.payments || {}).reduce((acc, p) => acc + (p.paid ? p.amount : 0), 0);

            return (
              <div key={session.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white w-10 h-10 rounded-xl flex flex-col items-center justify-center border border-slate-200 shadow-sm">
                      <span className="text-xs font-black leading-none">{date.getDate()}</span>
                      <span className="text-[7px] font-bold uppercase text-slate-400">{date.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-petrol-900 leading-tight">
                        {session.turmaName || "Treino Pontual"}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        {date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} • {attendees.length} Atletas
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sessão</p>
                    <p className="text-sm font-black text-petrol-900">{sessionTotal.toFixed(2)}€</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-50">
                  {attendees.map(student => {
                    const payment = session.payments?.[student.id] || { paid: false, amount: 15 };
                    const isSaving = savingId === `${session.id}-${student.id}`;

                    return (
                      <div key={student.id} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <img src={student.avatar} className="w-8 h-8 rounded-full border border-slate-100" alt="" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-petrol-900 truncate">{student.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{student.phone}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400">€</span>
                            <input 
                              type="number"
                              defaultValue={payment.amount}
                              onBlur={(e) => handleUpdatePayment(session, student.id, payment.paid, parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-center outline-none focus:ring-2 focus:ring-padelgreen-400"
                            />
                          </div>

                          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            payment.paid 
                              ? 'bg-padelgreen-50 border-padelgreen-200 text-padelgreen-700' 
                              : 'bg-white border-slate-200 text-slate-400 hover:border-padelgreen-300'
                          }`}>
                            <input 
                              type="checkbox"
                              checked={payment.paid}
                              onChange={(e) => handleUpdatePayment(session, student.id, e.target.checked, payment.amount)}
                              disabled={isSaving}
                              className="w-4 h-4 rounded text-padelgreen-500 focus:ring-padelgreen-400 border-slate-300"
                            />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {isSaving ? '...' : (payment.paid ? 'Pago' : 'Pendente')}
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {sessions.length === 0 && (
          <div className="bg-white rounded-[32px] p-20 text-center border border-slate-200">
            <p className="text-slate-400 font-medium italic">Não existem sessões concluídas para faturação.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Finops;
