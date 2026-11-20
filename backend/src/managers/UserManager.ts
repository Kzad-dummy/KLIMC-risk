import { Socket } from "socket.io";
import { QuizManager } from "./QuizManager";

// Set a real password before the event, e.g. in PowerShell:
//   $env:ADMIN_PASSWORD = "something-only-you-know"; node dist/index.js
// The fallback below is public (it is in the README), so students could guess it.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
}

export class UserManager {

    private quizManager;

    constructor() {
        this.quizManager = new QuizManager();
    }

    addUser(socket: Socket) {
        this.createHandlers(socket);
    }

    private createHandlers(socket: Socket) {
        socket.on("join", (data) => {
            const name = String(data?.name ?? "").trim().slice(0, 30);
            const roomId = String(data?.roomId ?? "");
            if (!name) {
                socket.emit("error", { message: "Please enter your TEAM NUMBER." });
                return;
            }

            // One device = one team. A second "join" on the same connection can never
            // create another team (this was how points got refreshed).
            if (socket.data.userId) {
                const currentName = this.quizManager.getTeamName(socket.data.roomId, socket.data.userId);
                if (socket.data.roomId === roomId && currentName && currentName.toLowerCase() === name.toLowerCase()) {
                    // Same team again (e.g. a double click): just resend the current state.
                    socket.emit("init", {
                        userId: socket.data.userId,
                        state: this.quizManager.getCurrentState(roomId)
                    });
                } else {
                    socket.emit("error", { message: `This device has already joined as "${currentName ?? "a team"}".` });
                }
                return;
            }

            const joined = this.quizManager.addUser(roomId, name);
            if (!joined.ok) {
                socket.emit("error", { message: joined.error });
                return;
            }
            const userId = joined.id;

            // Remember which team this device is, so it can't risk for another team.
            socket.data.userId = userId;
            socket.data.roomId = roomId;
            socket.join(roomId);
            socket.emit("init", {
                userId,
                state: this.quizManager.getCurrentState(roomId)
            });
        });

        socket.on("joinAdmin", (data) => {
            if (socket.data.isAdmin) {
                socket.emit("adminAuth", { success: true });
                return;
            }
            if (data?.password !== ADMIN_PASSWORD) {
                console.log("Admin authentication failed");
                socket.emit("adminAuth", { success: false });
                return;
            }
            console.log("Admin authenticated successfully");
            socket.data.isAdmin = true;
            socket.emit("adminAuth", { success: true });

            socket.on("createQuiz", data => {
                try {
                    this.quizManager.addQuiz(data.roomId);
                    socket.emit("quizCreated", { roomId: data.roomId });
                } catch (error) {
                    socket.emit("error", { message: "Failed to create quiz" });
                }
            });

            socket.on("createProblem", data => {
                try {
                    this.quizManager.addProblem(data.roomId, data.problem);
                    socket.emit("problemAdded", { roomId: data.roomId });
                } catch (error) {
                    socket.emit("error", { message: error instanceof Error ? error.message : "Failed to add problem" });
                }
            });

            // Load many questions at once, e.g. all 40 from a JSON file.
            socket.on("createProblems", data => {
                try {
                    const count = this.quizManager.addProblems(data.roomId, data.problems);
                    socket.emit("problemsAdded", { roomId: data.roomId, count });
                } catch (error) {
                    socket.emit("error", { message: error instanceof Error ? error.message : "Failed to add problems" });
                }
            });

            socket.on("next", data => {
                try {
                    this.quizManager.next(data.roomId);
                } catch (error) {
                    socket.emit("error", { message: "Failed to proceed to next question" });
                }
            });

            // End the risk window early and show the results.
            socket.on("closeRisks", data => {
                try {
                    this.quizManager.closeRisks(data.roomId);
                } catch (error) {
                    socket.emit("error", { message: "Failed to close risks" });
                }
            });

            socket.on("start", data => {
                try {
                    this.quizManager.start(data.roomId);
                } catch (error) {
                    socket.emit("error", { message: "Failed to start quiz" });
                }
            });

            socket.on("getQuizState", data => {
                try {
                    // The admin panel is allowed to see the answer.
                    const state = this.quizManager.getCurrentState(data.roomId, true);
                    socket.emit("quizStateUpdate", state);
                } catch (error) {
                    socket.emit("error", { message: "Failed to get quiz state" });
                }
            });
        });

        // stakes = [A, B, C, D], e.g. [60, 0, 40, 0]
        socket.on("placeRisk", (data) => {
            if (!data || socket.data.userId !== data.userId || socket.data.roomId !== data.roomId) {
                socket.emit("riskResult", { ok: false, error: "This device is not registered as that team." });
                return;
            }
            const result = this.quizManager.placeRisk(data.userId, data.roomId, data.problemId, data.stakes);
            socket.emit("riskResult", { ...result, stakes: result.ok ? data.stakes : undefined });
        });
    }

}
