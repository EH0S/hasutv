import React from 'react';

const TabBar = ({ currentRoom, onRoomChange, onHomeClick }) => {
    return (
        <div className="flex flex-col pt-6 space-y-6">
            <button
                onClick={onHomeClick}
                className={`flex flex-col items-center justify-center ${
                    !currentRoom ? 'text-blue-500' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-xs mt-1.5">Home</span>
            </button>
            <button
                onClick={() => onRoomChange('10-second-room')}
                className={`flex flex-col items-center justify-center ${
                    currentRoom === '10-second-room' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs mt-1.5">10s</span>
            </button>
            <button
                onClick={() => onRoomChange('30-second-room')}
                className={`flex flex-col items-center justify-center ${
                    currentRoom === '30-second-room' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs mt-1.5">30s</span>
            </button>
            <button
                onClick={() => onRoomChange('60-second-room')}
                className={`flex flex-col items-center justify-center ${
                    currentRoom === '60-second-room' ? 'text-blue-500' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs mt-1.5">60s</span>
            </button>
        </div>
    );
};

export default TabBar;
