'use client';

import { Button } from '@/components/ui/button';
import { Paperclip, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Textarea } from './ui/textarea';

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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
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
    <form onSubmit={handleFormSubmit} className={`relative w-full max-w-3xl ${className}`}>
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Tanyakan apapun pada AI Agent..."
        className="w-full bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 pr-28 shadow-lg shadow-gray-500/10 text-base resize-none overflow-y-hidden"
        autoComplete="off"
        disabled={isLoading}
        rows={1}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
        <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
          <Paperclip className="h-5 w-5 text-gray-500" />
        </Button>
        <Button type="submit" size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700" disabled={isLoading || !input.trim()}>
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
}
