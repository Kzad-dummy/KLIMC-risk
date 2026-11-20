import { settleQuestion, validateRisk, addResult, compareTallies, isPluralityCorrect, emptyStakes, Tally } from "./scoring";
import { Stakes } from "./types/types";

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
    const ok = actual === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${actual}, expected ${expected})`);
}
const s = (a: number, b = 0, c = 0, d = 0): Stakes => [a, b, c, d];

// Scoring: score = points placed on the correct option. Correct option is index 0 (A) unless stated.
check("all 100 on correct", settleQuestion(s(100), 0).score, 100);
check("60 on correct only", settleQuestion(s(60), 0).score, 60);
check("all 100 on wrong", settleQuestion(s(100), 1).score, 0);
check("70 correct / 30 wrong", settleQuestion(s(70, 30), 0).score, 70);
check("50 / 50 split", settleQuestion(s(50, 50), 0).score, 50);
check("40/30/20/10 spread", settleQuestion(s(40, 30, 20, 10), 0).score, 40);
check("unplaced points are lost (only 50 placed)", settleQuestion(s(50), 1).score, 0);
check("correct option D (index 3)", settleQuestion(s(0, 0, 0, 100), 3).score, 100);
check("no submission (empty stakes)", settleQuestion(emptyStakes(), 0).score, 0);
check("totalStaked reported", settleQuestion(s(70, 30), 0).totalStaked, 100);
check("stakeOnCorrect reported", settleQuestion(s(70, 30), 0).stakeOnCorrect, 70);

// Plurality-correct (tie-break): correct option must strictly beat every other option
check("100 on correct is plurality", settleQuestion(s(100), 0).pluralityCorrect, true);
check("40/30/20/10 is plurality", settleQuestion(s(40, 30, 20, 10), 0).pluralityCorrect, true);
check("50/50 split is NOT plurality", settleQuestion(s(50, 50), 0).pluralityCorrect, false);
check("30/40/0/30, correct has 30 -> not plurality", settleQuestion(s(30, 40, 0, 30), 0).pluralityCorrect, false);
check("all on wrong is not plurality", settleQuestion(s(100), 1).pluralityCorrect, false);
check("empty stakes is not plurality", isPluralityCorrect(emptyStakes(), 0), false);
check("1 point on correct, rest unplaced -> plurality", isPluralityCorrect(s(1), 0), true);
check("25/25/25/25 is NOT plurality", isPluralityCorrect(s(25, 25, 25, 25), 2), false);

// Validation: any whole-number split with a total of 0 to 100
check("0 total is allowed", validateRisk(s(0)), null);
check("49 total is allowed (no minimum)", validateRisk(s(49)), null);
check("100 total is allowed", validateRisk(s(100)), null);
check("25 each is allowed", validateRisk(s(25, 25, 25, 25)), null);
check("101 total is rejected", validateRisk(s(101)) !== null, true);
check("60 + 50 split is rejected", validateRisk(s(60, 50)) !== null, true);
check("fractional stake rejected", validateRisk(s(50.5)) !== null, true);
check("negative stake rejected", validateRisk(s(150, -50)) !== null, true);
check("wrong-length risk rejected", validateRisk([50, 0, 0]) !== null, true);
check("non-number stake rejected", validateRisk(["50", 0, 0, 0]) !== null, true);
check("non-array rejected", validateRisk(null) !== null, true);

// Running tally over a game: scores 100, 0, 40; plurality-correct on Q1 and Q3
let t: Tally = { total: 0, correct: 0 };
t = addResult(t, settleQuestion(s(100), 0));
t = addResult(t, settleQuestion(s(0, 100), 0));
t = addResult(t, settleQuestion(s(40, 30, 20, 10), 0));
check("tally total", t.total, 140);
check("tally correct count", t.correct, 2);

// Max possible over 40 questions
let max: Tally = { total: 0, correct: 0 };
for (let i = 0; i < 40; i++) max = addResult(max, settleQuestion(s(100), 0));
check("max total over 40 questions", max.total, 4000);

// Leaderboard ordering: higher total first, then more plurality-correct, else a true tie
check("higher total wins", compareTallies({ total: 120, correct: 0 }, { total: 100, correct: 9 }) > 0, false);
check("lower total loses", compareTallies({ total: 100, correct: 9 }, { total: 120, correct: 0 }) > 0, true);
check("tie on total, more correct wins", compareTallies({ total: 100, correct: 3 }, { total: 100, correct: 1 }) < 0, true);
check("full tie compares equal", compareTallies({ total: 100, correct: 2 }, { total: 100, correct: 2 }), 0);

console.log(failed === 0 ? "\nAll tests passed." : `\n${failed} test(s) failed.`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
