// Option index: 0 = A, 1 = B, 2 = C, 3 = D (same as before)
export type AllowedSubmissions = 0 | 1 | 2 | 3;

// Points bet on each option, indexed 0-3. Example: [60, 0, 40, 0]
export type Stakes = [number, number, number, number];

// What happened to one team on one question (filled in when the question is settled)
export interface Settlement {
    bankrollBefore: number; // bankroll before this question
    bankrollAfter: number;   // new bankroll, rounded to a whole number
    totalStaked: number;
    stakeOnCorrect: number;
    bonus: number;           // already included in bankrollAfter
    gotCredit: boolean;      // true if any stake was on the correct option
}

// A team. (Still called User so the rest of the code keeps working.)
export interface User {
    name: string;
    id: string;
    bankroll: number;        // current bankroll within the round (resets to 100 each round)
    banked: number;          // sum of (ending bankroll - 100) over finished rounds
    points: number;          // total score = banked + bankroll - 100 (what the leaderboard shows)
    correctCount: number;    // questions where the team had any stake on the right option
}

export interface Submission {
    problemId: string;
    userId: string;
    stakes: Stakes;
    result?: Settlement;     // set when the question is settled
}

export interface Problem {
    id: string;
    title: string;
    description: string;
    image?: string;
    startTime: number;
    answer: AllowedSubmissions; // 0, 1, 2, 3
    options: {
        id: number;
        title: string;
    }[]
    submissions: Submission[]
}

// What students are allowed to see: no answer, no one else's bets
export type PublicProblem = Omit<Problem, "answer" | "submissions">;