export type AllowedSubmissions = 0 | 1 | 2 | 3;

// Points risked on each option, in order A, B, C, D. Example: [60, 0, 40, 0]
export type Stakes = [number, number, number, number];

// What happened to one team on one question
export interface Settlement {
  bankrollBefore: number;
  bankrollAfter: number;
  totalStaked: number;
  stakeOnCorrect: number;
  bonus: number;
  gotCredit: boolean;
}

// A team, as it appears on the leaderboard
export interface User {
  name: string;
  id: string;
  points: number;       // total score
  bankroll: number;     // current bankroll in this round
  banked: number;
  correctCount: number;
}

export interface Submission {
  problemId: string;
  userId: string;
  stakes: Stakes;
  result?: Settlement;
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
  bankroll: number;
  points: number;
  minRisk: number;   // smallest total this team may risk right now
  maxRisk: number;   // largest total this team may risk right now
}

export interface Rules {
  startBankroll: number;
  profitRate: number;    // 0.2 = a correct stake comes back with 20% extra
  correctBonus: number;  // bonus x (stake on correct / total risked)
}

export interface RoundInfo {
  round: number;
  totalRounds: number;
  questionInRound: number;
  questionsPerRound: number;
  totalQuestions: number;
}

export interface RiskOutcome {
  userId: string;
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
    } & RoundInfo)
  | ({
      type: 'leaderboard';
      leaderboard: User[];
      problem: PublicProblem;
      correctAnswer: AllowedSubmissions;
      results: RiskOutcome[];
      isRoundEnd: boolean;
      isFinal: boolean;
      teams: TeamSnapshot[];
    } & RoundInfo)
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
