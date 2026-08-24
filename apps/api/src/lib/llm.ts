import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { logger } from "../config/logger";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

export async function generatePreVisitSummary(symptoms: string) {
  const prompt = `Analyse these symptoms and return ONLY valid JSON with keys "urgencyLevel" (one of LOW, MEDIUM, HIGH), "chiefComplaint" (a short string), and "suggestedQuestions" (an array of exactly 3 strings). Symptoms: ${symptoms}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    return {
      urgencyLevel: parsed.urgencyLevel ?? "MEDIUM",
      chiefComplaint: parsed.chiefComplaint ?? "Not determined",
      suggestedQuestions: parsed.suggestedQuestions ?? [],
    };
  } catch (err) {
    logger.error("LLM pre-visit summary failed", { error: err });
    return { urgencyLevel: "MEDIUM", chiefComplaint: null, suggestedQuestions: [] };
  }
}

export async function generatePostVisitSummary(notes: string) {
  const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps, in plain text, no markdown: ${notes}`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    logger.error("LLM post-visit summary failed", { error: err });
    return "Your visit summary is being processed and will be available shortly. Please contact the clinic if you have questions.";
  }
}
