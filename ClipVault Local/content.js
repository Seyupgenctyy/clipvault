// Content script: Code that monitors copy operations and reports them to the background script

// Prevent multiple injections
if (window.clipVaultInitialized !== true) {
  window.clipVaultInitialized = true;

  // Keep track of the last copied text to avoid duplicates
  let lastCopiedText = '';

  // Direct copy event listener - catches most copy events
  document.addEventListener('copy', (event) => {
    // Check the selection first
    const selection = window.getSelection().toString();
    if (selection && selection !== lastCopiedText) {
      lastCopiedText = selection;
      sendTextToBackground(selection);
      return;
    }
    
    // If selection is empty, try to get clipboard content after a short delay
    setTimeout(getClipboardContent, 100);
  });

  // Function to get clipboard content using execCommand
  function getClipboardContent() {
    try {
      // Create a temporary element
      const tempElement = document.createElement('textarea');
      tempElement.style.position = 'fixed';
      tempElement.style.left = '-999px';
      tempElement.style.top = '0';
      tempElement.setAttribute('readonly', '');
      document.body.appendChild(tempElement);
      
      // Focus and execute paste
      tempElement.focus();
      const successful = document.execCommand('paste');
      
      if (successful) {
        const text = tempElement.value;
        if (text && text !== lastCopiedText) {
          lastCopiedText = text;
          sendTextToBackground(text);
        }
      }
      
      // Clean up
      document.body.removeChild(tempElement);
    } catch (error) {
      console.error('Error getting clipboard content:', error);
    }
  }

  // Listen for keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    // Ctrl+C or Cmd+C (for Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      const selection = window.getSelection().toString();
      if (selection && selection !== lastCopiedText) {
        lastCopiedText = selection;
        // Use setTimeout to let the copy operation complete
        setTimeout(() => {
          sendTextToBackground(selection);
        }, 100);
      }
    }
  });

  // Context menu listener for right-click copy
  document.addEventListener('contextmenu', (event) => {
    // Store the current selection
    const selection = window.getSelection().toString();
    if (selection) {
      // Set up a monitor for this selection
      const checkForCopy = () => {
        document.addEventListener('copy', () => {
          if (selection !== lastCopiedText) {
            lastCopiedText = selection;
            sendTextToBackground(selection);
          }
        }, { once: true });
      };
      checkForCopy();
    }
  });

  // Function to send text to background script
  function sendTextToBackground(text) {
    if (!text || text.trim() === '') return;
    
    chrome.runtime.sendMessage({
      action: 'copyDetected',
      text: text
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send copied text:', chrome.runtime.lastError);
      }
    });
  }

  // Function to safely initialize the mutation observer
  function initMutationObserver() {
    if (!document.body) {
      // If body isn't available yet, wait for it
      window.addEventListener('DOMContentLoaded', initMutationObserver);
      return;
    }
    
    // Additional mutation observer to watch for text selection changes
    const textSelectionObserver = new MutationObserver((mutations) => {
      // Check if user has selected text
      const selection = window.getSelection().toString();
      if (selection && selection.length > 0) {
        // Add keydown and contextmenu listeners
        document.addEventListener('keydown', (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            if (selection !== lastCopiedText) {
              lastCopiedText = selection;
              setTimeout(() => sendTextToBackground(selection), 100);
            }
          }
        }, { once: true });
        
        document.addEventListener('contextmenu', () => {
          if (selection !== lastCopiedText) {
            document.addEventListener('copy', () => {
              lastCopiedText = selection;
              sendTextToBackground(selection);
            }, { once: true });
          }
        }, { once: true });
      }
    });

    // Start observing the document
    try {
      textSelectionObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      console.log('ClipVault: Observer initialized successfully');
    } catch (error) {
      console.error('ClipVault: Error initializing observer:', error);
    }
  }

  // Initialize the observer safely
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initMutationObserver);
  } else {
    initMutationObserver();
  }

  // Notify background script that content script is loaded
  chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error connecting to background script:', chrome.runtime.lastError);
    }
  });
  
  console.log('ClipVault initialized in this page');
} 