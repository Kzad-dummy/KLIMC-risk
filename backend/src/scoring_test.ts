import { settleQuestion, validateRisk, totalScore } from "./scoring";
import { Stakes } from "./types/types";

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
    const ok = actual === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${actual}, expected ${expected})`);
}
const s = (a: number, b = 0, c = 0, d = 0): Stakes => [a, b, c, d];

// Settlement (bankroll 100 unless stated). Correct option is index 0 (A) unless stated.
check("all 100 on correct", settleQuestion(100, s(100), 0).bankrollAfter, 140);
check("60 on correct only", settleQuestion(100, s(60), 0).bankrollAfter, 132);
check("all 100 on wrong", settleQuestion(100, s(100), 1).bankrollAfter, 0);
check("70 correct / 30 wrong", settleQuestion(100, s(70, 30), 0).bankrollAfter, 98);
check("50 / 50 split", settleQuestion(100, s(50, 50), 0).bankrollAfter, 70);
check("short bankroll 30, all on correct", settleQuestion(30, s(30), 0).bankrollAfter, 56);
check("unbet points are kept", settleQuestion(100, s(50), 1).bankrollAfter, 50);
check("correct option D (index 3)", settleQuestion(100, s(0, 0, 0, 100), 3).bankrollAfter, 140);

// Validation
check("49 is below minimum", validateRisk(s(49), 100) !== null, true);
check("50 is fine", validateRisk(s(50), 100), null);
check("101 is above bankroll", validateRisk(s(101), 100) !== null, true);
check("150 blocked by max-bet cap", validateRisk(s(150), 200) !== null, true);
check("30 left: betting 30 is legal", validateRisk(s(30), 30), null);
check("30 left: betting 20 is illegal", validateRisk(s(20), 30) !== null, true);
check("0 left: cannot bet", validateRisk(s(0), 0) !== null, true);
check("fractional stake rejected", validateRisk(s(50.5), 100) !== null, true);
check("negative stake rejected", validateRisk(s(150, -50), 100) !== null, true);
check("wrong-length bet rejected", validateRisk([50, 0, 0] as unknown as Stakes, 100) !== null, true);

// Total score: rounds ended on 140, 0, 100; now 98 into round 4
check("total score", totalScore(40 - 100 + 0, 98), -62);

console.log(failed === 0 ? "\nAll tests passed." : `\n${failed} test(s) failed.`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);