import { IoManager } from "./managers/IoManager";
import { Problem, PublicProblem, Stakes, User } from "./types/types";
import { CONFIG, riskLimits, settleQuestion, totalScore, validateRisk } from "./scoring";

const RISK_TIME_S = 60;

type QuizState = "not_started" | "question" | "leaderboard" | "ended";

export type JoinResult =
    | { ok: true; id: string; rejoined: boolean }
    | { ok: false; error: string };

export class Quiz {

    public roomId: string;
    private hasStarted: boolean;
    private problems: Problem[];
    private activeProblem: number;
    private users: User[];
    private currentState: QuizState;
    private timer: ReturnType<typeof setTimeout> | null;
    private riskEndsAt: number;

    constructor(roomId: string) {
        this.roomId = roomId;
        this.hasStarted = false;
        this.problems = [];
        this.activeProblem = 0;
        this.users = [];
        this.currentState = "not_started";
        this.timer = null;
        this.riskEndsAt = 0;
        console.log("room created");
    }

    /** Log the current state of the quiz. Call it by hand when you need it. */
    debug() {
        console.log("----debug---");
        console.log(this.roomId);
        console.log(JSON.stringify(this.problems));
        console.log(this.users);
        console.log(this.currentState);
        console.log(this.activeProblem);
    }

    addProblem(problem: Problem) {
        this.problems.push(problem);
    }

    /** Starts the quiz at the first problem. Ignored if already started or there are no problems. */
    start() {
        if (this.hasStarted || this.problems.length === 0) {
            return;
        }
        this.hasStarted = true;
        this.beginQuestion();
    }

    // ---------------------------------------------------------------
    // Round and question flow
    // ---------------------------------------------------------------

    /** Every team goes back to 100. The round's result is added to the banked total first. */
    private startNewRound() {
        for (const user of this.users) {
            user.banked += user.bankroll - CONFIG.START_BANKROLL;
            user.bankroll = CONFIG.START_BANKROLL;
            user.points = totalScore(user.banked, user.bankroll);
        }
    }

    private beginQuestion() {
        const problem = this.problems[this.activeProblem];
        if (this.activeProblem % CONFIG.QUESTIONS_PER_ROUND === 0) {
            this.startNewRound();
        }
        this.currentState = "question";
        problem.startTime = Date.now();
        problem.submissions = [];
        this.riskEndsAt = problem.startTime + RISK_TIME_S * 1000;

        IoManager.getIo().to(this.roomId).emit("problem", this.questionPayload());

        this.clearTimer();
        this.timer = setTimeout(() => this.closeRisks(), RISK_TIME_S * 1000);
    }

    private clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /** Stops the risk window, settles every team's risk and shows the results. Safe to call twice. */
    closeRisks() {
        if (this.currentState !== "question") {
            return;
        }
        this.clearTimer();
        this.settleActiveProblem();
        this.sendLeaderboard();
    }

    private settleActiveProblem() {
        const problem = this.problems[this.activeProblem];
        if (!problem) {
            return;
        }
        for (const user of this.users) {
            const submission = problem.submissions.find(s => s.userId === user.id);
            if (!submission) {
                continue; // no risk placed: nothing gained, nothing lost
            }
            const result = settleQuestion(user.bankroll, submission.stakes, problem.answer);
            submission.result = result;
            user.bankroll = result.bankrollAfter;
            if (result.gotCredit) {
                user.correctCount++;
            }
            user.points = totalScore(user.banked, user.bankroll);
        }
    }

    sendLeaderboard() {
        this.currentState = "leaderboard";
        IoManager.getIo().to(this.roomId).emit("leaderboard", this.revealPayload());
    }

    /**
     * Admin "next" button.
     * - During a question: ends the risk window and shows the results (does not skip them).
     * - On the results screen: moves to the next question, or ends the quiz after the last one.
     */
    next() {
        if (this.currentState === "question") {
            this.closeRisks();
            return;
        }
        if (this.currentState !== "leaderboard") {
            return;
        }
        this.activeProblem++;
        if (this.activeProblem < this.problems.length) {
            this.beginQuestion();
        } else {
            this.activeProblem--;
            this.currentState = "ended";
            IoManager.getIo().to(this.roomId).emit("quizEnded", {
                leaderboard: this.getLeaderboard()
            });
        }
    }

    // ---------------------------------------------------------------
    // Teams and risks
    // ---------------------------------------------------------------

