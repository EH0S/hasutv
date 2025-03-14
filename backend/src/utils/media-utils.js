import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import path from 'path';

// Configure ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

// Helper function to get video metadata
export const getVideoMetadata = async (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('FFprobe error:', err);
                // If ffprobe fails, try to get duration from file stats as fallback
                try {
                    const stats = fs.statSync(filePath);
                    const fileSizeInBytes = stats.size;
                    // Rough estimate: assume 1MB per second for video
                    const estimatedDuration = fileSizeInBytes / (1024 * 1024);
                    console.log('Using estimated duration:', estimatedDuration);
                    resolve({ format: { duration: estimatedDuration } });
                } catch (statErr) {
                    reject(err);
                }
            } else {
                resolve(metadata);
            }
        });
    });
};

// Helper function to trim video
export const trimVideo = (inputPath, outputPath, duration) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .setStartTime(0)
            .setDuration(duration)
            .output(outputPath)
            .on('end', () => {
                console.log('Video trimming finished');
                // Delete original file after successful trim
                fs.unlink(inputPath, (err) => {
                    if (err) console.error('Error deleting original file:', err);
                });
                resolve();
            })
            .on('error', (err) => {
                console.error('Error trimming video:', err);
                reject(err);
            })
            .run();
    });
};
