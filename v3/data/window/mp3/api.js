'use strict';

const USE_NATIVE = true;

const mp3 = {};
mp3.fetch = (url, callback) => {
  const controller = new AbortController();
  fetch(url, {
    signal: controller.signal
  }).then(r => r.arrayBuffer()).then(buffer => callback(null, buffer)).catch(callback);

  return controller;
};

mp3.decoder = (buffer, obj) => {
  const ffmpeg = document.getElementById('ffmpeg');
  const id = Math.random();
  ffmpeg.contentWindow.postMessage({
    method: 'decode',
    id,
    buffer
  }, '*');

  return new Promise((resolve, reject) => {
    mp3.decoder.cache[id] = {resolve, reject, obj};
  });
};
mp3.decoder.cache = {};
window.addEventListener('message', ({data}) => {
  if (data.method === 'message') {
    mp3.decoder.cache[data.id].obj.message(data.value);
  }
  else if (data.method === 'decoded') {
    const {channels, meta} = data;
    const context = new AudioContext();
    const buffer = context.createBuffer(meta['Channels'], channels[0].byteLength / meta['Sample Size'], meta['Sample Rate']);
    // fill the buffer with channel data
    for (let i = 0; i < meta['Channels']; i += 1) {
      buffer.getChannelData(i).set(new Float32Array(channels.shift().buffer));
    }

    mp3.decoder.cache[data.id].resolve(buffer);
  }

  else if (data.method === 'error') {
    mp3.decoder.cache[data.id].reject(Error(data.value));
  }
});

mp3.convert = ({buffer, type}, bitrate = 256, obj) => {
  const worker = new Worker('mp3/worker.js');

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const backup = buffer.slice(0);

  (USE_NATIVE ? audioCtx.decodeAudioData(buffer) : Promise.reject(Error('user_abort'))).catch(async e => {
    return await mp3.decoder(backup, obj, e);
  }).then(buffer => {
    obj.message('encoding...');
    const channels = buffer.numberOfChannels;
    const msg = {
      method: 'convert'
    };
    msg.channels = channels;
    msg.sampleRate = buffer.sampleRate;
    msg.length = buffer.length;
    msg.bitrate = bitrate;

    // find max value in data channels
    let max = 1;
    for (let n = 0; n < channels; n += 1) {
      max = Math.max(max, buffer.getChannelData(n).reduce((p, c) => Math.abs(c) > p ? Math.abs(c) : p, 1));
    }
    msg.max = max;

    worker.onmessage = e => {
      const {method, start, end} = e.data;
      if (method === 'progress') {
        obj.progress(e.data.value);
      }
      else if (method === 'mp3') {
        obj.done(e.data.blob);
        worker.terminate();
      }
      else if (method === 'read-chunk') {
        const msg = {
          method: 'chunk',
          left: buffer.getChannelData(0).slice(start, end)
        };
        if (channels > 1) {
          msg.right = buffer.getChannelData(1).slice(start, end);
        }
        worker.postMessage(msg);
      }
    };
    worker.postMessage(msg);
  }).catch(e => {
    worker.terminate();
    obj.error(e.message);
  });

  return worker;
};
window.mp3 = mp3;
