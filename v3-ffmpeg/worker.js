if (typeof importScripts !== 'undefined') {
  self.importScripts('context.js');
}

const permission = links => {
  const origins = [];
  links.forEach(link => {
    try {
      origins.push('*://' + (new URL(link)).hostname + '/*');
    }
    catch (e) {}
  });
  return new Promise(resolve => {
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
          chrome.runtime.lastError;
          resolve(g);
        });
      }
    });
  });
};
chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'permission') {
    permission(request.links).then(response);
    return true;
  }
});

const onClicked = link => {
  chrome.runtime.sendMessage({
    method: 'introduce'
  }, r => {
    chrome.runtime.lastError;
    if (r === true) {
      if (link) {
        chrome.runtime.sendMessage({
          method: 'convert',
          link
        });
      }
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
  });
};

chrome.action.onClicked.addListener(() => onClicked());

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'focus') {
    chrome.windows.update(sender.tab.windowId, {
      focused: true
    });
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const {homepage_url: page, name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, lastFocusedWindow: true}, tbs => tabs.create({
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
