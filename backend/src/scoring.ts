// scoring.ts — pure rules for "High Stakes". No sockets, no state.
// Lives in backend/src/ next to Quiz.ts.

import { AllowedSubmissions, Settlement, Stakes } from "./types/types";

export const CONFIG = {
    START_BANKROLL: 100,      // every team resets to this at the start of each round
    MIN_RISK: 50,             // min total risk per question (or whatever is left, if less)
    MAX_RISK: 100,            // max total risk per question; set to Infinity to remove the cap
    PROFIT_RATE: 0.2,         // correct stake returns stake + 20%
    CORRECT_BONUS: 20,        // bonus x (stake on correct / total risked), added to the bankroll
    QUESTIONS_PER_ROUND: 10,
    ROUNDS: 4,
    MAX_TEAMS: 30,            // fixed cap on teams per room (stops endless joins)
    ALLOW_LATE_JOIN: false,   // false = once the quiz starts, only existing teams can rejoin
};

export function emptyStakes(): Stakes {
    return [0, 0, 0, 0];
}

export function totalStake(stakes: Stakes): number {
    return stakes.reduce((sum, s) => sum + s, 0);
}

/** Smallest and largest total risk allowed for a team with this bankroll. */
export function riskLimits(bankroll: number): { min: number; max: number } {
    const available = Math.floor(bankroll);
    return {
        min: Math.min(CONFIG.MIN_RISK, available),
        max: Math.min(CONFIG.MAX_RISK, available),
    };
}

/** Returns an error message if the risk is illegal, or null if it is fine. */
export function validateRisk(stakes: Stakes, bankroll: number): string | null {
    if (!Array.isArray(stakes) || stakes.length !== 4) {
        return "A risk needs exactly four amounts, one per option.";
    }
    for (let i = 0; i < 4; i++) {
        const s = stakes[i];
        if (typeof s !== "number" || !Number.isInteger(s) || s < 0) {
            return `Stake on option ${String.fromCharCode(65 + i)} must be a whole number of 0 or more.`;
        }
    }
    const { min, max } = riskLimits(bankroll);
    if (max <= 0) {
        return "You have no points left this round.";
    }
    const total = totalStake(stakes);
    if (total < min) return `You must risk at least ${min} points.`;
    if (total > max) return `You can risk at most ${max} points.`;
    return null;
}

/** Settle one question for one team. Assumes the risk already passed validateRisk. */
export function settleQuestion(bankroll: number, stakes: Stakes, correct: AllowedSubmissions): Settlement {
    const totalStaked = totalStake(stakes);
    const stakeOnCorrect = stakes[correct];

    const returned = stakeOnCorrect * (1 + CONFIG.PROFIT_RATE);
    const bonus = totalStaked > 0 ? CONFIG.CORRECT_BONUS * (stakeOnCorrect / totalStaked) : 0;

    // Everything risked leaves the bankroll; only the correct stake (plus 20%) comes back.
    const bankrollAfter = Math.round(bankroll - totalStaked + returned + bonus);

    return { bankrollBefore: bankroll, bankrollAfter, totalStaked, stakeOnCorrect, bonus, gotCredit: stakeOnCorrect > 0 };
}

/** Total score = banked (finished rounds) + progress in the current round. */
export function totalScore(banked: number, currentBankroll: number): number {
    return banked + (currentBankroll - CONFIG.START_BANKROLL);
}
