
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

const renderContent = (text: string) => {
  // Split by **bold** text
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((boldPart, boldIndex) => {
    if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
      return <strong key={boldIndex}>{boldPart.slice(2, -2)}</strong>;
    }
    return boldPart;
  });
};


export default function StreamingConsole() {
  const { client, setConfig } = useLiveAPIContext();
  const { systemPrompt, voice, responseWindowDuration, storyLevel, audience } = useSettings();
  const turns = useLogStore(state => state.turns);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const { activate, deactivate } = useTimerStore();
  const { setAgentSpeaking } = useAppStatusStore();
  const timerRef = useRef<number | null>(null);

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

    const getAudienceDescription = (audience: 'king' | 'empress' | 'both'): string => {
      if (audience === 'empress') {
        return 'The audience is a 3-year-old girl named Empress. Tailor the story for her age and address her by name.';
      }
      if (audience === 'king') {
        return 'The audience is a 4.5-year-old boy named King. Tailor the story for his age and address him by name.';
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

      const getCharacterDescription = (audience: 'king' | 'empress' | 'both'): string => {
        if (audience === 'empress') {
          return 'The main character is a 3-year-old girl named Empress.';
        }
        if (audience === 'king') {
          return 'The main character is a young, brown-skinned boy with curly black hair named King.';
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
        // Step 2: Generate the image
        const imageResponse = await ai.models.generateImages({
          model: 'imagen-4.0-generate-001',
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
        updateLastTurn({
          text: last.text + text,
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

    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('content', handleContent);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('content', handleContent);
      client.off('turncomplete', handleTurnComplete);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [client, isGeneratingImage, responseWindowDuration, activate, deactivate, stopResponseTimer, setAgentSpeaking, audience]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const lastAgentTurnText = turns.filter(t => t.role === 'agent' && t.isFinal).pop()?.text || 'A beautiful illustration for our story.';

  const getUserLabel = () => {
    switch (audience) {
      case 'empress':
        return 'Empress:';
      case 'king':
        return 'King:';
      case 'both':
        return 'King & Empress:';
    }
  };


  return (
    <div className="story-container">
      {turns.length === 0 ? (
        <WelcomeScreen />
      ) : (
        <>
          <div className="story-image-container">
            {isGeneratingImage && <div className="image-loader">Creating an illustration...</div>}
            {imageUrl && <img src={imageUrl} alt={lastAgentTurnText} className="story-image" />}
            {!imageUrl && !isGeneratingImage && <div className="image-placeholder"><span className="icon">palette</span></div>}
          </div>
          <div className="story-text-container" ref={scrollRef}>
            {turns.map((t, i) => (
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
                  {renderContent(t.text)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
