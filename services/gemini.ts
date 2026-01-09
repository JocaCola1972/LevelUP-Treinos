
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getTrainingTips = async (focus: string): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gere 3 dicas rápidas e motivacionais de treinamento de Padel focadas em: ${focus}. Responda em Português de Portugal.`,
      config: {
        systemInstruction: "És um treinador de Padel experiente e motivador.",
        temperature: 0.7,
      }
    });
    return response.text || "Foca-te na técnica e diverte-te no campo!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Mantenha o foco nos fundamentos e no posicionamento de rede.";
  }
};

export const analyzeSession = async (notes: string): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analisa estas notas de uma aula de Padel e fornece insights técnicos e pontos de melhoria: "${notes}". Responda em Português de Portugal.`,
      config: {
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });
    return response.text || "Boa sessão! Continue a trabalhar nos pontos discutidos.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Análise temporariamente indisponível. Continue o bom trabalho!";
  }
};
