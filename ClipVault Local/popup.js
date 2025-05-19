// Define interface elements
const monitorToggle = document.getElementById('monitor-toggle');
const monitorStatus = document.getElementById('monitor-status');
const searchInput = document.getElementById('search-input');
const clipsList = document.getElementById('clips-list');
const clipTemplate = document.getElementById('clip-template');
const tabButtons = document.querySelectorAll('.tab-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const maxClipsInput = document.getElementById('max-clips');
const autoDeleteInput = document.getElementById('auto-delete');
const clearAllBtn = document.getElementById('clear-all');
const settingsSaveBtn = document.getElementById('settings-save');
const settingsCancelBtn = document.getElementById('settings-cancel');

// Define state information
let clips = [];
let isMonitoring = true;
let settings = {
  maxClips: 100,
  autoDeleteAfterDays: 7,
  isMonitoringEnabled: true
};
let currentFilter = 'all';

// Load state when page loads
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  addEventListeners();
});

// Add event listeners
function addEventListeners() {
  // Toggle monitoring status
  monitorToggle.addEventListener('change', toggleMonitoring);
  
  // Search in clips
  searchInput.addEventListener('input', filterClips);
  
  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTab(btn.dataset.tab);
    });
  });
  
  // Settings panel
  settingsBtn.addEventListener('click', toggleSettingsPanel);
  settingsSaveBtn.addEventListener('click', saveSettings);
  settingsCancelBtn.addEventListener('click', () => toggleSettingsPanel(false));
  clearAllBtn.addEventListener('click', clearAllClips);
}

// Load state information
function loadState() {
  chrome.storage.local.get(['clips', 'settings', 'isMonitoring'], (result) => {
    // Load clips
    clips = result.clips || [];
    renderClips();
    
    // Load settings
    if (result.settings) {
      settings = result.settings;
      maxClipsInput.value = settings.maxClips;
      autoDeleteInput.value = settings.autoDeleteAfterDays;
    }
    
    // Load monitoring status
    if (typeof result.isMonitoring !== 'undefined') {
      isMonitoring = result.isMonitoring;
      monitorToggle.checked = isMonitoring;
      updateMonitoringStatus();
    }
  });
  
  // Get state from background service
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response) {
      isMonitoring = response.isMonitoring;
      settings = response.settings;
      monitorToggle.checked = isMonitoring;
      updateMonitoringStatus();
    }
  });
}

// Toggle monitoring
function toggleMonitoring() {
  isMonitoring = monitorToggle.checked;
  updateMonitoringStatus();
  
  // Notify background service
  chrome.runtime.sendMessage(
    { action: 'toggleMonitoring', enabled: isMonitoring }
  );
}

// Update monitoring status text
function updateMonitoringStatus() {
  monitorStatus.textContent = isMonitoring ? 'Monitoring On' : 'Monitoring Off';
}

// Filter clips
function filterClips() {
  renderClips();
}

// Change active tab
function setActiveTab(tab) {
  currentFilter = tab;
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  renderClips();
}

// Display clips
function renderClips() {
  // First clear the list except for the empty message
  const emptyMessage = clipsList.querySelector('.empty-message');
  
  // Remove all clip items
  const clipItems = clipsList.querySelectorAll('.clip-item');
  clipItems.forEach(item => item.remove());
  
  // Get search filter
  const searchTerm = searchInput.value.toLowerCase();
  
  // Find clips matching filters
  let filteredClips = clips.filter(clip => {
    // Search term filter
    const matchesSearch = !searchTerm || clip.text.toLowerCase().includes(searchTerm);
    
    // Tab filter
    const matchesTab = currentFilter === 'all' || (currentFilter === 'favorites' && clip.isFavorite);
    
    return matchesSearch && matchesTab;
  });
  
  // Show or hide empty message
  if (filteredClips.length === 0) {
    emptyMessage.style.display = 'block';
  } else {
    emptyMessage.style.display = 'none';
    
    // List clips
    filteredClips.forEach(clip => {
      const clipElement = createClipElement(clip);
      clipsList.appendChild(clipElement);
    });
  }
}

// Create clip element
function createClipElement(clip) {
  const clipNode = document.importNode(clipTemplate.content, true);
  const clipItem = clipNode.querySelector('.clip-item');
  const clipContent = clipNode.querySelector('.clip-content');
  const clipDate = clipNode.querySelector('.clip-date');
  const copyBtn = clipNode.querySelector('.copy-btn');
  const favoriteBtn = clipNode.querySelector('.favorite-btn');
  const deleteBtn = clipNode.querySelector('.delete-btn');
  
  // Set clip ID
  clipItem.dataset.id = clip.id;
  
  // Set clip content
  clipContent.textContent = clip.text;
  
  // Set date information
  const date = new Date(clip.createdAt);
  clipDate.textContent = date.toLocaleString('en-US');
  
  // Set favorite status
  if (clip.isFavorite) {
    favoriteBtn.textContent = '★';
    favoriteBtn.title = 'Remove from Favorites';
  } else {
    favoriteBtn.textContent = '☆';
    favoriteBtn.title = 'Add to Favorites';
  }
  
  // Copy button
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(clip.text)
      .then(() => {
        showToast('Copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy text');
      });
  });
  
  // Favorite button
  favoriteBtn.addEventListener('click', () => {
    toggleFavorite(clip.id);
  });
  
  // Delete button
  deleteBtn.addEventListener('click', () => {
    deleteClip(clip.id);
  });
  
  return clipNode;
}

// Toggle favorite status
function toggleFavorite(clipId) {
  // Find the clip in our local array first
  const clipIndex = clips.findIndex(clip => clip.id === clipId);
  
  if (clipIndex !== -1) {
    // Toggle the favorite status
    clips[clipIndex].isFavorite = !clips[clipIndex].isFavorite;
    
    // Update in storage
    chrome.storage.local.set({ clips: clips }, () => {
      // Re-render after update
      renderClips();
      
      const status = clips[clipIndex].isFavorite ? 'added to' : 'removed from';
      showToast(`Clip ${status} favorites`);
    });
  }
}

// Delete clip
function deleteClip(clipId) {
  // Filter out the clip to be deleted
  const updatedClips = clips.filter(clip => clip.id !== clipId);
  
  // Update local array and storage
  if (updatedClips.length !== clips.length) {
    clips = updatedClips;
    
    chrome.storage.local.set({ clips: updatedClips }, () => {
      renderClips();
      showToast('Clip deleted');
    });
  }
}

// Clear all clips
function clearAllClips() {
  if (confirm('All clips will be deleted. Are you sure?')) {
    clips = [];
    chrome.storage.local.set({ clips: [] }, () => {
      renderClips();
      showToast('All clips cleared');
    });
  }
}

// Toggle settings panel
function toggleSettingsPanel(show) {
  if (show === undefined) {
    settingsPanel.classList.toggle('show');
  } else {
    settingsPanel.classList.toggle('show', show);
  }
}

// Save settings
function saveSettings() {
  settings.maxClips = parseInt(maxClipsInput.value, 10);
  settings.autoDeleteAfterDays = parseInt(autoDeleteInput.value, 10);
  
  chrome.runtime.sendMessage(
    { action: 'updateSettings', settings },
    () => {
      toggleSettingsPanel(false);
      showToast('Settings saved');
    }
  );
}

// Show toast notification
function showToast(message) {
  // Remove any existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => {
    document.body.removeChild(toast);
  });
  
  // Create new toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Show toast with animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Hide and remove toast after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 2000);
} 