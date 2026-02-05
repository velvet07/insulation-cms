'use client';

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from './button';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onChange?: (hasSignature: boolean) => void;
  initialSignature?: string | null;
  width?: number;
  height?: number;
}

export interface SignaturePadHandle {
  getSignatureData: () => string | null;
  clear: () => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({ 
  onChange,
  initialSignature = null,
  width = 600,
  height = 200
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialSignature);

  useImperativeHandle(ref, () => ({
    getSignatureData: () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasSignature) return null;
      return canvas.toDataURL('image/png');
    },
    clear: () => {
      clear();
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas beállítása - Nagyon nagy felbontás az élesebb vonalakért
    // 6x nagyobb felbontás a teljesen éles aláírásokért
    const dpr = (window.devicePixelRatio || 1) * 6;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Visszaállítjuk a megjelenítési méretet CSS-sel
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // A canvas méretezés után újra kell hozzáférni a kontextushoz
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Skálázzuk a kontextust a DPR-nek megfelelően
    ctx.scale(dpr, dpr);

    // Clip: a rajzolás ne lógjon ki a keretből
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    
    // Kék szín az aláíráshoz - vastagabb vonal a jobb láthatóságért
    ctx.strokeStyle = '#003399'; 
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Ha van kezdeti aláírás, betöltjük
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        // A ctx.scale után a koordináták a logikai méretek (width, height), nem a fizikai pixel méretek
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        setHasSignature(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature, width, height]);

  const getLogicalCoords = (
    canvas: HTMLCanvasElement,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * width;
    const y = ((clientY - rect.top) / rect.height) * height;
    return {
      x: Math.max(0, Math.min(width, x)),
      y: Math.max(0, Math.min(height, y)),
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const coords = getLogicalCoords(canvas, e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getLogicalCoords(canvas, e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSignature(true);
    onChange?.(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    setHasSignature(false);
    onChange?.(false);
  };

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 overflow-hidden shrink-0"
        style={{
          width: `${width}px`,
          minWidth: `${width}px`,
          maxWidth: `${width}px`,
          height: `${height}px`,
          minHeight: `${height}px`,
          maxHeight: `${height}px`,
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair touch-none block"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            minWidth: `${width}px`,
            maxWidth: `${width}px`,
            minHeight: `${height}px`,
            maxHeight: `${height}px`,
            boxSizing: 'border-box',
            display: 'block',
            touchAction: 'none',
          }}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={clear} disabled={!hasSignature}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Törlés
        </Button>
      </div>
    </div>
  );
});
