/* global lamejs */
'use strict';

self.importScripts('vendor/lame.all.js');

onmessage = function(e) {
  const {method, length, left, right, channels, sampleRate, bitrate} = e.data;

  if (method === 'convert') {
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);

    const sampleBlockSize = 1152; // can be anything but make it a multiple of 576 to make encoders life easier

    const mp3Data = [];
    for (let i = 0; i < length; i += sampleBlockSize) {
      postMessage({
        method: 'progress',
        value: i / length * 100
      });
      let mp3buf;
      if (channels === 1) {
        const leftChunk = left.subarray(i, i + sampleBlockSize);
        // Convert to required format
        for (let i = 0; i < leftChunk.length; i++) {
          leftChunk[i] = leftChunk[i] * 32767.5;
        }
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      }
      else {
        const leftChunk = left.subarray(i, i + sampleBlockSize);
        const rightChunk = right.subarray(i, i + sampleBlockSize);
        // Convert to required format
        for (let i = 0; i < leftChunk.length; i++) {
          leftChunk[i] = leftChunk[i] * 32767.5;
          rightChunk[i] = rightChunk[i] * 32767.5;
        }
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      }
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }
    const mp3buf = mp3encoder.flush(); // finish writing mp3
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
    const blob = new Blob(mp3Data, {type: 'audio/mp3'});
    postMessage({
      method: 'mp3',
      blob
    });
  }
};
