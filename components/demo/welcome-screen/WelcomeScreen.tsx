
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { useSettings } from '@/lib/state';
import './WelcomeScreen.css';

const WelcomeScreen: React.FC = () => {
  const { audience } = useSettings();

  const getAudienceName = () => {
    switch (audience) {
      case 'empress':
        return 'Empress';
      case 'king':
        return 'King';
      case 'both':
        return 'King and Empress';
      case 'random':
        return 'Listener';
      default:
        return 'Friend';
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="title-container">
          <span className="welcome-icon">auto_stories</span>
          <h2 className="welcome-title">The "What If?" Story Engine</h2>
        </div>
        <p>Ready for an adventure, {getAudienceName()}? Let's tell a story together!</p>
        <div className="start-prompt">
          <p>
            Press the <span className="mic-icon-text"></span> button and say "Start
            a story!"
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
