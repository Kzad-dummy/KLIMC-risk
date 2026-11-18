import { Quiz, JoinResult } from "../Quiz";
import { AllowedSubmissions, Stakes } from "../types/types";
let globalProblemId = 0;

export interface ProblemInput {
    title: string;
    description: string;
    image?: string;
    options: {
        id: number;
        title: string;
    }[];
    answer: AllowedSubmissions;
}

export class QuizManager {

    private quizes: Quiz[];

    constructor() {
        this.quizes = [];
    }

    public start(roomId: string) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            return;
        }
        quiz.start();
    }

    /** Throws a readable error if a problem can't be used in a 4-option risk game. */
    private validateProblem(problem: ProblemInput) {
        if (!problem || typeof problem.title !== "string" || problem.title.trim() === "") {
            throw new Error("Every question needs a title.");
        }
        if (!Array.isArray(problem.options) || problem.options.length !== 4) {
            throw new Error(`"${problem.title}" must have exactly 4 options.`);
        }
        if (![0, 1, 2, 3].includes(problem.answer)) {
            throw new Error(`"${problem.title}" needs an answer of 0, 1, 2 or 3.`);
        }
    }

    public addProblem(roomId: string, problem: ProblemInput) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            return;
        }
        this.validateProblem(problem);
        quiz.addProblem({
            ...problem,
            id: (globalProblemId++).toString(),
            startTime: new Date().getTime(),
            submissions: []
        });
    }

    /** Add many questions at once (e.g. all 40 from a JSON file). All-or-nothing. */
    public addProblems(roomId: string, problems: ProblemInput[]) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            throw new Error("Room not found.");
        }
        if (!Array.isArray(problems)) {
            throw new Error("Expected a list of questions.");
        }
        problems.forEach(p => this.validateProblem(p));
        problems.forEach(p => this.addProblem(roomId, p));
        return problems.length;
    }

    public next(roomId: string) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            return;
        }
        quiz.next();
    }

    public closeRisks(roomId: string) {
        this.getQuiz(roomId)?.closeRisks();
    }

    /** Join (or rejoin) a team. Returns an error result if the room doesn't exist. */
    addUser(roomId: string, name: string): JoinResult {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            return { ok: false, error: "Room not found." };
        }
        return quiz.joinTeam(name);
    }

    placeRisk(userId: string, roomId: string, problemId: string, stakes: Stakes) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            return { ok: false, error: "Room not found." };
        }
        return quiz.placeRisk(userId, problemId, stakes);
    }

    getTeamName(roomId: string, userId: string) {
        return this.getQuiz(roomId)?.getTeamName(userId) ?? null;
    }

    getQuiz(roomId: string) {
        return this.quizes.find(x => x.roomId === roomId) ?? null;
    }

    getCurrentState(roomId: string, includeAnswer = false) {
        const quiz = this.quizes.find(x => x.roomId === roomId);
        if (!quiz) {
            return null;
        }
        return quiz.getCurrentState(includeAnswer);
    }

    addQuiz(roomId: string) {
        if (this.getQuiz(roomId)) {
            return;
        }
        const quiz = new Quiz(roomId);
        this.quizes.push(quiz);
    }
}
