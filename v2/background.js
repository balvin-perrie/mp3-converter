'use strict';

const ports = [];

chrome.runtime.onConnect.addListener(port => {
  ports.push(port);
  port.onDisconnect.addListener(() => {
    const index = ports.indexOf(port);
    ports.splice(index, 1);
  });
});

const permission = links => {
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
chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'permission') {
    permission(request.links).then(response);
    return true;
  }
});

const onClicked = link => {
  if (ports.length) {
    if (link) {
      ports[0].postMessage({
        method: 'convert',
        link
      });
    }
    chrome.windows.update(ports[0].sender.tab.windowId, {
      focused: true
    });
  }
  else {
    chrome.windows.getCurrent(win => {
      chrome.storage.local.get({
        width: 750,
        height: 500,
        left: win.left + Math.round((win.width - 700) / 2),
        top: win.top + Math.round((win.height - 500) / 2)
      }, prefs => {
        chrome.windows.create({
          url: '/data/window/index.html' + (link ? '?link=' + link : ''),
          width: prefs.width,
          height: prefs.height,
          left: prefs.left,
          top: prefs.top,
          type: 'popup'
        });
      });
    });
  }
};

chrome.browserAction.onClicked.addListener(() => onClicked());

{
  const onStartup = () => {
    chrome.contextMenus.create({
      title: 'Open a Sample',
      id: 'sample',
      contexts: ['browser_action']
    });
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
        'avi', 'mp4', 'webm', 'flv', 'mov', 'ogv', '3gp', 'mpg', 'wmv', 'swf', 'mkv',
        'pcm', 'wav', 'aac', 'ogg', 'wma', 'flac', 'mid', 'mka', 'm4a', 'voc'
      ].map(a => '*://*/*.' + a)
    });
  };
  chrome.runtime.onInstalled.addListener(onStartup);
  chrome.runtime.onStartup.addListener(onStartup);
}
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'sample') {
    chrome.tabs.create({
      url: 'https://webbrowsertools.com/test-download-with/'
    });
  }
  else if (info.menuItemId === 'convert-media' || info.menuItemId === 'convert-link') {
    const link = info.menuItemId === 'convert-media' ? info.srcUrl : info.linkUrl;

    permission([link]).then(() => onClicked(link));
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
