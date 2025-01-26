import React, { useRef, useState, useEffect } from 'react';
import UploadButton from './UploadButton';

const COLORS = [
    '#000000', // Black
    '#FFFFFF', // White
    '#FF0000', // Red
    '#00FF00', // Green
    '#0000FF', // Blue
    '#FFFF00', // Yellow
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#FFA500', // Orange
    '#800080', // Purple
    '#A52A2A', // Brown
    '#808080', // Gray
];

const BRUSH_SIZES = [
    { size: 2, label: 'XS' },
    { size: 5, label: 'S' },
    { size: 10, label: 'M' },
    { size: 15, label: 'L' },
    { size: 20, label: 'XL' },
];

const TOOLS = {
    BRUSH: 'brush',
    ERASER: 'eraser',
    BUCKET: 'bucket'
};

const DrawingModal = ({ isOpen, onClose, onSave, uploading }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const contextRef = useRef(null);
    const [currentColor, setCurrentColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [currentTool, setCurrentTool] = useState(TOOLS.BRUSH);
    const drawingStateRef = useRef({
        isDrawing: false,
        lastX: 0,
        lastY: 0
    });

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;

        const context = canvas.getContext('2d');
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = currentColor;
        context.lineWidth = brushSize;
        contextRef.current = context;

        // Fill with white background
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }, [isOpen]);

    useEffect(() => {
        if (!contextRef.current) return;
        contextRef.current.strokeStyle = currentTool === TOOLS.ERASER ? '#ffffff' : currentColor;
        contextRef.current.lineWidth = brushSize;
    }, [currentColor, brushSize, currentTool]);

    const getEventCoordinates = (event) => {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        
        if (event.touches) {
            const touch = event.touches[0];
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        }
        
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    };

    const startDrawing = (event) => {
        if (currentTool === TOOLS.BUCKET) return;
        
        const coords = getEventCoordinates(event);
        if (!coords || !contextRef.current) return;

        drawingStateRef.current = {
            isDrawing: true,
            lastX: coords.x,
            lastY: coords.y
        };
        setIsDrawing(true);

        contextRef.current.beginPath();
        contextRef.current.moveTo(coords.x, coords.y);
    };

    const draw = (event) => {
        if (currentTool === TOOLS.BUCKET || !drawingStateRef.current.isDrawing || !contextRef.current) return;
        
        const coords = getEventCoordinates(event);
        if (!coords) return;

        contextRef.current.lineTo(coords.x, coords.y);
        contextRef.current.stroke();
        
        drawingStateRef.current.lastX = coords.x;
        drawingStateRef.current.lastY = coords.y;
    };

    const stopDrawing = () => {
        if (contextRef.current) {
            contextRef.current.closePath();
        }
        drawingStateRef.current.isDrawing = false;
        setIsDrawing(false);
    };

    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    };

    const rgbToHex = (r, g, b) => {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    };

    const colorMatch = (data, pos, color) => {
        return (
            data[pos] === color[0] &&
            data[pos + 1] === color[1] &&
            data[pos + 2] === color[2]
        );
    };

    const floodFill = (startX, startY, fillColor) => {
        const canvas = canvasRef.current;
        const ctx = contextRef.current;
        if (!canvas || !ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        const pos = (startY * canvas.width + startX) * 4;
        const targetColor = [
            pixels[pos],
            pixels[pos + 1],
            pixels[pos + 2]
        ];
        
        const fillColorRgb = hexToRgb(fillColor);
        
        // Don't fill if we're trying to fill with the same color
        if (targetColor[0] === fillColorRgb[0] &&
            targetColor[1] === fillColorRgb[1] &&
            targetColor[2] === fillColorRgb[2]) {
            return;
        }

        const queue = [[startX, startY]];
        
        while (queue.length > 0) {
            const [x, y] = queue.pop();
            const currentPos = (y * canvas.width + x) * 4;
            
            if (!colorMatch(pixels, currentPos, targetColor)) continue;
            
            // Fill the current pixel
            pixels[currentPos] = fillColorRgb[0];
            pixels[currentPos + 1] = fillColorRgb[1];
            pixels[currentPos + 2] = fillColorRgb[2];
            pixels[currentPos + 3] = 255;
            
            // Add adjacent pixels to queue
            if (x > 0) queue.push([x - 1, y]);
            if (x < canvas.width - 1) queue.push([x + 1, y]);
            if (y > 0) queue.push([x, y - 1]);
            if (y < canvas.height - 1) queue.push([x, y + 1]);
        }
        
        ctx.putImageData(imageData, 0, 0);
    };

    const handleCanvasClick = (event) => {
        if (currentTool === TOOLS.BUCKET) {
            const coords = getEventCoordinates(event);
            if (!coords) return;
            floodFill(coords.x, coords.y, currentColor);
        }
    };

    const clearCanvas = () => {
        if (!contextRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        contextRef.current.fillStyle = '#ffffff';
        contextRef.current.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleUpload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const drawingDataUrl = canvas.toDataURL('image/png');
        
        fetch(drawingDataUrl)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], 'drawing.png', { type: 'image/png' });
                onSave(file);
            });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold dark:text-white">Draw Something</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        ✕
                    </button>
                </div>

                {/* Tools Section */}
                <div className="mb-4 flex flex-wrap gap-4">
                    {/* Color Palette */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Colors:</span>
                        {COLORS.map((color) => (
                            <button
                                key={color}
                                onClick={() => {
                                    setCurrentColor(color);
                                    setCurrentTool(TOOLS.BRUSH);
                                }}
                                className={`w-8 h-8 rounded-full border-2 ${
                                    currentColor === color && currentTool !== TOOLS.ERASER 
                                        ? 'border-blue-500' 
                                        : 'border-gray-300'
                                }`}
                                style={{
                                    backgroundColor: color,
                                    boxShadow: color === '#FFFFFF' ? 'inset 0 0 0 1px #E5E7EB' : 'none'
                                }}
                            />
                        ))}
                    </div>

                    {/* Brush Sizes */}
                    <div className="flex gap-2 items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Size:</span>
                        {BRUSH_SIZES.map(({ size, label }) => (
                            <button
                                key={size}
                                onClick={() => setBrushSize(size)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                                    brushSize === size
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                                        : 'border-gray-300 bg-white dark:bg-gray-700'
                                }`}
                            >
                                <span className="text-xs">{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Tools */}
                    <div className="flex gap-2 items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Tools:</span>
                        {/* Brush */}
                        <button
                            onClick={() => setCurrentTool(TOOLS.BRUSH)}
                            className={`px-3 py-1 rounded-full flex items-center gap-2 ${
                                currentTool === TOOLS.BRUSH
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Brush
                        </button>

                        {/* Eraser */}
                        <button
                            onClick={() => setCurrentTool(TOOLS.ERASER)}
                            className={`px-3 py-1 rounded-full flex items-center gap-2 ${
                                currentTool === TOOLS.ERASER
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Eraser
                        </button>

                        {/* Fill Bucket */}
                        <button
                            onClick={() => setCurrentTool(TOOLS.BUCKET)}
                            className={`px-3 py-1 rounded-full flex items-center gap-2 ${
                                currentTool === TOOLS.BUCKET
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                            </svg>
                            Fill
                        </button>
                    </div>
                </div>
                
                <div className="border rounded dark:border-gray-600 overflow-hidden mb-4" style={{ height: '400px' }}>
                    <canvas
                        ref={canvasRef}
                        style={{ touchAction: 'none' }}
                        className="bg-white cursor-crosshair w-full h-full"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        onClick={handleCanvasClick}
                    />
                </div>

                <div className="flex space-x-4">
                    <button
                        onClick={clearCanvas}
                        className="flex-1 py-2 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-full"
                    >
                        Clear
                    </button>
                    <UploadButton
                        onClick={handleUpload}
                        disabled={uploading}
                        uploading={uploading}
                        className="flex-1"
                    />
                </div>
            </div>
        </div>
    );
};

export default DrawingModal;
