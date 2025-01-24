import React, { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { useAuth } from '../context/AuthContext';

const roomConfigs = {
    '10-second-room': {
        interval: 10000,    // 10 seconds
        countdown: 10
    },
    '30-second-room': {
        interval: 30000,    // 30 seconds
        countdown: 30
    },
    '60-second-room': {
        interval: 60000,     // 60 seconds
        countdown: 60
    }
};

const VideoPlayer = ({ room }) => {
    const { token } = useAuth();
    const [currentMedia, setCurrentMedia] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [playing, setPlaying] = useState(true);
    const [volume, setVolume] = useState(0.8);
    const [progress, setProgress] = useState(0);
    const [timeUntilNext, setTimeUntilNext] = useState(roomConfigs[room].countdown);
    const [reconnectTrigger, setReconnectTrigger] = useState(0);
    const mediaRef = useRef(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        const ws = new WebSocket(`ws://localhost:3001`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('VideoPlayer WebSocket connected');
            setError(null);
            
            // Stop any current playback before changing rooms
            setCurrentMedia(null);
            setPlaying(false);
            
            ws.send(JSON.stringify({
                type: 'room_change',
                room: room
            }));
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('VideoPlayer received message:', message);

                switch (message.type) {
                    case 'connected':
                        console.log('Connection confirmed, client ID:', message.clientId);
                        break;

                    case 'room_changed':
                        console.log('Room changed to:', message.room);
                        // Clear current media when changing rooms
                        setCurrentMedia(null);
                        setPlaying(false);
                        setLoading(false);
                        break;

                    case 'media_state':
                        console.log('Received media state:', message);
                        if (message.media) {
                            setCurrentMedia(message.media);
                            setPlaying(true);
                            setLoading(false);
                        } else {
                            setCurrentMedia(null);
                            setPlaying(false);
                            setLoading(false);
                        }
                        break;

                    case 'media_queued':
                        console.log('New media queued:', message);
                        break;

                    case 'error':
                        console.error('WebSocket error:', message.message);
                        setError(message.message);
                        break;

                    default:
                        console.log('Unknown message type:', message.type);
                }
            } catch (err) {
                console.error('Error parsing WebSocket message:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('VideoPlayer WebSocket error:', error);
            setError('Connection error');
        };

        ws.onclose = () => {
            console.log('VideoPlayer WebSocket closed');
            setPlaying(false);
            setLoading(false);
            if (!reconnectTimeoutRef.current) {
                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log('Attempting to reconnect VideoPlayer...');
                    reconnectTimeoutRef.current = null;
                    setReconnectTrigger(prev => prev + 1);
                }, 5000);
            }
        };

        return () => {
            console.log('Cleaning up VideoPlayer WebSocket');
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [room, reconnectTrigger]);

    useEffect(() => {
        if (currentMedia) {
            // Reset timer
            setTimeUntilNext(roomConfigs[room].countdown);
            
            // Clear existing interval
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }

            // Start new countdown
            timerRef.current = setInterval(() => {
                setTimeUntilNext(prev => {
                    if (prev <= 0) return roomConfigs[room].countdown;
                    return prev - 1;
                });
            }, 1000);

            return () => {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            };
        }
    }, [currentMedia, room]);

    const handleEnded = () => {
        console.log('Media ended');
        setPlaying(false);
        setCurrentMedia(null);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'request_next_media',
                room: room
            }));
        }
    };

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    if (loading || !currentMedia) {
        return (
            <div className="flex items-center justify-center h-96 bg-gray-100 bg-transparent rounded-lg">
                <div className="text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading...' : 'No media available'}
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-black">
            <div className="aspect-w-16 aspect-h-9 w-full h-full">
                {currentMedia.type === 'video' ? (
                    <ReactPlayer
                        ref={mediaRef}
                        url={`http://localhost:3001${currentMedia.path}`}
                        width="100%"
                        height="100%"
                        playing={true}
                        volume={volume}
                        onProgress={({ played }) => setProgress(played)}
                        onEnded={handleEnded}
                        onError={(error) => {
                            console.error('Player error:', error);
                            setError('Failed to load video');
                        }}
                        config={{
                            file: {
                                attributes: {
                                    crossOrigin: 'anonymous'
                                }
                            }
                        }}
                    />
                ) : (
                    <img
                        src={`http://localhost:3001${currentMedia.path}`}
                        alt="Media content"
                        className="w-full h-full object-contain"
                        onError={() => setError('Failed to load image')}
                        onLoad={() => {
                            setTimeout(handleEnded, roomConfigs[room].interval || 30000);
                        }}
                    />
                )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
                <div className="flex items-center justify-between text-white">
                    <div className="text-sm">
                        Next media in: {Math.ceil(timeUntilNext)}s
                    </div>
                    <div className="flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                        </svg>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.1}
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="w-24"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