    genRandonString(length: number) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()';
        var charLength = chars.length;
        var result = '';
        for (var i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * charLength));
        }
        return result;
    }

    /**
     * Join or rejoin a team.
     * - A name already in this room (case-insensitive) is the SAME team: it keeps its points,
     *   so rejoining can never reset a score or create a duplicate team.
     * - New teams are capped at CONFIG.MAX_TEAMS, and (unless ALLOW_LATE_JOIN) can't be
     *   created after the quiz has started.
     */
    joinTeam(name: string): JoinResult {
        const key = name.toLowerCase();
        const existing = this.users.find(u => u.name.toLowerCase() === key);
        if (existing) {
            return { ok: true, id: existing.id, rejoined: true };
        }
        if (this.hasStarted && !CONFIG.ALLOW_LATE_JOIN) {
            return { ok: false, error: "The quiz has already started. Only existing teams can rejoin." };
        }
        if (this.users.length >= CONFIG.MAX_TEAMS) {
            return { ok: false, error: `This room is full (${CONFIG.MAX_TEAMS} teams).` };
        }
        let id = this.genRandonString(7);
        while (this.users.some(u => u.id === id)) {
            id = this.genRandonString(7);
        }
        this.users.push({
            id,
            name,
            bankroll: CONFIG.START_BANKROLL,
            banked: 0,
            points: 0,
            correctCount: 0
        });
        return { ok: true, id, rejoined: false };
    }

    /** Convenience wrapper: join (or rejoin) a team and return its id. Throws if the join is refused. */
    addUser(name: string): string {
        const joined = this.joinTeam(name);
        if (!joined.ok) {
            throw new Error(joined.error);
        }
        return joined.id;
    }

    getTeamName(userId: string): string | null {
        return this.users.find(u => u.id === userId)?.name ?? null;
    }

    /**
     * A team places (or changes) its risk. The last risk before the window closes is the one that counts.
     */
    placeRisk(userId: string, problemId: string, stakes: Stakes): { ok: boolean; error?: string } {
        if (this.currentState !== "question" || Date.now() > this.riskEndsAt) {
            return { ok: false, error: "Risks are closed." };
        }
        const problem = this.problems[this.activeProblem];
        if (!problem || problem.id !== problemId) {
            return { ok: false, error: "That question is not active." };
        }
        const user = this.users.find(x => x.id === userId);
        if (!user) {
            return { ok: false, error: "Team not found." };
        }
        const error = validateRisk(stakes, user.bankroll);
        if (error) {
            return { ok: false, error };
        }
        const clean: Stakes = [stakes[0], stakes[1], stakes[2], stakes[3]];
        const existing = problem.submissions.find(s => s.userId === userId);
        if (existing) {
            existing.stakes = clean;
        } else {
            problem.submissions.push({ problemId, userId, stakes: clean });
        }
        return { ok: true };
    }

    // ---------------------------------------------------------------
    // What gets sent to clients
    // ---------------------------------------------------------------

    /** Top 20 by total score; correct answers break ties. Returns a copy, so users stay in order. */
    getLeaderboard() {
        return [...this.users]
            .sort((a, b) => (b.points - a.points) || (b.correctCount - a.correctCount))
            .slice(0, 20);
    }

    /** Only whitelisted fields: no answer, no submissions. */
    private toPublic(problem: Problem): PublicProblem {
        return {
            id: problem.id,
            title: problem.title,
            description: problem.description,
            image: problem.image,
            startTime: problem.startTime,
            options: problem.options
        };
    }

    private roundInfo() {
        const n = CONFIG.QUESTIONS_PER_ROUND;
        return {
            round: Math.floor(this.activeProblem / n) + 1,
            totalRounds: CONFIG.ROUNDS,
            questionInRound: (this.activeProblem % n) + 1,
            questionsPerRound: n,
            totalQuestions: this.problems.length
        };
    }

    /** Every team's bankroll, plus the smallest and largest total it may risk right now. */
    private teamsSnapshot() {
        return this.users.map(u => {
            const limits = riskLimits(u.bankroll);
            return {
                id: u.id,
                name: u.name,
                bankroll: u.bankroll,
                points: u.points,
                minRisk: limits.min,
                maxRisk: limits.max
            };
        });
    }

    private questionPayload(includeAnswer = false) {
        const problem = this.problems[this.activeProblem];
        return {
            problem: includeAnswer ? problem : this.toPublic(problem),
            endsAt: this.riskEndsAt,
            // Lets each device work out the time left without trusting its own clock.
            serverNow: Date.now(),
            rules: {
                startBankroll: CONFIG.START_BANKROLL,
                profitRate: CONFIG.PROFIT_RATE,
                correctBonus: CONFIG.CORRECT_BONUS
            },
            ...this.roundInfo(),
            teams: this.teamsSnapshot()
        };
    }

    /** Sent once the risk window is closed, so it is safe to show everyone's risks and the answer. */
    private revealPayload() {
        const problem = this.problems[this.activeProblem];
        const n = CONFIG.QUESTIONS_PER_ROUND;
        return {
            leaderboard: this.getLeaderboard(),
            problem: this.toPublic(problem),
            correctAnswer: problem.answer,
            results: problem.submissions.map(s => ({
                userId: s.userId,
                stakes: s.stakes,
                result: s.result
            })),
            ...this.roundInfo(),
            isRoundEnd: (this.activeProblem + 1) % n === 0,
            isFinal: this.activeProblem === this.problems.length - 1,
            teams: this.teamsSnapshot()
        };
    }

    /** includeAnswer is for the admin panel only. */
    getCurrentState(includeAnswer = false) {
        if (this.currentState === "not_started") {
            return {
                type: "not_started"
            };
        }
        if (this.currentState === "ended") {
            return {
                type: "ended",
                leaderboard: this.getLeaderboard()
            };
        }
        if (this.currentState === "leaderboard") {
            return {
                type: "leaderboard",
                ...this.revealPayload()
            };
        }
        if (this.currentState === "question") {
            return {
                type: "question",
                ...this.questionPayload(includeAnswer)
            };
        }
    }

}