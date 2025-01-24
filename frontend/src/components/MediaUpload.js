import React, { useState } from 'react';
import DrawingModal from './DrawingModal';

const MediaUpload = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && (selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('image/'))) {
            setFile(selectedFile);
            setUploadStatus('');
        } else {
            setUploadStatus('Please select a valid video or image file');
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setUploadStatus('Please select a file first');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:3001/upload', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            const data = await response.json();
            
            if (response.ok) {
                setUploadStatus('Upload successful!');
                setFile(null);
                // Reset the file input
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) fileInput.value = '';
            } else {
                setUploadStatus(`Upload failed: ${data.error}`);
            }
        } catch (error) {
            setUploadStatus(`Error: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Upload Media</h2>
            <div className="space-y-4">
                <input
                    type="file"
                    accept="video/*,image/*"
                    onChange={handleFileChange}
                    className="w-full p-2 border rounded dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                />
                <div className="flex space-x-4">
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className={`flex-1 py-2 px-4 rounded ${
                            !file || uploading
                                ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                    >
                        {uploading ? 'Uploading...' : 'Upload Media'}
                    </button>
                    <button
                        onClick={() => setIsDrawingModalOpen(true)}
                        className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded"
                    >
                        Draw
                    </button>
                </div>
                {uploadStatus && (
                    <p className={`text-sm ${
                        uploadStatus.includes('successful')
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                    }`}>
                        {uploadStatus}
                    </p>
                )}
            </div>

            <DrawingModal
                isOpen={isDrawingModalOpen}
                onClose={() => setIsDrawingModalOpen(false)}
                onSave={(drawingFile) => {
                    setFile(drawingFile);
                    setUploadStatus('Drawing ready to upload!');
                }}
            />
        </div>
    );
};

export default MediaUpload;
