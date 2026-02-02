// Wait until the page is fully loaded before running our code
document.addEventListener("DOMContentLoaded", function () {

  // Get all the buttons and elements we need
  var runButton = document.getElementById("runScript");
  var pauseResumeBtn = document.getElementById("pauseResumeBtn");
  var clearLogsButton = document.getElementById("clearLogs");
  var clearResultsButton = document.getElementById("clearResults");
  var exportJsonButton = document.getElementById("exportJson");
  var exportCsvButton = document.getElementById("exportCsv");
  var copyButton = document.getElementById("copyToClipboard");
  var settingsButton = document.getElementById("settingsButton");
  var logArea = document.getElementById("log-container");
  var statusText = document.getElementById("status");
  var resultsTable = document.querySelector("#results-table tbody");
  var userCountDisplay = document.getElementById("user-count");

  // Progress elements
  var progressSection = document.getElementById("progressSection");
  var progressBar = document.getElementById("progressBar");
  var progressText = document.getElementById("progressText");
  var timeEstimate = document.getElementById("timeEstimate");

  // Summary elements
  var summarySection = document.getElementById("summarySection");
  var summaryFound = document.getElementById("summaryFound");
  var summaryNotFound = document.getElementById("summaryNotFound");
  var summaryTotal = document.getElementById("summaryTotal");

  // Variables to store our data
  var users = [];
  var scanning = false;
  var isPaused = false;
  var currentTab = null;

  // Progress tracking
  var startTime = null;
  var checksCompleted = 0;

  // Function to update the status message
  function updateStatus(text, statusType) {
    statusText.textContent = text;
    // Remove all status classes first
    statusText.classList.remove("status-idle", "status-running", "status-finished", "status-error");
    // Add the new status class
    statusText.classList.add("status-" + statusType);
  }

  // Function to enable/disable buttons based on current state
  function updateButtons() {
    runButton.disabled = scanning;
    runButton.textContent = scanning ? "⏹ Stop Scanning" : "▶️ Start Checking";
    exportJsonButton.disabled = scanning || users.length === 0;
    exportCsvButton.disabled = scanning || users.length === 0;
    copyButton.disabled = scanning || users.length === 0;
  }

  // Function to stop the scanning process
  function stopScan() {
    scanning = false;
    if (currentTab) {
      // Note: The content script needs to be listening for this message.
      chrome.tabs.sendMessage(currentTab, { type: "stop_scan" });
    }
    updateStatus("Stopped", "finished");
    updateButtons();
    addLog("Scanning stopped by user");
  }

  // When run button is clicked
  runButton.addEventListener("click", function () {
    if (scanning) {
      stopScan();
      return;
    }

    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];

      // Check if we're on WhatsApp Web
      if (tab.url && tab.url.startsWith("https://web.whatsapp.com")) {
        scanning = true;
        isPaused = false;
        currentTab = tab.id;
        startTime = Date.now();
        checksCompleted = 0;

        updateStatus("Running...", "running");
        updateButtons();
        pauseResumeBtn.style.display = "inline-flex";
        pauseResumeBtn.textContent = "⏸ Pause";
        progressSection.style.display = "block";
        summarySection.style.display = "none";

        // Reset progress
        updateProgress(0, 0, 0, 0);

        addLog("Starting WhatsApp number checker...");

        try {
          // Inject our content script
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["js/content.js"],
          }, function () {
            // Send message to start checking
            chrome.tabs.sendMessage(tab.id, { type: "start_check" });
          });
        } catch (error) {
          addLog("Error: " + error.message);
          updateStatus("Error", "error");
          scanning = false;
          updateButtons();
        }
      } else {
        addLog("Error: Please open WhatsApp Web (web.whatsapp.com) first");
        updateStatus("Error", "error");
      }
    });
  });

  // Settings button
  settingsButton.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });

  // Clear logs button
  clearLogsButton.addEventListener("click", function () {
    logArea.innerHTML = "";
  });

  // Clear results button
  clearResultsButton.addEventListener("click", function () {
    users = [];
    resultsTable.innerHTML = "";
    userCountDisplay.textContent = 0;
    summarySection.style.display = "none";
    updateButtons();
    addLog("Results cleared");
  });

  // Pause/Resume button
  pauseResumeBtn.addEventListener("click", togglePause);

  // Listen for messages from other parts of the extension
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.type) {
      case "log":
        addLog(message.payload);
        break;
      case "update_progress":
        updateProgress(
          message.payload.current,
          message.payload.total,
          message.payload.found,
          message.payload.notFound
        );
        break;
      case "found_user":
        addNewUser(message.payload);
        break;
      case "scan_complete":
        scanning = false;
        isPaused = false;
        updateStatus("Finished", "finished");
        updateButtons();
        pauseResumeBtn.style.display = "none";
        progressSection.style.display = "none";

        // Show summary if available
        if (message.payload && message.payload.summary) {
          showSummary(
            message.payload.summary.total,
            message.payload.summary.found,
            message.payload.summary.notFound
          );
          addLog(message.payload.message);
        } else {
          addLog(message.payload);
        }

        // Play completion sound
        playCompletionSound();
        break;
      case "error":
        scanning = false;
        isPaused = false;
        updateStatus("Error", "error");
        updateButtons();
        pauseResumeBtn.style.display = "none";
        progressSection.style.display = "none";
        addLog("Error: " + message.payload);
        break;
    }
  });

  // Add a message to the log area
  function addLog(message) {
    var timestamp = new Date().toLocaleTimeString();
    logArea.textContent += `[${timestamp}] ${message}\n`;
    logArea.scrollTop = logArea.scrollHeight;
  }

  // Update progress bar and text
  function updateProgress(current, total, found, notFound) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    progressBar.style.width = percentage + "%";
    progressText.textContent = `${current}/${total} (${percentage}%)`;

    // Calculate time estimate
    if (current > 0) {
      const elapsed = (Date.now() - startTime) / 1000; // seconds
      const avgTimePerCheck = elapsed / current;
      const remaining = total - current;
      const estimatedSeconds = Math.round(avgTimePerCheck * remaining);

      if (estimatedSeconds > 0) {
        const minutes = Math.floor(estimatedSeconds / 60);
        const seconds = estimatedSeconds % 60;
        timeEstimate.textContent = minutes > 0
          ? `~${minutes}m ${seconds}s remaining`
          : `~${seconds}s remaining`;
      } else {
        timeEstimate.textContent = '';
      }
    }
  }

  // Show summary stats
  function showSummary(total, found, notFound) {
    summaryFound.textContent = found;
    summaryNotFound.textContent = notFound;
    summaryTotal.textContent = total;
    summarySection.style.display = "block";
  }

  // Play completion sound
  function playCompletionSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.log('Could not play sound:', e);
    }
  }

  // Toggle pause/resume
  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      pauseResumeBtn.textContent = "▶️ Resume";
      updateStatus("Paused", "idle");
      chrome.tabs.sendMessage(currentTab, { type: "pause_scan" });
    } else {
      pauseResumeBtn.textContent = "⏸ Pause";
      updateStatus("Running...", "running");
      chrome.tabs.sendMessage(currentTab, { type: "resume_scan" });
    }
  }

  // Function to add a new user to the results
  function addNewUser(user) {
    // Check if user already exists
    var exists = users.some(function (u) {
      return u.Number === user.Number;
    });

    if (exists) {
      addLog("⚠️ Duplicate skipped: " + user.Number);
      return;
    }

    // Add the new user
    users.push(user);
    userCountDisplay.textContent = users.length;

    // Add to the results table (using textContent to prevent XSS)
    var newRow = document.createElement("tr");
    var refCell = document.createElement("td");
    var numCell = document.createElement("td");
    refCell.textContent = user.Reference;
    numCell.textContent = user.Number;
    newRow.appendChild(refCell);
    newRow.appendChild(numCell);
    resultsTable.appendChild(newRow);
    updateButtons();
  }

  // Function to download a file
  function download(content, filename, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Export as JSON
  exportJsonButton.addEventListener("click", function () {
    var jsonData = JSON.stringify(users, null, 2);
    download(jsonData, "whatsapp_users.json", "application/json");
    addLog("Exported results as JSON");
  });

  // Export as CSV
  exportCsvButton.addEventListener("click", function () {
    var csv = "Reference,Number\n";
    users.forEach(function (user) {
      var safeName = user.Reference.replace(/"/g, '""');
      csv += '"' + safeName + '","' + user.Number + '"\n';
    });
    download(csv, "whatsapp_users.csv", "text/csv");
    addLog("Exported results as CSV");
  });

  // Copy to clipboard
  copyButton.addEventListener("click", function () {
    var text = "Reference\tNumber\n";
    users.forEach(function (user) {
      text += user.Reference + "\t" + user.Number + "\n";
    });

    navigator.clipboard.writeText(text).then(function () {
      addLog("Results copied to clipboard!");
    }, function () {
      addLog("Error: Could not copy to clipboard.");
    });
  });

  // Set initial state when page loads
  updateStatus("Idle", "idle");
  updateButtons();
});