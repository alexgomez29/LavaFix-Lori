import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface LiveTechnicianProps {
    isOpen: boolean;
    onClose: () => void;
}

const LiveTechnician: React.FC<LiveTechnicianProps> = ({ isOpen, onClose }) => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [volume, setVolume] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const sessionRef = useRef<any>(null);

    useEffect(() => {
        if (isOpen) {
            startSession();
        } else {
            stopSession();
        }
        return () => stopSession();
    }, [isOpen]);

    const startSession = async () => {
        try {
            setStatus('connecting');
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Audio Contexts
            inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            
            const outputNode = outputAudioContextRef.current.createGain();
            outputNode.connect(outputAudioContextRef.current.destination);

            // Microphone
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 640, height: 360 } });
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                callbacks: {
                    onopen: () => {
                        setStatus('connected');
                        
                        // Handle Audio Input
                        if (!inputAudioContextRef.current || !streamRef.current) return;
                        const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            
                            // Visualization logic
                            let sum = 0;
                            for(let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
                            setVolume(Math.min((sum / inputData.length) * 500, 100));

                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);

                        // Handle Video Input (Frames)
                        const intervalId = window.setInterval(() => {
                            if (!videoRef.current || !canvasRef.current) return;
                            const ctx = canvasRef.current.getContext('2d');
                            if (!ctx) return;
                            
                            canvasRef.current.width = videoRef.current.videoWidth;
                            canvasRef.current.height = videoRef.current.videoHeight;
                            ctx.drawImage(videoRef.current, 0, 0);
                            
                            const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                            sessionPromise.then(session => session.sendRealtimeInput({ 
                                media: { mimeType: 'image/jpeg', data: base64 } 
                            }));
                        }, 1000); // 1 FPS for efficiency
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const ctx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            
                            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                            
                            source.onended = () => sourcesRef.current.delete(source);
                        }
                    },
                    onclose: () => setStatus('idle'),
                    onerror: (e) => console.error(e)
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                    systemInstruction: "You are an expert appliance repair technician from LavaFix. You are looking at a video stream from the user. Be helpful, concise, and friendly. Guide them to fix their appliance."
                }
            });
            sessionRef.current = sessionPromise;

        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    const stopSession = () => {
        if (sessionRef.current) {
            sessionRef.current.then((s: any) => s.close());
        }
        streamRef.current?.getTracks().forEach(t => t.stop());
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        setStatus('idle');
    };

    // Utils
    const createBlob = (data: Float32Array) => {
        const int16 = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
        const binary = String.fromCharCode(...new Uint8Array(int16.buffer));
        return { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' };
    };

    const decode = (base64: string) => {
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    };

    const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, rate: number, channels: number) => {
        const int16 = new Int16Array(data.buffer);
        const buffer = ctx.createBuffer(channels, int16.length / channels, rate);
        for (let c = 0; c < channels; c++) {
            const chData = buffer.getChannelData(c);
            for (let i = 0; i < buffer.length; i++) chData[i] = int16[i * channels + c] / 32768.0;
        }
        return buffer;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#10221f] rounded-2xl w-full max-w-2xl overflow-hidden border border-[#27f1d0]/30 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-[#27f1d0] z-20">
                    <span className="material-symbols-outlined text-3xl">close</span>
                </button>
                
                <div className="relative aspect-video bg-black">
                    <video ref={videoRef} className="w-full h-full object-cover opacity-80" muted playsInline />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {status === 'connecting' && <div className="text-[#27f1d0] font-bold text-xl animate-pulse">Conectando con Técnico...</div>}
                        {status === 'connected' && (
                            <div className="flex flex-col items-center gap-4">
                                <div className={`w-24 h-24 rounded-full border-4 border-[#27f1d0] flex items-center justify-center transition-all duration-100`}
                                     style={{ transform: `scale(${1 + volume / 100})`, boxShadow: `0 0 ${volume}px #27f1d0` }}>
                                    <span className="material-symbols-outlined text-5xl text-[#27f1d0]">support_agent</span>
                                </div>
                                <div className="bg-black/50 px-4 py-2 rounded-full text-[#27f1d0] text-sm font-bold backdrop-blur-md">
                                    En vivo • Técnico AI
                                </div>
                            </div>
                        )}
                        {status === 'error' && <div className="text-red-500 font-bold">Error de conexión</div>}
                    </div>
                </div>

                <div className="p-6 bg-[#152a26] border-t border-[#2a3e3b]">
                    <h3 className="text-white text-lg font-bold mb-2">Diagnóstico en Tiempo Real</h3>
                    <p className="text-[#608a83] text-sm">El técnico está viendo y escuchando. Muestra el electrodoméstico y describe el problema.</p>
                </div>
            </div>
        </div>
    );
};

export default LiveTechnician;
