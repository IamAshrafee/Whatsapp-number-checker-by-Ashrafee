// Wait until the page is fully loaded before running our code
document.addEventListener("DOMContentLoaded", function() {

  // Get all the buttons and elements we need
  var runButton = document.getElementById("runScript");
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

  // Variables to store our data
  var users = [];
  var scanning = false;
  var currentTab = null;

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
      chrome.tabs.sendMessage(currentTab, { type: "stop_scan" });
    }
    updateStatus("Stopped", "finished");
    updateButtons();
    addLog("Scanning stopped by user");
  }

  // When run button is clicked
  runButton.addEventListener("click", function() {
    if (scanning) {
      stopScan();
      return;
    }

    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var tab = tabs[0];
      
      // Check if we're on WhatsApp Web
      if (tab.url && tab.url.startsWith("https://web.whatsapp.com")) {
        scanning = true;
        currentTab = tab.id;
        updateStatus("Running...", "running");
        updateButtons();
        addLog("Starting WhatsApp number checker...");
        
        try {
          // Inject our content script
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["js/content.js"],
          }, function() {
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
  settingsButton.addEventListener("click", function() {
    chrome.runtime.openOptionsPage();
  });

  // Clear logs button
  clearLogsButton.addEventListener("click", function() {
    logArea.innerHTML = "";
  });

  // Clear results button
  clearResultsButton.addEventListener("click", function() {
    users = [];
    resultsTable.innerHTML = "";
    userCountDisplay.textContent = 0;
    updateButtons();
    addLog("Results cleared");
  });

  // Listen for messages from other parts of the extension
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    switch (message.type) {
      case "log":
        addLog(message.payload);
        break;
      case "found_user":
        addNewUser(message.payload);
        break;
      case "scan_complete":
        scanning = false;
        updateStatus("Finished", "finished");
        updateButtons();
        addLog(message.payload);
        break;
      case "error":
        scanning = false;
        updateStatus("Error", "error");
        addLog("Error: " + message.payload);
        updateButtons();
        break;
      case "progress":
        updateStatus("Checking " + message.current + "/" + message.total, "running");
        break;
    }
    return true;
  });

  // Function to add a log message
  function addLog(message) {
    var time = new Date();
    var logEntry = document.createElement("div");
    logEntry.textContent = "[" + time.toLocaleTimeString() + "] " + message;
    logArea.appendChild(logEntry);
    logArea.scrollTop = logArea.scrollHeight;
  }

  // Function to add a new user to the results
  function addNewUser(user) {
    // Check if user already exists
    var exists = users.some(function(u) {
      return u.Number === user.Number;
    });
    
    if (exists) {
      addLog("⚠️ Duplicate skipped: " + user.Number);
      return;
    }
    
    // Add the new user
    users.push(user);
    userCountDisplay.textContent = users.length;

    // Add to the results table
    var newRow = document.createElement("tr");
    newRow.innerHTML = "<td>" + user.Reference + "</td><td>" + user.Number + "</td>";
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
  exportJsonButton.addEventListener("click", function() {
    var jsonData = JSON.stringify(users, null, 2);
    download(jsonData, "whatsapp_users.json", "application/json");
    addLog("Exported results as JSON");
  });

  // Export as CSV
  exportCsvButton.addEventListener("click", function() {
    var csv = "Reference,Number\n";
    users.forEach(function(user) {
      var safeName = user.Reference.replace(/"/g, '""');
      csv += '"' + safeName + '","' + user.Number + '"\n';
    });
    download(csv, "whatsapp_users.csv", "text/csv");
    addLog("Exported results as CSV");
  });

  // Copy to clipboard
  copyButton.addEventListener("click", function() {
    var text = "Reference\tNumber\n";
    users.forEach(function(user) {
      text += user.Reference + "\t" + user.Number + "\n";
    });
    
    navigator.clipboard.writeText(text).then(function() {
      addLog("Results copied to clipboard!");
    }, function() {
      addLog("Error: Could not copy to clipboard.");
    });
  });

  // Set initial state when page loads
  updateStatus("Idle", "idle");
  updateButtons();
});