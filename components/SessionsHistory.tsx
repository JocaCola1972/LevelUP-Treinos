
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
    setSelectedSession({ ...session, aiInsights: result });
    setIsAnalyzing(false);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {state.sessions.map(session => {
          const shift = state.shifts.find(s => s.id === session.shiftId);
          return (
            <div 
              key={session.id} 
              onClick={() => setSelectedSession(session)}
              className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 cursor-pointer hover:border-padelgreen-400 hover:shadow-lg transition-all active:scale-[0.98] md:active:scale-100"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{new Date(session.date).toLocaleDateString()}</span>
                <span className={`text-[9px] md:text-[10px] font-bold px-2.5 py-1 rounded-full ${session.completed ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  {session.completed ? 'CONCLUÍDO' : 'EM CURSO'}
                </span>
              </div>
              <h3 className="text-base md:text-lg font-bold text-petrol-900 mb-2 leading-tight">
                {shift?.dayOfWeek} <span className="text-slate-400 font-medium">às {shift?.startTime}</span>
              </h3>
              <p className="text-xs md:text-sm text-slate-500 line-clamp-2 mb-4 h-8 md:h-10">
                {session.notes || "Nenhuma nota registada para este treino."}
              </p>
              <div className="flex items-center justify-between mt-auto">
                <div className="flex -space-x-2">
                  {session.attendeeIds.slice(0, 4).map(id => (
                    <img key={id} src={state.users.find(u => u.id === id)?.avatar} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white" alt="" />
                  ))}
                  {session.attendeeIds.length > 4 && (
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                      +{session.attendeeIds.length - 4}
                    </div>
                  )}
                </div>
                {session.aiInsights && <span className="text-lg md:text-xl" title="Contém análise AI">✨</span>}
              </div>
            </div>
          );
        })}
        {state.sessions.length === 0 && (
          <div className="col-span-full py-16 md:py-24 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 px-6">
            <span className="text-4xl mb-4 block">📅</span>
            <p className="font-medium">Ainda não há histórico de sessões.</p>
          </div>
        )}
      </div>

      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-petrol-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-[32px] md:rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 md:duration-200 overflow-y-auto max-h-[90vh]">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold text-petrol-900">Detalhes do Treino</h3>
              <button onClick={() => setSelectedSession(null)} className="hidden md:block text-slate-400 hover:text-slate-600 text-3xl transition-colors">×</button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Data</p>
                  <p className="text-sm md:text-base font-semibold text-petrol-800">{new Date(selectedSession.date).toLocaleDateString()}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Alunos</p>
                  <p className="text-sm md:text-base font-semibold text-petrol-800">{selectedSession.attendeeIds.length} Presentes</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">Notas do Treinador</h4>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm md:text-base leading-relaxed min-h-24">
                  {selectedSession.notes || "Sem notas disponíveis para esta sessão."}
                </div>
              </div>

              {selectedSession.youtubeUrl && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">Vídeo do Treino</h4>
                  <a href={selectedSession.youtubeUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center md:justify-start gap-3 p-4 bg-red-50 text-red-700 rounded-2xl font-bold border border-red-100 hover:bg-red-100 transition-colors group">
                    <span className="text-xl group-hover:scale-110 transition-transform">📺</span> 
                    <span className="text-sm">Abrir Gravação no YouTube</span>
                  </a>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-petrol-900 flex items-center gap-2">
                    <span className="text-xl">✨</span> Análise Inteligente
                  </h4>
                  {!selectedSession.aiInsights && selectedSession.notes && (
                    <button 
                      onClick={() => handleAnalyze(selectedSession)}
                      disabled={isAnalyzing}
                      className="text-[10px] font-black text-padelgreen-600 hover:text-padelgreen-700 disabled:opacity-50 uppercase tracking-widest bg-padelgreen-50 px-3 py-1.5 rounded-lg border border-padelgreen-100"
                    >
                      {isAnalyzing ? 'A ANALISAR...' : 'GERAR INSIGHTS'}
                    </button>
                  )}
                </div>
                <div className={`p-5 rounded-2xl text-sm leading-relaxed ${selectedSession.aiInsights ? 'bg-padelgreen-50 text-petrol-900 border border-padelgreen-100' : 'bg-slate-50 text-slate-400 italic text-center'}`}>
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center py-4">
                      <div className="animate-spin w-6 h-6 border-2 border-padelgreen-500 border-t-transparent rounded-full mb-3"></div>
                      <p className="text-xs font-bold text-padelgreen-700">O treinador AI está a rever a sessão...</p>
                    </div>
                  ) : 
                   selectedSession.aiInsights || "Adicione notas ao treino para que a AI possa analisar a performance."}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedSession(null)}
              className="w-full mt-8 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl md:hidden active:bg-slate-200 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsHistory;
