/* globals mp3, manager, ID3Writer */
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
  if (e.object.worker) {
    e.object.worker.terminate();
  }
  if (e.object.controller) {
    e.object.controller.abort();
  }
  e.object.closed = true; // in case we are in the fetch level
});
manager.on('added', e => {
  const {type, link, name} = e.file;
  e.then = async blob => {
    // id3
    const keys = Object.keys(tags);
    if (keys.length) {
      const ab = await blob.arrayBuffer();
      const writer = new ID3Writer(ab);
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
      blob = writer.getBlob();
    }

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
    const bitrate = Number(document.getElementById('bitrate').value);
    if (link) {
      e.message('downloading');
      e.controller = mp3.fetch(link, (err, buffer) => {
        if (err) {
          return e.error(err.messsage);
        }
        e.message('decoding');
        e.worker = mp3.convert(buffer, bitrate, e);
      });
    }
    else {
      e.message('reading');
      const reader = new FileReader();
      reader.onload = () => {
        e.message('decoding');
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

const port = chrome.runtime.connect({
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
  'bitrate': 128
}, prefs => document.getElementById('bitrate').value = prefs.bitrate);
document.getElementById('bitrate').addEventListener('change', e => chrome.storage.local.set({
  'bitrate': e.target.value
}));
