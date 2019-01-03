'use strict';

var mp3 = {};
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
    const channels = buffer.numberOfChannels;
    const msg = {
      method: 'convert'
    };
    msg.channels = channels;
    msg.sampleRate = buffer.sampleRate;
    msg.length = buffer.length;
    msg.left = buffer.getChannelData(0);
    msg.bitrate = bitrate;
    if (channels === 2) {
      msg.right = buffer.getChannelData(1);
    }
    worker.onmessage = e => {
      const {method} = e.data;
      if (method === 'progress') {
        obj.progress(e.data.value);
      }
      else if (method === 'mp3') {
        obj.done();
        const url = URL.createObjectURL(e.data.blob);
        chrome.downloads.download({
          filename: obj.file.name.replace(/\.[^.]*/, '') + '.mp3',
          url
        }, id => {
          window.setTimeout(() => URL.revokeObjectURL(url), 10000);
          obj.downloadId(id);
        });
      }
    };
    worker.postMessage(msg);
  }).catch(e => obj.error(e.message));

  return worker;
};
