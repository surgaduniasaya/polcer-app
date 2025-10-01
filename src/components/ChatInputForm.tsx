'use client';

import { Button } from '@/components/ui/button';
import { Paperclip, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Textarea } from './ui/textarea'; // Menggunakan Textarea baru

interface ChatInputFormProps {
  onSubmit: (message: string) => Promise<void>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isLoading: boolean;
  className?: string;
}

export default function ChatInputForm({ onSubmit, onFileChange, isLoading, className }: ChatInputFormProps) {
  const [input, setInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Efek untuk auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height
      textarea.style.height = `${textarea.scrollHeight}px`; // Set to scroll height
    }
  }, [input]);


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e as any);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await onSubmit(input);
    setInput('');
  };

  return (
    <form onSubmit={handleFormSubmit} className={`w-full max-w-3xl bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-2 shadow-2xl shadow-gray-500/10 flex items-start gap-2 ${className}`}>
      <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
      <Button type="button" variant="ghost" size="icon" className="rounded-full flex-shrink-0 mt-1" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
        <Paperclip className="h-5 w-5 text-gray-500" />
      </Button>
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Tanyakan apapun pada AI Agent..."
        className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base resize-none overflow-y-hidden py-2.5"
        autoComplete="off"
        disabled={isLoading}
        rows={1}
      />
      <Button type="submit" size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700 flex-shrink-0 mt-1" disabled={isLoading || !input.trim()}>
        <Send className="h-5 w-5" />
      </Button>
    </form>
  );
}
