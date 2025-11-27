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

import {
  createWorketFromSrc,
  registeredWorklets,
} from './audioworklet-registry';

export class AudioStreamer {
  private sampleRate: number = 24000;
  // A queue of audio buffers to be played. Each buffer is a Float32Array.
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  // Web Audio API nodes. gain => destination
  public gainNode: GainNode;
  private currentSource: AudioBufferSourceNode | null = null;

  public onComplete = () => {};

  constructor(public context: AudioContext) {
    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.context.destination);
    this.addPCM16 = this.addPCM16.bind(this);
  }

  async addWorklet<T extends (d: any) => void>(
    workletName: string,
    workletSrc: string,
    handler: T
  ): Promise<this> {
    let workletsRecord = registeredWorklets.get(this.context);
    if (workletsRecord && workletsRecord[workletName]) {
      // the worklet already exists on this context
      // add the new handler to it
      workletsRecord[workletName].handlers.push(handler);
      return Promise.resolve(this);
    }

    if (!workletsRecord) {
      registeredWorklets.set(this.context, {});
      workletsRecord = registeredWorklets.get(this.context)!;
    }

    // create new record to fill in as becomes available
    workletsRecord[workletName] = { handlers: [handler] };

    const src = createWorketFromSrc(workletName, workletSrc);
    await this.context.audioWorklet.addModule(src);
    const worklet = new AudioWorkletNode(this.context, workletName);

    //add the node into the map
    workletsRecord[workletName].node = worklet;

    return this;
  }

  /**
   * Converts a Uint8Array of PCM16 audio data into a Float32Array.
   * PCM16 is a common raw audio format, but the Web Audio API generally
   * expects audio data as Float32Arrays with samples normalized between -1.0 and 1.0.
   * This function handles that conversion.
   * @param chunk The Uint8Array containing PCM16 audio data.
   * @returns A Float32Array representing the converted audio data.
   */
  private _processPCM16Chunk(chunk: Uint8Array): AudioBuffer {
    const float32Array = new Float32Array(chunk.length / 2);
    const dataView = new DataView(chunk.buffer);

    for (let i = 0; i < chunk.length / 2; i++) {
      try {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / 32768;
      } catch (e) {
        console.error(e);
      }
    }

    const audioBuffer = this.context.createBuffer(
      1,
      float32Array.length,
      this.sampleRate
    );
    audioBuffer.getChannelData(0).set(float32Array);
    return audioBuffer;
  }

  addPCM16(chunk: Uint8Array) {
    const audioBuffer = this._processPCM16Chunk(chunk);
    this.audioQueue.push(audioBuffer);
    if (!this.isPlaying) {
      this.playNextChunk();
    }
  }

  private playNextChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      this.currentSource = null;
      this.onComplete();
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;
    const source = this.context.createBufferSource();
    this.currentSource = source;
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const worklets = registeredWorklets.get(this.context);
    if (worklets) {
      Object.values(worklets).forEach(({ node, handlers }) => {
        if (node) {
          source.connect(node);
          node.port.onmessage = (ev: MessageEvent) => {
            handlers.forEach(handler => handler.call(node.port, ev));
          };
          node.connect(this.context.destination);
        }
      });
    }

    source.onended = () => {
      // When one chunk finishes, play the next one.
      this.playNextChunk();
    };
    source.start();
  }

  stop() {
    this.isPlaying = false;
    // Clear any pending audio data
    this.audioQueue = [];

    // Stop the currently playing source, if any.
    if (this.currentSource) {
      // Prevent onended from firing and trying to play the next chunk.
      this.currentSource.onended = null;
      this.currentSource.stop();
      this.currentSource.disconnect();
      this.currentSource = null;
    }
  }

  async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.gainNode.gain.setValueAtTime(1, this.context.currentTime);
  }

  complete() {
    // This can be used to signal that no more chunks are expected.
    // The onComplete callback will naturally be called when the queue is empty.
  }
}
