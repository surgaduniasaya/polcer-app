'use client';

import { chatWithAdminAgent, executePendingActions, processExcelFile, signOutUser } from '@/app/admin/actions';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AIModel, RichAIResponse, ToolCall } from '@/types/ai';
import { AlertTriangle, Bot, BrainCircuit, Loader2, LogOut, PanelLeft, Plus, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChatInputForm from './ChatInputForm';
import LlamaIcon from './icons/LlamaIcon';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  response?: RichAIResponse;
}

// Komponen baru untuk menampilkan prompt konfirmasi
const ConfirmationDialog = ({ prompt, onConfirm, onCancel }: { prompt: string, onConfirm: () => void, onCancel: () => void }) => (
  <div className="mt-4 p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded-r-lg">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-yellow-800">Membutuhkan Konfirmasi</p>
        <p className="text-sm text-yellow-700 mt-1">{prompt}</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">Ya, Lanjutkan</Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Batal</Button>
        </div>
      </div>
    </div>
  </div>
);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
};

export default function SuperAdminDashboard({ userName, avatarUrl }: { userName: string, avatarUrl: string }) {
  const [isMounted, setIsMounted] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini');
  const [confirmation, setConfirmation] = useState<{ prompt: string; actions: ToolCall[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    setGreeting(getGreeting());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, confirmation]);

  const handleSendMessage = async (input: string) => {
    if (!input.trim() || isLoading) return;
    setConfirmation(null); // Hapus konfirmasi sebelumnya
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const response = await chatWithAdminAgent(input, messages, selectedModel);

    // LOGIKA BARU: Periksa apakah butuh konfirmasi
    if (response.needsConfirmation && response.confirmationPrompt && response.pendingActions) {
      setConfirmation({ prompt: response.confirmationPrompt, actions: response.pendingActions });
    } else {
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.introText || response.error || "Berikut hasilnya:",
        response: response
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
    setIsLoading(false);
  };

  const handleConfirmAction = async () => {
    if (!confirmation || isLoading) return;

    const actionsToExecute = confirmation.actions;
    setConfirmation(null);
    setIsLoading(true);

    const response = await executePendingActions(actionsToExecute);

    const assistantMessage: Message = {
      role: 'assistant',
      content: response.introText || response.error || "Aksi telah dieksekusi.",
      response: response
    };
    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const handleCancelAction = () => {
    setConfirmation(null);
    const cancelMessage: Message = {
      role: 'assistant',
      content: "Baik, aksi telah dibatalkan. 👍",
      response: { success: true, introText: "Baik, aksi telah dibatalkan. 👍" }
    };
    setMessages(prev => [...prev, cancelMessage]);
  };

  // ... (sisa fungsi, seperti handleFileChange, tetap sama)
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isLoading) return;
    const userMessage: Message = { role: 'user', content: `Memproses file: ${file.name}` };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    const result = await processExcelFile(formData, selectedModel);
    const assistantMessage: Message = {
      role: 'assistant',
      content: result.introText || result.error || "File telah diproses.",
      response: result
    };
    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
    if (event.target) event.target.value = "";
  };

  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-screen w-full bg-white font-sans">
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border-b">
        {/* ... (kode header tidak berubah) */}
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <PanelLeft className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col w-72 p-0 bg-gray-50/95 backdrop-blur-sm border-r">
              <div className="p-4 border-b flex items-center gap-3">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <BrainCircuit className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-800 tracking-tight">POLCER Agent</h2>
              </div>
              <div className='p-4 space-y-4'>
                <Button onClick={() => setMessages([])} className="w-full justify-start gap-2 bg-white hover:bg-gray-100 text-gray-800 border shadow-sm">
                  <Plus size={18} />
                  New Chat
                </Button>
              </div>
              <div className="mt-auto border-t p-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-200/60">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={avatarUrl} alt={userName} />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-sm truncate text-gray-800">{userName}</span>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top" className="w-56">
                    <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <form action={signOutUser} className="w-full">
                        <button type="submit" className="w-full text-left flex items-center">
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Logout</span>
                        </button>
                      </form>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-gray-100 p-1">
          <Button size="sm" variant={selectedModel === 'gemini' ? 'default' : 'ghost'} onClick={() => setSelectedModel('gemini')} className="rounded-full gap-2 text-xs h-8 px-3">
            <BrainCircuit className="h-4 w-4" /> Gemini 2.5
          </Button>
          <Button size="sm" variant={selectedModel === 'llama' ? 'default' : 'ghost'} onClick={() => setSelectedModel('llama')} className="rounded-full gap-2 text-xs h-8 px-3">
            <LlamaIcon className="h-4 w-4" /> Llama 3.1
          </Button>
        </div>
        <div className="w-9 h-9" />
      </header>

      {messages.length === 0 && !confirmation ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-16">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-gray-800">{greeting}, {userName}</h1>
            <p className="text-lg text-gray-500 mt-2">Apa yang bisa saya bantu hari ini?</p>
          </div>
          <ChatInputForm onSubmit={handleSendMessage} onFileChange={handleFileChange} isLoading={isLoading} />
        </div>
      ) : (
        <>
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pt-24 pb-40">
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-start gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1"><Bot className="h-5 w-5 text-blue-600" /></div>}
                <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.role === 'user' ? (<p>{msg.content}</p>) : (
                    <div className="prose prose-sm max-w-none prose-p:my-2">
                      {msg.response?.introText && <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.response.introText}</ReactMarkdown>}
                      {msg.response?.tables && msg.response.tables.map((table, tableIndex) => (
                        <div key={tableIndex} className="mt-3">
                          {table.title && <h4 className="font-semibold mb-2">{table.title}</h4>}
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {table.data.length > 0 && Object.keys(table.data[0]).map((key) => <TableHead key={key}>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</TableHead>)}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {table.data.map((row, rowIndex) => (
                                  <TableRow key={rowIndex}>
                                    {Object.values(row).map((cell: any, cellIndex: number) => (
                                      <TableCell key={cellIndex}>{cell !== null && cell !== undefined ? String(cell) : '-'}</TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                      {msg.response?.outroText && <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.response.outroText}</ReactMarkdown>}
                      {msg.response?.error && <p className="text-red-600 mt-2">Error: {msg.response.error}</p>}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1"><User className="h-5 w-5 text-gray-600" /></div>}
              </div>
            ))}

            {/* LOGIKA BARU: Tampilkan dialog konfirmasi di sini */}
            {confirmation && !isLoading && (
              <div className="flex items-start gap-4 max-w-4xl mx-auto">
                <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1"><Bot className="h-5 w-5 text-blue-600" /></div>
                <div className="rounded-2xl px-4 py-2.5 max-w-[85%] bg-gray-100 text-gray-800">
                  <ConfirmationDialog
                    prompt={confirmation.prompt}
                    onConfirm={handleConfirmAction}
                    onCancel={handleCancelAction}
                  />
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-start gap-4 max-w-4xl mx-auto">
                <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1"><Bot className="h-5 w-5 text-blue-600" /></div>
                <div className="rounded-2xl px-4 py-2.5 bg-gray-100 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </main>
          <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white to-transparent flex justify-center">
            <ChatInputForm onSubmit={handleSendMessage} onFileChange={handleFileChange} isLoading={isLoading} />
          </footer>
        </>
      )}
    </div>
  );
}

