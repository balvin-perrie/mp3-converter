
let meta = {};
let decoder = '';

window.Module = {
  onRuntimeInitialized() {
    decoder = window.Module.cwrap('decoder', 'number', ['string', 'string']);
    for (const {resolve} of window.Module.ready.cache) {
      resolve();
    }
  },
  ready() {
    document.getElementById('decoder').src = document.getElementById('decoder').src || 'decoder.js';

    if (decoder) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      window.Module.ready.cache.push({resolve, reject});
    });
  }
};
window.Module.ready.cache = [];

const jobs = [];

const next = () => {
  if (next.ready === false) {
    return;
  }
  const data = jobs.shift();
  if (!data) {
    return;
  }

  parent.postMessage({
    method: 'message',
    value: 'decoding by FFmpeg',
    id: data.id
  }, '*');

  next.ready = false;
  window.Module.ready().then(async () => {
    const name = Math.random().toString(36).substring(7);
    window.FS.writeFile(name, new Uint8Array(data.buffer));
    meta = {};
    try {
      decoder(name);
    }
    catch (e) {
      throw Error(meta['Exit Message'] || e.message);
    }
    window.FS.unlink(name);

    let channels = [];
    for (let i = 0; i < meta['Channels']; i += 1) {
      channels[i] = window.FS.readFile('channel_' + i);
      window.FS.unlink('channel_' + i);
    }

    if (meta['Channels'] === undefined) {
      throw Error('no audio data is detected');
    }

    parent.postMessage({
      method: 'decoded',
      channels,
      meta,
      id: data.id
    }, '*');
    channels = [];
  }).catch(e => parent.postMessage({
    method: 'error',
    value: 'FFmpeg decoding failed; ' + e.message,
    id: data.id
  }, '*')).finally(() => {
    next.ready = true;
    next();
  });
};
next.ready = true;

window.addEventListener('message', ({data}) => {
  if (data.method === 'decode') {
    parent.postMessage({
      method: 'message',
      value: 'using FFmpeg to decode',
      id: data.id
    }, '*');

    jobs.push(data);
    next();
  }
});
