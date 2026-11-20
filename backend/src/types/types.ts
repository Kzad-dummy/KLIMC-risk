// Option index: 0 = A, 1 = B, 2 = C, 3 = D (same as before)
export type AllowedSubmissions = 0 | 1 | 2 | 3;

// Points risked on each option, indexed 0-3. Example: [60, 0, 40, 0]
// Any total from 0 to 100 is allowed; points not placed are simply lost.
export type Stakes = [number, number, number, number];

// What happened to one team on one question (filled in when the question is settled)
export interface Settlement {
    totalStaked: number;       // total points placed across all options
    stakeOnCorrect: number;    // points placed on the correct option
    score: number;             // what the team earns for this question (= stakeOnCorrect, 0 to 100)
    pluralityCorrect: boolean; // true if the correct option had strictly more points than any other (tie-break)
}

// A team. (Still called User so the rest of the code keeps working.)
export interface User {
    name: string;
    id: string;
    points: number;          // total score: sum of question scores (what the leaderboard shows)
    correctCount: number;    // questions where the right option had the most points (tie-break)
}

export interface Submission {
    problemId: string;
    userId: string;
    stakes: Stakes;
    result?: Settlement;     // set when the question is settled
    submitted?: boolean;     // false if the team never submitted (settled with empty stakes)
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

// What students are allowed to see: no answer, no one else's risks
export type PublicProblem = Omit<Problem, "answer" | "submissions">;
