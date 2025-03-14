import React, { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { useSocket } from '../context/SocketContext';

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
    const { socket, emit } = useSocket();
    const [currentMedia, setCurrentMedia] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [playing, setPlaying] = useState(true);
    const [volume, setVolume] = useState(0.8);
    const [progress, setProgress] = useState(0);
    const [timeUntilNext, setTimeUntilNext] = useState(roomConfigs[room].countdown);
    const mediaRef = useRef(null);
    const timerRef = useRef(null);
    const mountedRef = useRef(true);
    const mediaStateTimerRef = useRef(null);
    const lastProcessedTimestampRef = useRef(0);

    // Set mounted ref to false when component unmounts
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!socket) return;

        // Clear any existing media state timer
        if (mediaStateTimerRef.current) {
            clearTimeout(mediaStateTimerRef.current);
            mediaStateTimerRef.current = null;
        }

        // Join room when component mounts or room changes
        emit('room_change', room);

        const handleRoomChanged = (data) => {
            if (!mountedRef.current) return;
            console.log('Room changed to:', data.room);
            setCurrentMedia(null);
            setPlaying(false);
            setLoading(true);
            lastProcessedTimestampRef.current = 0;
        };

        const handleMediaState = (data) => {
            if (!mountedRef.current) return;
            console.log('Received media state:', data);
            
            // Process media state if it has a timestamp newer than the last one we processed
            // or if it has media and we haven't processed any media yet
            const timestamp = data.timestamp || Date.now();
            
            if (timestamp > lastProcessedTimestampRef.current || 
                (data.media && !currentMedia)) {
                
                console.log('Processing media state with timestamp:', timestamp);
                lastProcessedTimestampRef.current = timestamp;
                
                if (data.media) {
                    console.log('Setting current media:', data.media);
                    setCurrentMedia(data.media);
                    setPlaying(true);
                    setLoading(false);
                    
                    // Set up periodic media state requests
                    scheduleNextMediaStateRequest();
                } else {
                    console.log('No media in state, clearing current media');
                    setCurrentMedia(null);
                    setPlaying(false);
                    setLoading(false);
                }
            } else {
                console.log('Ignoring older or duplicate media state');
            }
        };
        
        const scheduleNextMediaStateRequest = () => {
            // Clear any existing timer
            if (mediaStateTimerRef.current) {
                clearTimeout(mediaStateTimerRef.current);
            }
            
            // Set up a new timer to request media state
            mediaStateTimerRef.current = setTimeout(() => {
                if (mountedRef.current && socket) {
                    console.log('Requesting media state update');
                    emit('request_media_state');
                }
            }, roomConfigs[room].interval || 30000);
        };

        // Set up event listeners
        socket.on('room_changed', handleRoomChanged);
        socket.on('media_state', handleMediaState);

        // Cleanup listeners when component unmounts or room/socket changes
        return () => {
            if (socket) {
                socket.off('room_changed', handleRoomChanged);
                socket.off('media_state', handleMediaState);
            }
            
            // Clear any timers
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            
            if (mediaStateTimerRef.current) {
                clearTimeout(mediaStateTimerRef.current);
                mediaStateTimerRef.current = null;
            }
        };
    }, [socket, room, emit]);

    useEffect(() => {
        if (currentMedia && mountedRef.current) {
            // Reset timer
            setTimeUntilNext(roomConfigs[room].countdown);
            
            // Clear existing interval
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }

            // Start new countdown
            timerRef.current = setInterval(() => {
                if (mountedRef.current) {
                    setTimeUntilNext(prev => {
                        if (prev <= 0) return roomConfigs[room].countdown;
                        return prev - 1;
                    });
                }
            }, 1000);

            return () => {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            };
        }
    }, [currentMedia, room]);

    const handleMediaEnd = () => {
        // Request next media
        emit('request_next_media');
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

    // Log the media that we're trying to render
    console.log('Rendering media:', currentMedia);
    
    // Construct the full URL for the media
    const mediaUrl = `http://localhost:3001${currentMedia.path}`;
    console.log('Media URL:', mediaUrl);

    // Determine if the media is an image based on type or file extension
    const isImage = currentMedia.type === 'image' || 
                   (currentMedia.path && 
                    /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(currentMedia.path));
    
    console.log('Media type detection:', { 
        declaredType: currentMedia.type,
        isImage,
        path: currentMedia.path
    });

    return (
        <div className="relative w-full h-full bg-black">
            <div className="aspect-w-16 aspect-h-9 w-full h-full">
                {!isImage ? (
                    <ReactPlayer
                        ref={mediaRef}
                        url={mediaUrl}
                        width="100%"
                        height="100%"
                        playing={playing}
                        volume={volume}
                        loop={true}
                        onProgress={({ played }) => setProgress(played)}
                        onEnded={handleMediaEnd}
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
                    <div className="w-full h-full flex items-center justify-center">
                        <img
                            src={mediaUrl}
                            alt="Media content"
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                                console.error('Image load error:', e);
                                setError('Failed to load image');
                            }}
                            onLoad={() => {
                                console.log('Image loaded successfully');
                            }}
                        />
                    </div>
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
