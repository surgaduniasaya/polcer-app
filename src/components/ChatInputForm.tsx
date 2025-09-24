'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, Send } from 'lucide-react';
import { useRef, useState } from 'react';

interface ChatInputFormProps {
  onSubmit: (message: string) => Promise<void>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isLoading: boolean;
  className?: string;
}

// Komponen ini diisolasi untuk mencegah re-render yang tidak perlu pada parent,
// yang mana menyelesaikan masalah input kehilangan fokus.
export default function ChatInputForm({ onSubmit, onFileChange, isLoading, className }: ChatInputFormProps) {
  const [input, setInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await onSubmit(input);
    setInput('');
  };

  return (
    <form onSubmit={handleFormSubmit} className={`w-full max-w-3xl bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-full p-2 shadow-2xl shadow-gray-500/10 flex items-center gap-2 ${className}`}>
      <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".xlsx, .xls, .csv" />
      <Button type="button" variant="ghost" size="icon" className="rounded-full flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
        <Paperclip className="h-5 w-5 text-gray-500" />
      </Button>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Tanyakan apapun pada AI Agent..."
        className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
        autoComplete="off"
        disabled={isLoading}
      />
      <Button type="submit" size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700 flex-shrink-0" disabled={isLoading || !input.trim()}>
        <Send className="h-5 w-5" />
      </Button>
    </form>
  );
}
