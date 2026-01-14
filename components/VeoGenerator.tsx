import React, { useState } from 'react';
import { generateVeoVideo } from '../services/geminiService';

interface VeoGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    baseImage?: string;
}

const VeoGenerator: React.FC<VeoGeneratorProps> = ({ isOpen, onClose, baseImage }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            // API Key Check for Veo
            if (window.aistudio && window.aistudio.hasSelectedApiKey) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (!hasKey) {
                    await window.aistudio.openSelectKey();
                }
            }

            // Remove header from base64 if present for image-to-video
            let cleanBase64 = baseImage;
            if (baseImage && baseImage.includes(',')) {
                cleanBase64 = baseImage.split(',')[1];
            }

            const url = await generateVeoVideo(prompt, cleanBase64);
            setVideoUrl(url);
        } catch (error) {
            console.error("Veo Error:", error);
            alert("Error generando video. Asegúrate de tener una llave API válida seleccionada.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#152a26] rounded-xl w-full max-w-lg p-6 border border-[#2a3e3b]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">movie</span>
                        Generador de Video Veo
                    </h3>
                    <button onClick={onClose} className="text-[#608a83] hover:text-primary">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {baseImage && (
                    <div className="mb-4">
                        <p className="text-xs font-bold text-[#608a83] mb-2 uppercase">Imagen Base</p>
                        <img src={baseImage} alt="Base" className="h-32 object-contain rounded-lg border border-gray-700" />
                    </div>
                )}

                <div className="mb-4">
                    <label className="text-sm font-bold dark:text-white mb-2 block">Prompt de Video</label>
                    <textarea 
                        className="w-full bg-[#f0f5f4] dark:bg-[#10221f] border border-[#dbe6e4] dark:border-[#2a3e3b] rounded-lg p-3 text-sm dark:text-white focus:ring-2 focus:ring-primary h-24"
                        placeholder={baseImage ? "Describe cómo animar esta imagen (ej. El agua debe fluir...)" : "Describe el video de reparación que necesitas..."}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                </div>

                {videoUrl ? (
                    <div className="mb-6">
                         <p className="text-xs font-bold text-primary mb-2 uppercase">Video Generado</p>
                         <video src={videoUrl} controls className="w-full rounded-lg" autoPlay loop />
                    </div>
                ) : null}

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-[#608a83] hover:bg-gray-100 dark:hover:bg-[#1e3631] rounded-lg">Cancelar</button>
                    <button 
                        onClick={handleGenerate} 
                        disabled={isGenerating || !prompt}
                        className={`px-4 py-2 bg-primary text-[#111817] text-sm font-bold rounded-lg flex items-center gap-2 ${isGenerating ? 'opacity-50' : 'hover:opacity-90'}`}
                    >
                        {isGenerating ? (
                            <><span className="material-symbols-outlined animate-spin text-sm">refresh</span> Generando...</>
                        ) : (
                            <><span className="material-symbols-outlined text-sm">auto_awesome</span> Generar Video</>
                        )}
                    </button>
                </div>
                
                <p className="mt-4 text-[10px] text-[#608a83] text-center">
                    Potenciado por Veo 3.1. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-primary">Requiere facturación activada.</a>
                </p>
            </div>
        </div>
    );
};

export default VeoGenerator;
