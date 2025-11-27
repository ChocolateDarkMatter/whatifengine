
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useCallback, useEffect, useRef, useState } from 'react';
import WelcomeScreen from '../welcome-screen/WelcomeScreen';
import { Modality, LiveServerContent, GoogleGenAI } from '@google/genai';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import {
  useSettings,
  useLogStore,
  useTimerStore,
  useAppStatusStore,
} from '@/lib/state';

/**
 * Renders text content with optional word highlighting for TTS sync.
 * @param text - The text to render
 * @param currentWordIndex - Index of the word currently being spoken
 * @param enableHighlight - Whether to enable word highlighting
 */
const renderContent = (text: string, currentWordIndex?: number, enableHighlight: boolean = false) => {
  // Split by **bold** text first
  const boldParts = text.split(/(\*\*.*?\*\*)/g);

  if (!enableHighlight || currentWordIndex === undefined) {
    // No highlighting - original behavior
    return boldParts.map((boldPart, boldIndex) => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
        return <strong key={boldIndex}>{boldPart.slice(2, -2)}</strong>;
      }
      return boldPart;
    });
  }

  // With highlighting - track word index as we render
  let globalWordIndex = 0;

  return boldParts.map((boldPart, boldIndex) => {
    const isBold = boldPart.startsWith('**') && boldPart.endsWith('**');
    const displayText = isBold ? boldPart.slice(2, -2) : boldPart;

    // Split into words while preserving spaces
    const wordMatches = displayText.match(/(\S+|\s+)/g) || [];

    const highlightedContent = wordMatches.map((word, wordIndex) => {
      if (word.trim() === '') {
        // Preserve whitespace
        return word;
      }

      const thisWordIndex = globalWordIndex;
      globalWordIndex++;

      // Check if this word has been spoken
      const isSpoken = thisWordIndex < currentWordIndex;
      const isCurrentWord = thisWordIndex === currentWordIndex;

      return (
        <span
          key={`${boldIndex}-${wordIndex}`}
          className={`story-word ${isSpoken ? 'spoken' : ''} ${isCurrentWord ? 'current-word' : ''}`}
        >
          {word}
        </span>
      );
    });

    if (isBold) {
      return <strong key={boldIndex}>{highlightedContent}</strong>;
    }
    return <span key={boldIndex}>{highlightedContent}</span>;
  });
};

/**
 * Count words in text (excluding markdown formatting)
 */
const countWords = (text: string): number => {
  // Remove ** markers and count non-whitespace sequences
  const cleanText = text.replace(/\*\*/g, '');
  const words = cleanText.match(/\S+/g);
  return words ? words.length : 0;
};


