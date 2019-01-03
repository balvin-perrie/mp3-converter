'use strict';

var ports = [];

chrome.runtime.onConnect.addListener(port => {
  ports.push(port);
  port.onDisconnect.addListener(() => {
    const index = ports.indexOf(port);
    ports.splice(index, 1);
  });
});

var permission = links => {
  const origins = [];
  links.forEach(link => {
    try {
      origins.push('*://' + (new URL(link)).hostname + '/*');
    }
    catch (e) {}
  });
  return new Promise(resolve => chrome.permissions.request({
    permissions: [],
    origins
  }, g => {
    chrome.runtime.lastError;
    resolve(g);
  }));
};

var onClicked = link => chrome.storage.local.get({
  width: 700,
  height: 500,
  left: screen.availLeft + Math.round((screen.availWidth - 700) / 2),
  top: screen.availTop + Math.round((screen.availHeight - 500) / 2)
}, prefs => {
  chrome.windows.create({
    url: chrome.extension.getURL('data/window/index.html') + (link ? '?link=' + link : ''),
    width: prefs.width,
    height: prefs.height,
    left: prefs.left,
    top: prefs.top,
    type: 'popup'
  });
});
chrome.browserAction.onClicked.addListener(() => onClicked());

{
  const onStartup = () => {
    chrome.contextMenus.create({
      title: 'Convert to MP3',
      id: 'convert-media',
      contexts: ['audio', 'video']
    });
    chrome.contextMenus.create({
      title: 'Convert to MP3',
      id: 'convert-link',
      contexts: ['link'],
      targetUrlPatterns: [
        'avi', 'mp4', 'webm', 'flv', 'mov', 'ogv', '3gp',
        'pcm', 'wav', 'aac', 'ogg', 'wma'
      ].map(a => '*://*/*.' + a)
    });
  };
  chrome.runtime.onInstalled.addListener(onStartup);
  chrome.runtime.onStartup.addListener(onStartup);
}
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'convert-media' || info.menuItemId === 'convert-link') {
    const link = info.menuItemId === 'convert-media' ? info.srcUrl : info.linkUrl;

    permission([link]).then(() => {
      if (ports.length) {
        ports[0].postMessage({
          method: 'convert',
          link
        });
        chrome.windows.update(ports[0].sender.tab.windowId, {
          focused: true
        });
      }
      else {
        onClicked(link);
      }
    });
  }
});
