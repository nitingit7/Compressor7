import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  accept: string;
  label: string;
  icon?: React.ReactNode;
}

export function Dropzone({ onFileSelect, accept, label, icon }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

    const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      const files = Array.from(e.dataTransfer.files) as File[];
      if (files.length > 0) {
        // Just take the first file
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
             onFileSelect(file);
             break;
          }
        }
      }
    },
    [onFileSelect]
  );

  React.useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors duration-200',
        isDragging
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
          : 'border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800'
      )}
    >
      <input
        type="file"
        ref={inputRef}
        onChange={handleChange}
        accept={accept}
        className="hidden"
      />
      
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-slate-200 p-3 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {icon || <UploadCloud className="h-8 w-8" />}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isDragging ? 'Drop file to compress' : 'Drop file here or click to browse'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
