/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useSettings } from '@/lib/state';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import './StoryLevelSlider.css';

export default function StoryLevelSlider() {
  const { storyLevel, setStoryLevel } = useSettings();
  const { connected } = useLiveAPIContext();

  const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStoryLevel(Number(e.target.value));
  };

  return (
    <div className="story-level-slider-container" title="Adjust Story Complexity (reconnect to apply)">
      <label htmlFor="story-level-slider">
        <span className="icon">signal_cellular_alt</span>
      </label>
      <input
        type="range"
        id="story-level-slider"
        min="1"
        max="10"
        value={storyLevel}
        onChange={handleLevelChange}
        disabled={connected}
        aria-label="Story complexity level"
      />
      <span className="story-level-value">{storyLevel}</span>
    </div>
  );
}
