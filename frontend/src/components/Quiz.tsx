import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useSocket } from '../contexts/SocketContext';
import { useCountdown } from '../lib/useCountdown';
import type { EndedView, QuestionView, ResultsView, Stakes, User } from '../types/types';

const letter = (index: number) => String.fromCharCode(65 + index);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const Page = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        {children}
    </div>
);

const LeaderboardTable = ({ rows, userId, showBankroll }: { rows: User[]; userId: string | null; showBankroll: boolean }) => (
    <div className="space-y-3">
        {rows.map((user, index) => (
            <div
                key={user.id}
                className={`flex justify-between items-center p-3 rounded-lg ${user.id === userId ? 'bg-blue-100 border-2 border-blue-300' : 'bg-gray-50'}`}
            >
                <div className="flex items-center space-x-3">
                    <Badge variant={index < 3 ? "default" : "secondary"}>
                        #{index + 1}
                    </Badge>
                    <div>
                        <span className="font-medium">{user.name}</span>
                        <div className="text-xs text-gray-500">
                            {user.correctCount} correct{showBankroll ? ` · bankroll ${user.bankroll}` : ''}
                        </div>
                    </div>
                </div>
                <span className="font-bold text-lg">{user.points}</span>
            </div>
        ))}
    </div>
);

// ---------------------------------------------------------------------------
// Risk screen
// ---------------------------------------------------------------------------