export default function StreamingConsole() {
  const { client, setConfig } = useLiveAPIContext();
  const { systemPrompt, voice, responseWindowDuration, storyLevel, audience } = useSettings();
  const turns = useLogStore(state => state.turns);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const { activate, deactivate } = useTimerStore();
  const { setAgentSpeaking, isAgentSpeaking } = useAppStatusStore();
  const timerRef = useRef<number | null>(null);

  // Word highlighting state
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const highlightAnimationRef = useRef<number | null>(null);
  const audioStartTimeRef = useRef<number | null>(null);
  const totalAudioDurationRef = useRef<number>(0);

  const stopResponseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    deactivate();
  }, [deactivate]);


  // Set the configuration for the Live API
  useEffect(() => {
    const getLevelDescription = (level: number): string => {
      if (level <= 2) {
        return 'The story should be extremely simple, using single-clause sentences and vocabulary a 2-3 year old can understand.';
      }
      if (level <= 4) {
        return 'The story should be simple, with basic sentence structures and vocabulary suitable for a 3-5 year old.';
      }
      if (level <= 6) {
        return 'The story can have slightly more complex sentences and a broader vocabulary, suitable for a 5-7 year old.';
      }
      if (level <= 8) {
        return 'The story should be more descriptive, with compound sentences and richer vocabulary for a 7-9 year old.';
      }
      return 'The story can be complex and nuanced, with sophisticated vocabulary and themes suitable for a child aged 10+.';
    };

    const getAudienceDescription = (audience: 'king' | 'empress' | 'both' | 'random'): string => {
      if (audience === 'empress') {
        return 'The audience is a 3-year-old girl named Empress. Tailor the story for her age and address her by name.';
      }
      if (audience === 'king') {
        return 'The audience is a 4.5-year-old boy named King. Tailor the story for his age and address him by name.';
      }
      if (audience === 'random') {
        return 'You are telling a story to an adult listener. There are no age restrictions or content limitations. Tell engaging, creative stories with mature themes if appropriate.';
      }
      return 'The audience is two children: King, a 4.5-year-old boy, and Empress, a 3-year-old girl. Please address both of them in the story.';
    };


    const finalSystemPrompt = `${systemPrompt}\n\n${getAudienceDescription(audience)}\n\nStorytelling Level: ${storyLevel}/10. ${getLevelDescription(storyLevel)}`;

    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice,
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: finalSystemPrompt,
      tools: [],
    };

    setConfig(config);
  }, [setConfig, systemPrompt, voice, storyLevel, audience]);

  const generateImage = async (storyText: string) => {
    if (!storyText || isGeneratingImage) return;

    setIsGeneratingImage(true);
    // Don't clear previous image, keep it until the new one is ready
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

      const getCharacterDescription = (audience: 'king' | 'empress' | 'both' | 'random'): string => {
        if (audience === 'empress') {
          return 'The main character is a 3-year-old girl named Empress.';
        }
        if (audience === 'king') {
          return 'The main character is a young, brown-skinned boy with curly black hair named King.';
        }
        if (audience === 'random') {
          return 'Create characters appropriate to the story being told.';
        }
        return 'The main characters are King, a young, brown-skinned boy with curly black hair, and Empress, a 3-year-old girl.';
      };


      // Step 1: Generate an image prompt from the story text
      const imagePromptResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on the following story segment, create a short, descriptive prompt for an image generation model. ${getCharacterDescription(audience)} The style should be a simple, friendly, whimsical cartoon for a young child. The prompt should only contain the description of the scene, focusing on the main characters and setting. Story segment: "${storyText}"`,
      });
      const imagePrompt = imagePromptResponse.text;

      if (imagePrompt) {
        // Step 2: Generate the image with fallback models
        const imageModels = [
          'imagen-4.0-ultra-generate-preview-06-06', // Ultra quality (separate quota)
          'imagen-4.0-generate-preview-06-06',       // Standard quality
          'imagen-4.0-generate-001',                 // Legacy fallback
        ];

        let imageResponse = null;
        let lastError = null;

        for (const model of imageModels) {
          try {
            imageResponse = await ai.models.generateImages({
              model,
              prompt: imagePrompt,
              config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
              },
            });

            if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
              const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
              const dataUrl = `data:image/png;base64,${base64ImageBytes}`;
              setImageUrl(dataUrl);
              break; // Success, exit the loop
            }
          } catch (err: any) {
            lastError = err;
            console.warn(`Failed to generate image with model ${model}:`, err.message);

            // Continue to next model if quota exhausted or model not found
            if (err.message?.includes('quota') ||
              err.message?.includes('RESOURCE_EXHAUSTED') ||
              err.message?.includes('not found')) {
              continue;
            }
            // For other errors, break the loop
            break;
          }
        }

        if (!imageResponse && lastError) {
          console.error('All image generation models failed:', lastError);
        }
      }
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      // Stop the timer as soon as the user starts a new turn
      if (!last || last.role !== 'user' || last.isFinal) {
        stopResponseTimer();
      }

      if (last && last.role === 'user' && !last.isFinal) {
        updateLastTurn({
          text: last.text + text,
          isFinal,
        });
      } else {
        addTurn({ role: 'user', text, isFinal });
      }
    };

    const handleOutputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (!last || last.role !== 'agent' || last.isFinal) {
        setAgentSpeaking(true);
      }
      if (last && last.role === 'agent' && !last.isFinal) {
        const newText = last.text + text;
        updateLastTurn({
          text: newText,
          isFinal,
        });
      } else {
        addTurn({ role: 'agent', text, isFinal });
      }
    };

    const handleContent = (serverContent: LiveServerContent) => {
      // This handles non-transcription text, but we are not expecting any.
    };

    const handleTurnComplete = () => {
      const turns = useLogStore.getState().turns;
      const last = turns.at(-1);
      if (last && !last.isFinal) {
        updateLastTurn({ isFinal: true });
        if (last.role === 'agent' && last.text) {
          setAgentSpeaking(false);
          generateImage(last.text);

          // If agent asks a question, start the response timer
          if (last.text.trim().endsWith('?')) {
            activate();
            timerRef.current = window.setTimeout(() => {
              deactivate();
              timerRef.current = null;
            }, responseWindowDuration * 1000);
          }
        }
      }
    };

    // Track audio chunks to estimate duration for word highlighting
    const handleAudio = (data: ArrayBuffer) => {
      // PCM16 at 24000 Hz: duration = samples / sampleRate
      // Each sample is 2 bytes (16-bit)
      const samples = data.byteLength / 2;
      const duration = samples / 24000; // seconds
      totalAudioDurationRef.current += duration;

      // Start animation timer on first audio chunk
      if (audioStartTimeRef.current === null) {
        audioStartTimeRef.current = performance.now();
        setCurrentWordIndex(0);
      }
    };

    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('content', handleContent);
    client.on('turncomplete', handleTurnComplete);
    client.on('audio', handleAudio);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('content', handleContent);
      client.off('turncomplete', handleTurnComplete);
      client.off('audio', handleAudio);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [client, isGeneratingImage, responseWindowDuration, activate, deactivate, stopResponseTimer, setAgentSpeaking, audience]);

  // Word highlighting animation effect
  useEffect(() => {
    // Get the current agent turn being spoken
    const lastTurn = turns[turns.length - 1];
    const isCurrentlySpeaking = lastTurn?.role === 'agent' && !lastTurn.isFinal && isAgentSpeaking;

    if (!isCurrentlySpeaking) {
      // Reset when not speaking
      if (highlightAnimationRef.current) {
        cancelAnimationFrame(highlightAnimationRef.current);
        highlightAnimationRef.current = null;
      }
      audioStartTimeRef.current = null;
      totalAudioDurationRef.current = 0;
      setCurrentWordIndex(0);
      return;
    }

    const totalWords = countWords(lastTurn.text);
    if (totalWords === 0) return;

    const animate = () => {
      if (audioStartTimeRef.current === null || !isAgentSpeaking) {
        return;
      }

      const elapsed = (performance.now() - audioStartTimeRef.current) / 1000; // seconds
      const audioDuration = totalAudioDurationRef.current;

      // Estimate progress through the text based on elapsed time vs audio duration
      // Use a minimum duration estimate if we don't have enough audio data yet
      const estimatedDuration = Math.max(audioDuration, totalWords * 0.3); // ~3.3 words/sec fallback
      const progress = Math.min(elapsed / estimatedDuration, 1);
      const wordIndex = Math.floor(progress * totalWords);

      setCurrentWordIndex(wordIndex);

      if (progress < 1 && isAgentSpeaking) {
        highlightAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    highlightAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (highlightAnimationRef.current) {
        cancelAnimationFrame(highlightAnimationRef.current);
      }
    };
  }, [turns, isAgentSpeaking]);

  useEffect(() => {
    if (scrollRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    }
  }, [turns]);

  // Additional scroll trigger for when text content changes
  useEffect(() => {
    const lastTurn = turns[turns.length - 1];
    if (lastTurn && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    }
  }, [turns.length > 0 ? turns[turns.length - 1]?.text : '']);

  const lastAgentTurnText = turns.filter(t => t.role === 'agent' && t.isFinal).pop()?.text || 'A beautiful illustration for our story.';

  const getUserLabel = () => {
    switch (audience) {
      case 'empress':
        return 'Empress:';
      case 'king':
        return 'King:';
      case 'both':
        return 'King & Empress:';
      case 'random':
        return 'Listener:';
    }
  };


  return (
    <div className="story-container">
      {turns.length === 0 ? (
        <WelcomeScreen />
      ) : (
        <>
          <div className="story-image-container">
            {isGeneratingImage && (
              <div className="image-loader-icon">
                <span className="icon">brush</span>
              </div>
            )}
            {imageUrl && <img src={imageUrl} alt={lastAgentTurnText} className="story-image" />}
            {!imageUrl && !isGeneratingImage && <div className="image-placeholder"><span className="icon">palette</span></div>}
          </div>
          <div className="story-text-container" ref={scrollRef}>
            {turns.map((t, i) => {
              // Enable highlighting for the current agent turn being spoken
              const isLastTurn = i === turns.length - 1;
              const enableHighlight = t.role === 'agent' && !t.isFinal && isLastTurn && isAgentSpeaking;
              return (
                <div
                  key={i}
                  className={`story-entry ${t.role} ${!t.isFinal ? 'interim' : ''}`}
                >
                  <div className="story-text-content">
                    <span className="story-source">
                      {t.role === 'user'
                        ? getUserLabel()
                        : t.role === 'agent'
                          ? 'Storyteller:'
                          : ''}
                    </span>
                    {renderContent(t.text, enableHighlight ? currentWordIndex : undefined, enableHighlight)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
