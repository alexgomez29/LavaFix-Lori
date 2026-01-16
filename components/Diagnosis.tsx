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
            const newHistory = [...chatHistory, { role: 'user', parts: [{ text: searchQuery }] }];
            setChatHistory(newHistory);

            const result = await sendChatMessage(chatHistory, searchQuery);
            
            setChatResponse(result.text || "No se pudo generar una respuesta.");
            
            if (result.grounding) {
                 const links = result.grounding
                    .map((chunk: any) => chunk.web?.uri ? { title: chunk.web.title, uri: chunk.web.uri } : null)
                    .filter(Boolean);
                 setGroundingLinks(links);
            }

            setChatHistory([...newHistory, { role: 'model', parts: [{ text: result.text || "" }] }]);
        } catch (error) {
            setChatResponse("Hubo un error al conectar con el asistente.");
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-light-bg dark:bg-dark-bg text-slate-800 dark:text-slate-100">
            <LiveTechnician isOpen={isLiveOpen} onClose={() => setIsLiveOpen(false)} />

            {/* Header */}
            <header className="flex items-center justify-between glass-panel px-8 py-4 sticky top-0 z-50">
                <Link to="/" className="flex items-center gap-3 group">
                    <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">LavaFix</h2>
                </Link>
                <Link className="px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-bold text-slate-500" to="/">Volver</Link>
            </header>

            <main className="flex-1 flex flex-col items-center py-12 px-4 relative">
                <div className="w-full max-w-4xl relative z-10">
                    <div className="py-8 text-center">
                        <h1 className="text-5xl font-black mb-4 tracking-tight dark:text-white">
                            Centro de <span className="text-gradient">Diagnóstico</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                            Potenciado por Gemini Pro para identificar problemas técnicos con precisión milimétrica.
                        </p>
                    </div>

                    {/* Search / Chat Input */}
                    <div className="py-8 relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition duration-500"></div>
                        <form onSubmit={handleSearch} className="flex w-full items-center bg-white dark:bg-slate-800 rounded-2xl p-2 shadow-2xl relative z-10 border border-slate-100 dark:border-slate-700">
                            <input 
                                className="flex-1 bg-transparent border-none text-lg px-4 py-3 dark:text-white placeholder:text-slate-400 focus:ring-0" 
                                placeholder="Describe el problema (ej. Lavadora hace ruido metálico...)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button type="submit" className="bg-gradient-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2">
                                {isTyping ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span>Analizar</span>}
                            </button>
                        </form>
                    </div>

                    {/* Chat Response Area */}
                    {(chatResponse || isTyping) && (
                        <div className="glass rounded-2xl p-8 border border-primary/20 shadow-glow mb-10 animate-float" style={{ animationDuration: '0s', animation: 'none' }}>
                            <div className="flex gap-6">
                                <div className="h-12 w-12 bg-gradient-primary rounded-full flex items-center justify-center shrink-0 shadow-lg text-white">
                                    <span className="material-symbols-outlined text-2xl">smart_toy</span>
                                </div>
                                <div className="flex-1 space-y-4">
                                    <h3 className="text-xl font-bold dark:text-white">Diagnóstico IA</h3>
                                    {isTyping ? (
                                        <div className="flex gap-2">
                                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></div>
                                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></div>
                                        </div>
                                    ) : (
                                        <div className="prose prose-slate dark:prose-invert max-w-none leading-relaxed">
                                            {chatResponse}
                                        </div>
                                    )}
                                    
                                    {groundingLinks.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                            {groundingLinks.map((link, idx) => (
                                                <a key={idx} href={link.uri} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors">
                                                    <span className="material-symbols-outlined text-sm">link</span>
                                                    {link.title || "Fuente Web"}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Live Expert Card */}
                        <div className="bg-dark-surface rounded-3xl p-8 relative overflow-hidden group shadow-2xl border border-slate-700">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/30 transition-colors"></div>
                            <div className="relative z-10">
                                <div className="h-14 w-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                                    <span className="material-symbols-outlined text-3xl text-primary">video_call</span>
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Soporte en Vivo</h3>
                                <p className="text-slate-400 mb-8 leading-relaxed">Conéctate con nuestra IA multimodal para recibir instrucciones paso a paso mediante video en tiempo real.</p>
                                <button 
                                    onClick={() => setIsLiveOpen(true)}
                                    className="w-full bg-white text-dark-bg font-bold py-4 rounded-xl hover:scale-[1.02] transition-transform shadow-xl flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">play_circle</span>
                                    Iniciar Sesión
                                </button>
                            </div>
                        </div>

                        {/* Quick Tools */}
                        <div className="glass rounded-3xl p-8 border border-white/10 shadow-xl">
                            <h3 className="text-lg font-bold dark:text-white mb-6">Acceso Rápido</h3>
                            <div className="grid grid-cols-2 gap-4 h-full max-h-[200px]">
                                <Link to="/devices" className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all group">
                                    <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-primary transition-colors">kitchen</span>
                                    <span className="font-bold text-sm text-slate-600 dark:text-slate-300">Mis Equipos</span>
                                </Link>
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-secondary/5 border border-transparent hover:border-secondary/20 transition-all cursor-pointer group">
                                    <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-secondary transition-colors">upload_file</span>
                                    <span className="font-bold text-sm text-slate-600 dark:text-slate-300">Manuales</span>
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