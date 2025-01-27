/* global permission, onClicked */

{
  const onStartup = () => {
    if (onStartup.done) {
      return;
    }
    onStartup.done = true;

    chrome.contextMenus.create({
      title: 'Open a Sample',
      id: 'sample',
      contexts: ['action']
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      title: 'Usage Preview',
      id: 'preview',
      contexts: ['action']
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      title: 'Convert to MP3',
      id: 'convert-media',
      contexts: ['audio', 'video']
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      title: 'Convert to MP3',
      id: 'convert-link',
      contexts: ['link'],
      targetUrlPatterns: [
        'avi', 'mp4', 'webm', 'flv', 'mov', 'ogv', '3gp', 'mpg', 'wmv', 'swf', 'mkv',
        'pcm', 'wav', 'aac', 'ogg', 'wma', 'flac', 'mid', 'mka', 'm4a', 'voc'
      ].map(a => '*://*/*.' + a)
    }, () => chrome.runtime.lastError);
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
  else if (info.menuItemId === 'preview') {
    chrome.tabs.create({
      url: 'https://www.youtube.com/watch?v=j0KeXQDRl_0'
    });
  }
  else if (info.menuItemId === 'convert-media' || info.menuItemId === 'convert-link') {
    const link = info.menuItemId === 'convert-media' ? info.srcUrl : info.linkUrl;

    permission([link]).then(() => onClicked(link));
  }
});
