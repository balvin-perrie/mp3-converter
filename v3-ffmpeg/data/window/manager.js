'use strict';

const manager = {
  events: {
    closed: [],
    added: []
  },
  ready() {
    document.querySelector('#drag input[type=file]').disabled = false;
    document.getElementById('drag').classList.add('ready');
    document.getElementById('msg').textContent =
      'Click to choose files or drag them to start the conversion. Drop text content to extract links';
  }
};
window.manager = manager;

const permission = (links, user = false) => new Promise(resolve => {
  const origins = [];
  links.forEach(link => {
    try {
      origins.push('*://' + (new URL(link)).hostname + '/*');
    }
    catch (e) {}
  });

  chrome.permissions.contains({
    origins
  }, g => {
    if (g) {
      resolve(true);
    }
    else {
      chrome.permissions.request({
        origins
      }, g => {
        console.info(user, chrome.runtime.lastError);
        if (g) {
          resolve(g);
        }
        else if (user === false) {
          const dialog = document.querySelector('dialog');
          dialog.querySelector('#hostnames').textContent = origins.join(', ');
          dialog.onsubmit = e => {
            if (e.submitter?.dataset?.cmd === 'proceed') {
              chrome.permissions.request({
                origins
              }, g => {
                console.info(user, chrome.runtime.lastError);
                resolve(g);
              });
            }
            else {
              resolve();
            }
          };
          dialog.showModal();
        }
        else {
          resolve(g);
        }
      });
    }
  });
});

const extract = content => {
  const r = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\\/%?=~_|!:,.;]*[-A-Z0-9+&@#\\/%=~_|])/gi;
  return (content.match(r) || []) .map(s => s.replace(/&amp;/g, '&'))
    .filter(href => href).filter((s, i, l) => l.indexOf(s) === i);
};

