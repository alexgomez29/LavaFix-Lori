import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { findRepairShops, generateSpeech, editApplianceImage, transcribeAudio } from '../services/geminiService';
import VeoGenerator from './VeoGenerator';

const DeviceDetails = () => {
    const [shops, setShops] = useState<any[]>([]);
    const [isLoadingShops, setIsLoadingShops] = useState(false);
    const [isPlayingTTS, setIsPlayingTTS] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isVeoOpen, setIsVeoOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleFindShops = async () => {
        setIsLoadingShops(true);
        try {
            const result = await findRepairShops(40.7128, -74.0060, "Repair shops for washing machines nearby");
            const places = result.chunks
                .filter((chunk: any) => chunk.maps)
                .map((chunk: any) => ({
                    title: chunk.maps.title,
                    uri: chunk.maps.uri,
                    rating: chunk.maps.placeAnswerSources?.reviewSnippets?.[0]?.reviewText || "Sin reseñas"
                }));
            setShops(places);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingShops(false);
        }
    };

    const handlePlayTip = async () => {
        if (isPlayingTTS) return;
        setIsPlayingTTS(true);
        try {
            const text = "Consejo Pro: Limpie el filtro de la bomba cada 3 meses para evitar olores y bloqueos.";
            const audioData = await generateSpeech(text);
            if (audioData) {
                const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
                audio.onended = () => setIsPlayingTTS(false);
                audio.play();
            } else {
                setIsPlayingTTS(false);
            }
        } catch (e) {
            setIsPlayingTTS(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setSelectedImage(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleEditImage = async () => {
        if (!selectedImage || !editPrompt) return;
        setIsEditing(true);
        try {
            const base64 = selectedImage.split(',')[1];
            const result = await editApplianceImage(base64, editPrompt);
            if (result) setEditedImage(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsEditing(false);
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
        } else {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64 = (reader.result as string).split(',')[1];
                    const text = await transcribeAudio(base64, 'audio/mp3');
                    setTranscription(text);
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            setIsRecording(true);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-light-bg dark:bg-dark-bg text-slate-800 dark:text-slate-100 font-sans">
            <VeoGenerator isOpen={isVeoOpen} onClose={() => setIsVeoOpen(false)} baseImage={selectedImage || undefined} />

            <header className="flex items-center justify-between glass-panel px-8 py-4 sticky top-0 z-50">
                 <div className="flex items-center gap-6">
                     <Link to="/" className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">LavaFix</Link>
                     <nav className="flex gap-4">
                         <Link to="/devices" className="text-primary font-bold text-sm bg-primary/10 px-3 py-1 rounded-lg">Detalles</Link>
                         <Link to="/diagnosis" className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-sm font-medium px-3 py-1">Diagnóstico</Link>
                     </nav>
                 </div>
            </header>

            <main className="flex-1 px-4 lg:px-20 py-10 max-w-7xl mx-auto w-full relative">
                <div className="flex flex-wrap justify-between items-end gap-6 pb-8 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-6">
                        <div className="h-24 w-24 bg-gradient-to-br from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-xl">
                            <span className="material-symbols-outlined text-5xl text-primary drop-shadow-lg">local_laundry_service</span>
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tight dark:text-white mb-2">Lavadora Principal</h1>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">
                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                <span className="text-xs font-bold uppercase tracking-wide">Requiere Atención</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={handleFindShops}
                            disabled={isLoadingShops}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-rose-500">location_on</span>
                            {isLoadingShops ? "Buscando..." : "Buscar Técnicos"}
                        </button>
                        <button 
                            onClick={() => setIsVeoOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-white font-bold shadow-lg shadow-primary/30 hover:scale-[1.02] transition-transform"
                        >
                            <span className="material-symbols-outlined">movie_filter</span> 
                            Video Ayuda (Veo)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
                    <div className="space-y-6">
                        <div className="glass p-6 rounded-2xl border border-white/20">
                            <h3 className="font-bold text-sm mb-4 dark:text-white uppercase tracking-wider">Nota de Voz</h3>
                            <button 
                                onClick={toggleRecording}
                                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-md ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                <span className="material-symbols-outlined">{isRecording ? 'stop_circle' : 'mic'}</span>
                                {isRecording ? 'Grabando...' : 'Grabar Problema'}
                            </button>
                            {transcription && (
                                <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-xl text-sm italic text-slate-600 dark:text-slate-300">
                                    "{transcription}"
                                </div>
                            )}
                        </div>

                        {shops.length > 0 && (
                            <div className="glass p-6 rounded-2xl border border-white/20">
                                <h3 className="font-bold text-sm mb-4 dark:text-white uppercase tracking-wider">Talleres</h3>
                                <div className="space-y-3">
                                    {shops.map((shop, i) => (
                                        <a key={i} href={shop.uri} target="_blank" rel="noreferrer" className="block p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-primary/5 transition-colors group border border-transparent hover:border-primary/20">
                                            <p className="font-bold text-sm dark:text-white group-hover:text-primary transition-colors">{shop.title}</p>
                                            <div className="flex gap-1 mt-1 text-yellow-500 text-xs"><span className="material-symbols-outlined text-sm">star</span> {shop.rating}</div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-gradient-to-br from-secondary/20 to-primary/20 p-6 rounded-2xl border border-primary/10 relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 blur-xl rounded-full -mr-10 -mt-10"></div>
                            <div className="flex items-center gap-2 mb-3 relative z-10">
                                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm"><span className="material-symbols-outlined text-primary text-sm">lightbulb</span></div>
                                <h3 className="font-bold text-sm dark:text-white uppercase tracking-wider">Consejo Pro</h3>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 relative z-10 leading-relaxed">Mantenimiento preventivo para la bomba de drenaje. Limpiar filtro cada 3 meses.</p>
                            <button 
                                onClick={handlePlayTip}
                                disabled={isPlayingTTS}
                                className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary-dark relative z-10"
                            >
                                <span className="material-symbols-outlined text-lg">{isPlayingTTS ? 'volume_up' : 'play_circle'}</span>
                                Escuchar
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="glass p-8 rounded-3xl border border-white/20 h-full">
                            <h3 className="text-xl font-bold dark:text-white mb-6 flex items-center gap-3">
                                <span className="p-2 bg-gradient-primary rounded-lg text-white shadow-lg"><span className="material-symbols-outlined">auto_fix</span></span>
                                Estudio IA
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-video bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group relative overflow-hidden"
                                >
                                    {selectedImage ? (
                                        <img src={selectedImage} alt="Uploaded" className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <div className="text-center">
                                            <span className="material-symbols-outlined text-5xl text-slate-300 group-hover:text-primary transition-colors mb-3">add_photo_alternate</span>
                                            <p className="text-sm font-bold text-slate-400 group-hover:text-primary">Subir Evidencia</p>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />

                                <div className="flex flex-col gap-4">
                                    <textarea
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent h-32 resize-none transition-shadow"
                                        placeholder="Describe qué quieres que la IA analice o edite (ej. 'Resalta el área oxidada')..."
                                        value={editPrompt}
                                        onChange={(e) => setEditPrompt(e.target.value)}
                                    />
                                    <div className="flex gap-3 mt-auto">
                                        <button 
                                            onClick={handleEditImage}
                                            disabled={!selectedImage || isEditing}
                                            className="flex-1 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                                        >
                                            {isEditing ? "Procesando..." : "Editar (Gemini)"}
                                        </button>
                                        <button 
                                            onClick={() => setIsVeoOpen(true)}
                                            disabled={!selectedImage}
                                            className="flex-1 bg-gradient-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/30 hover:scale-105 transition-transform disabled:opacity-50 disabled:transform-none"
                                        >
                                            Animar (Veo)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {editedImage && (
                                <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-8 animate-float" style={{ animationDuration: '0s', animation: 'none' }}>
                                    <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider">Resultado Generado</h4>
                                    <div className="rounded-2xl overflow-hidden shadow-2xl border border-primary/20">
                                        <img src={editedImage} alt="Edited" className="w-full h-auto object-cover" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DeviceDetails;