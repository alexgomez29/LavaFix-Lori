import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { sendChatMessage } from '../services/geminiService';
import LiveTechnician from './LiveTechnician';

const Diagnosis = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [chatHistory, setChatHistory] = useState<{role: string, parts: {text: string}[]}[]>([]);
    const [chatResponse, setChatResponse] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isLiveOpen, setIsLiveOpen] = useState(false);
    const [groundingLinks, setGroundingLinks] = useState<any[]>([]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsTyping(true);
        setChatResponse(null);
        setGroundingLinks([]);

        try {
            // Add user message to history
            const newHistory = [...chatHistory, { role: 'user', parts: [{ text: searchQuery }] }];
            setChatHistory(newHistory);

            const result = await sendChatMessage(chatHistory, searchQuery);
            
            setChatResponse(result.text || "No se pudo generar una respuesta.");
            
            // Extract links from grounding chunks
            if (result.grounding) {
                 const links = result.grounding
                    .map((chunk: any) => chunk.web?.uri ? { title: chunk.web.title, uri: chunk.web.uri } : null)
                    .filter(Boolean);
                 setGroundingLinks(links);
            }

            // Update history with model response
            setChatHistory([...newHistory, { role: 'model', parts: [{ text: result.text || "" }] }]);
        } catch (error) {
            console.error(error);
            setChatResponse("Hubo un error al conectar con el asistente.");
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
            <LiveTechnician isOpen={isLiveOpen} onClose={() => setIsLiveOpen(false)} />

            {/* Header */}
            <header className="flex items-center justify-between border-b border-[#e5e7e7] dark:border-[#1e3a36] bg-white dark:bg-background-dark px-6 py-3 sticky top-0 z-50">
                <Link to="/" className="flex items-center gap-4">
                    <div className="bg-primary rounded-lg p-1">
                        <span className="material-symbols-outlined text-[#10221f]">rocket_launch</span>
                    </div>
                    <h2 className="text-[#111817] dark:text-white text-xl font-black">LavaFix</h2>
                </Link>
                <div className="flex gap-4">
                     <Link className="text-[#111817] dark:text-white hover:text-primary pt-2" to="/">Volver</Link>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center py-8 px-4">
                <div className="w-full max-w-4xl">
                    <div className="py-4 text-center">
                        <h1 className="text-[#111817] dark:text-white text-4xl font-black mb-2">Centro de Diagnóstico AI</h1>
                        <p className="text-[#608a83] text-lg">Identifique y solucione problemas con Gemini Pro.</p>
                    </div>

                    {/* Search / Chat Input */}
                    <div className="py-6">
                        <form onSubmit={handleSearch} className="flex w-full items-stretch rounded-xl h-16 shadow-lg overflow-hidden relative z-10">
                            <div className="text-[#608a83] flex bg-white dark:bg-[#1e3a36] items-center justify-center pl-5">
                                <span className="material-symbols-outlined">search</span>
                            </div>
                            <input 
                                className="flex-1 border-none bg-white dark:bg-[#1e3a36] text-[#111817] dark:text-white focus:ring-0 px-4 text-lg outline-none" 
                                placeholder="Describe el problema (ej. Lavadora hace ruido metálico)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button type="submit" className="bg-primary text-[#10221f] px-8 font-bold hover:brightness-95 transition-all">
                                {isTyping ? <span className="material-symbols-outlined animate-spin">refresh</span> : "Analizar"}
                            </button>
                        </form>
                    </div>

                    {/* Chat Response Area */}
                    {(chatResponse || isTyping) && (
                        <div className="bg-white dark:bg-[#1e3a36] p-6 rounded-xl border border-primary/20 shadow-sm mb-8 animate-fade-in">
                            <div className="flex items-start gap-4">
                                <div className="size-10 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-primary">smart_toy</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-[#111817] dark:text-white mb-2">Diagnóstico Preliminar</h3>
                                    {isTyping ? (
                                        <div className="flex gap-2 h-6 items-center">
                                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></div>
                                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></div>
                                        </div>
                                    ) : (
                                        <div className="prose dark:prose-invert max-w-none text-sm text-[#111817] dark:text-gray-200 whitespace-pre-line">
                                            {chatResponse}
                                        </div>
                                    )}
                                    
                                    {/* Grounding Sources */}
                                    {groundingLinks.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                            <p className="text-xs font-bold text-[#608a83] mb-2 uppercase">Fuentes encontradas</p>
                                            <div className="flex flex-wrap gap-2">
                                                {groundingLinks.map((link, idx) => (
                                                    <a key={idx} href={link.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-[#f0f5f4] dark:bg-[#152a26] px-3 py-1.5 rounded-full text-xs hover:bg-primary/20 transition-colors text-primary truncate max-w-xs">
                                                        <span className="material-symbols-outlined text-xs">public</span>
                                                        {link.title || "Fuente Web"}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Live Expert Card */}
                        <div className="bg-[#111817] text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <span className="material-symbols-outlined text-8xl">support_agent</span>
                            </div>
                            <h3 className="text-xl font-bold mb-2">¿Necesita ayuda en vivo?</h3>
                            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Conéctese con nuestro Técnico AI por video y voz para una guía paso a paso.</p>
                            <button 
                                onClick={() => setIsLiveOpen(true)}
                                className="w-full bg-primary text-[#111817] font-black py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                            >
                                <span className="material-symbols-outlined">video_call</span>
                                Iniciar Videollamada AI
                            </button>
                        </div>

                        {/* Quick Tools */}
                        <div className="bg-white dark:bg-[#1e3a36] p-6 rounded-xl border border-[#e5e7e7] dark:border-white/10 shadow-sm">
                            <h3 className="text-[#111817] dark:text-white font-bold mb-4">Herramientas Rápidas</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <Link to="/devices" className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-background-light dark:bg-background-dark/50 hover:bg-primary/10 transition-colors group">
                                    <span className="material-symbols-outlined text-3xl text-[#608a83] group-hover:text-primary">kitchen</span>
                                    <span className="font-bold text-xs text-center dark:text-white">Mis Equipos</span>
                                </Link>
                                <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-background-light dark:bg-background-dark/50 hover:bg-primary/10 transition-colors group cursor-pointer">
                                    <span className="material-symbols-outlined text-3xl text-[#608a83] group-hover:text-primary">upload_file</span>
                                    <span className="font-bold text-xs text-center dark:text-white">Subir Manual</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Diagnosis;
