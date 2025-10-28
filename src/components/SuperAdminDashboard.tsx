'use client';

// Impor Server Actions
import { chatWithAdminAgent } from '../app/admin/ai_actions'; // Path relatif untuk Server Action AI
import { signOut } from '../app/login/actions'; // Path relatif untuk Server Action SignOut

// Impor Komponen UI
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm'; // Dihapus untuk menghindari error dependensi
import ChatInputForm from './ChatInputForm'; // Menggunakan path relatif
import DeepseekIcon from './icons/DeepseekIcon'; // Menggunakan path relatif
import GeminiIcon from './icons/GeminiIcon'; // Menggunakan path relatif
import LlamaIcon from './icons/LlamaIcon'; // Menggunakan path relatif

interface Message {
  role: 'user' | 'assistant';
  content: string;
  response?: RichAIResponse; // Simpan respons lengkap dari AI
}

// Data model AI
const modelData = {
  gemini: { name: 'Gemini 1.5', Icon: GeminiIcon },
  llama: { name: 'Llama 3.1', Icon: LlamaIcon },
  deepseek: { name: 'DeepSeek v2', Icon: DeepseekIcon },
};

// Fungsi salam berdasarkan waktu
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
};

export default function SuperAdminDashboard({ userName, avatarUrl, unverifiedCount }: { userName: string, avatarUrl: string | null, unverifiedCount: number }) {
  const [isMounted, setIsMounted] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('llama'); // Default ke llama
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State baru untuk alur konfirmasi
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationPrompt, setConfirmationPrompt] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<ToolCall[] | null>(null);

  // Memoize ikon model saat ini
  const CurrentModelIcon = useMemo(() => modelData[selectedModel].Icon, [selectedModel]);

  // Efek untuk mount dan salam
  useEffect(() => {
    setIsMounted(true);
    setGreeting(getGreeting());
  }, []);

  // Efek untuk auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, confirmationPrompt]); // Tambahkan confirmationPrompt

  // Fungsi utama untuk mengirim pesan ke AI Agent
  const handleSendMessage = useCallback(async (input: string, isConfirmation: boolean = false) => {
    if (!input.trim() || isLoading) return;

    // Reset konfirmasi jika ini bukan jawaban konfirmasi
    if (!isConfirmation) {
      setNeedsConfirmation(false);
      setConfirmationPrompt(null);
      setPendingActions(null);
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Panggil Server Action chatWithAdminAgent
      const response = await chatWithAdminAgent(
        input,
        messages, // Kirim riwayat sebelumnya
        selectedModel
      );

      if (response.success) {
        if (response.needsConfirmation && response.confirmationPrompt && response.pendingActions) {
          // AI meminta konfirmasi
          setNeedsConfirmation(true);
          setConfirmationPrompt(response.confirmationPrompt);
          setPendingActions(response.pendingActions);
          // Tambahkan prompt konfirmasi sebagai pesan "assistant" sementara
          setMessages(prev => [...prev, { role: 'assistant', content: response.confirmationPrompt || "Membutuhkan konfirmasi Anda." }]);
        } else {
          // Respons normal dari AI (teks atau hasil fungsi)
          const assistantMessage: Message = {
            role: 'assistant',
            content: response.introText || "Berikut hasilnya:", // Fallback content
            response: response // Simpan seluruh respons
          };
          setMessages(prev => [...prev, assistantMessage]);
          setNeedsConfirmation(false); // Reset konfirmasi
          setConfirmationPrompt(null);
          setPendingActions(null);
        }
      } else {
        // Handle error dari AI Agent
        const errorMessage: Message = {
          role: 'assistant',
          content: `Error: ${response.error || 'Terjadi kesalahan tidak diketahui.'}`
        };
        setMessages(prev => [...prev, errorMessage]);
        setNeedsConfirmation(false); // Reset konfirmasi jika error
        setConfirmationPrompt(null);
        setPendingActions(null);
      }
    } catch (error: any) {
      // Handle error network atau error tak terduga lainnya
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.message || 'Gagal menghubungi AI Agent.'}`
      };
      setMessages(prev => [...prev, errorMessage]);
      setNeedsConfirmation(false);
      setConfirmationPrompt(null);
      setPendingActions(null);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, messages, selectedModel]); // Dependency array


  // Fungsi untuk menangani jawaban konfirmasi dari user
  const handleConfirmation = (confirm: boolean) => {
    if (confirm && pendingActions) {
      // Kirim kembali prompt asli (atau hanya konfirmasi) untuk memicu eksekusi
      // Server Action perlu logika untuk mendeteksi ini
      handleSendMessage("Ya, konfirmasi", true); // Kirim 'Ya' sebagai prompt
    } else {
      // User membatalkan
      setMessages(prev => [...prev, { role: 'assistant', content: "Aksi dibatalkan." }]);
      setNeedsConfirmation(false);
      setConfirmationPrompt(null);
      setPendingActions(null);
    }
  };

  // Hitung inisial user
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  // Tunda render sampai client-side mount selesai
  if (!isMounted) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full bg-background font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-1">
          {/* Tombol Sheet Mobile */}
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
                <Button onClick={() => { setMessages([]); setNeedsConfirmation(false); setConfirmationPrompt(null); setPendingActions(null); }} className="w-full justify-start gap-2 bg-white hover:bg-gray-100 text-gray-800 border shadow-sm">
                  <Plus size={18} />
                  New Chat
                </Button>
                {/* Tambahkan link/navigasi lain di sini jika perlu */}
              </div>
              <div className="mt-auto border-t p-4">
                {/* User menu di mobile */}
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
                      <form action={signOut} className="w-full"> {/* Perbaikan: action={signOut} */}
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

          {/* Pemilih Model AI */}
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
                <form action={signOut} className="w-full"> {/* Perbaikan: action={signOut} */}
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

      {/* Konten Utama */}
      {messages.length === 0 && !isLoading ? (
        // Tampilan Awal (Belum ada chat)
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
          {/* Form input di tengah */}
          <ChatInputForm
            onSubmit={(input) => handleSendMessage(input)}
            isLoading={isLoading || needsConfirmation} // Disable input saat menunggu konfirmasi
            className="w-full px-4 md:px-0"
          />
        </div>
      ) : (
        // Tampilan Chat
        <>
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pt-24 pb-40">
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-start gap-3 md:gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {/* Avatar AI */}
                {msg.role === 'assistant' && (
                  <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1 self-start">
                    <Bot className="h-5 w-5 text-blue-600" />
                  </div>
                )}
                {/* Bubble Chat */}
                <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p> // Tampilkan teks user apa adanya
                  ) : (
                    // Render konten AI (Markdown + Tabel)
                    <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-li:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown> {/* Perbaikan: remarkPlugins dihapus */}
                      {/* Render Tabel jika ada */}
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
                                      <TableCell key={cellIndex} className="px-3 py-2 text-sm text-gray-700">{cell !== null && cell !== undefined ? String(cell) : '-'}</TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                                {table.data.length === 0 && (
                                  <TableRow><TableCell colSpan={Object.keys(table.data[0] || {}).length || 1} className="text-center text-gray-500 py-4">Tidak ada data.</TableCell></TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                      {/* Render Outro Text jika ada */}
                      {msg.response?.outroText && <ReactMarkdown className="mt-2">{msg.response.outroText}</ReactMarkdown>} {/* Perbaikan: remarkPlugins dihapus */}
                    </div>
                  )}
                </div>
                {/* Avatar User */}
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

            {/* Indikator Loading */}
            {isLoading && !needsConfirmation && (
              <div className="flex items-start gap-4 max-w-4xl mx-auto">
                <div className="p-2 bg-gray-100 rounded-full flex-shrink-0 mt-1"><Bot className="h-5 w-5 text-blue-600" /></div>
                <div className="rounded-2xl px-4 py-2.5 bg-gray-100 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
              </div>
            )}

            {/* Tombol Konfirmasi */}
            {needsConfirmation && confirmationPrompt && (
              <div className="flex items-start gap-4 max-w-4xl mx-auto">
                {/* Placeholder Avatar AI */}
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

            {/* Elemen untuk auto-scroll */}
            <div ref={messagesEndRef} />
          </main>

          {/* Footer dengan Input Form */}
          <footer className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent flex justify-center">
            <ChatInputForm
              onSubmit={(input) => handleSendMessage(input)}
              isLoading={isLoading || needsConfirmation} // Disable input saat loading atau menunggu konfirmasi
            />
          </footer>
        </>
      )}
    </div>
  );
}

