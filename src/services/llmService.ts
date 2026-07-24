import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import type { QuestionDTO, QuestionCategory, InterviewQuestion } from "../types";

export class QuestionGenerationEngine {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  public async generateTestAsync(
    totalQuestions: number,
    totalMinutes: number,
    language: string
  ): Promise<QuestionDTO[]> {
    const questionsPerCategory = Math.ceil(totalQuestions / 4);
    const secondsPerQuestion = Math.floor((totalMinutes * 60) / totalQuestions);

    const categories: { key: QuestionCategory; prompt: string; schema: Schema }[] = [
      { key: 'numerical', prompt: this.getNumericalPrompt(questionsPerCategory, language, secondsPerQuestion), schema: this.getBaseSchema('numerical') },
      { key: 'verbal', prompt: this.getVerbalPrompt(questionsPerCategory, language, secondsPerQuestion), schema: this.getBaseSchema('verbal') },
      { key: 'chart', prompt: this.getChartPrompt(questionsPerCategory, language, secondsPerQuestion), schema: this.getChartSchema() },
      { key: 'abstract', prompt: this.getAbstractPrompt(questionsPerCategory, language, secondsPerQuestion), schema: this.getAbstractSchema() }
    ];

    const llmPromises = categories.map(async (cat) => {
      try {
        const model = this.genAI.getGenerativeModel({
          model: "gemini-3.5-flash",
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.ARRAY,
              items: cat.schema
            }
          }
        });

        const result = await model.generateContent(cat.prompt);
        const responseText = result.response.text();
        const parsed: QuestionDTO[] = JSON.parse(responseText);
        
        // Ensure category is set correctly
        return parsed.map(q => ({ ...q, category: cat.key })) as unknown as QuestionDTO[];
      } catch (error) {
        console.error(`Error generating ${cat.key} questions:`, error);
        return [];
      }
    });

    const resultsArray = await Promise.all(llmPromises);
    let allQuestions: QuestionDTO[] = resultsArray.flat();
    
    allQuestions = this.shuffleArray(allQuestions).slice(0, totalQuestions);
    return allQuestions;
  }

  private getNumericalPrompt(count: number, language: string, seconds: number) {
    return `You are an expert HR talent assessment creator.
Your task is to generate ${count} challenging and reasoning-heavy NUMERICAL REASONING questions.
Target Language: ${language}
Candidates have an average of ${seconds} seconds per question. Adjust text length and difficulty accordingly.
Numerical questions should require analytical thinking, ratio-proportion, and setting up equations rather than simple formula memorization. Options must contain exactly 4 or 5 choices.
Return ONLY a JSON array.`;
  }

  private getVerbalPrompt(count: number, language: string, seconds: number) {
    return `You are an expert HR talent assessment creator.
Your task is to generate ${count} challenging and reasoning-heavy VERBAL REASONING questions.
Target Language: ${language}
Candidates have an average of ${seconds} seconds per question.
Verbal questions should involve paragraph comprehension, logical deductions, or comparisons. Options must contain exactly 4 or 5 choices.
Return ONLY a JSON array.`;
  }

  private getChartPrompt(count: number, language: string, seconds: number) {
    return `You are a data analysis and talent assessment expert.
Your task is to generate ${count} CHART INTERPRETATION questions that will be rendered using a chart library.
Target Language: ${language}
Average Time: ${seconds} seconds per question.
For each question, you must produce a logical "dataset" array (e.g., [{ "name": "Q1", "value": 100 }]).
Questions should require the user to interpret data in the chart and perform calculations.
chartType must be 'bar', 'line', or 'pie'. Options must contain exactly 4 or 5 choices.
Return ONLY a JSON array.`;
  }

  private getAbstractPrompt(count: number, language: string, seconds: number) {
    return `You are a visual intelligence and abstract reasoning expert.
Your task is to generate ${count} PATTERN/ABSTRACT REASONING questions.
Target Language: ${language}
Average Time: ${seconds} seconds per question.
Each question should ask to find the missing shape/pattern.
Provide a clean, valid, and monochrome SVG code (svgContent using stroke='currentColor' or fill='currentColor') representing the visual. Options must contain exactly 4 or 5 choices.
Return ONLY a JSON array.`;
  }

  private getBaseSchema(_category: string): Schema {
    return {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        text: { type: SchemaType.STRING },
        options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        correctAnswer: { type: SchemaType.STRING },
        estimatedTimeSeconds: { type: SchemaType.NUMBER }
      },
      required: ["id", "category", "text", "options", "correctAnswer", "estimatedTimeSeconds"]
    };
  }

  private getChartSchema(): Schema {
    return {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        text: { type: SchemaType.STRING },
        options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        correctAnswer: { type: SchemaType.STRING },
        estimatedTimeSeconds: { type: SchemaType.NUMBER },
        chartType: { type: SchemaType.STRING },
        dataset: { 
          type: SchemaType.ARRAY, 
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              value: { type: SchemaType.NUMBER },
              label: { type: SchemaType.STRING },
              amount: { type: SchemaType.NUMBER }
            }
          } 
        }
      },
      required: ["id", "category", "text", "options", "correctAnswer", "estimatedTimeSeconds", "chartType", "dataset"]
    };
  }

  private getAbstractSchema(): Schema {
    return {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        text: { type: SchemaType.STRING },
        options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        correctAnswer: { type: SchemaType.STRING },
        estimatedTimeSeconds: { type: SchemaType.NUMBER },
        svgContent: { type: SchemaType.STRING }
      },
      required: ["id", "category", "text", "options", "correctAnswer", "estimatedTimeSeconds", "svgContent"]
    };
  }

  public async generateInterviewQuestionsAsync(
    role: string,
    totalQuestions: number,
    language: string
  ): Promise<InterviewQuestion[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-3.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.ARRAY,
            items: this.getInterviewSchema()
          }
        }
      });

      const prompt = this.getInterviewPrompt(role, totalQuestions, language);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const parsed: InterviewQuestion[] = JSON.parse(responseText);
      return parsed;
    } catch (error) {
      console.error("Error generating interview questions:", error);
      return [];
    }
  }

  private getInterviewPrompt(role: string, count: number, language: string) {
    return `You are a professional HR Panel Coordinator.
Your task is to generate ${count} interview questions for a candidate applying for the role of: "${role}".
Target Language: ${language}

The panel consists of three interviewers:
1. "fulya" (HR Lead): Focuses on behavioral questions, cultural fit, team collaboration, conflict resolution, and soft skills.
2. "gokturk" (Tech Lead): Focuses on technical expertise, problem-solving, system design, coding logic, and technical challenges related to the role.
3. "ayse" (Product Manager): Focuses on product design, user-centric thinking, agile methodologies, scoping, planning, and business goals.

Generate exactly ${count} realistic and challenging questions distributed logically among the three panel members.
Return ONLY a JSON array.`;
  }

  private getInterviewSchema(): Schema {
    return {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        text: { type: SchemaType.STRING },
        interviewer: { 
          type: SchemaType.STRING, 
          description: "Assign the question to the appropriate interviewer: 'fulya' (HR Lead), 'gokturk' (Tech Lead), or 'ayse' (Product Manager)."
        },
        estimatedTimeSeconds: { type: SchemaType.NUMBER, description: "Suggested duration to answer this question, usually 45 to 90 seconds." }
      },
      required: ["id", "text", "interviewer", "estimatedTimeSeconds"]
    };
  }

  private shuffleArray(array: any[]) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  }
}
