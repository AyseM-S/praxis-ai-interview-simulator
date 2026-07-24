export type QuestionCategory = 'numerical' | 'verbal' | 'abstract' | 'chart';

export interface BaseQuestion {
  id: string;
  category: QuestionCategory;
  text: string;
  options: string[];
  correctAnswer: string;
  estimatedTimeSeconds: number;
}

export interface TextQuestion extends BaseQuestion {
  category: 'numerical' | 'verbal';
}

export interface ChartQuestion extends BaseQuestion {
  category: 'chart';
  chartType: 'bar' | 'line' | 'pie';
  dataset: Record<string, string | number>[];
}

export interface AbstractQuestion extends BaseQuestion {
  category: 'abstract';
  svgContent: string;
}

export type QuestionDTO = TextQuestion | ChartQuestion | AbstractQuestion;

export type AssessmentMode = 'talent_test' | 'face_to_face';

export interface InterviewQuestion {
  id: string;
  text: string;
  interviewer: 'fulya' | 'gokturk' | 'ayse';
  estimatedTimeSeconds: number;
}