const QuestionScreen = ({ state, roomId }: { state: QuestionView; roomId: string }) => {
    const { userId, placeRisk, riskResult, isConnected } = useSocket();
    const secondsLeft = useCountdown(state.endsAt, state.serverNow);
    const totalSeconds = Math.max(1, Math.round((state.endsAt - state.problem.startTime) / 1000));
    const [amounts, setAmounts] = useState<string[]>(['', '', '', '']);
    const [locked, setLocked] = useState<Stakes | null>(null);

    // Remember the last risk the server accepted (a later rejected change doesn't undo it)
    useEffect(() => {
        if (riskResult?.ok && riskResult.stakes) {
            setLocked(riskResult.stakes);
        }
    }, [riskResult]);

    const me = state.teams.find(t => t.id === userId);
    if (!me) {
        return (
            <Page>
                <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center">
                        <CardTitle>Team not found</CardTitle>
                        <CardDescription>This device isn't registered as a team in this room. Go back and join again.</CardDescription>
                    </CardHeader>
                </Card>
            </Page>
        );
    }

    const { bankroll, minRisk, maxRisk } = me;
    const { rules } = state;
    const closed = secondsLeft === 0;

    // Read the boxes: an empty box means 0
    const stakes = amounts.map(a => (a.trim() === '' ? 0 : Number(a)));
    const allValid = stakes.every(s => Number.isInteger(s) && s >= 0);
    const total = allValid ? stakes.reduce((sum, s) => sum + s, 0) : 0;
    const touched = amounts.some(a => a.trim() !== '');

    let problem: string | null = null;
    if (!allValid) problem = 'Use whole numbers of 0 or more.';
    else if (maxRisk <= 0) problem = 'You have no points left this round.';
    else if (total < minRisk) problem = `Risk at least ${minRisk} points in total.`;
    else if (total > maxRisk) problem = `Risk at most ${maxRisk} points in total.`;

    // What the bankroll would be if each option turned out to be correct (same formula as the server)
    const outcomeIfCorrect = (index: number): number | null => {
        if (!allValid || total <= 0) return null;
        const onCorrect = stakes[index];
        return Math.round(bankroll - total + onCorrect * (1 + rules.profitRate) + rules.correctBonus * (onCorrect / total));
    };

    const stakesTuple: Stakes = [stakes[0], stakes[1], stakes[2], stakes[3]];
    const changed = locked === null || locked.some((v, i) => v !== stakesTuple[i]);
    const canSend = problem === null && !closed && isConnected && changed;
    const serverError = riskResult && !riskResult.ok ? riskResult.error : null;

    const setAmount = (index: number, value: string) => {
        setAmounts(prev => prev.map((a, i) => (i === index ? value : a)));
    };
    const allInOn = (index: number) => {
        setAmounts(['', '', '', ''].map((_, i) => (i === index ? String(maxRisk) : '')));
    };
    const handleSend = () => {
        if (canSend) {
            placeRisk(roomId, state.problem.id, stakesTuple);
        }
    };

    const progress = Math.min(100, Math.max(0, (1 - secondsLeft / totalSeconds) * 100));

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>
                                Round {state.round} of {state.totalRounds} · Question {state.questionInRound} of {state.questionsPerRound}
                            </CardTitle>
                            <Badge variant={secondsLeft > 10 ? "default" : "destructive"}>
                                {secondsLeft}s
                            </Badge>
                        </div>
                        <Progress value={progress} className="w-full" />
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-3 gap-3 text-center">
                    <Card>
                        <CardContent className="p-3">
                            <div className="text-xs text-gray-500">Bankroll</div>
                            <div className="text-2xl font-bold">{bankroll}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-3">
                            <div className="text-xs text-gray-500">Total risk allowed</div>
                            <div className="text-2xl font-bold">{maxRisk > 0 ? `${minRisk}–${maxRisk}` : '—'}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-3">
                            <div className="text-xs text-gray-500">Your total risk</div>
                            <div className="text-2xl font-bold">{total}</div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">{state.problem.title}</CardTitle>
                        <CardDescription>{state.problem.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {state.problem.options.map((option, i) => {
                            const after = outcomeIfCorrect(i);
                            return (
                                <div key={option.id} className="rounded-lg border bg-white p-3">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold w-6">{letter(i)}.</span>
                                        <span className="flex-1">{option.title}</span>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={1}
                                            inputMode="numeric"
                                            className="w-24 text-right"
                                            placeholder="0"
                                            value={amounts[i]}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(i, e.target.value)}
                                            disabled={closed || maxRisk <= 0}
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => allInOn(i)}
                                            disabled={closed || maxRisk <= 0}
                                        >
                                            Max
                                        </Button>
                                    </div>
                                    {after !== null && (
                                        <div className="text-xs text-gray-500 mt-1 ml-9">
                                            If {letter(i)} is correct: bankroll {bankroll} → {after} ({signed(after - bankroll)})
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div className="text-sm text-gray-600">
                            Points you don't risk are kept: {allValid ? bankroll - total : bankroll}. Wrong stakes are lost; the correct stake
                            comes back with {Math.round(rules.profitRate * 100)}% extra, plus up to {rules.correctBonus} bonus points
                            for the share of your risk that was on the right answer.
                        </div>

                        {touched && problem && (
                            <p className="text-sm text-red-600">{problem}</p>
                        )}
                        {serverError && (
                            <p className="text-sm text-red-600">{serverError}</p>
                        )}
                        {locked && !closed && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-center text-sm font-medium">
                                ✓ Risk locked in: {locked.map((s, i) => `${letter(i)} ${s}`).join(' · ')}. You can change it until time runs out.
                            </div>
                        )}
                        {!locked && !closed && secondsLeft <= 15 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-center text-sm font-medium">
                                ⚠ No risk placed yet. Press "Place risk" before time runs out.
                            </div>
                        )}
                        {closed && (
                            <div className="bg-gray-50 border rounded-lg p-3 text-center text-sm font-medium">
                                {locked ? 'Risks closed. Waiting for the results…' : "Time's up. No risk was placed."}
                            </div>
                        )}

                        <Button
                            onClick={handleSend}
                            disabled={!canSend}
                            className="w-full mt-2"
                            size="lg"
                        >
                            {closed ? "Time's up" : locked ? (changed ? 'Update risk' : 'Risk placed') : 'Place risk'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Results after each question
// ---------------------------------------------------------------------------

const ResultsScreen = ({ state, userId }: { state: ResultsView; userId: string | null }) => {
    const mine = state.results.find(r => r.userId === userId);
    const myTeam = state.teams.find(t => t.id === userId);
    const correctOption = state.problem.options[state.correctAnswer];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-2xl mx-auto space-y-4">
                <Card>
                    <CardHeader className="text-center">
                        <CardDescription>
                            Round {state.round} of {state.totalRounds} · Question {state.questionInRound} of {state.questionsPerRound}
                        </CardDescription>
                        <CardTitle>{state.problem.title}</CardTitle>
                        <div className="mt-2 inline-block rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-green-800 font-medium">
                            Correct answer: {letter(state.correctAnswer)}. {correctOption?.title}
                        </div>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Your result</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {mine?.result ? (
                            <>
                                <div>
                                    Your risk: {mine.stakes.map((s, i) => `${letter(i)} ${s}`).join(' · ')} (total {mine.result.totalStaked})
                                </div>
                                <div>
                                    On the correct answer: {mine.result.stakeOnCorrect} · Bonus: +{mine.result.bonus.toFixed(1)}
                                </div>
                                <div className="text-lg font-bold">
                                    Bankroll: {mine.result.bankrollBefore} → {mine.result.bankrollAfter}{' '}
                                    <span className={mine.result.bankrollAfter >= mine.result.bankrollBefore ? 'text-green-600' : 'text-red-600'}>
                                        ({signed(mine.result.bankrollAfter - mine.result.bankrollBefore)})
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div>
                                You didn't place a risk on this question, so your bankroll is unchanged
                                {myTeam ? ` at ${myTeam.bankroll}` : ''}.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {state.isRoundEnd && !state.isFinal && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center text-blue-800 font-medium">
                        Round {state.round} complete! Every bankroll goes back to 100 for round {state.round + 1}.
                    </div>
                )}
                {state.isFinal && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-center text-purple-800 font-medium">
                        That was the final question. Waiting for the host to show the final results…
                    </div>
                )}

                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>Leaderboard</CardTitle>
                        <CardDescription>Total score across all rounds</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LeaderboardTable rows={state.leaderboard} userId={userId} showBankroll />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const EndedScreen = ({ state, userId }: { state: EndedView; userId: string | null }) => {
    const winner = state.leaderboard[0];
    return (
        <Page>
            <Card className="w-full max-w-2xl">
                <CardHeader className="text-center">
                    <CardTitle>Quiz Ended</CardTitle>
                    <CardDescription>
                        {winner ? `🏆 Winner: ${winner.name} with ${winner.points} points` : 'Thank you for participating!'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <h3 className="text-lg font-semibold text-center mb-4">Final Results</h3>
                    <LeaderboardTable rows={state.leaderboard} userId={userId} showBankroll={false} />
                </CardContent>
            </Card>
        </Page>
    );
};

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export const Quiz = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { quizState, userId, joinError } = useSocket();
    const [connectionTimeout, setConnectionTimeout] = useState(false);

    // Redirect if no roomId in URL
    useEffect(() => {
        if (!roomId) {
            navigate('/');
        }
    }, [roomId, navigate]);

    // Set a timeout to detect if room doesn't exist
    useEffect(() => {
        if (quizState) {
            setConnectionTimeout(false);
            return;
        }
        const timeout = setTimeout(() => setConnectionTimeout(true), 5000);
        return () => clearTimeout(timeout);
    }, [quizState]);

    if (!quizState) {
        if (connectionTimeout) {
            return (
                <Page>
                    <Card className="w-full max-w-2xl">
                        <CardHeader className="text-center">
                            <CardTitle>Room Not Found</CardTitle>
                            <CardDescription>Room ID: {roomId}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="space-y-4">
                                <p className="text-red-600 font-medium">
                                    ⚠️ This room doesn't exist or isn't available.
                                </p>
                                <p className="text-gray-600">
                                    Please check your room ID or ask the instructor to create the room first.
                                </p>
                                <div className="flex gap-2 justify-center">
                                    <Button onClick={() => window.location.reload()} variant="outline">
                                        Try Again
                                    </Button>
                                    <Button onClick={() => navigate('/')}>
                                        Go Back Home
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Page>
            );
        }

        return (
            <Page>
                <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center">
                        <CardTitle>Connecting to Quiz...</CardTitle>
                        <CardDescription>Room ID: {roomId}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <div className="space-y-4">
                            <div className="animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                            </div>
                            <p className="text-gray-600">
                                Connecting to room... Please wait.
                            </p>
                            <Button onClick={() => navigate('/')} variant="outline">
                                Go Back Home
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </Page>
        );
    }

    if (quizState.type === 'room_not_found') {
        return (
            <Page>
                <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center">
                        <CardTitle>{joinError ? "Couldn't join" : 'Room Not Found'}</CardTitle>
                        <CardDescription>
                            {joinError
                                ? joinError
                                : `Room ID: ${roomId} - This room doesn't exist yet. Ask the admin to create it first.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-gray-600 mb-4">
                            {joinError
                                ? 'Go back and try again, or ask the host for help.'
                                : 'Make sure you have the correct room ID, or ask the quiz administrator to create the room.'}
                        </p>
                        <Button onClick={() => navigate('/')} variant="outline">
                            Go Back Home
                        </Button>
                    </CardContent>
                </Card>
            </Page>
        );
    }

    if (quizState.type === 'not_started') {
        return (
            <Page>
                <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center">
                        <CardTitle>Waiting for Quiz to Start</CardTitle>
                        <CardDescription>Room ID: {roomId}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-gray-600">
                            Waiting for admin to start the quiz...
                        </p>
                    </CardContent>
                </Card>
            </Page>
        );
    }

    if (quizState.type === 'question') {
        // key = question id, so the risk boxes start empty on every new question
        return <QuestionScreen key={quizState.problem.id} state={quizState} roomId={roomId ?? ''} />;
    }

    if (quizState.type === 'leaderboard') {
        return <ResultsScreen state={quizState} userId={userId} />;
    }

    if (quizState.type === 'ended') {
        return <EndedScreen state={quizState} userId={userId} />;
    }

    // Fallback for unknown state
    return (
        <Page>
            <Card className="w-full max-w-2xl">
                <CardHeader className="text-center">
                    <CardTitle>Unknown State</CardTitle>
                    <CardDescription>Room ID: {roomId}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-gray-600">
                        Current state: {(quizState as { type?: string }).type || 'undefined'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        Please contact the admin if this persists.
                    </p>
                </CardContent>
            </Card>
        </Page>
    );
};
