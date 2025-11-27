
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law of aicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import cn from 'classnames';

// FIX: Import React to provide the React namespace for React.CSSProperties.
import React, { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';
import { useLogStore, useSettings, useTimerStore, useAppStatusStore } from '@/lib/state';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import StoryLevelSlider from '../story-level-slider/StoryLevelSlider';
import AudienceSelector from '../audience-selector/AudienceSelector';

export type ControlTrayProps = {
  children?: ReactNode;
};

function ControlTray({ children }: ControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const { isTimerActive, timerKey } = useTimerStore();
  const { responseWindowDuration } = useSettings();
  const { isAgentSpeaking } = useAppStatusStore();
  const isAgentSpeakingRef = useRef(isAgentSpeaking);
  isAgentSpeakingRef.current = isAgentSpeaking;


  const { client, connected, connect, disconnect } = useLiveAPIContext();

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      setMuted(false);
    }
  }, [connected]);

  useEffect(() => {
    const onData = (base64: string) => {
      if (isAgentSpeakingRef.current) {
        return; // Don't send audio data if the agent is speaking.
      }
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };

    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData);
      // Ensure the recorder is started only if not already recording.
      if (!audioRecorder.recording) {
        audioRecorder.start();
      }
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off('data', onData);
    };
  }, [connected, client, muted, audioRecorder]);

  const handleMicClick = () => {
    if (isAgentSpeaking) return;

    if (connected) {
      setMuted(!muted);
    } else {
      connect();
    }
  };

  const micButtonTitle = isAgentSpeaking
    ? 'Storyteller is speaking...'
    : connected
      ? muted
        ? 'Unmute microphone'
        : 'Mute microphone'
      : 'Talk to the storyteller';

  const connectButtonTitle = connected ? 'Pause story' : 'Start story';
  const CIRCLE_RADIUS = 28;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  return (
    <section className="control-tray">
      <nav className={cn('actions-nav')}>
        <div className="mic-button-container">
          {isTimerActive && (
            <svg
              key={timerKey}
              className="countdown-timer"
              width="60"
              height="60"
              viewBox="0 0 60 60"
              style={
                {
                  '--timer-duration': `${responseWindowDuration}s`,
                  '--circle-circumference': CIRCLE_CIRCUMFERENCE,
                } as React.CSSProperties
              }
            >
              <circle
                className="countdown-timer-circle"
                cx="30"
                cy="30"
                r={CIRCLE_RADIUS}
                strokeDasharray={CIRCLE_CIRCUMFERENCE}
              />
            </svg>
          )}
          <button
            className={cn('action-button mic-button', {
              speaking: isAgentSpeaking,
            })}
            onClick={handleMicClick}
            title={micButtonTitle}
            disabled={isAgentSpeaking}
            aria-disabled={isAgentSpeaking}
          >
            {isAgentSpeaking ? (
              <span className="material-symbols-outlined filled">
                voice_over_off
              </span>
            ) : !muted ? (
              <span className="material-symbols-outlined filled">mic</span>
            ) : (
              <span className="material-symbols-outlined filled">mic_off</span>
            )}
          </button>
        </div>
        <button
          className={cn('action-button')}
          onClick={useLogStore.getState().clearTurns}
          aria-label="New Story"
          title="Start a new story"
        >
          <span className="icon">refresh</span>
        </button>
        <AudienceSelector />
        <StoryLevelSlider />
        {children}
      </nav>

      <div className={cn('connection-container', { connected })}>
        <div className="connection-button-container">
          <button
            ref={connectButtonRef}
            className={cn('action-button connect-toggle', { connected })}
            onClick={connected ? disconnect : connect}
            title={connectButtonTitle}
          >
            <span className="material-symbols-outlined filled">
              {connected ? 'pause' : 'play_arrow'}
            </span>
          </button>
        </div>
        <span className="text-indicator">{connected ? 'Listening...' : 'Story Time!'}</span>
      </div>
    </section>
  );
}

export default memo(ControlTray);
