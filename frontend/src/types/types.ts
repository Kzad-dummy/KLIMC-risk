export type AllowedSubmissions = 0 | 1 | 2 | 3;

// Points risked on each option, in order A, B, C, D. Example: [60, 0, 40, 0]
// Any total from 0 to 100 is allowed; points not placed are simply lost.
export type Stakes = [number, number, number, number];

// What happened to one team on one question
export interface Settlement {
  totalStaked: number;       // points placed across all options
  stakeOnCorrect: number;    // points placed on the correct option
  score: number;             // what the team earned for this question (= stakeOnCorrect, 0 to 100)
  pluralityCorrect: boolean; // correct option had strictly more points than any other (tie-break)
}

// A team, as it appears on the leaderboard
export interface User {
  name: string;
  id: string;
  points: number;       // total score: sum of question scores
  correctCount: number; // questions where the right option had the most points (tie-break)
  rank?: number;        // tied teams share a rank (sent by the server on the leaderboard)
}

export interface Submission {
  problemId: string;
  userId: string;
  stakes: Stakes;
  result?: Settlement;
  submitted?: boolean;  // false if the team never submitted (settled with empty stakes)
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  image?: string;
  startTime: number;
  answer: AllowedSubmissions;
  options: {
    id: number;
    title: string;
  }[];
  submissions: Submission[];
}

// A question as the server sends it. `answer` and `submissions` are only present in the admin view.
export interface PublicProblem {
  id: string;
  title: string;
  description: string;
  image?: string;
  startTime: number;
  options: {
    id: number;
    title: string;
  }[];
  answer?: AllowedSubmissions;
  submissions?: Submission[];
}

export interface TeamSnapshot {
  id: string;
  name: string;
  points: number;
  correctCount: number;
}

export interface Rules {
  bankroll: number;  // points every team gets to spread on each question (100)
}

export interface ProgressInfo {
  questionNumber: number;  // 1-based
  totalQuestions: number;
}

// Old name, kept as an alias so any other file importing it still compiles
export type RoundInfo = ProgressInfo;

export interface RiskOutcome {
  userId: string;
  submitted: boolean;  // false = the team never submitted and scored 0
  stakes: Stakes;
  result?: Settlement;
}

export type QuizView =
  | { type: 'not_started' }
  | { type: 'room_not_found' }
  | ({
      type: 'question';
      problem: PublicProblem;
      endsAt: number;     // server time (ms) when the risk window closes
      serverNow: number;  // server time (ms) when this message was sent
      rules: Rules;
      teams: TeamSnapshot[];
    } & ProgressInfo)
  | ({
      type: 'leaderboard';
      leaderboard: User[];
      problem: PublicProblem;
      correctAnswer: AllowedSubmissions;
      results: RiskOutcome[];
      isFinal: boolean;
      teams: TeamSnapshot[];
    } & ProgressInfo)
  | { type: 'ended'; leaderboard: User[] };

export type QuestionView = Extract<QuizView, { type: 'question' }>;
export type ResultsView = Extract<QuizView, { type: 'leaderboard' }>;
export type EndedView = Extract<QuizView, { type: 'ended' }>;

export interface RiskResult {
  ok: boolean;
  error?: string;
  stakes?: Stakes;
}

// Older shape, kept so any other file importing it still compiles
export interface QuizState {
  roomId: string;
  currentState: "leaderboard" | "question" | "not_started" | "ended";
  activeProblem: number;
  problems: Problem[];
  users: User[];
}
