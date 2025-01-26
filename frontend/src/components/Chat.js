import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import AuthModal from './AuthModal';
import EmojiPicker from 'emoji-picker-react';

const Chat = ({ room }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showAuth, setShowAuth] = useState(false);
    const [error, setError] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const { isAuthenticated, user } = useAuth();
    const { socket, emit } = useSocket();

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

    useEffect(() => {
        if (!socket) return;

        // Join room when component mounts or room changes
        emit('room_change', room);

        // Socket event listeners
        socket.on('chat_message', (message) => {
            setMessages(prev => [...prev, message]);
        });

        socket.on('chat_history', (data) => {
            setMessages(data.messages || []);
            setIsLoading(false);
        });

        // Cleanup listeners when component unmounts
        return () => {
            socket.off('chat_message');
            socket.off('chat_history');
        };
    }, [socket, room, emit]);

    const onEmojiClick = (emojiObject) => {
        setNewMessage(prev => prev + emojiObject.emoji);
        setShowEmojiPicker(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        emit('chat_message', {
            content: newMessage.trim()
        });
        
        setNewMessage('');
        setShowEmojiPicker(false);
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
