'use client';

import { chatWithAdminAgent } from '../app/admin/actions';
import { signOut } from '../app/login/actions';

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
import { AIModel, RichAIResponse, ToolCall } from '@/types/ai';
import { AlertTriangle, Bot, BrainCircuit, Check, ChevronDown, Loader2, LogOut, PanelLeft, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import ChatInputForm from './ChatInputForm';
import DeepseekIcon from './icons/DeepseekIcon';
import GeminiIcon from './icons/GeminiIcon';
import LlamaIcon from './icons/LlamaIcon';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  response?: RichAIResponse;
}

const modelData = {
  gemini: { name: 'Gemini 1.5', Icon: GeminiIcon },
  llama: { name: 'Llama 3.1', Icon: LlamaIcon },
  deepseek: { name: 'DeepSeek r1', Icon: DeepseekIcon },
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
};

// PERBAIKAN: Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center p-8">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Terjadi Kesalahan</h1>
            <p className="text-gray-600 mb-4">
              Aplikasi mengalami error. Silakan refresh halaman.
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh Halaman
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SuperAdminDashboard({
  userName,
  avatarUrl,
  unverifiedCount
}: {
  userName: string;
  avatarUrl: string | null;
  unverifiedCount: number;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('llama');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationPrompt, setConfirmationPrompt] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<ToolCall[] | null>(null);

  // PERBAIKAN: State untuk tracking error
  const [error, setError] = useState<string | null>(null);

  const CurrentModelIcon = useMemo(() => modelData[selectedModel].Icon, [selectedModel]);

  useEffect(() => {
    setIsMounted(true);
    setGreeting(getGreeting());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, confirmationPrompt]);

  // PERBAIKAN: Reset error saat user mulai mengetik
  const handleResetError = useCallback(() => {
    if (error) setError(null);
  }, [error]);

  // PERBAIKAN: Dependency array lengkap
  const handleSendMessage = useCallback(async (input: string, isConfirmation: boolean = false) => {
    if (!input.trim() || isLoading) return;

    handleResetError();

    if (!isConfirmation) {
      setNeedsConfirmation(false);
      setConfirmationPrompt(null);
      setPendingActions(null);
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatWithAdminAgent(
        input,
        messages,
        selectedModel
      );

      if (response.success) {
        if (response.needsConfirmation && response.confirmationPrompt && response.pendingActions) {
          setNeedsConfirmation(true);
          setConfirmationPrompt(response.confirmationPrompt);
          setPendingActions(response.pendingActions);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: response.confirmationPrompt || "Membutuhkan konfirmasi Anda."
          }]);
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: response.introText || "Berikut hasilnya:",
            response: response
          };
          setMessages(prev => [...prev, assistantMessage]);
          setNeedsConfirmation(false);
          setConfirmationPrompt(null);
          setPendingActions(null);
        }
      } else {
        const errorMessage: Message = {
          role: 'assistant',
          content: `${response.error || 'Terjadi kesalahan tidak diketahui.'}`
        };
        setMessages(prev => [...prev, errorMessage]);
        setError(response.error || 'Terjadi kesalahan tidak diketahui.');
        setNeedsConfirmation(false);
        setConfirmationPrompt(null);
        setPendingActions(null);
      }
    } catch (error: any) {
      console.error('[Dashboard] Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ Error: ${error.message || 'Gagal menghubungi AI Agent.'}`
      };
      setMessages(prev => [...prev, errorMessage]);
      setError(error.message || 'Gagal menghubungi AI Agent.');
      setNeedsConfirmation(false);
      setConfirmationPrompt(null);
      setPendingActions(null);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, selectedModel, handleResetError]); // PERBAIKAN: Dependency lengkap

  const handleConfirmation = useCallback((confirm: boolean) => {
    if (confirm && pendingActions) {
      handleSendMessage("Ya, konfirmasi", true);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: "❌ Aksi dibatalkan oleh pengguna." }]);
      setNeedsConfirmation(false);
      setConfirmationPrompt(null);
      setPendingActions(null);
    }
  }, [pendingActions, handleSendMessage]); // PERBAIKAN: Dependency lengkap

  // PERBAIKAN: Handle file upload
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validasi file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];

    if (!validTypes.includes(file.type)) {
      setError('Format file tidak didukung. Gunakan file Excel (.xlsx, .xls) atau CSV.');
      return;
    }

    // Show loading message
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `📎 Memproses file "${file.name}"...`
    }]);
    setIsLoading(true);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // PERBAIKAN: Langsung kirim ke AI agent untuk diproses
      const prompt = `Saya telah mengupload file Excel/CSV dengan nama "${file.name}". Tolong proses file ini untuk menambahkan pengguna secara bulk. File berisi ${arrayBuffer.byteLength} bytes data.`;

      // Untuk sekarang, beri tahu user bahwa fitur masih dalam pengembangan
      setMessages(prev => [
        ...prev.slice(0, -1), // Remove loading message
        {
          role: 'assistant',
          content: `📎 File "${file.name}" diterima (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB).\n\n⚠️ **Fitur Upload Bulk Users sedang dalam pengembangan.**\n\nUntuk saat ini, silakan gunakan perintah teks untuk menambahkan pengguna satu per satu dengan format:\n\n\`\`\`\nTambahkan pengguna baru:\n- Email: user@example.com\n- Nama: John Doe\n- Role: mahasiswa/dosen\n- Program Studi: [nama prodi]\n- NIM/NIDN: [nomor]\n- Angkatan: [tahun] (untuk mahasiswa)\n\`\`\`\n\nAtau unduh template Excel di menu untuk format yang benar.`
        }
      ]);
    } catch (error: any) {
      console.error('[File Upload] Error:', error);
      setMessages(prev => [
        ...prev.slice(0, -1), // Remove loading message
        {
          role: 'assistant',
          content: `❌ Gagal memproses file: ${error.message}`
        }
      ]);
      setError(error.message);
    } finally {
      setIsLoading(false);
      event.target.value = ''; // Reset input
    }
  }, []);

  // PERBAIKAN: Reset chat
  const handleResetChat = useCallback(() => {
    setMessages([]);
    setNeedsConfirmation(false);
    setConfirmationPrompt(null);
    setPendingActions(null);
    setError(null);
  }, []);

  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  if (!isMounted) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen w-full bg-background font-sans">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-background/80 backdrop-blur-md border-b">
          <div className="flex items-center gap-1">
            {/* Sheet Mobile */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden mr-1">
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
                  <Button
                    onClick={handleResetChat}
                    className="w-full justify-start gap-2 bg-white hover:bg-gray-100 text-gray-800 border shadow-sm"
                  >
                    <Plus size={18} />
                    New Chat
                  </Button>
                </div>
                <div className="mt-auto border-t p-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-200/60 transition-colors">
                        <Avatar className="h-8 w-8">
                          {avatarUrl && <AvatarImage key={avatarUrl} src={avatarUrl} alt={userName} />}
                          <AvatarFallback>{userInitials}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-sm truncate text-gray-800">{userName}</span>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-56 mb-2">
                      <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <form action={signOut} className="w-full">
                          <button type="submit" className="w-full text-left flex items-center text-sm p-2 hover:bg-gray-100 rounded">
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

            {/* Model Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-base px-2">
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
                      <DropdownMenuRadioItem key={modelKey} value={modelKey} className="flex items-center gap-2 cursor-pointer">
                        <Icon className="h-4 w-4" />
                        <span>{name}</span>
                      </DropdownMenuRadioItem>
                    );
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* User Menu Desktop */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-9 w-9 cursor-pointer">
                  {avatarUrl && <AvatarImage key={avatarUrl} src={avatarUrl} alt={userName} />}
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={signOut} className="w-full">
                    <button type="submit" className="w-full text-left flex items-center text-sm p-2 hover:bg-gray-100 rounded">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content */}
        {messages.length === 0 && !isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-16">
            <div className="mb-12">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-800">{greeting}, {userName.split(' ')[0]}</h1>
              {unverifiedCount > 0 ? (
                <p className="text-lg md:text-xl text-amber-600 mt-4 font-medium flex items-center justify-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Ada {unverifiedCount} pengguna baru menunggu verifikasi Anda.
                </p>
              ) : (
                <p className="text-lg md:text-xl text-gray-500 mt-4">Bagaimana saya bisa membantu Anda hari ini?</p>
              )}
            </div>
            <ChatInputForm
              onSubmit={(input) => handleSendMessage(input)}
              onFileChange={handleFileChange}
              isLoading={isLoading || needsConfirmation}
              className="w-full px-4 md:px-0"
            />
          </div>
        ) : (
          <>
            <main className="flex-1 overflow-y-auto p-4 space-y-6 pt-24 pb-40">
              {messages.map((msg, index) => (
                <div key={index} className={`flex items-start gap-3 md:gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1 self-start">
                      <Bot className="h-5 w-5 text-blue-600" />
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ node, ...props }) => <p className="my-2" {...props} />,
                            h1: ({ node, ...props }) => <h1 className="my-3" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="my-3" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="my-3" {...props} />,
                            li: ({ node, ...props }) => <li className="my-1" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>

                        {msg.response?.tables && msg.response.tables.map((table, tableIndex) => (
                          <div key={tableIndex} className="mt-4 overflow-hidden rounded-lg border bg-white shadow-sm not-prose">
                            {table.title && <h4 className="font-semibold text-base p-3 border-b bg-gray-50">{table.title}</h4>}
                            <div className="overflow-x-auto">
                              <Table className="min-w-full">
                                <TableHeader>
                                  <TableRow className="bg-gray-50">
                                    {table.data.length > 0 && Object.keys(table.data[0]).map((key) =>
                                      <TableHead key={key} className="px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">{key}</TableHead>)}
                                  </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-gray-200">
                                  {table.data.map((row, rowIndex) => (
                                    <TableRow key={rowIndex} className="hover:bg-gray-50 transition-colors">
                                      {Object.values(row).map((cell: any, cellIndex: number) => (
                                        <TableCell key={cellIndex} className="px-3 py-2 text-sm text-gray-700">
                                          {cell !== null && cell !== undefined ? String(cell) : '-'}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  ))}
                                  {table.data.length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={Object.keys(table.data[0] || {}).length || 1} className="text-center text-gray-500 py-4">
                                        Tidak ada data.
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ))}

                        {/* PERBAIKAN: Gunakan wrapper div untuk outroText */}
                        {msg.response?.outroText && (
                          <div className="mt-2">
                            <ReactMarkdown
                              components={{
                                p: ({ node, ...props }) => <p className="my-2" {...props} />,
                                h1: ({ node, ...props }) => <h1 className="my-3" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="my-3" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="my-3" {...props} />,
                                li: ({ node, ...props }) => <li className="my-1" {...props} />
                              }}
                            >
                              {msg.response.outroText}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 mt-1 self-start">
                      <Avatar className="h-8 w-8">
                        {avatarUrl && <AvatarImage key={avatarUrl} src={avatarUrl} alt={userName} />}
                        <AvatarFallback>{userInitials}</AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && !needsConfirmation && (
                <div className="flex items-start gap-4 max-w-4xl mx-auto">
                  <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1"><Bot className="h-5 w-5 text-blue-600" /></div>
                  <div className="rounded-2xl px-4 py-2.5 bg-gray-100 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
                </div>
              )}

              {needsConfirmation && confirmationPrompt && (
                <div className="flex items-start gap-4 max-w-4xl mx-auto">
                  <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1 self-start opacity-0">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => handleConfirmation(true)} size="sm" className="bg-green-600 hover:bg-green-700">
                      <Check className="mr-1 h-4 w-4" /> Ya, Lanjutkan
                    </Button>
                    <Button onClick={() => handleConfirmation(false)} size="sm" variant="outline">
                      <X className="mr-1 h-4 w-4" /> Batal
                    </Button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </main>

            <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent flex justify-center">
              <ChatInputForm
                onSubmit={(input) => handleSendMessage(input)}
                onFileChange={handleFileChange}
                isLoading={isLoading || needsConfirmation}
              />
            </footer>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}