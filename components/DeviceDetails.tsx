import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { findRepairShops, generateSpeech, editApplianceImage, transcribeAudio, analyzeApplianceVideo } from '../services/geminiService';
import VeoGenerator from './VeoGenerator';

const DeviceDetails = () => {
    // State for Maps Grounding
    const [shops, setShops] = useState<any[]>([]);
    const [isLoadingShops, setIsLoadingShops] = useState(false);

    // State for TTS
    const [isPlayingTTS, setIsPlayingTTS] = useState(false);

    // State for Image Editing
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for Veo
    const [isVeoOpen, setIsVeoOpen] = useState(false);

    // State for Audio
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleFindShops = async () => {
        setIsLoadingShops(true);
        try {
            // Mock location for demo purposes if geolocation fails or is denied
            const lat = 40.7128; 
            const lng = -74.0060;
            
            // In a real app, use navigator.geolocation.getCurrentPosition
            
            const result = await findRepairShops(lat, lng, "Repair shops for washing machines nearby");
            
            // Extract map links
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
            const text = "Consejo Pro: Limpie el filtro de la bomba cada 3 meses para evitar olores y bloqueos. Revise las mangueras anualmente.";
            const audioData = await generateSpeech(text);
            if (audioData) {
                const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
                audio.onended = () => setIsPlayingTTS(false);
                audio.play();
            } else {
                setIsPlayingTTS(false);
            }
        } catch (e) {
            console.error(e);
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
            // Strip header
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

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' }); // Gemini handles many formats
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
        <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
            <VeoGenerator isOpen={isVeoOpen} onClose={() => setIsVeoOpen(false)} baseImage={selectedImage || undefined} />

            <header className="flex items-center justify-between border-b border-[#e5eaea] dark:border-[#1e3a36] bg-white dark:bg-[#10221f] px-6 py-3 sticky top-0 z-50">
                 <div className="flex items-center gap-4">
                     <Link to="/" className="text-xl font-bold dark:text-white">LavaFix</Link>
                     <nav className="flex gap-4 ml-8">
                         <Link to="/devices" className="text-primary text-sm font-bold">Detalles</Link>
                         <Link to="/diagnosis" className="text-[#608a83] hover:text-primary text-sm">Diagnóstico</Link>
                     </nav>
                 </div>
            </header>

            <main className="flex-1 px-4 lg:px-20 py-8 max-w-7xl mx-auto w-full">
                {/* Device Header */}
                <div className="flex flex-wrap justify-between items-end gap-4 pb-6 border-b border-[#e5eaea] dark:border-[#1e3a36]">
                    <div className="flex items-center gap-5">
                        <div className="size-20 bg-white dark:bg-[#1e3a36] rounded-xl flex items-center justify-center border border-[#e5eaea] dark:border-[#2a4d48] shadow-sm">
                            <span className="material-symbols-outlined text-4xl text-primary">local_laundry_service</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h1 className="text-3xl font-black tracking-tight dark:text-white">Lavadora Principal</h1>
                            <p className="text-orange-400 text-sm font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">warning</span> Requiere Atención
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={handleFindShops}
                            disabled={isLoadingShops}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white dark:bg-[#1e3a36] border border-[#e5eaea] dark:border-[#2a4d48] text-sm font-bold shadow-sm hover:bg-gray-50 dark:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm text-red-500">location_on</span>
                            {isLoadingShops ? "Buscando..." : "Buscar Técnicos"}
                        </button>
                        <button 
                            onClick={() => setIsVeoOpen(true)}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-[#111817] text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90"
                        >
                            <span className="material-symbols-outlined text-sm">movie_filter</span> 
                            Generar Video Ayuda
                        </button>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                    {/* Left Column: Info & Tools */}
                    <div className="space-y-6">
                        {/* Audio Note */}
                        <div className="bg-white dark:bg-[#152a26] p-4 rounded-xl border border-[#2a3e3b]">
                            <h3 className="font-bold text-sm mb-3 dark:text-white">Nota de Voz</h3>
                            <button 
                                onClick={toggleRecording}
                                className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors ${isRecording ? 'bg-red-500 text-white' : 'bg-[#f0f5f4] dark:bg-[#1e3a36] text-[#608a83]'}`}
                            >
                                <span className="material-symbols-outlined">{isRecording ? 'stop_circle' : 'mic'}</span>
                                {isRecording ? 'Detener Grabación' : 'Grabar Problema'}
                            </button>
                            {transcription && (
                                <div className="mt-3 p-3 bg-primary/10 rounded-lg text-xs dark:text-white italic">
                                    "{transcription}"
                                </div>
                            )}
                        </div>

                        {/* Maps Results */}
                        {shops.length > 0 && (
                            <div className="bg-white dark:bg-[#152a26] p-4 rounded-xl border border-[#2a3e3b]">
                                <h3 className="font-bold text-sm mb-3 dark:text-white">Talleres Cercanos</h3>
                                <div className="space-y-3">
                                    {shops.map((shop, i) => (
                                        <a key={i} href={shop.uri} target="_blank" rel="noreferrer" className="block p-3 bg-[#f0f5f4] dark:bg-[#1e3a36] rounded-lg hover:bg-primary/10">
                                            <p className="font-bold text-sm dark:text-white truncate">{shop.title}</p>
                                            <p className="text-xs text-[#608a83]">{shop.rating}</p>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pro Tip TTS */}
                        <div className="bg-gradient-to-br from-primary/20 to-transparent p-5 rounded-xl border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-primary">lightbulb</span>
                                <h3 className="font-bold text-sm dark:text-white">Consejo Pro</h3>
                            </div>
                            <p className="text-xs text-[#608a83] mb-4">Mantenimiento preventivo para la bomba de drenaje.</p>
                            <button 
                                onClick={handlePlayTip}
                                disabled={isPlayingTTS}
                                className="flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                            >
                                <span className="material-symbols-outlined text-sm">{isPlayingTTS ? 'volume_up' : 'play_circle'}</span>
                                {isPlayingTTS ? 'Reproduciendo...' : 'Escuchar Consejo'}
                            </button>
                        </div>
                    </div>

                    {/* Middle: Image AI */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-[#152a26] rounded-xl border border-[#2a3e3b] p-6">
                            <h3 className="text-lg font-bold dark:text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">auto_fix</span>
                                Análisis y Edición Visual
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-video bg-[#f0f5f4] dark:bg-[#1e3a36] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
                                    >
                                        {selectedImage ? (
                                            <img src={selectedImage} alt="Uploaded" className="w-full h-full object-contain" />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-4xl text-[#608a83] mb-2">add_photo_alternate</span>
                                                <p className="text-xs font-bold text-[#608a83]">Subir foto del daño</p>
                                            </>
                                        )}
                                    </div>
                                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                                </div>

                                <div className="flex flex-col gap-4">
                                    <textarea
                                        className="w-full bg-[#f0f5f4] dark:bg-[#1e3a36] border-none rounded-lg p-3 text-sm dark:text-white focus:ring-2 focus:ring-primary h-24 resize-none"
                                        placeholder="Instrucción IA: 'Resalta el óxido', 'Muestra cómo se vería limpio', 'Identifica la pieza'..."
                                        value={editPrompt}
                                        onChange={(e) => setEditPrompt(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleEditImage}
                                            disabled={!selectedImage || isEditing}
                                            className="flex-1 bg-primary text-[#111817] py-2 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50"
                                        >
                                            {isEditing ? "Procesando..." : "Editar con Gemini"}
                                        </button>
                                        <button 
                                            onClick={() => setIsVeoOpen(true)}
                                            disabled={!selectedImage}
                                            className="flex-1 border border-primary text-primary py-2 rounded-lg font-bold text-sm hover:bg-primary/10 disabled:opacity-50"
                                        >
                                            Animar (Veo)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {editedImage && (
                                <div className="mt-6 border-t border-gray-100 dark:border-gray-700 pt-6">
                                    <h4 className="text-sm font-bold dark:text-white mb-2">Resultado IA</h4>
                                    <img src={editedImage} alt="Edited" className="rounded-lg max-h-64 object-contain border border-primary/50" />
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
