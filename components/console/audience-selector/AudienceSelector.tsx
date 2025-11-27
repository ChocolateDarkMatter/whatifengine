
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import cn from 'classnames';
import { useSettings } from '@/lib/state';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import './AudienceSelector.css';

type Audience = 'king' | 'empress' | 'both' | 'random';

export default function AudienceSelector() {
  const { audience, setAudience } = useSettings();
  const { connected } = useLiveAPIContext();

  const audiences: { id: Audience; label: string }[] = [
    { id: 'empress', label: 'Empress' },
    { id: 'king', label: 'King' },
    { id: 'both', label: 'Both' },
    { id: 'random', label: 'Random' },
  ];

  return (
    <div className="audience-selector" title="Select the audience">
      {audiences.map(aud => (
        <button
          key={aud.id}
          className={cn({ active: audience === aud.id })}
          onClick={() => setAudience(aud.id)}
          disabled={connected}
          aria-pressed={audience === aud.id}
        >
          {aud.label}
        </button>
      ))}
    </div>
  );
}
