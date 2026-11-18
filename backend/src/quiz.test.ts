// Simulates a game without any sockets. Run: npx tsx src/Quiz.test.ts
import { IoManager } from "./managers/IoManager";
import { Quiz } from "./Quiz";
import { Problem } from "./types/types";

// Capture everything the server would send instead of using real sockets.
const emitted: { event: string; payload: any }[] = [];
(IoManager as any).getIo = () => ({
    to: () => ({ emit: (event: string, payload: any) => emitted.push({ event, payload }) })
});
const last = (event: string) => [...emitted].reverse().find(e => e.event === event)!.payload;

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

const mk = (i: number): Problem => ({
    id: `p${i}`, title: `Q${i}`, description: "", startTime: 0, answer: 0,
    options: [0, 1, 2, 3].map(id => ({ id, title: `opt${id}` })), submissions: []
});

const quiz = new Quiz("room1");
for (let i = 1; i <= 11; i++) quiz.addProblem(mk(i));   // 11 questions: crosses a round boundary
const alpha = quiz.addUser("alpha");
const beta = quiz.addUser("beta");
// A team's latest public numbers, taken from whichever message (question or results) was sent most recently.
const team = (id: string) => {
    const latest = [...emitted].reverse().find(e => e.event === "problem" || e.event === "leaderboard")!;
    return latest.payload.teams.find((t: any) => t.id === id);
};

// ---- Question 1 ----
quiz.start();
check("state is question", quiz.getCurrentState()?.type, "question");
const sent = JSON.stringify(last("problem"));
check("answer is NOT sent to students", sent.includes('"answer"'), false);
check("other bets are NOT sent to students", sent.includes('"submissions"'), false);
check("admin view does include the answer", JSON.stringify(quiz.getCurrentState(true)).includes('"answer":0'), true);

check("alpha bets 100", quiz.placeRisk(alpha, "p1", [100, 0, 0, 0]).ok, true);
check("beta bets 60/40", quiz.placeRisk(beta, "p1", [60, 0, 40, 0]).ok, true);
check("bet below minimum rejected", quiz.placeRisk(alpha, "p1", [10, 0, 0, 0]).ok, false);
check("bet on a different question rejected", quiz.placeRisk(alpha, "p2", [50, 0, 0, 0]).ok, false);
check("unknown team rejected", quiz.placeRisk("nope", "p1", [50, 0, 0, 0]).ok, false);
check("alpha changes bet to 60", quiz.placeRisk(alpha, "p1", [60, 0, 0, 0]).ok, true);

quiz.next(); // during a question: closes betting, shows results
check("state is leaderboard", quiz.getCurrentState()?.type, "leaderboard");
const reveal = last("leaderboard");
check("correct answer revealed", reveal.correctAnswer, 0);
check("both bets revealed", reveal.results.length, 2);
check("alpha bankroll 132 (60 bet, last bet counts)", reveal.teams.find((t: any) => t.id === alpha).bankroll, 132);
check("beta bankroll 84", reveal.teams.find((t: any) => t.id === beta).bankroll, 84);
check("leaderboard order", reveal.leaderboard.map((u: any) => u.name), ["alpha", "beta"]);
check("alpha points 32", reveal.leaderboard[0].points, 32);
check("beta points -16", reveal.leaderboard[1].points, -16);
check("late bet rejected", quiz.placeRisk(alpha, "p1", [50, 0, 0, 0]).ok, false);

// ---- Question 2: bankroll carries over, max-bet cap applies, beta skips ----
quiz.next();
check("question 2 started", last("problem").problem.id, "p2");
check("alpha limits: min 50, max 100", [team(alpha).minBet, team(alpha).maxBet], [50, 100]);
check("alpha can't bet 101 (cap)", quiz.placeRisk(alpha, "p2", [101, 0, 0, 0]).ok, false);
check("alpha bets 100", quiz.placeRisk(alpha, "p2", [100, 0, 0, 0]).ok, true);
quiz.next();
check("alpha bankroll 172", last("leaderboard").teams.find((t: any) => t.id === alpha).bankroll, 172);
check("beta unchanged when skipping", last("leaderboard").teams.find((t: any) => t.id === beta).bankroll, 84);

// ---- Questions 3-10: nobody bets ----
for (let q = 3; q <= 10; q++) { quiz.next(); quiz.next(); }
check("round 1 ends after question 10", last("leaderboard").isRoundEnd, true);
check("question counter", [last("leaderboard").round, last("leaderboard").questionInRound], [1, 10]);

// ---- Question 11: new round, everyone back to 100 ----
quiz.next();
check("round 2 started", [last("problem").round, last("problem").questionInRound], [2, 1]);
check("alpha reset to 100", team(alpha).bankroll, 100);
check("alpha points keep round 1 result", team(alpha).points, 72);
check("beta points keep round 1 result", team(beta).points, -16);
check("alpha bets 50", quiz.placeRisk(alpha, "p11", [50, 0, 0, 0]).ok, true);
quiz.next();
check("alpha points 102 (72 + 30)", last("leaderboard").leaderboard[0].points, 102);
check("last question is flagged final", last("leaderboard").isFinal, true);

// ---- End ----
quiz.next();
check("quiz ended", quiz.getCurrentState()?.type, "ended");
check("quizEnded event sent", emitted.some(e => e.event === "quizEnded"), true);
check("no timer left running", (quiz as any).timer, null);

console.log(failed === 0 ? "\nAll tests passed." : `\n${failed} test(s) failed.`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);