manager.add = async files => {
  const links = files.filter(f => f.link);
  if (links.length) {
    await permission(links.map(o => o.link));
  }
  const size = bytes => {
    if (Math.abs(bytes) < 1024) {
      return bytes + ' B';
    }
    const units = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let u = -1;
    do {
      bytes /= 1024;
      ++u;
    }
    while (Math.abs(bytes) >= 1024 && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
  };
  const guess = obj => {
    const {disposition, type, src} = obj;
    let name = obj.name || '';
    if (!name && disposition) {
      const tmp = /filename\*=UTF-8''([^;]*)/.exec(disposition);
      if (tmp && tmp.length) {
        name = tmp[1].replace(/["']$/, '').replace(/^["']/, '');
        name = decodeURIComponent(name);
      }
    }
    if (!name && disposition) {
      const tmp = /filename=([^;]*)/.exec(disposition);
      if (tmp && tmp.length) {
        name = tmp[1].replace(/["']$/, '').replace(/^["']/, '');
      }
    }
    if (!name) {
      if (src.startsWith('http')) {
        const url = src.replace(/\/$/, '');
        const tmp = /(title|filename)=([^&]+)/.exec(url);
        if (tmp && tmp.length) {
          name = tmp[2];
        }
        else {
          name = url.substring(url.lastIndexOf('/') + 1);
        }
        try {
          name = decodeURIComponent(name.split('?')[0].split('&')[0]) || 'image';
          // make sure name is writable
          name = name.replace(/[`~!@#$%^&*()_|+\-=?;:'",<>{}[\]\\/]/gi, '-');
        }
        catch (e) {}
      }
      else { // data-url
        name = 'unknown';
      }
    }
    if (disposition && name) {
      const arr = [...name].map(v => v.charCodeAt(0)).filter(v => v <= 255);
      name = (new TextDecoder('UTF-8')).decode(Uint8Array.from(arr));
    }
    // extension
    if (name.indexOf('.') === -1 && type) {
      name += '.' + type.split('/').pop().split(/[+;]/).shift();
    }
    let index = name.lastIndexOf('.');
    if (index === -1) {
      index = name.length;
    }
    const extension = name.substr(index).substr(0, 10);
    name = name.substr(0, index);

    // apply masking
    return '[name][extension]'.split('[extension]').map(str => str
      .replace(/\[name\]/gi, name)
      .replace(/\[type\]/gi, type || '')
      .replace(/\[disposition\]/gi, disposition || '')
      // make sure filename is acceptable
      .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-')
      // limit length of each section to 60 chars
      .substr(0, 60)).join(extension);
  };

  files.forEach(file => {
    const filename = file.name || '-';
    const filesize = file.size ? size(file.size) : '';
    const link = file.link || 'file:///local-file';
    const obj = manager.build(filename, filesize, link);
    obj.file = file;
    if (file.link) {
      const req = new XMLHttpRequest();
      req.open('GET', file.link);
      req.onreadystatechange = () => {
        if (req.readyState === req.HEADERS_RECEIVED) {
          const type = req.getResponseHeader('content-type') || '';
          const filename = guess({
            type,
            src: file.link,
            disposition: req.getResponseHeader('content-disposition')
          });
          file.name = filename;
          file.type = type;
          obj.name(filename);
          const s = req.getResponseHeader('content-length');
          obj.size(s ? size(Number(s)) : 'NA');

          req.abort();
          manager.events.added.forEach(c => c(obj));
        }
      };
      req.onerror = () => {
        obj.error('Cannot connect to this server. Drop the files to ask for permission or click here for more info', 'faq8');
      };
      req.send();
    }
    else {
      manager.events.added.forEach(c => c(obj));
    }
  });
};

document.querySelector('#drag input[type=file]').addEventListener('change', e => {
  const files = [...e.target.files];
  manager.add(files);
  e.target.value = '';
});
document.querySelector('#drag input[type=button]').addEventListener('click', () => {
  navigator.clipboard.readText().then(content => {
    const links = extract(content);
    if (links.length) {
      manager.add(links.map(link => ({
        link
      })));
    }
    else {
      alert('there is no link in the dropped text');
    }
  }).catch(e => {
    console.warn(e);
    alert('Failed to read clipboard contents. Use drag and drop instead: ', e);
  });
});
document.addEventListener('paste', () => {
  document.querySelector('#drag input[type=button]').click();
});

{
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length) {
      manager.add([...e.dataTransfer.files]);
    }
    else {
      const content =
        e.dataTransfer.getData('text/html') ||
        e.dataTransfer.getData('text/plain');
      const links = extract(content);
      if (links.length) {
        manager.add(links.map(link => ({
          link
        })));
      }
      else {
        alert('there is no link in the dropped text');
      }
    }
  });
}

manager.on = (name, c) => manager.events[name].push(c);

manager.build = (filename, filesize, url) => {
  const template = document.getElementById('entry');
  const clone = document.importNode(template.content, true);

  clone.querySelector('input[type=button]').addEventListener('click', e => {
    const entry = e.target.closest('.entry');
    manager.events.closed.forEach(c => c(entry));
    entry.remove();
  });

  const progress = clone.querySelector('.progress');
  Object.assign(progress.dataset, {
    filename,
    filesize
  });
  // clone.querySelector('b').textContent = filename;
  clone.querySelector('span[data-id=link]').textContent = url;
  const info = clone.querySelector('span[data-id=info]');

  const div = clone.querySelector('.progress div');
  const entry = clone.querySelector('.entry');
  const entries = document.getElementById('entries');

  entries.appendChild(clone);

  const rtn = {
    progress(p) {
      div.style.width = p + '%';
    },
    done(ab) {
      div.dataset.done = true;
      if (this.then) {
        this.then(ab);
      }
    },
    error(msg, faq) {
      div.dataset.error = true;
      progress.title = progress.dataset.filesize = msg || 'Error';
      info.textContent = '';

      if (faq) {
        progress.classList.add('link');
        progress.onclick = () => {
          chrome.tabs.create({
            url: chrome.runtime.getManifest().homepage_url + '#' + faq
          });
        };
      }
    },
    message(msg) {
      info.textContent = msg;
    },
    focus() {
      div.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    },
    size: s => progress.dataset.filesize = s,
    name: s => progress.dataset.filename = s,
    downloadId: downloadId => progress.dataset.downloadId = downloadId
  };
  entry.object = rtn;
  return rtn;
};

document.addEventListener('click', e => {
  const downloadId = e.target.dataset.downloadId;
  if (downloadId) {
    chrome.downloads.show(Number(downloadId));
  }
});
