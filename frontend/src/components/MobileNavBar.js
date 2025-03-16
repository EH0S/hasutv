import React from 'react';
import { useNavigate } from 'react-router-dom';

const MobileNavBar = ({ currentRoom }) => {
    const navigate = useNavigate();

    const handleRoomChange = (room) => {
        navigate(`/${room}`);
    };

    return (
        <div className="h-full flex items-center justify-around px-4 md:px-8">
            <button
                onClick={() => handleRoomChange('')}
                className={`flex flex-col items-center ${!currentRoom ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-xs mt-0.5">Home</span>
            </button>
            <button
                onClick={() => handleRoomChange('10-second-room')}
                className={`flex flex-col items-center ${currentRoom === '10-second-room' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs mt-0.5">10s</span>
            </button>
            <button
                onClick={() => handleRoomChange('30-second-room')}
                className={`flex flex-col items-center ${currentRoom === '30-second-room' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs mt-0.5">30s</span>
            </button>
            <button
                onClick={() => handleRoomChange('60-second-room')}
                className={`flex flex-col items-center ${currentRoom === '60-second-room' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs mt-0.5">60s</span>
            </button>
        </div>
    );
};

export default MobileNavBar;
