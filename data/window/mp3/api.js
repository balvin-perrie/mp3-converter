'use strict';

const mp3 = {};
mp3.fetch = (url, callback) => {
  const controller = new AbortController();
  fetch(url, {
    signal: controller.signal
  }).then(r => r.arrayBuffer()).then(buffer => callback(null, buffer)).catch(callback);

  return controller;
};
mp3.convert = (buffer, bitrate = 256, obj) => {
  const worker = new Worker('mp3/worker.js');

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  audioCtx.decodeAudioData(buffer, buffer => {
    obj.message('encoding');
    const channels = buffer.numberOfChannels;
    const msg = {
      method: 'convert'
    };
    msg.channels = channels;
    msg.sampleRate = buffer.sampleRate;
    msg.length = buffer.length;

    msg.left = buffer.getChannelData(0);
    msg.bitrate = bitrate;
    if (channels > 1) {
      msg.right = buffer.getChannelData(1);
    }
    worker.onmessage = e => {
      const {method} = e.data;
      if (method === 'progress') {
        obj.progress(e.data.value);
      }
      else if (method === 'mp3') {
        obj.done(e.data.blob);
      }
    };
    worker.postMessage(msg);
  }).catch(e => obj.error(e.message));

  return worker;
};
window.mp3 = mp3;
