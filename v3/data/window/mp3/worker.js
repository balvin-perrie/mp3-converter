/* global lamejs */
'use strict';

const SAMPLEBLOCKSIZE = 2 * 576; // can be anything but make it a multiple of 576 to make encoders life easier
const SAMPLEREADSIZE = SAMPLEBLOCKSIZE * 5000;

self.importScripts('vendor/lame.all.js');

let percent = -2;
let resolve = () => console.log('something is not right!');

const convert = async data => {
  const {length, max, channels, sampleRate, bitrate} = data;


  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);
  const mp3Data = [];

  for (let i = 0; i < length; i += SAMPLEREADSIZE) {
    let mp3buf;

    const convert = n => {
      return n < 0 ? n / max * 32768 : n / max * 32767; // convert in range [-32768, 32767]
    };

    const r = await new Promise(r => {
      resolve = r;
      postMessage({
        method: 'read-chunk',
        start: i,
        end: i + SAMPLEREADSIZE
      });
    });

    for (let j = i; j < i + SAMPLEREADSIZE; j += SAMPLEBLOCKSIZE) {
      const value = j / length * 100;
      if (value > percent + 0.5) {
        postMessage({
          method: 'progress',
          value
        });
        percent = value;
      }

      const leftChunk = Int16Array.from(r.left.subarray(j - i, j - i + SAMPLEBLOCKSIZE), convert);
      // const leftChunk = Int16Array.from(left.subarray(i, i + SAMPLEBLOCKSIZE), a => a * (a < 0 ? 0x8000 : 0x7FFF));
      if (channels === 1) {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      }
      else {
        const rightChunk = Int16Array.from(r.right.subarray(j - i, j - i + SAMPLEBLOCKSIZE), convert);
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      }

      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
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
};

onmessage = function(e) {
  if (e.data.method === 'convert') {
    convert(e.data);
  }
  else if (e.data.method === 'chunk') {
    resolve(e.data);
  }
};
