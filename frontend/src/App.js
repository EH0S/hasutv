import React, { useState, useEffect } from 'react';
import TabBar from './components/TabBar';
import VideoPlayer from './components/VideoPlayer';
import VideoDescription from './components/VideoDescription';
import Chat from './components/Chat';
import MobileNavBar from './components/MobileNavBar';
import Home from './components/Home';
import DrawingModal from './components/DrawingModal';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

const ThemeToggle = () => {
    const { isDark, toggleTheme } = useTheme();
    
    return (
        <button
            onClick={toggleTheme}
            className="fixed top-4 right-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors md:opacity-100 opacity-40 hover:opacity-100"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
            {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
            )}
        </button>
    );
};

const AppContent = () => {
    const [currentRoom, setCurrentRoom] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleRoomChange = (room) => {
        setCurrentRoom(room);
    };

    const handleHomeClick = () => {
        setCurrentRoom(null);
    };

    const handleDrawingClick = () => {
        setIsDrawingModalOpen(true);
    };

    const handleDrawingSave = async (drawingFile) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', drawingFile);

        try {
            const response = await fetch(`http://localhost:3001/upload/${currentRoom}`, {
                method: 'POST',
                body: formData,
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('Upload failed: ' + text);
            }

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            console.log('Upload successful!', data);
            setIsDrawingModalOpen(false);
        } catch (error) {
            console.error(`Error: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-black max-w-screen overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-80" />

            {/* Top Navigation */}
            <div className="sticky top-0 z-20 bg-black border-b border-gray-800">
                <div className="flex justify-between items-center px-3 h-12 md:h-16 md:px-4">
                    <div className="flex items-center space-x-4">
                        <div className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 cursor-pointer">
                            Hasu
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 md:space-x-4">
                        <ThemeToggle />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative">
                {currentRoom ? (
                    <div className="h-[calc(100vh-48px)] md:h-[calc(100vh-64px)] relative">
                        {/* Drawing Modal */}
                        <DrawingModal
                            isOpen={isDrawingModalOpen}
                            onClose={() => setIsDrawingModalOpen(false)}
                            onSave={handleDrawingSave}
                            uploading={uploading}
                        />
                        {/* Mobile Layout */}
                        <div className="md:hidden flex flex-col h-full">
                            {/* Video Player */}
                            <div className="w-full">
                                <div className="aspect-video w-full">
                                    {isMobile && <VideoPlayer room={currentRoom} />}
                                </div>
                            </div>

                            {/* Video Description for Mobile */}
                            <div className="w-full bg-black">
                                <VideoDescription 
                                    room={currentRoom} 
                                    isDrawingModalOpen={isDrawingModalOpen}
                                    onDrawingModalClose={handleDrawingClick}
                                />
                            </div>

                            {/* Chat for Mobile */}
                            <div className="flex-1 min-h-0 border-t border-gray-800 bg-black relative">
                                <div className="absolute inset-0 flex flex-col">
                                    <div className="flex-1 overflow-y-auto">
                                        <Chat room={currentRoom} />
                                    </div>
                                    <div className="h-[48px]"></div>
                                </div>
                            </div>

                            {/* Mobile Navigation */}
                            <div className="fixed bottom-0 left-0 right-0 h-[50px] md:h-[48px] z-40 bg-gray-900 border-t border-gray-800">
                                <MobileNavBar currentRoom={currentRoom} onRoomChange={handleRoomChange} />
                            </div>
                        </div>

                        {/* Desktop Layout */}
                        <div className="hidden md:flex h-full">
                            {/* Left Sidebar - Menu */}
                            <div className="w-16 lg:w-20 border-r border-gray-800 bg-black">
                                <TabBar 
                                    currentRoom={currentRoom} 
                                    onRoomChange={handleRoomChange}
                                    onHomeClick={handleHomeClick}
                                />
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 flex flex-col">
                                <div className="w-full h-[40vh] bg-black">
                                    <div className="h-full flex items-center justify-center">
                                        {!isMobile && <VideoPlayer room={currentRoom} />}
                                    </div>
                                </div>
                                <div className="flex-1 p-4 overflow-auto bg-black">
                                    <VideoDescription 
                                        room={currentRoom} 
                                        isDrawingModalOpen={isDrawingModalOpen}
                                        onDrawingModalClose={handleDrawingClick}
                                    />
                                </div>
                            </div>

                            {/* Chat Panel */}
                            <div className="w-[300px] lg:w-[400px] border-l border-gray-800 bg-black">
                                <Chat room={currentRoom} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <Home onRoomChange={handleRoomChange} />
                )}
            </div>
        </div>
    );
};

const App = () => {
    const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);

    const handleDrawingClick = () => {
        setIsDrawingModalOpen(true);
    };

    return (
        <ThemeProvider>
            <AuthProvider>
                <AppContent 
                    isDrawingModalOpen={isDrawingModalOpen}
                    onDrawingModalClose={() => setIsDrawingModalOpen(false)}
                    onDrawingClick={handleDrawingClick}
                />
            </AuthProvider>
        </ThemeProvider>
    );
};

export default App;