document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settings-form');
    const statusDiv = document.getElementById('status-save');

    const defaultSettings = {
        randomDelay: true,
        batchProcessing: true,
        pauseBetweenBatches: true,
        simulateErrors: true,
        randomOrder: true
    };

    // Load settings and update the form
    chrome.storage.sync.get('settings', (data) => {
        const settings = { ...defaultSettings, ...data.settings };
        Object.keys(settings).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.checked = settings[key];
            }
        });
    });

    // Save settings when any checkbox changes
    settingsForm.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            chrome.storage.sync.get('settings', (data) => {
                const settings = { ...defaultSettings, ...data.settings };
                settings[e.target.id] = e.target.checked;
                chrome.storage.sync.set({ settings }, () => {
                    statusDiv.textContent = 'Settings saved!';
                    setTimeout(() => {
                        statusDiv.textContent = '';
                    }, 1500);
                });
            });
        }
    });
});