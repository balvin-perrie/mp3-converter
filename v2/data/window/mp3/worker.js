/* global lamejs */
'use strict';

self.importScripts('vendor/lame.all.js');

let percent = -2;
onmessage = function(e) {
  const {method, length, left, right, channels, sampleRate, bitrate} = e.data;

  // find max value
  const max = Math.max(
    left.reduce((p, c) => Math.abs(c) > p ? Math.abs(c) : p, 1),
    right ? right.reduce((p, c) => Math.abs(c) > p ? Math.abs(c) : p, 1) : 1
  );

  if (method === 'convert') {
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);

    const sampleBlockSize = 2 * 576; // can be anything but make it a multiple of 576 to make encoders life easier

    const mp3Data = [];
    for (let i = 0; i < length; i += sampleBlockSize) {
      const value = i / length * 100;
      if (value > percent + 0.5) {
        postMessage({
          method: 'progress',
          value
        });
        percent = value;
      }

      let mp3buf;

      const convert = n => {
        return n < 0 ? n / max * 32768 : n / max * 32767; // convert in range [-32768, 32767]
      };
      const leftChunk = Int16Array.from(left.subarray(i, i + sampleBlockSize), convert);
      // const leftChunk = Int16Array.from(left.subarray(i, i + sampleBlockSize), a => a * (a < 0 ? 0x8000 : 0x7FFF));
      if (channels === 1) {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      }
      else {
        const rightChunk = Int16Array.from(right.subarray(i, i + sampleBlockSize), convert);
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
    postMessage({
      method: 'mp3',
      blob: new Blob(mp3Data, {
        type: 'audio/mp3'
      })
    });
  }
};
