
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useSettings } from "@/lib/state";

export default function Header() {
  const { audience } = useSettings();

  const getAudienceName = () => {
    switch (audience) {
      case 'empress':
        return 'Empress';
      case 'king':
        return 'King';
      case 'both':
        return 'King & Empress';
      case 'random':
        return 'Listener';
      default:
        return 'Friend';
    }
  };

  return (
    <header>
      <div className="header-left">
        <h1>The "What If?" Story Engine</h1>
        <p>A new adventure awaits, {getAudienceName()}!</p>
      </div>
    </header>
  );
}
