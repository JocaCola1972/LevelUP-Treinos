
import React, { useState } from 'react';
import { AppState, Role, TrainingSession } from '../types';
import { analyzeSession } from '../services/gemini';

interface SessionsHistoryProps {
  state: AppState;
}

const SessionsHistory: React.FC<SessionsHistoryProps> = ({ state }) => {
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async (session: TrainingSession) => {
    if (!session.notes) return;
    setIsAnalyzing(true);
    const result = await analyzeSession(session.notes);
    // Update local state for display - in real app would save to DB
    setSelectedSession({ ...session, aiInsights: result });
    setIsAnalyzing(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.sessions.map(session => {
          const shift = state.shifts.find(s => s.id === session.shiftId);
          return (
            <div 
              key={session.id} 
              onClick={() => setSelectedSession(session)}
              className="bg-white p-6 rounded-3xl border border-slate-200 cursor-pointer hover:border-padelgreen-400 hover:shadow-lg transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase">{new Date(session.date).toLocaleDateString()}</span>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${session.completed ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  {session.completed ? 'CONCLUÍDO' : 'EM CURSO'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-petrol-900 mb-2">{shift?.dayOfWeek} às {shift?.startTime}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                {session.notes || "Nenhuma nota registada para este treino."}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {session.attendeeIds.slice(0, 3).map(id => (
                    <img key={id} src={state.users.find(u => u.id === id)?.avatar} className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                  ))}
                </div>
                {session.aiInsights && <span className="text-xl">✨</span>}
              </div>
            </div>
          );
        })}
        {state.sessions.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
            Ainda não há histórico de sessões para mostrar.
          </div>
        )}
      </div>

      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-petrol-900">Detalhes do Treino</h3>
              <button onClick={() => setSelectedSession(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Data</p>
                  <p className="font-semibold">{new Date(selectedSession.date).toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Participantes</p>
                  <p className="font-semibold">{selectedSession.attendeeIds.length} Alunos</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-petrol-900 mb-2">Notas do Treinador</h4>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 leading-relaxed min-h-24">
                  {selectedSession.notes || "Sem notas disponíveis."}
                </div>
              </div>

              {selectedSession.youtubeUrl && (
                <div>
                  <h4 className="font-bold text-petrol-900 mb-2">Vídeo do Treino</h4>
                  <a href={selectedSession.youtubeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl font-semibold border border-red-100 hover:bg-red-100 transition-colors">
                    <span className="text-xl">📺</span> Ver Gravação no YouTube
                  </a>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-petrol-900 flex items-center gap-2">
                    <span className="text-xl">✨</span> Análise Inteligente AI
                  </h4>
                  {!selectedSession.aiInsights && selectedSession.notes && (
                    <button 
                      onClick={() => handleAnalyze(selectedSession)}
                      disabled={isAnalyzing}
                      className="text-xs font-bold text-padelgreen-600 hover:text-padelgreen-700 disabled:opacity-50"
                    >
                      {isAnalyzing ? 'A ANALISAR...' : 'GERAR ANÁLISE'}
                    </button>
                  )}
                </div>
                <div className={`p-5 rounded-2xl leading-relaxed ${selectedSession.aiInsights ? 'bg-padelgreen-50 text-petrol-900 border border-padelgreen-100' : 'bg-slate-50 text-slate-400 italic'}`}>
                  {isAnalyzing ? 'O treinador AI está a rever a sessão...' : 
                   selectedSession.aiInsights || "Crie notas de treino para gerar uma análise de performance."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsHistory;
