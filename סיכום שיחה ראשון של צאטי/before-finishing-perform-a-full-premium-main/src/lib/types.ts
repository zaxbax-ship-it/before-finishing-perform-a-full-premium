export type QuestionTranslation = {
  category?: string;
  difficulty?: string;
  question?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
};
export type Question = { id:number|string; category:string; difficulty:string; question:string; options:string[]; correctIndex:number; correctAnswer?:string; explanation?:string; tags?:string[]; translations?: Partial<Record<Locale, QuestionTranslation>> };
export type Locale = 'he'|'en'|'ar'|'ru'|'am';
