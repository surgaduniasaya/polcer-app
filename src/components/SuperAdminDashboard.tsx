'use client';

import { chatWithAdminAgent, processExcelFile, signOutUser } from '@/app/admin/actions';
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
import { Bot, BrainCircuit, Download, Loader2, LogOut, PanelLeft, Plus, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChatInputForm from './ChatInputForm';

// Tipe Message diperbarui untuk menyertakan data tabel dan URL unduhan opsional
interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    setGreeting(getGreeting());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (input: string) => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    const response = await chatWithAdminAgent(input, messages);
    if (response.success) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
        data: response.data // Menyimpan data tabel ke state
      };
      setMessages(prev => [...prev, assistantMessage]);
    } else {
      const errorMessage: Message = { role: 'assistant', content: `Maaf, terjadi kesalahan: ${response.message}` };
      setMessages(prev => [...prev, errorMessage]);
    }
    setIsLoading(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isLoading) return;
    const userMessage: Message = { role: 'user', content: `Memproses file: ${file.name}` };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    const result = await processExcelFile(formData);
    if (result.success) {
      const assistantMessage: Message = { role: 'assistant', content: result.message, data: result.data };
      setMessages(prev => [...prev, assistantMessage]);
    } else {
      const errorMessage: Message = { role: 'assistant', content: `Maaf, terjadi kesalahan: ${result.message}` };
      setMessages(prev => [...prev, errorMessage]);
    }
    setIsLoading(false);
    if (event.target) event.target.value = "";
  };

  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  if (!isMounted) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-white font-sans">
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border-b">
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
            {/* Sisa dari sidebar bisa ditambahkan di sini */}
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
      </header>

      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-16">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-gray-800">{greeting}, {userName}</h1>
            <p className="text-lg text-gray-500 mt-2">Apa yang bisa saya bantu hari ini?</p>
          </div>
          <ChatInputForm onSubmit={handleSendMessage} onFileChange={handleFileChange} isLoading={isLoading} />
        </div>
      ) : (
        <>
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pt-24 pb-32">
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-start gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1"><Bot className="h-5 w-5 text-blue-600" /></div>}

                <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <div className="prose prose-sm max-w-none prose-p:my-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {/* ---- LOGIKA BARU UNTUK MERENDER TABEL ---- */}
                  {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                    <div className="mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(msg.data[0]).map((key) => <TableHead key={key}>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</TableHead>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {msg.data.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {Object.values(row).map((cell: any, cellIndex: number) => (
                                <TableCell key={cellIndex}>{cell !== null && cell !== undefined ? String(cell) : '-'}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {/* Tombol unduh jika ini adalah template */}
                      {msg.content.toLowerCase().includes("template") && (
                        <Button asChild variant="outline" className="mt-3 w-full sm:w-auto">
                          <a href="/api/template" download>
                            <Download className="mr-2 h-4 w-4" />
                            Unduh Template Excel
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1"><User className="h-5 w-5 text-gray-600" /></div>}
              </div>
            ))}
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

