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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    
    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      } else {
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    };

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    
    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      } else {
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    };

    const coords = getCoordinates(e);
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange?.(false);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair touch-none"
          style={{ width: '100%', maxWidth: `${width}px`, height: `${height}px` }}
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
