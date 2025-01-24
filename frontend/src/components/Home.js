import React, { useState, useEffect } from 'react';

const Home = ({ onRoomChange }) => {
    const [currentEmoji, setCurrentEmoji] = useState('🌊');
    const [isVisible, setIsVisible] = useState(true);

    // List of emojis to cycle through
    const emojis = ['🌊', '🌸', '🌟', '🌈', '🌙', '✨', '🍄', '🌿', '🎨'];

    useEffect(() => {
        const interval = setInterval(() => {
            // Start the slow fade out
            setIsVisible(false);
            
            // After the fade out is complete, change the emoji
            setTimeout(() => {
                const availableEmojis = emojis.filter(emoji => emoji !== currentEmoji);
                const randomIndex = Math.floor(Math.random() * availableEmojis.length);
                setCurrentEmoji(availableEmojis[randomIndex]);
                setIsVisible(true);
            }, 10000); // Wait for fade out to complete
        }, 10000);

        return () => clearInterval(interval);
    }, [currentEmoji]);

    const rooms = [
        {
            id: '10-second-room',
            name: '10 SEC ROOM',
            description: 'For the attention-challenged generation. Perfect for your TikTok-fried brain.',
            color: 'bg-gradient-to-r from-blue-500 to-cyan-500',
            borderColor: 'hover:border-blue-500/50',
            glowColor: 'hover:shadow-blue-500/20',
            tagColors: ['bg-blue-500/20 text-blue-300', 'bg-cyan-500/20 text-cyan-300', 'bg-sky-500/20 text-sky-300'],
            emoji: '⚡️',
            tags: ['ADHD APPROVED™', 'SPEED DEMON', 'INSTANT GRATIFICATION']
        },
        {
            id: '30-second-room',
            name: '30 SEC ROOM',
            description: 'The sweet spot. Long enough to tell a story, short enough to keep you interested. Maybe.',
            color: 'bg-gradient-to-r from-purple-500 to-pink-500',
            borderColor: 'hover:border-purple-500/50',
            glowColor: 'hover:shadow-purple-500/20',
            tagColors: ['bg-purple-500/20 text-purple-300', 'bg-pink-500/20 text-pink-300', 'bg-fuchsia-500/20 text-fuchsia-300'],
            emoji: '🎯',
            tags: ['PERFECTLY BALANCED™', 'CHEF\'S KISS', 'JUST RIGHT']
        },
        {
            id: '60-second-room',
            name: '60 SEC ROOM',
            description: 'A whole minute of content? Ambitious. We believe in you though (not really).',
            color: 'bg-gradient-to-r from-pink-500 to-rose-500',
            borderColor: 'hover:border-rose-500/50',
            glowColor: 'hover:shadow-rose-500/20',
            tagColors: ['bg-rose-500/20 text-rose-300', 'bg-red-500/20 text-red-300', 'bg-pink-500/20 text-pink-300'],
            emoji: '🎬',
            tags: ['LONG FORM™', 'BOOMER MODE', 'FOCUS REQUIRED']
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white overflow-y-auto relative">
            {/* Animated background */}
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-80" />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-screen">
                {/* Hero Section */}
                <div className="text-center mb-16 relative">
                    <div className={`text-6xl mb-6 transition-opacity duration-[10000ms] ${
                        isVisible ? 'opacity-100' : 'opacity-0'
                    }`}>
                        {currentEmoji}
                    </div>
                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
                        HASU.TV
                    </h1>
                    <div className="flex justify-center gap-4 mb-8 flex-wrap">
                        <span className="px-3 py-1 bg-gradient-to-r from-blue-500/10 to-blue-500/20 rounded text-blue-300 text-sm font-mono border border-blue-500/20">SLIGHTLY ADDICTIVE</span>
                        <span className="px-3 py-1 bg-gradient-to-r from-purple-500/10 to-purple-500/20 rounded text-purple-300 text-sm font-mono border border-purple-500/20">SIGMA RIZZLER</span>
                        <span className="px-3 py-1 bg-gradient-to-r from-pink-500/10 to-pink-500/20 rounded text-pink-300 text-sm font-mono border border-pink-500/20">SKIBIDI TOILET-.. ERROR</span>
                    </div>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed font-medium">
                        Finally, a communistic content platform.
                        No algorithms telling you what to watch, no AI pretending to know you.
                        Just pure, unfiltered content chaos.
                    </p>
                </div>

                {/* Room Cards */}
                <div className="grid md:grid-cols-3 gap-8 mb-20">
                    {rooms.map((room, index) => (
                        <div 
                            key={room.id}
                            className={`bg-gray-900/50 backdrop-blur rounded-2xl overflow-hidden transition-all hover:scale-105 hover:shadow-2xl border border-gray-800 group relative ${room.borderColor} ${room.glowColor} hover:shadow-xl`}
                        >
                            <div className={`h-1 ${room.color}`} />
                            <div className="p-8">
                                <div className="text-3xl mb-4 transform group-hover:scale-110 transition-transform duration-200">{room.emoji}</div>
                                <h3 className="text-2xl font-black text-white mb-2 font-mono">
                                    {room.name}
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {room.tags.map((tag, tagIndex) => (
                                        <span 
                                            key={tagIndex}
                                            className={`text-[10px] font-bold px-2 py-1 rounded font-mono tracking-wider ${room.tagColors[tagIndex]}`}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-gray-400 mb-8 leading-relaxed font-medium min-h-[80px]">
                                    {room.description}
                                </p>
                                <button
                                    onClick={() => onRoomChange(room.id)}
                                    className={`
                                        w-full py-3 px-6 rounded-xl text-white font-black uppercase tracking-wider font-mono
                                        ${room.color} relative overflow-hidden group/button
                                        ${index === 0 ? 'hover:animate-pulse transition-all duration-300' : ''}
                                        ${index === 1 ? 'hover:scale-[1.02] transition-all duration-300' : ''}
                                        ${index === 2 ? 'transition-all duration-300' : ''}
                                    `}
                                >
                                    {/* Unique hover effects for each button */}
                                    {index === 0 && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover/button:opacity-100 transition-opacity duration-300" />
                                    )}
                                    {index === 1 && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-pink-600/50 to-purple-600/0 translate-x-[-200%] group-hover/button:translate-x-[200%] transition-all duration-1000" />
                                    )}
                                    {index === 2 && (
                                        <>
                                            <div className="absolute inset-0 opacity-0 group-hover/button:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-rose-600 to-pink-600" />
                                            <div className="absolute inset-0 opacity-0 group-hover/button:opacity-50 blur-xl transition-opacity duration-300 bg-gradient-to-r from-rose-400 to-pink-400" />
                                        </>
                                    )}
                                    <span className="relative">Enter {room.emoji}</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Features */}
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-wider font-mono">
                        THE CONCEPT
                    </h2>
                    <p className="text-gray-400 mb-12 max-w-2xl mx-auto font-medium">
                        Experience content in perfect synchronization with others. 
                        Every room has its own rhythm, every moment shared together.
                    </p>
                </div>

                {/* How It Works */}
                <div className="bg-gray-900/50 backdrop-blur rounded-2xl border border-gray-800 p-12 mb-16">
                    <div className="grid md:grid-cols-3 gap-12">
                        <div className="text-center group">
                            <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-200">🎥</div>
                            <h3 className="text-xl font-black text-white mb-3 uppercase font-mono">
                                Share Content
                            </h3>
                            <p className="text-gray-400 leading-relaxed">
                                Upload videos and images that match your room's duration.
                                Content is automatically synchronized for everyone.
                            </p>
                        </div>
                        <div className="text-center group">
                            <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-200">⚡️</div>
                            <h3 className="text-xl font-black text-white mb-3 uppercase font-mono">
                                Stay in Sync
                            </h3>
                            <p className="text-gray-400 leading-relaxed">
                                Experience content together in real-time.
                                Everyone sees the same thing at the same moment.
                            </p>
                        </div>
                        <div className="text-center group">
                            <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-200">💭</div>
                            <h3 className="text-xl font-black text-white mb-3 uppercase font-mono">
                                Connect
                            </h3>
                            <p className="text-gray-400 leading-relaxed">
                                Chat and interact with others while watching.
                                Build connections through shared experiences.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-gray-500 font-mono text-sm pb-8">
                    <p>HASU.TV™ - SYNCHRONIZED CONTENT EXPERIENCE</p>
                </div>
            </div>
        </div>
    );
};

export default Home;
