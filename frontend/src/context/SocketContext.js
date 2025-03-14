import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { token } = useAuth();
    const socketRef = useRef(null);

    useEffect(() => {
        if (!token) return;

        // Clean up existing socket before creating a new one
        if (socketRef.current) {
            console.log('Disconnecting existing socket before creating new one');
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        const newSocket = io('http://localhost:3001', {
            auth: { token },
            transports: ['websocket', 'polling'],
            withCredentials: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            autoConnect: true
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        // Store socket in ref for cleanup
        socketRef.current = newSocket;
        setSocket(newSocket);

        return () => {
            if (socketRef.current) {
                console.log('Cleaning up socket on unmount');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [token]);

    const emit = (eventName, data) => {
        if (socket) {
            if (eventName === 'room_change') {
                // Debounce room changes to prevent multiple rapid changes
                if (emit.roomChangeTimeout) {
                    clearTimeout(emit.roomChangeTimeout);
                }
                emit.roomChangeTimeout = setTimeout(() => {
                    socket.emit(eventName, data);
                    emit.roomChangeTimeout = null;
                }, 300); // 300ms debounce
            } else {
                socket.emit(eventName, data);
            }
        } else {
            console.warn('Socket not connected, cannot emit:', eventName);
        }
    };

    const value = {
        socket,
        emit,
        connected: socket?.connected || false,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};
