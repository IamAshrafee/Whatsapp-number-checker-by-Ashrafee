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
  return new Promise(function(resolve) {
    setTimeout(resolve, waitTime);
  });
}

// Function to wait until element appears (with no timeout)
function waitForElement(selector) {
  return new Promise(function(resolve) {
    function checkElement() {
      var element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else {
        setTimeout(checkElement, 100);
      }
    }
    checkElement();
  });
}

// Function to get random batch size (25-35)
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

// Main function to check WhatsApp users from last message
function checkWhatsAppUsersFromLastMessage() {
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
  var textSpans = lastMessage.querySelectorAll('span.x1lliihq');
  sendMessageToPopup("log", "📃 Lines in last message: " + textSpans.length);

  // Process lines with all human-like behaviors
  processLinesWithHumanBehavior(textSpans).then(function() {
    sendMessageToPopup("scan_complete", "✅ Done! All lines have been checked.");
  }).catch(function(error) {
    sendMessageToPopup("error", "An error occurred: " + error.message);
  });
}

// Function to process lines with human-like behavior
async function processLinesWithHumanBehavior(lines) {
  var linesArray = Array.from(lines);
  var skippedLines = []; // Array to store skipped line indices
  
  // Randomly decide to process in reverse order (30% chance)
  if (Math.random() < 0.3) {
    linesArray.reverse();
    sendMessageToPopup("log", "🔀 Checking lines in reverse order");
  }

  var currentIndex = 0;
  while (currentIndex < linesArray.length) {
    // Get random batch size
    var batchSize = getRandomBatchSize();
    var batchEnd = Math.min(currentIndex + batchSize, linesArray.length);

    sendMessageToPopup("log", "📊 Processing batch of " + batchSize + " lines");

    // Process current batch
    for (var i = currentIndex; i < batchEnd; i++) {
      // Add initial delay before processing each line
      await waitRandomTime(800, 2000);
      
      // Skip with 10% probability (simulate human error)
      if (shouldSimulateError()) {
        sendMessageToPopup("log", "🤷‍♂️ Oops! Missed line " + (i + 1) + " (human error simulation)");
        skippedLines.push({line: linesArray[i], index: i + 1});
        continue;
      }

      await processLine(linesArray[i], i + 1);
    }

    currentIndex = batchEnd;

    // Pause after each batch except the last one
    if (currentIndex < linesArray.length) {
      var pauseDuration = getRandomPauseDuration();
      var pauseMinutes = Math.round(pauseDuration / 60000);
      sendMessageToPopup("log", "⏸️ Pausing for ~" + pauseMinutes + " minutes...");
      await new Promise(resolve => setTimeout(resolve, pauseDuration));
      sendMessageToPopup("log", "↩️ Resuming checking...");
    }
  }

  // Check if there were any skipped lines
  if (skippedLines.length > 0) {
    sendMessageToPopup("log", "🔍 Going back to check " + skippedLines.length + " skipped lines...");
    
    // Process all skipped lines with a small delay between each
    for (var j = 0; j < skippedLines.length; j++) {
      await waitRandomTime(800, 2000);
      sendMessageToPopup("log", "🔍 Re-checking previously skipped line " + skippedLines[j].index);
      await processLine(skippedLines[j].line, skippedLines[j].index);
    }
    
    sendMessageToPopup("log", "✅ Finished checking all skipped lines");
  }
}

// Function to process a single line
async function processLine(line, lineNumber) {
  sendMessageToPopup("log", "🔍 Checking Line " + lineNumber);

  // Find all links in the current line
  var links = line.querySelectorAll("a");
  if (links.length === 0) {
    sendMessageToPopup("log", "⚠️ Skipped: No <a> tag found.");
    return;
  }

  // Get the last link (which should be the number)
  var numberLink = links[links.length - 1];
  var phoneNumber = numberLink.textContent ? numberLink.textContent.trim() : "";
  
  if (!phoneNumber) {
    sendMessageToPopup("log", "⚠️ Skipped: Number not found.");
    return;
  }

  // Extract the name from the rest of the text
  var userName = "";
  line.childNodes.forEach(function(node) {
    if (node !== numberLink) {
      userName += node.textContent ? node.textContent.trim() : "";
    }
  });
  userName = userName.trim();

  if (!userName) {
    sendMessageToPopup("log", "⚠️ Skipped: Reference not found.");
    return;
  }

  sendMessageToPopup("log", "👤 Reference: " + userName);
  sendMessageToPopup("log", "📞 Number: " + phoneNumber);

  // Click on the number to open the profile
  numberLink.click();
  sendMessageToPopup("log", "🖱️ Clicked the number");

  try {
    // Wait for dropdown to appear (no timeout, will wait indefinitely)
    var dropdownMenu = await waitForElement('span > div[role="application"]');
    
    // Count the items in the dropdown
    var menuItemsCount = dropdownMenu.querySelectorAll("li").length;
    sendMessageToPopup("log", "📋 <li> items found: " + menuItemsCount);

    // Check if WhatsApp is found (2 menu items means it's a valid contact)
    var whatsappStatus = menuItemsCount === 2 ? "found" : "not found";
    sendMessageToPopup("log", "✅ WhatsApp status: " + whatsappStatus);

    // If valid contact, send the user data to popup
    if (whatsappStatus === "found") {
      sendMessageToPopup("found_user", { 
        Reference: userName, 
        Number: phoneNumber 
      });
    }
  } catch (error) {
    sendMessageToPopup("log", "⚠️ Error checking dropdown: " + error.message);
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === "start_check") {
    checkWhatsAppUsersFromLastMessage().catch(function(error) {
      sendMessageToPopup("error", "An unexpected error occurred: " + error.message);
    });
    return true; // Keep the message channel open for async response
  }
});