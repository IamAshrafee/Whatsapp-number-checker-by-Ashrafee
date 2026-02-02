/**
 * WhatsApp Number Checker - Content Script
 * 
 * This script runs on WhatsApp Web and checks which phone numbers have WhatsApp accounts.
 * It reads numbers from the last message, clicks each number, checks the dropdown menu,
 * and reports results back to the extension popup.
 * 
 * Key Features:
 * - Stop scan functionality
 * - Human-like behavior simulation (random delays, random order, error simulation)
 * - Aggressive dropdown closing to prevent result misalignment
 * - Proper timing to ensure dropdowns are fully loaded/closed
 */

let settings = {
  randomDelay: true,
  batchProcessing: true,
  pauseBetweenBatches: true,
  simulateErrors: true,
  randomOrder: true
};

// Global flags for scan control
let shouldStop = false;
let isPaused = false;

// Progress tracking
let progressData = {
  current: 0,
  total: 0,
  found: 0,
  notFound: 0
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Function to load settings from Chrome storage
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (data) => {
      if (data.settings) {
        settings = { ...settings, ...data.settings };
      }
      resolve();
    });
  });
}

// Function to send messages to the extension popup
function sendMessageToPopup(messageType, messageData) {
  chrome.runtime.sendMessage({
    type: messageType,
    payload: messageData
  });
}

// Function to wait for a random amount of time
function waitRandomTime(minTime, maxTime) {
  var waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise(function (resolve) {
    setTimeout(resolve, waitTime);
  });
}

