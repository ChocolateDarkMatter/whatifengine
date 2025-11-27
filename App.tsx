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
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import ControlTray from './components/console/control-tray/ControlTray';
import ErrorScreen from './components/demo/ErrorScreen';
import StreamingConsole from './components/demo/streaming-console/StreamingConsole';

import Header from './components/Header';
import { LiveAPIProvider } from './contexts/LiveAPIContext';

const API_KEY = process.env.API_KEY as string;
if (!API_KEY) {
  console.error(
    'Missing required environment variable: API_KEY'
  );
}

/**
 * Main application component for the "What If?" Story Engine.
 */
function App() {
  return (
    <div className="App">
      <LiveAPIProvider apiKey={API_KEY}>
        <ErrorScreen />
        <Header />
        <div className="streaming-console">
          <main>
            <div className="main-app-area">
              <StreamingConsole />
            </div>
            <ControlTray />
          </main>
        </div>
      </LiveAPIProvider>
    </div>
  );
}

export default App;
