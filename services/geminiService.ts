import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// --- Helpers ---

export const getGeminiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Services ---

// 1. Chatbot (Gemini 3 Pro) with Search Grounding
export const sendChatMessage = async (history: {role: string, parts: {text: string}[]}[], message: string) => {
    const ai = getGeminiClient();
    const chat = ai.chats.create({
        model: 'gemini-3-pro-preview',
        history: history,
        config: {
            tools: [{ googleSearch: {} }],
            systemInstruction: "You are LavaFix's expert AI technician. Help users diagnose appliance issues, find parts, and offer maintenance advice. Keep answers concise and helpful."
        }
    });

    const result = await chat.sendMessage({ message });
    
    // Extract text and grounding metadata
    const text = result.text;
    const grounding = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return { text, grounding };
};

// 2. Video Understanding (Gemini 3 Pro)
export const analyzeApplianceVideo = async (base64Video: string, mimeType: string, prompt: string) => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Video } },
                { text: prompt }
            ]
        }
    });
    return response.text;
};

// 3. Audio Transcription (Gemini 3 Flash)
export const transcribeAudio = async (base64Audio: string, mimeType: string) => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Audio } },
                { text: "Transcribe this audio exactly as spoken." }
            ]
        }
    });
    return response.text;
};

// 4. Text to Speech (Gemini 2.5 Flash TTS)
export const generateSpeech = async (text: string) => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
};

// 5. Image Editing (Gemini 2.5 Flash Image)
export const editApplianceImage = async (base64Image: string, prompt: string) => {
    const ai = getGeminiClient();
    // Using generateContent for nano banana series as per guidelines for editing/generation
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: prompt },
            ],
        },
    });

    // Iterate to find image part
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    return null;
};

// 6. Maps Grounding (Gemini 2.5 Flash)
export const findRepairShops = async (latitude: number, longitude: number, query: string) => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                    latLng: { latitude, longitude }
                }
            }
        },
    });
    
    return {
        text: response.text,
        chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
};

// 7. Veo Video Generation (Veo 3.1 Fast)
export const generateVeoVideo = async (prompt: string, imageBase64?: string) => {
    const ai = getGeminiClient(); // Make sure to call this AFTER key selection
    
    let operation;
    
    if (imageBase64) {
        // Image-to-Video
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt || "Animate this naturally.",
            image: {
                imageBytes: imageBase64,
                mimeType: 'image/jpeg' // Assuming jpeg for simplicity, can make dynamic
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });
    } else {
        // Text-to-Video
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });
    }

    // Polling
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
        return `${videoUri}&key=${process.env.API_KEY}`;
    }
    return null;
};
