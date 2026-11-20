/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { RiskResult, QuizView, Stakes, User } from '../types/types';

export interface SocketContextType {
  socket: Socket | null;
  quizState: QuizView | null;
  user: User | null;
  userId: string | null;
  currentRoomId: string | null;
  isConnected: boolean;
  riskResult: RiskResult | null;
  joinError: string | null;
  joinRoom: (roomId: string, userName: string) => void;
  leaveRoom: () => void;
  placeRisk: (roomId: string, problemId: string, stakes: Stakes) => void;
  createRoom: (userName: string) => void;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [quizState, setQuizState] = useState<QuizView | null>(null);
  const [user] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const joining = useRef(false);

  useEffect(() => {
    // Uses the address the page was opened from, so devices on the same Wi-Fi reach the host's server.
    const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3000`;
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Initial state when joining
    newSocket.on('init', (data) => {
      joining.current = false;
      if (data.userId && data.state) {
        setUserId(data.userId);
        setQuizState(data.state);
        setRiskResult(null);
        setJoinError(null);
      } else {
        setQuizState({ type: 'room_not_found' });
      }
    });

    // The server refuses a join (room missing, room full, quiz already started...) with an "error" event
    newSocket.on('error', (data) => {
      if (joining.current) {
        joining.current = false;
        setJoinError(data?.message ?? null);
        setQuizState({ type: 'room_not_found' });
      }
    });

    // A new question: the risk window is open
    newSocket.on('problem', (data) => {
      setRiskResult(null);
      setQuizState({ type: 'question', ...data });
    });

    // Risk window closed: correct answer, everyone's results and the leaderboard
    newSocket.on('leaderboard', (data) => {
      setQuizState({ type: 'leaderboard', ...data });
    });

    newSocket.on('quizEnded', (data) => {
      setQuizState({ type: 'ended', leaderboard: data.leaderboard });
    });

    // The server's answer to a risk this device sent
    newSocket.on('riskResult', (data) => {
      setRiskResult(data);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const joinRoom = (roomId: string, userName: string) => {
    if (socket) {
      joining.current = true;
      setJoinError(null);
      socket.emit('join', { roomId, name: userName });
      setCurrentRoomId(roomId);
    }
  };

  const createRoom = (userName: string) => {
    // Generate a random room ID for the user
    const roomId = Math.random().toString(36).substring(2, 15);
    if (socket) {
      joining.current = true;
      setJoinError(null);
      socket.emit('join', { roomId, name: userName });
      setCurrentRoomId(roomId);
    }
  };

  const leaveRoom = () => {
    if (socket && currentRoomId) {
      socket.emit('leave', { roomId: currentRoomId });
      setCurrentRoomId(null);
      setUserId(null);
      setQuizState(null);
      setRiskResult(null);
      setJoinError(null);
    }
  };

  const placeRisk = (roomId: string, problemId: string, stakes: Stakes) => {
    if (socket && userId) {
      socket.emit('placeRisk', { roomId, problemId, userId, stakes });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        quizState,
        user,
        userId,
        currentRoomId,
        isConnected,
        riskResult,
        joinError,
        joinRoom,
        leaveRoom,
        placeRisk,
        createRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
