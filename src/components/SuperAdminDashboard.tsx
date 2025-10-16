'use client';

import { chatWithAdminAgent, signOutUser } from '@/app/admin/actions';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AIModel, RichAIResponse } from '@/types/ai';
import { Bot, BrainCircuit, Check, ChevronDown, Loader2, LogOut, PanelLeft, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChatInputForm from './ChatInputForm';
import DeepseekIcon from './icons/DeepseekIcon';
import GeminiIcon from './icons/GeminiIcon';
import LlamaIcon from './icons/LlamaIcon';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  response?: RichAIResponse;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
};

const modelData = {
  gemini: { name: 'Gemini 1.5 Flash', Icon: GeminiIcon },
  llama: { name: 'Llama 3.1', Icon: LlamaIcon },
  deepseek: { name: 'DeepSeek v2', Icon: DeepseekIcon },
};

export default function SuperAdminDashboard({ userName, avatarUrl, unverifiedCount }: { userName: string, avatarUrl: string, unverifiedCount: number }) {
  const [isMounted, setIsMounted] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini'); // Default ke Gemini untuk fitur terbaik
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const CurrentModelIcon = useMemo(() => modelData[selectedModel].Icon, [selectedModel]);

  useEffect(() => {
    setIsMounted(true);
    setGreeting(getGreeting());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (input: string) => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // Panggil Server Action 'chatWithAdminAgent' yang baru dengan arsitektur Reasoning Loop
    const response = await chatWithAdminAgent(input, messages, selectedModel);

    const assistantMessage: Message = {
      role: 'assistant',
      content: response.introText || response.error || "Berikut hasilnya:",
      response: response
    };
    setMessages([...newMessages, assistantMessage]);
    setIsLoading(false);
  };

  // Fungsi handleFileChange tidak perlu diubah
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Implementasi untuk file processing tetap sama, bisa ditambahkan jika diperlukan
    console.log("File processing to be implemented.");
    if (event.target) event.target.value = "";
  };

  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-screen w-full bg-background font-sans">
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-1">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
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
                        <AvatarImage key={avatarUrl} src={avatarUrl} alt={userName} />
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 text-base">
                <CurrentModelIcon className="h-5 w-5" />
                <span className="font-semibold">{modelData[selectedModel].name}</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Pilih Model AI</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={selectedModel} onValueChange={(value) => setSelectedModel(value as AIModel)}>
                {(Object.keys(modelData) as AIModel[]).map((modelKey) => {
                  const { name, Icon } = modelData[modelKey];
                  return (
                    <DropdownMenuRadioItem key={modelKey} value={modelKey} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{name}</span>
                      {selectedModel === modelKey && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-9 w-9 cursor-pointer">
              <AvatarImage key={avatarUrl} src={avatarUrl} alt={userName} />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
      </header>

      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-16">
          <div className="mb-12">
            <h1 className="text-6xl font-bold text-gray-800">{greeting}, {userName.split(' ')[0]}</h1>
            {unverifiedCount > 0 ? (
              <p className="text-xl text-amber-600 mt-4 font-medium">
                Ada {unverifiedCount} pengguna baru yang menunggu verifikasi Anda.
              </p>
            ) : (
              <p className="text-xl text-gray-500 mt-4">Bagaimana saya bisa membantu hari ini?</p>
            )}
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
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 mt-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage key={avatarUrl} src={avatarUrl} alt={userName} />
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                  </div>
                )}
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
          <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent flex justify-center">
            <ChatInputForm onSubmit={handleSendMessage} onFileChange={handleFileChange} isLoading={isLoading} />
          </footer>
        </>
      )}
    </div>
  );
}
