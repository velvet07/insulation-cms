'use client';

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
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

/**
 * High-performance signature pad using PointerEvents + setPointerCapture.
 * - DPR capped at 3x to avoid massive canvas (was 6x → caused lag)
 * - Pointer capture: drawing continues even when pen leaves the canvas area
 * - isDrawing stored in ref → no React re-renders during drawing
 * - hasSignature state updated only ONCE (first stroke), not every pixel
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({
  onChange,
  initialSignature = null,
  width = 600,
  height = 200,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(!!initialSignature);
  // Track whether we already reported hasSignature to avoid repeated onChange calls
  const reportedRef = useRef(!!initialSignature);

  useImperativeHandle(ref, () => ({
    getSignatureData: () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasSignature) return null;
      return canvas.toDataURL('image/png');
    },
    clear: () => {
      clearCanvas();
    },
  }));

  // --- Canvas init ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Minimum 3x DPR → legalább 1800×600 px kimenet, éles aláírás.
    // Cap at 4x to avoid lag on very-high-DPI screens.
    const dpr = Math.max(3, Math.min(window.devicePixelRatio || 1, 4));
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    // Clip to logical bounds
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    // Signature stroke style
    ctx.strokeStyle = '#003399';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctxRef.current = ctx;

    // Load initial signature if any
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        setHasSignature(true);
        reportedRef.current = true;
      };
      img.src = initialSignature;
    }
  }, [initialSignature, width, height]);

  // --- Coordinate helper ---
  const getLogicalCoords = useCallback(
    (e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * width;
      const y = ((e.clientY - rect.top) / rect.height) * height;
      return {
        x: Math.max(0, Math.min(width, x)),
        y: Math.max(0, Math.min(height, y)),
      };
    },
    [width, height],
  );

  // --- Pointer event handlers (native, not React synthetic) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      // Capture pointer so events fire even outside the canvas
      canvas.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;

      const ctx = ctxRef.current;
      if (!ctx) return;
      const coords = getLogicalCoords(e);
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const ctx = ctxRef.current;
      if (!ctx) return;
      const coords = getLogicalCoords(e);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      // Report hasSignature only once
      if (!reportedRef.current) {
        reportedRef.current = true;
        setHasSignature(true);
        onChange?.(true);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        canvas.releasePointerCapture(e.pointerId);
      }
    };

    // Use native listeners for better performance (no React synthetic overhead)
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [getLogicalCoords, onChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, width, height);
    setHasSignature(false);
    reportedRef.current = false;
    onChange?.(false);
  }, [width, height, onChange]);

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
        <Button variant="outline" onClick={clearCanvas} disabled={!hasSignature}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Törlés
        </Button>
      </div>
    </div>
  );
});
