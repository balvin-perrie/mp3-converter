/* globals mp3, manager */
'use strict';

var args = new URLSearchParams(location.search);

manager.on('closed', e => {
  if (e.object.worker) {
    e.object.worker.terminate();
  }
  if (e.object.controller) {
    e.object.controller.abort();
  }
  e.object.closed = true; // in case we are in the fetch level
});
manager.on('added', e => {
  const {type, link} = e.file;
  if (type.startsWith('audio/') || type.startsWith('video/')) {
    const bitrate = Number(document.getElementById('bitrate').value);
    if (link) {
      e.message('downloading');
      e.controller = mp3.fetch(link, (err, buffer) => {
        if (err) {
          return e.error(err.messsage);
        }
        e.message('converting');
        e.worker = mp3.convert(buffer, bitrate, e);
      });
    }
    else {
      e.message('reading');
      const reader = new FileReader();
      reader.onload = () => {
        e.message('converting');
        e.worker = mp3.convert(reader.result, bitrate, e);
      };
      reader.onerror = m => e.error(m.message);
      reader.readAsArrayBuffer(e.file);
    }
  }
  else {
    e.error('not a media file');
  }
});

var port = chrome.runtime.connect({
  name: 'window'
});
port.onMessage.addListener(request => {
  if (request.method === 'convert') {
    manager.add([{
      link: request.link
    }]);
  }
});

if (args.has('link')) {
  manager.add([{
    link: args.get('link')
  }]);
}

document.getElementById('global-permission').addEventListener('click', () => chrome.permissions.request({
  permissions: [],
  origins: ['*://*/*']
}));
