import type { AllowedSubmissions } from '../types/types';

export interface ProblemDraft {
  title: string;
  description: string;
  options: { id: number; title: string }[];
  answer: AllowedSubmissions;
}

export interface ParsedQuestions {
  problems: ProblemDraft[];
  errors: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads a JSON file of questions. Accepts either a list, or { "questions": [...] }.
 * Each question: { title, description?, options: [4 strings], answer: "A"-"D" or 0-3 }
 */
export function parseQuestionFile(text: string): ParsedQuestions {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { problems: [], errors: ['This file is not valid JSON.'] };
  }

  const list = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.questions)
      ? data.questions
      : null;
  if (!list) {
    return { problems: [], errors: ['Expected a list of questions (or an object with a "questions" list).'] };
  }
  if (list.length === 0) {
    return { problems: [], errors: ['The file has no questions in it.'] };
  }

  const problems: ProblemDraft[] = [];
  const errors: string[] = [];

  list.forEach((raw: unknown, i: number) => {
    const label = `Question ${i + 1}`;
    if (!isRecord(raw)) {
      errors.push(`${label}: not an object.`);
      return;
    }

    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) errors.push(`${label}: missing "title".`);
    const description = typeof raw.description === 'string' ? raw.description.trim() : '';

    const optionTitles = Array.isArray(raw.options)
      ? raw.options.map((o: unknown) =>
          typeof o === 'string' ? o.trim() : isRecord(o) && typeof o.title === 'string' ? o.title.trim() : ''
        )
      : [];
    if (optionTitles.length !== 4 || optionTitles.some(o => o === '')) {
      errors.push(`${label}: needs exactly 4 non-empty options.`);
    }

    let answer: AllowedSubmissions | null = null;
    if (typeof raw.answer === 'number' && [0, 1, 2, 3].includes(raw.answer)) {
      answer = raw.answer as AllowedSubmissions;
    } else if (typeof raw.answer === 'string') {
      const index = ['A', 'B', 'C', 'D'].indexOf(raw.answer.trim().toUpperCase());
      if (index >= 0) answer = index as AllowedSubmissions;
    }
    if (answer === null) errors.push(`${label}: "answer" must be A, B, C or D (or 0-3).`);

    if (title && optionTitles.length === 4 && optionTitles.every(o => o !== '') && answer !== null) {
      problems.push({
        title,
        description,
        options: optionTitles.map((t, id) => ({ id, title: t })),
        answer,
      });
    }
  });

  return { problems, errors };
}
