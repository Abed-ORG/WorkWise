import { GoogleGenAI } from "@google/genai";
import { AppError } from "../../errors/AppError";
import { buildAcceptanceCriteriaPrompt } from "./prompts/acceptanceCriteria.prompt";
import { buildTaskBreakdownPrompt } from "./prompts/taskBreakdown.prompt";
import { parseAcceptanceCriteriaResponse } from "./parsers/acceptanceCriteria.parser";
import { parseTaskBreakdownResponse } from "./parsers/taskBreakdown.parser";
import {
  AcceptanceCriteriaInput,
  AcceptanceCriteriaResult,
  TaskBreakdownInput,
  TaskBreakdownResult,
  TaskSearchFilters,
  SprintRiskResult,
  SprintSuggestionResult,
} from "./types";
import { buildTaskSearchPrompt } from "./prompts/taskSearch.prompt";
import { parseTaskSearchResponse } from "./parsers/taskSearch.parser";
import { buildSprintRiskPrompt, SprintRiskPromptInput } from "./prompts/sprintRisk.prompt";
import { parseSprintRiskResponse } from "./parsers/sprintRisk.parser";
import { buildSprintSuggestionPrompt, SprintSuggestionPromptInput } from "./prompts/sprintSuggestion.prompt";
import { parseSprintSuggestionResponse } from "./parsers/sprintSuggestion.parser";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 30000;

type ErrorWithStatus = Error & {
  status?: number;
  statusCode?: number;
  code?: number | string;
};

class GeminiService {
  private client?: GoogleGenAI;

  async generateTaskBreakdown(
    input: TaskBreakdownInput
  ): Promise<TaskBreakdownResult> {
    const responseText = await this.generateJson(buildTaskBreakdownPrompt(input));
    return parseTaskBreakdownResponse(responseText);
  }

  async suggestSprintTasks(input: SprintSuggestionPromptInput): Promise<SprintSuggestionResult> {
    const responseText = await this.generateJson(buildSprintSuggestionPrompt(input));
    return parseSprintSuggestionResponse(responseText);
  }

  async analyzeSprintRisk(input: SprintRiskPromptInput): Promise<SprintRiskResult> {
    const responseText = await this.generateJson(buildSprintRiskPrompt(input));
    return parseSprintRiskResponse(responseText);
  }

  async parseTaskQuery(input: {
    query: string;
    memberNames: string[];
    labels: string[];
    statusNames: string[];
    today: string;
  }): Promise<TaskSearchFilters> {
    const responseText = await this.generateJson(buildTaskSearchPrompt(input));
    return parseTaskSearchResponse(responseText, input.statusNames);
  }

  async generateAcceptanceCriteria(
    input: AcceptanceCriteriaInput
  ): Promise<AcceptanceCriteriaResult> {
    const responseText = await this.generateJson(
      buildAcceptanceCriteriaPrompt(input)
    );
    return parseAcceptanceCriteriaResponse(responseText);
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const response = await this.withTimeout(
        this.getClient().models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            temperature: 0.3,
          },
        })
      );

      const text = response.text?.trim();

      if (!text) {
        throw new AppError("AI response was empty", 502);
      }

      return text;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw this.toAppError(error);
    }
  }

  private getClient() {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      throw new AppError("Gemini API key is not configured", 503);
    }

    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  private async generateJson(prompt: string): Promise<string> {
    try {
      const response = await this.withTimeout(
        this.getClient().models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        })
      );

      const text = response.text?.trim();

      if (!text) {
        throw new AppError("AI response was empty", 502);
      }

      return text;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw this.toAppError(error);
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new AppError("Gemini request timed out", 504));
      }, GEMINI_TIMEOUT_MS);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  private toAppError(error: unknown) {
    const geminiError = error as ErrorWithStatus;
    const status = geminiError.status ?? geminiError.statusCode;
    const code = geminiError.code;

    if (status === 429 || code === 429 || code === "429") {
      return new AppError("Gemini rate limit exceeded", 429);
    }

    if (status === 408 || code === "ETIMEDOUT" || code === "ECONNABORTED") {
      return new AppError("Gemini request timed out", 504);
    }

    return new AppError("Gemini API request failed", 502);
  }
}

export const geminiService = new GeminiService();