// Wait for specific element to appear in DOM (with timeout)
function waitForElement(selector, timeout = 10000) {
  return new Promise(function (resolve, reject) {
    const startTime = Date.now();
    function checkElement() {
      var element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for element: ${selector}`));
      } else {
        setTimeout(checkElement, 100);
      }
    }
    checkElement();
  });
}

// Generate random batch size for human-like processing
function getRandomBatchSize() {
  return Math.floor(Math.random() * 11) + 25; // 25-35
}

// Function to get random pause duration (4-6 minutes in ms)
function getRandomPauseDuration() {
  return (Math.floor(Math.random() * 13) + 48) * 1000 * 5; // 4-6 minutes in ms
}

// Function to simulate occasional human error (10% chance)
function shouldSimulateError() {
  return Math.random() < 0.1; // 10% chance
}

// ============================================================================
// TIMING & DELAY FUNCTIONS
// ============================================================================

// ============================================================================
// MAIN PROCESSING LOGIC
// ============================================================================

// Main function to check WhatsApp users from last message
async function checkWhatsAppUsersFromLastMessage() {
  await loadSettings();
  sendMessageToPopup("log", "🚀 Starting WhatsApp check from the LAST message...");

  // Find all message rows in the chat
  var allMessages = document.querySelectorAll('div[role="row"]');
  var messageCount = allMessages.length;

  if (messageCount === 0) {
    sendMessageToPopup("error", "No messages found!");
    return;
  }

  sendMessageToPopup("log", "📦 Total messages found: " + messageCount);

  // Get the last message in the chat
  var lastMessage = allMessages[messageCount - 1];
  sendMessageToPopup("log", "🧩 Analyzing last message...");

  // Find all text spans in the last message
  // The message structure has a parent span containing multiple child spans (one per line)
  // We need ONLY the individual line spans, not the parent container
  var allSpans = lastMessage.querySelectorAll('span');
  var textSpans = Array.from(allSpans).filter(function (span) {
    // Must contain a tab character (userName\tphoneNumber format)
    if (!span.textContent || !span.textContent.includes('\t')) {
      return false;
    }

    // Must NOT have child spans (otherwise it's a parent container)
    var childSpans = span.querySelectorAll('span');
    if (childSpans.length > 0) {
      return false; // This is a parent, skip it
    }

    // Must contain an <a> tag (the phone number link)
    var links = span.querySelectorAll('a');
    if (links.length === 0) {
      return false;
    }

    return true;
  });

  sendMessageToPopup("log", "📃 Lines in last message: " + textSpans.length);

  // Initialize progress tracking
  progressData = {
    current: 0,
    total: textSpans.length,
    found: 0,
    notFound: 0
  };

  // Process lines with all human-like behaviors
  try {
    await processLinesWithHumanBehavior(textSpans);

    // Send final summary
    sendMessageToPopup("scan_complete", {
      message: "✅ Done! All lines have been checked.",
      summary: {
        total: progressData.total,
        found: progressData.found,
        notFound: progressData.notFound
      }
    });
  } catch (error) {
    sendMessageToPopup("error", "An error occurred: " + error.message);
  }
}

// Function to process lines with human-like behavior
async function processLinesWithHumanBehavior(lines) {
  var linesArray = Array.from(lines);
  var skippedLines = [];

  if (settings.randomOrder && Math.random() < 0.3) {
    linesArray.reverse();
  }

  if (!settings.batchProcessing) {
    sendMessageToPopup("log", "🏃‍♂️ Processing all lines without batching and pausing.");
  }

  let currentIndex = 0;
  while (currentIndex < linesArray.length) {
    let batchSize = linesArray.length; // Default to all lines
    if (settings.batchProcessing) {
      batchSize = getRandomBatchSize();
    }

    const batchEnd = Math.min(currentIndex + batchSize, linesArray.length);

    if (settings.batchProcessing) {
      sendMessageToPopup("log", `📊 Processing batch of ${batchEnd - currentIndex} lines`);
    }

    for (let i = currentIndex; i < batchEnd; i++) {
      // Check if user requested stop
      if (shouldStop) {
        sendMessageToPopup("log", "⏹ Scanning stopped by user");
        return;
      }

      // Check if user requested pause
      while (isPaused) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (settings.randomDelay) {
        await waitRandomTime(800, 2000);
      }

      // Skip this line randomly (simulate human error)
      if (settings.simulateErrors && shouldSimulateError()) { // Kept original function name as per faithful edit
        sendMessageToPopup("log", `🤷‍♂️ Oops! Missed line ${i + 1} (human error simulation)`);
        skippedLines.push(i); // Changed to push index directly
        progressData.current++; // Increment progress even for skipped lines
        sendMessageToPopup("update_progress", progressData);
        continue;
      }

      sendMessageToPopup("log", `🔍 Checking Line ${i + 1}`);
      await processLine(linesArray[i]); // Removed lineNumber parameter
      progressData.current++;
      sendMessageToPopup("update_progress", progressData);
    }

    currentIndex = batchEnd;

    if (settings.batchProcessing && settings.pauseBetweenBatches && currentIndex < linesArray.length) {
      const pauseDuration = getRandomPauseDuration();
      const pauseMinutes = Math.round(pauseDuration / 60000);
      sendMessageToPopup("log", `⏸️ Pausing for ~${pauseMinutes} minutes...`);
      await new Promise(resolve => setTimeout(resolve, pauseDuration));
      sendMessageToPopup("log", "↩️ Resuming checking...");
    }
  }

  if (settings.simulateErrors && skippedLines.length > 0) {
    sendMessageToPopup("log", `🔍 Going back to check ${skippedLines.length} skipped lines...`);

    for (const skipped of skippedLines) {
      if (settings.randomDelay) {
        await waitRandomTime(800, 2000);
      }
      sendMessageToPopup("log", `🔍 Re-checking previously skipped line ${skipped.index}`);
      await processLine(skipped.line, skipped.index);
    }

    sendMessageToPopup("log", "✅ Finished checking all skipped lines");
  }
}

// Function to process a single line
async function processLine(line, lineNumber) {
  sendMessageToPopup("log", "🔍 Checking Line " + lineNumber);

  // Get the full text content and split by tab to extract userName and phoneNumber
  // WhatsApp format is: "userName\tphoneNumber"
  var fullText = line.textContent ? line.textContent.trim() : "";

  if (!fullText) {
    sendMessageToPopup("log", "⚠️ Skipped: Empty line.");
    return;
  }

  // Split by tab character
  var parts = fullText.split('\t');

  if (parts.length < 2) {
    sendMessageToPopup("log", "⚠️ Skipped: Invalid format (no tab separator).");
    return;
  }

  // Capture variables immediately before any async operations
  const userName = parts[0].trim();
  const phoneNumber = parts[parts.length - 1].trim();

  if (!userName) {
    sendMessageToPopup("log", "⚠️ Skipped: Reference not found.");
    return;
  }

  if (!phoneNumber) {
    sendMessageToPopup("log", "⚠️ Skipped: Number not found.");
    return;
  }

  sendMessageToPopup("log", "👤 Reference: " + userName);
  sendMessageToPopup("log", "📞 Number: " + phoneNumber);

  // Find the phone number link to click
  var links = line.querySelectorAll("a");
  if (links.length === 0) {
    sendMessageToPopup("log", "⚠️ Skipped: No <a> tag found.");
    return;
  }

  // Get the last link (which should be the number)
  var numberLink = links[links.length - 1];

  // Click number and wait for old dropdown to clear
  numberLink.click();
  await waitRandomTime(700, 1000);

  try {
    // Wait for dropdown and let it populate
    var dropdownMenu = await waitForElement('span > div[role="application"]');
    await waitRandomTime(300, 500);

    // Count the items in the dropdown
    var menuItemsCount = dropdownMenu.querySelectorAll("li").length;
    sendMessageToPopup("log", "📋 <li> items found: " + menuItemsCount);

    // Check if WhatsApp is found (2 menu items means it's a valid contact)
    var whatsappStatus = menuItemsCount === 2 ? "found" : "not found";
    sendMessageToPopup("log", "✅ WhatsApp status: " + whatsappStatus);

    // Track statistics
    if (whatsappStatus === "found") {
      progressData.found++;
    } else {
      progressData.notFound++;
    }

    // If valid contact, send the user data to popup
    if (whatsappStatus === "found") {
      sendMessageToPopup("found_user", {
        Reference: userName,
        Number: phoneNumber
      });
    }

    // CRITICAL: Close the dropdown and wait for it to be fully hidden
    // WhatsApp Web doesn't remove dropdowns from DOM, just hides them
    try {
      // Strategy 1: Click on the dropdown element itself to dismiss it
      if (dropdownMenu && dropdownMenu.parentElement) {
        dropdownMenu.parentElement.click();
      }

      // Strategy 2: Press Escape key (WhatsApp standard way to close popups)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));

      // Strategy 3: Click on document body as backup
      document.body.click();

      // IMPORTANT: Wait longer since dropdown doesn't disappear from DOM, just gets hidden
      await waitRandomTime(1000, 1500);
    } catch (closeError) {
      await waitRandomTime(1000, 1500);
    }
  } catch (error) {
    sendMessageToPopup("log", "⚠️ Error: " + error.message);
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "start_check") {
    shouldStop = false;
    isPaused = false;
    checkWhatsAppUsersFromLastMessage().catch(function (error) {
      sendMessageToPopup("error", "An unexpected error occurred: " + error.message);
    });
  } else if (request.type === "stop_scan") {
    shouldStop = true;
    sendMessageToPopup("log", "⏹ Stop request received");
  } else if (request.type === "pause_scan") {
    isPaused = true;
    sendMessageToPopup("log", "⏸ Scan paused");
  } else if (request.type === "resume_scan") {
    isPaused = false;
    sendMessageToPopup("log", "▶️ Scan resumed");
  }
});