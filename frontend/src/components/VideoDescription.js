import React, { useRef, useState } from 'react';
import DrawingModal from './DrawingModal';
import UploadButton from './UploadButton';
import Toast from './Toast';
import { useAuth } from '../context/AuthContext';

const VideoDescription = ({ room, isDrawingModalOpen, onDrawingModalClose: onDrawClick }) => {
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState(null);
    const fileInputRef = useRef(null);
    const { token } = useAuth();

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        // Reset file input if it was a successful upload
        if (type === 'success' && fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        if (!token) {
            showToast('Please log in to upload files', 'error');
            return;
        }

        if (selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('image/')) {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                // Get video duration if it's a video file
                if (selectedFile.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    
                    await new Promise((resolve, reject) => {
                        video.onloadedmetadata = () => resolve();
                        video.onerror = () => reject();
                        video.src = URL.createObjectURL(selectedFile);
                    });
                    
                    const duration = video.duration;
                    formData.append('duration', duration);
                    URL.revokeObjectURL(video.src);
                }

                const response = await fetch(`http://localhost:3001/api/upload/${room || 'home'}`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }

                const data = await response.json();
                console.log('Upload successful!', data);
                showToast('File uploaded successfully! 🎉');
            } catch (error) {
                console.error(`Error: ${error.message}`);
                showToast(error.message, 'error');
            } finally {
                setUploading(false);
            }
        } else {
            showToast('Please select a valid video or image file', 'error');
        }
    };

    return (
        <div className="relative">
            {/* Ambient light effect */}
            <div className="absolute -top-[150px] -left-[50px] w-[200%] h-[300px] bg-gradient-to-b from-purple-500/10 via-transparent to-transparent blur-3xl pointer-events-none" />
            
            {/* Desktop title and buttons */}
            <div className="hidden md:flex justify-between items-center py-4 relative">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
                    {room === '10-second-room' && '⚡ 10 Second Room'}
                    {room === '30-second-room' && '⏱️ 30 Second Room'}
                    {room === '60-second-room' && '⏲️ 60 Second Room'}
                </h1>
                <div className="flex space-x-2">
                    <UploadButton
                        onClick={() => fileInputRef.current.click()}
                        disabled={uploading || !token}
                        uploading={uploading}
                    />
                    <button
                        id="video-description-draw-button"
                        onClick={onDrawClick}
                        disabled={uploading || !token}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 flex items-center space-x-2 transition-all border border-purple-500/20 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span>Draw</span>
                    </button>
                </div>
            </div>

            {/* Mobile title and buttons */}
            <div className="md:hidden">
                <div className="flex justify-between items-center py-4">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        {room === '10-second-room' && '⚡ 10 Second Room'}
                        {room === '30-second-room' && '⏱️ 30 Second Room'}
                        {room === '60-second-room' && '⏲️ 60 Second Room'}
                    </h1>
                </div>
                <div className="flex justify-center space-x-4 py-4 border-t dark:border-gray-700">
                    <UploadButton
                        onClick={() => document.querySelector('#mobile-file-input').click()}
                        disabled={uploading || !token}
                        uploading={uploading}
                        className="text-sm"
                    />
                    <button
                        onClick={onDrawClick}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 transition-colors text-sm"
                        disabled={uploading || !token}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span>Draw</span>
                    </button>
                </div>
            </div>

            {/* Hidden file inputs */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*,image/*"
                className="hidden"
                id="video-description-file-input"
            />
            <input
                type="file"
                id="mobile-file-input"
                onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const transfer = new DataTransfer();
                        transfer.items.add(file);
                        fileInputRef.current.files = transfer.files;
                        handleFileChange({ target: { files: transfer.files } });
                    }
                }}
                accept="video/*,image/*"
                className="hidden"
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default VideoDescription;
