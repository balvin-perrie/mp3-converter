/* global mp3, manager, ID3Writer */
'use strict';

const args = new URLSearchParams(location.search);
const tags = {};

document.getElementById('add-id3').addEventListener('click', () => {
  const select = document.getElementById('select-id3');
  const option = select.selectedOptions[0];
  const type = option.getAttribute('type');
  if (type === 'picture') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const reader = new FileReader();
      reader.onloadend = () => {
        tags[option.value] = reader.result;
      };
      reader.readAsArrayBuffer(input.files[0]);
    };
    input.click();
  }
  else {
    const msg = (type === 'array' ? 'Comma-separated list of ' : 'Value for ') + option.text + ' ' + ` (type ${type})`;
    const value = window.prompt(msg, tags[option.value]);
    if (value) {
      tags[option.value] = value;
    }
    else {
      delete tags[option.value];
    }
  }
});

manager.on('closed', e => {
  if (e.object.controller) {
    e.object.controller.abort();
  }
  e.object.closed = true; // in case we are in the fetch level
});
manager.on('added', e => {
  const {type, link, name} = e.file;
  e.then = uint8a => {
    // id3
    try {
      const keys = Object.keys(tags);
      if (keys.length) {
        const writer = new ID3Writer(uint8a);
        for (const key of keys) {
          // arrays
          if (['TPE1', 'TCOM', 'TCON'].indexOf(key) !== -1) {
            writer.setFrame(key, tags[key].split(',').map(s => s.trim()).filter((s, i, l) => s && l.indexOf(s) === i));
          }
          else if (key === 'APIC') {
            writer.setFrame('APIC', {
              type: 3,
              data: tags['APIC'],
              description: 'Cover Image'
            });
          }
          else {
            if (['TLEN', 'TDAT', 'TYER', 'TBPM'].indexOf('key') === -1) {
              writer.setFrame(key, tags[key]);
            }
            else {
              writer.setFrame(key, Number(tags[key]));
            }
          }
        }
        writer.addTag();

        uint8a = new Uint8Array(writer.arrayBuffer);
      }
    }
    catch (e) {
      console.warn('ID3 skipped', e);
    }

    const blob = new Blob([uint8a], {
      type: 'audio/mp3'
    });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      filename: e.file.name.replace(/\.[^.]*/, '') + '.mp3',
      url
    }, id => {
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      e.downloadId(id);
    });
  };
  if (
    type.startsWith('audio/') ||
    type.startsWith('video/') ||
    [
      'avi', 'mp4', 'webm', 'flv', 'mov', 'ogv', '3gp', 'mpg', 'wmv', 'swf', 'mkv',
      'pcm', 'wav', 'aac', 'ogg', 'wma', 'flac', 'mid', 'mka', 'm4a', 'voc'
    ].some(e => (link && link.indexOf(e) !== -1) || (name && name.indexOf(e) !== -1))
  ) {
    const bitrate = document.getElementById('bitrate').value;
    const controller = new AbortController();
    e.controller = controller;
    const {signal} = controller;

    if (link) {
      e.message('downloading...');
      mp3.fetch(link, signal, e).then(abs => {
        e.message('queue...');
        const file = new File(abs, 'input.raw');
        mp3.convert({file, signal}, bitrate, e);
      }).catch(err => e.error(err.messsage, 'faq8'));
    }
    else {
      e.message('queue...');

      mp3.convert({
        file: e.file,
        signal
      }, bitrate, e);
    }
  }
  else {
    e.error('No media detected. Click for more info', 'faq7');
  }
});

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'convert') {
    manager.add([{
      link: request.link
    }]);
    chrome.runtime.sendMessage({method: 'focus'});
  }
  else if (request.method === 'introduce') {
    response(true);
    chrome.runtime.sendMessage({method: 'focus'});
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
}, granted => {
  if (granted) {
    document.getElementById('tools').dataset.count = '2';
  }
}));
chrome.permissions.contains({
  permissions: [],
  origins: ['*://*/*']
}, granted => {
  if (granted) {
    document.getElementById('tools').dataset.count = '2';
  }
});

// init
chrome.storage.local.get({
  'bitrate': 'v1'
}, prefs => document.getElementById('bitrate').value = prefs.bitrate);
document.getElementById('bitrate').addEventListener('change', e => chrome.storage.local.set({
  'bitrate': e.target.value
}));
