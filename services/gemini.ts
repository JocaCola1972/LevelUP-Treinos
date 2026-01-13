
import { GoogleGenAI } from "@google/genai";

// Fix: Initializing GoogleGenAI with apiKey from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates training tips based on a technical focus area using Gemini 3 Flash.
 */
export const getTrainingTips = async (focus: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Sou um jogador de Padel focado em melhorar o meu: ${focus}. Dá-me 3 dicas rápidas e técnicas para melhorar hoje no treino. Responde em Português de Portugal.`,
      config: {
        systemInstruction: "És um treinador profissional de Padel com anos de experiência no World Padel Tour. Sê motivador e técnico.",
      },
    });
    // Fix: Using the .text property directly from the response
    return response.text || "Foca-te na técnica e diverte-te no campo!";
  } catch (error) {
    console.error("Gemini API Error (getTrainingTips):", error);
    return "Foca-te na técnica e diverte-te no campo!";
  }
};

/**
 * Analyzes session notes to provide insights using Gemini 3 Flash.
 */
export const analyzeSession = async (notes: string): Promise<string> => {
  if (!notes) return "Boa sessão! Continue a trabalhar nos pontos discutidos.";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analisa estas notas de treino de padel e dá um resumo motivador e uma área de melhoria: ${notes}`,
      config: {
        systemInstruction: "És um analista técnico de padel. Sê conciso, encorajador e profissional. Responde em Português de Portugal.",
      },
    });
    // Fix: Using the .text property directly from the response
    return response.text || "Boa sessão! Continue a trabalhar nos pontos discutidos.";
  } catch (error) {
    console.error("Gemini API Error (analyzeSession):", error);
    return "Boa sessão! Continue a trabalhar nos pontos discutidos.";
  }
};
