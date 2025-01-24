import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import EmojiPicker from 'emoji-picker-react';

const Chat = ({ room }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showAuth, setShowAuth] = useState(false);
    const [error, setError] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const messagesEndRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const { token, isAuthenticated, user } = useAuth();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Close emoji picker when clicking outside
        const handleClickOutside = (event) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const onEmojiClick = (emojiObject) => {
        setNewMessage(prev => prev + emojiObject.emoji);
        setShowEmojiPicker(false);
    };

    const connectWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        setIsLoading(true);
        wsRef.current = new WebSocket('ws://localhost:3001');

        // Set up ping timeout
        const pingTimeout = 35000; // slightly longer than server's ping interval
        let pingTimeoutId = null;

        const heartbeat = () => {
            if (pingTimeoutId) clearTimeout(pingTimeoutId);
            pingTimeoutId = setTimeout(() => {
                console.log('Connection lost - no ping received');
                wsRef.current.close();
            }, pingTimeout);
        };

        wsRef.current.onopen = () => {
            console.log('Chat WebSocket connected');
            setError(null);
            heartbeat();

            // Send auth token
            if (token) {
                wsRef.current.send(JSON.stringify({
                    type: 'auth',
                    token: token
                }));
            }

            // Send initial room after authentication
            if (room) {
                console.log('Sending initial room:', room);
                wsRef.current.send(JSON.stringify({
                    type: 'room_change',
                    room: room
                }));
            }
        };

        wsRef.current.onmessage = (event) => {
            heartbeat();
            
            try {
                const data = JSON.parse(event.data);
                console.log('Received message:', data);
                
                if (data.type === 'auth_success') {
                    console.log('Authentication successful');
                    // Send room change after successful auth
                    if (room) {
                        console.log('Sending room after auth:', room);
                        wsRef.current.send(JSON.stringify({
                            type: 'room_change',
                            room: room
                        }));
                    }
                }
                else if (data.type === 'chat_message') {
                    if (!data.id || !data.username || !data.text) {
                        console.error('Invalid chat message format:', data);
                        setError('Received invalid message format from server');
                        return;
                    }
                    setMessages(prev => {
                        if (prev.some(msg => msg.id === data.id)) {
                            return prev;
                        }
                        return [...prev, data];
                    });
                    setIsLoading(false);
                } else if (data.type === 'chat_history') {
                    console.log('Received chat history:', data.messages);
                    if (!Array.isArray(data.messages)) {
                        console.error('Invalid chat history format:', data);
                        setError('Received invalid chat history format from server');
                        return;
                    }
                    
                    // Map messages to ensure they have all required fields
                    const validMessages = data.messages.map(msg => ({
                        id: msg.id || msg._id,
                        type: 'chat_message',
                        username: msg.username,
                        text: msg.text,
                        timestamp: msg.timestamp || msg.createdAt
                    }));
                    
                    console.log('Processed chat history:', validMessages);
                    setMessages(validMessages);
                    setIsLoading(false);
                } else if (data.type === 'error') {
                    console.error('Server error:', data.error);
                    setError(data.error);
                    setIsLoading(false);
                    setTimeout(() => setError(null), 3000);
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err, event.data);
                setError('Failed to parse message from server');
                setIsLoading(false);
                setTimeout(() => setError(null), 3000);
            }
        };

        wsRef.current.onerror = (error) => {
            console.error('Chat WebSocket error:', error);
            setError('Failed to connect to chat server');
            setIsLoading(false);
            if (pingTimeoutId) clearTimeout(pingTimeoutId);
        };

        wsRef.current.onclose = (event) => {
            console.log('Chat WebSocket disconnected:', {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
            });
            
            setIsLoading(false);
            if (pingTimeoutId) clearTimeout(pingTimeoutId);
            
            // Only attempt to reconnect if we're still authenticated and it wasn't a clean close
            if (isAuthenticated && (!event.wasClean || event.code === 1006)) {
                console.log('Attempting to reconnect...');
                reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
            }
        };
    };

    useEffect(() => {
        if (isAuthenticated) {
            connectWebSocket();
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmounting');
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [isAuthenticated]);

    useEffect(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN && room) {
            console.log('Sending room change:', room);
            wsRef.current.send(JSON.stringify({
                type: 'room_change',
                room: room
            }));
            setMessages([]);
            setIsLoading(true);
        }
    }, [room]);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!newMessage.trim()) return;

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat_message',
                text: newMessage.trim()
            }));
            setNewMessage('');
            setShowEmojiPicker(false);
        } else {
            setError('Not connected to chat server');
            setTimeout(() => setError(null), 3000);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
            
            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-4 py-3 space-y-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-red-500">
                            {error}
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            No messages yet
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div key={index} className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-white text-sm">
                                    {msg.username?.[0]?.toUpperCase() || 'A'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {msg.username || 'Anonymous'}
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                                        {msg.text}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Chat Input */}
            <div className="flex-shrink-0 border-t dark:border-gray-700">
                <div className="p-4">
                    {isAuthenticated ? (
                        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    😊
                                </button>
                                {showEmojiPicker && (
                                    <div ref={emojiPickerRef} className="absolute bottom-full right-0 mb-2 max-w-[90vw] sm:max-w-[320px] z-50">
                                        <div className="scale-[0.8] sm:scale-100 origin-bottom-right">
                                            <EmojiPicker 
                                                onEmojiClick={onEmojiClick}
                                                width="100%"
                                                height="350px"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Send
                            </button>
                        </form>
                    ) : (
                        <button
                            onClick={() => setShowAuth(true)}
                            className="w-full px-4 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            Sign in to chat
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Chat;
