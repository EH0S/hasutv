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
    },
    'home': {
        interval: 30000,    // default 30 seconds
        countdown: 30
    }
};

// Default config for fallback
const defaultConfig = {
    interval: 30000,
    countdown: 30
};

const VideoPlayer = ({ room }) => {
    const { socket, emit } = useSocket();
    const [currentMedia, setCurrentMedia] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [playing, setPlaying] = useState(true);
    const [volume, setVolume] = useState(0.8);
    const [progress, setProgress] = useState(0);
    
    // Safely access roomConfigs with fallback to default
    const roomConfig = roomConfigs[room] || defaultConfig;
    const [timeUntilNext, setTimeUntilNext] = useState(roomConfig.countdown);
    
    const mediaRef = useRef(null);
    const timerRef = useRef(null);
    const mountedRef = useRef(true);
    const mediaStateTimerRef = useRef(null);
    const lastProcessedTimestampRef = useRef(0);
    const lastProcessedSequenceNumberRef = useRef(0); // Track the last processed sequence number
    const lastClientIdRef = useRef(null); // Track the last received clientId

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

        // Reset sequence number tracking when changing rooms
        lastProcessedSequenceNumberRef.current = 0;
        lastClientIdRef.current = null; // Reset clientId tracking

        // Join room when component mounts or room changes
        emit('room_change', room);

        const handleRoomChanged = (data) => {
            if (!mountedRef.current) return;
            console.log('Room changed to:', data.room);
            setCurrentMedia(null);
            setPlaying(false);
            setLoading(true);
            lastProcessedTimestampRef.current = 0;
            lastProcessedSequenceNumberRef.current = 0; // Reset sequence number on room change
            lastClientIdRef.current = null; // Reset clientId tracking
        };

        const handleMediaState = (data) => {
            if (!mountedRef.current) return;
            console.log('Received media state:', data);
            
            // Get sequence number with fallback to 0 if not present (for backward compatibility)
            const sequenceNumber = data.sequenceNumber || 0;
            const timestamp = data.timestamp || Date.now();
            const clientId = data.clientId || null;
            
            // Check if this is a duplicate update from the same client
            const isDuplicate = 
                (sequenceNumber === lastProcessedSequenceNumberRef.current && 
                Math.abs(timestamp - lastProcessedTimestampRef.current) < 500) || // Within 500ms
                (clientId && clientId === lastClientIdRef.current && 
                Math.abs(timestamp - lastProcessedTimestampRef.current) < 1000); // Same client within 1s
            
            if (isDuplicate) {
                console.log(`Ignoring duplicate media state update: seq=${sequenceNumber}, timestamp=${timestamp}, clientId=${clientId}`);
                return;
            }
            
            // Check if this update has a higher sequence number than the last one we processed
            // If sequence numbers are equal, use timestamp as a tiebreaker
            const isNewerSequence = sequenceNumber > lastProcessedSequenceNumberRef.current;
            const isSameSequenceNewerTimestamp = 
                sequenceNumber === lastProcessedSequenceNumberRef.current && 
                timestamp > lastProcessedTimestampRef.current + 1000; // Only consider significantly newer timestamps
            
            if (isNewerSequence || isSameSequenceNewerTimestamp || (!currentMedia && data.media)) {
                console.log(`Processing media state with sequence number: ${sequenceNumber} (previous: ${lastProcessedSequenceNumberRef.current})`);
                
                // Update the last processed sequence number, timestamp, and clientId
                lastProcessedSequenceNumberRef.current = sequenceNumber;
                lastProcessedTimestampRef.current = timestamp;
                if (clientId) {
                    lastClientIdRef.current = clientId;
                }
                
                if (data.media) {
                    console.log('Setting current media:', data.media);
                    setCurrentMedia(data.media);
                    setPlaying(true);
                    setLoading(false);
                    
                    // Reset countdown timer
                    setTimeUntilNext(roomConfig.countdown);
                    
                    // Set up periodic media state requests
                    scheduleNextMediaStateRequest();
                } else {
                    console.log('No media in state, clearing current media');
                    setCurrentMedia(null);
                    setPlaying(false);
                    setLoading(false);
                }
            } else {
                console.log(`Ignoring outdated media state with sequence number: ${sequenceNumber} (current: ${lastProcessedSequenceNumberRef.current})`);
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
            }, roomConfig.interval || 30000);
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
    }, [socket, room, emit, roomConfig.interval]);

    useEffect(() => {
        if (currentMedia && mountedRef.current) {
            // Reset timer
            setTimeUntilNext(roomConfig.countdown);
            
            // Clear existing interval
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }

            // Start new countdown
            timerRef.current = setInterval(() => {
                if (mountedRef.current) {
                    setTimeUntilNext(prev => {
                        if (prev <= 0) return roomConfig.countdown;
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
    }, [currentMedia, roomConfig.countdown]);

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
        <div className="relative w-full h-full flex items-center justify-center">
            {/* Countdown display */}
            <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-2 py-1 rounded-lg text-sm">
                Next: {timeUntilNext}s
            </div>
            
            {isImage ? (
                // Image display
                <div className="flex items-center justify-center w-full h-full">
                    <img
                        src={mediaUrl}
                        alt="Media content"
                        className="max-w-full max-h-full object-contain"
                    />
                </div>
            ) : (
                // Video player
                <div className="w-full h-full">
                    <ReactPlayer
                        ref={mediaRef}
                        url={mediaUrl}
                        playing={playing}
                        controls={true}
                        volume={volume}
                        width="100%"
                        height="100%"
                        onEnded={handleMediaEnd}
                        onError={(e) => {
                            console.error('Player error:', e);
                            setError('Error playing media. Please try again.');
                        }}
                        loop={true}
                        config={{
                            file: {
                                attributes: {
                                    controlsList: 'nodownload',
                                    disablePictureInPicture: true,
                                }
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
