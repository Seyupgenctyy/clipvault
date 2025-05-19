// Background service that monitors clipboard changes and stores them locally
let lastCopiedText = '';
let isMonitoring = false;
let settings = {
  maxClips: 100,
  autoDeleteAfterDays: 7,
  isMonitoringEnabled: true
};

// Load settings
chrome.storage.local.get(['settings', 'isMonitoring'], (result) => {
  if (result.settings) {
    settings = result.settings;
  } else {
    chrome.storage.local.set({ settings });
  }
  
  if (typeof result.isMonitoring !== 'undefined') {
    isMonitoring = result.isMonitoring;
  } else {
    chrome.storage.local.set({ isMonitoring: true });
    isMonitoring = true;
  }
  
  // Initialize after settings are loaded
  if (isMonitoring && settings.isMonitoringEnabled) {
    startListening();
  }
});

// Check if a URL is valid for script injection
function isValidUrl(url) {
  if (!url) return false;
  
  // Exclude browser internal pages and other special URLs
  return !url.startsWith('chrome:') && 
         !url.startsWith('chrome-extension:') && 
         !url.startsWith('edge:') && 
         !url.startsWith('about:') && 
         !url.startsWith('chrome-search:') && 
         !url.startsWith('chrome-devtools:') && 
         !url.startsWith('file:') && 
         !url.startsWith('view-source:');
}

// Get tabs to inject content script
function startListening() {
  console.log('Starting clipboard monitoring...');
  
  // Send content script to all tabs
  chrome.tabs.query({}, (tabs) => {
    console.log(`Found ${tabs.length} tabs to inject content script`);
    for (let tab of tabs) {
      try {
        if (tab.id && isValidUrl(tab.url)) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).catch((err) => {
            console.log(`Skipping tab ${tab.id}: ${err.message}`);
          });
        }
      } catch (error) {
        console.log(`Error processing tab ${tab.id}: ${error.message}`);
      }
    }
  });
}

// Inject content script when a new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  if (isMonitoring && settings.isMonitoringEnabled) {
    setTimeout(() => {
      try {
        if (tab.id && isValidUrl(tab.url)) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).catch((err) => {
            console.log(`Skipping new tab ${tab.id}: ${err.message}`);
          });
        }
      } catch (error) {
        console.log(`Error processing new tab ${tab.id}: ${error.message}`);
      }
    }, 1000); // Wait a bit for tab to load
  }
});

// Also inject content script when tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isMonitoring && settings.isMonitoringEnabled) {
    try {
      if (isValidUrl(tab.url)) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).catch((err) => {
          console.log(`Skipping updated tab ${tabId}: ${err.message}`);
        });
      }
    } catch (error) {
      console.log(`Error processing updated tab ${tabId}: ${error.message}`);
    }
  }
});

// Permission and content script management
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated, initializing...');
  // We added scripting permission to the manifest, now load the content script
  if (isMonitoring && settings.isMonitoringEnabled) {
    startListening();
  }
});

// Save text from clipboard
function saveClip(text) {
  console.log('Saving clip:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  
  if (!text || text === lastCopiedText) return;
  
  lastCopiedText = text;
  const now = new Date();
  const newClip = {
    id: Date.now(),
    text: text,
    createdAt: now.toISOString(),
    isFavorite: false
  };
  
  chrome.storage.local.get(['clips'], (result) => {
    const clips = result.clips || [];
    
    // Check if this text already exists in recent clips
    const exists = clips.some(clip => clip.text === text);
    if (exists) {
      console.log('This text already exists in clips, not saving duplicate');
      return;
    }
    
    // Add new clip
    clips.unshift(newClip);
    console.log(`Added new clip. Total clips: ${clips.length}`);
    
    // Remove oldest clip if maximum is exceeded
    if (clips.length > settings.maxClips) {
      clips.pop();
    }
    
    // Clean clips older than auto-delete setting
    if (settings.autoDeleteAfterDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - settings.autoDeleteAfterDays);
      
      const filteredClips = clips.filter(clip => {
        // Don't delete favorites
        if (clip.isFavorite) return true;
        
        const clipDate = new Date(clip.createdAt);
        return clipDate > cutoffDate;
      });
      
      chrome.storage.local.set({ clips: filteredClips });
      console.log(`Stored ${filteredClips.length} clips after filtering`);
    } else {
      chrome.storage.local.set({ clips });
      console.log(`Stored ${clips.length} clips`);
    }
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.action);
  
  if (message.action === 'toggleMonitoring') {
    isMonitoring = message.enabled;
    chrome.storage.local.set({ isMonitoring });
    console.log(`Monitoring toggled to: ${isMonitoring}`);
    sendResponse({ status: 'success', isMonitoring });
    
    if (isMonitoring && settings.isMonitoringEnabled) {
      startListening();
    }
  } else if (message.action === 'updateSettings') {
    settings = message.settings;
    chrome.storage.local.set({ settings });
    console.log('Settings updated:', settings);
    sendResponse({ status: 'success', settings });
  } else if (message.action === 'getState') {
    sendResponse({ isMonitoring, settings });
  } else if (message.action === 'copyDetected') {
    if (isMonitoring && settings.isMonitoringEnabled && message.text) {
      saveClip(message.text);
      sendResponse({ status: 'success' });
    }
  } else if (message.action === 'contentScriptReady') {
    console.log('Content script ready in tab:', sender.tab ? sender.tab.id : 'unknown');
    sendResponse({ status: 'acknowledged' });
  }
  
  return true;
}); 