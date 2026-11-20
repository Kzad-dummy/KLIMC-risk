// scoring.ts — pure rules for "High Stakes". No sockets, no state.
// Lives in backend/src/ next to Quiz.ts.
//
// Rules
//  - Every question, every team gets a fresh bankroll of 100 to spread over 4 options.
//  - Question score = points placed on the correct option (0 to 100).
//  - Points on wrong options, and any points left unplaced, score 0. Nothing is ever subtracted.
//  - No submission before the timer ends = empty stakes = 0 for that question.
//  - Total score = sum of question scores (max 100 x 40 = 4000).
//  - Tie-break = number of questions where the team put strictly more points
//    on the correct option than on any other single option ("plurality correct").

import { AllowedSubmissions, Settlement, Stakes } from "./types/types";

export const CONFIG = {
    BANKROLL: 100,            // fresh bankroll every question
    MAX_QUESTIONS: 40,        // hard cap on questions in one game
    MAX_TEAMS: 30,            // fixed cap on teams per room (stops endless joins)
    ALLOW_LATE_JOIN: false,   // false = once the quiz starts, only existing teams can rejoin
};

/** A team's running totals. */
export interface Tally {
    total: number;    // running total score
    correct: number;  // running count of plurality-correct questions
}

export function emptyStakes(): Stakes {
    return [0, 0, 0, 0];
}

export function totalStake(stakes: Stakes): number {
    return stakes.reduce((sum, s) => sum + s, 0);
}

/** Returns an error message if the risk is illegal, or null if it is fine.
 *  Placing fewer than 100 is allowed, but the points not placed are simply lost. */
export function validateRisk(stakes: unknown): string | null {
    if (!Array.isArray(stakes) || stakes.length !== 4) {
        return "A risk needs exactly four amounts, one per option.";
    }
    for (let i = 0; i < 4; i++) {
        const s = stakes[i];
        if (typeof s !== "number" || !Number.isInteger(s) || s < 0) {
            return `Risk on option ${String.fromCharCode(65 + i)} must be a whole number of 0 or more.`;
        }
    }
    const total = (stakes as number[]).reduce((sum, s) => sum + s, 0);
    if (total > CONFIG.BANKROLL) {
        return `You can risk at most ${CONFIG.BANKROLL} points per question.`;
    }
    return null;
}

/** True only if the correct option has strictly more points than every other option.
 *  A 50/50 split between the right answer and a wrong one does NOT count. */
export function isPluralityCorrect(stakes: Stakes, correct: AllowedSubmissions): boolean {
    const onCorrect = stakes[correct];
    if (onCorrect <= 0) return false;
    return stakes.every((s, i) => i === correct || s < onCorrect);
}

/** Settle one question for one team. Assumes the risk already passed validateRisk.
 *  Pass emptyStakes() for a team that didn't submit in time. */
export function settleQuestion(stakes: Stakes, correct: AllowedSubmissions): Settlement {
    const stakeOnCorrect = stakes[correct] ?? 0;
    return {
        totalStaked: totalStake(stakes),
        stakeOnCorrect,
        score: stakeOnCorrect,
        pluralityCorrect: isPluralityCorrect(stakes, correct),
    };
}

/** Add one question's result to a team's running tally (returns a new object). */
export function addResult(tally: Tally, result: Settlement): Tally {
    return {
        total: tally.total + result.score,
        correct: tally.correct + (result.pluralityCorrect ? 1 : 0),
    };
}

/** Sort comparator for the leaderboard: higher total first, then more plurality-correct.
 *  Returns 0 for a true tie, so those teams can share a rank. */
export function compareTallies(a: Tally, b: Tally): number {
    return (b.total - a.total) || (b.correct - a.correct);
}
