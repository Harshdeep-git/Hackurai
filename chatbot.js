// HabitLens.AI - Personalized AI Assistant for Daily Routines and Habits

const API_KEY_STORAGE = 'openai_api_key';

let apiKey = null;

// Conversation state
let conversationState = {
    mode: 'idle',
    onboardingData: {
        wake_time: null,
        sleep_time: null,
        key_goals: null,
        fixed_routines: null,
        productivity_peak: null,
        available_hours: null
    },
    currentQuestion: 0,
    userProfile: null
};

// DOM Elements
let chatbotInput, chatbotSend, chatbotMessages, chatbotToggle, chatbotBody;

// Initialize chatbot
function initChatbot() {
    // Get DOM elements
    chatbotInput = document.getElementById('chatbot-input');
    chatbotSend = document.getElementById('chatbot-send');
    chatbotMessages = document.getElementById('chatbot-messages');
    chatbotToggle = document.getElementById('chatbot-toggle');
    chatbotBody = document.getElementById('chatbot-body');

    // Check for elements
    if (!chatbotInput || !chatbotSend || !chatbotMessages) {
        console.error('Chatbot elements not found');
        return;
    }

    // Get or prompt for API key
    apiKey = localStorage.getItem(API_KEY_STORAGE);
    
    if (!apiKey) {
        showApiKeyPrompt();
        return;
    }

    initializeScheduler();
    setupEventListeners();
    checkUserProfile();
}

// Show API key prompt
function showApiKeyPrompt() {
    chatbotMessages.innerHTML = `
        <div class="api-key-prompt">
            <p><strong>⚠️ OpenAI API Key Required</strong></p>
            <p>Please enter your OpenAI API key to use the AI assistant:</p>
            <input type="password" id="api-key-input" class="api-key-input" placeholder="sk-...">
            <button class="api-key-save-btn" id="save-api-key-btn">Save & Continue</button>
            <p style="font-size: 0.85rem; margin-top: 10px;">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #667eea;">OpenAI Platform</a>
            </p>
        </div>
    `;

    const saveBtn = document.getElementById('save-api-key-btn');
    const apiKeyInput = document.getElementById('api-key-input');

    saveBtn?.addEventListener('click', () => {
        const key = apiKeyInput?.value.trim();
        if (key && key.startsWith('sk-')) {
            localStorage.setItem(API_KEY_STORAGE, key);
            apiKey = key;
            chatbotMessages.innerHTML = '';
            initializeScheduler();
            setupEventListeners();
            checkUserProfile();
        } else {
            alert('Please enter a valid OpenAI API key (starts with sk-)');
        }
    });

    apiKeyInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn?.click();
        }
    });
}

// Initialize scheduler
async function initializeScheduler() {
    try {
        const schedulerModule = await import('./ai-scheduler.js');
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkFirebase = () => {
            if (window.firebaseDb && window.firebaseAuth) {
                schedulerModule.initScheduler(window.firebaseDb, window.firebaseAuth);
                console.log('✅ Scheduler initialized');
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkFirebase, 500);
            } else {
                console.error('❌ Firebase not initialized after max attempts');
            }
        };
        
        checkFirebase();
    } catch (error) {
        console.error("Error initializing scheduler:", error);
    }
}

// Check if user has existing profile
async function checkUserProfile() {
    try {
        // Wait for Firebase to be ready
        let attempts = 0;
        const maxAttempts = 20;
        
        const waitForFirebase = () => {
            return new Promise((resolve) => {
                const checkFirebase = () => {
                    if (window.firebaseDb && window.firebaseAuth && window.firebaseAuth.currentUser) {
                        resolve(true);
                    } else if (attempts < maxAttempts) {
                        attempts++;
                        setTimeout(checkFirebase, 500);
                    } else {
                        resolve(false);
                    }
                };
                checkFirebase();
            });
        };

        const isReady = await waitForFirebase();
        
        if (!isReady) {
            console.warn('Firebase not ready, showing new user greeting');
            showNewUserGreeting();
            return;
        }

        const schedulerModule = await import('./ai-scheduler.js');
        schedulerModule.initScheduler(window.firebaseDb, window.firebaseAuth);
        
        const profile = await schedulerModule.loadUserProfile();
        if (profile) {
            conversationState.userProfile = profile;
            conversationState.mode = 'ready';
            showReturningUserGreeting();
        } else {
            conversationState.mode = 'idle';
            showNewUserGreeting();
        }
    } catch (error) {
        console.error("Error checking profile:", error);
        showNewUserGreeting();
    }
}

// Show greeting for new users
function showNewUserGreeting() {
    chatbotMessages.innerHTML = `
        <div class="message bot-message">
            <div class="message-content">
                <strong>👋 Welcome to HabitLens.AI!</strong><br><br>
                I'm your friendly AI assistant designed to help you plan and improve your daily routines and habits.<br><br>
                I'll create a personalized daily schedule just for you. Let's start by getting to know your habits and preferences!<br><br>
                <strong>Ready to begin? Just say "yes" or "start"!</strong>
            </div>
        </div>
    `;
    conversationState.mode = 'onboarding';
}

// Show greeting for returning users
function showReturningUserGreeting() {
    const profile = conversationState.userProfile;
    const username = profile.username || 'there';
    
    chatbotMessages.innerHTML = `
        <div class="message bot-message">
            <div class="message-content">
                <strong>👋 Welcome back, ${username}!</strong><br><br>
                Would you like me to:<br>
                • Update your schedule based on today's tasks<br>
                • Review yesterday's performance<br>
                • Create a new schedule for today<br><br>
                Just tell me what you'd like to do!
            </div>
        </div>
    `;
    conversationState.mode = 'ready';
}

// Setup event listeners
function setupEventListeners() {
    if (!chatbotSend || !chatbotInput || !chatbotToggle) return;

    chatbotSend.addEventListener('click', handleUserMessage);
    
    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserMessage();
        }
    });
    
    chatbotToggle.addEventListener('click', () => {
        chatbotBody.classList.toggle('collapsed');
        chatbotToggle.textContent = chatbotBody.classList.contains('collapsed') ? '+' : '−';
    });
}

// Handle user message
async function handleUserMessage() {
    const message = chatbotInput.value.trim();
    
    if (!message) return;
    
    if (!apiKey) {
        addMessage('Please configure your API key first.', 'bot');
        showApiKeyPrompt();
        return;
    }
    
    chatbotInput.disabled = true;
    chatbotSend.disabled = true;
    
    addMessage(message, 'user');
    chatbotInput.value = '';
    
    const loadingId = showLoading();
    
    try {
        await processMessage(message, loadingId);
    } catch (error) {
        console.error('Error processing message:', error);
        removeLoading(loadingId);
        addMessage(`Sorry, I encountered an error: ${error.message}. Please try again.`, 'bot');
    } finally {
        chatbotInput.disabled = false;
        chatbotSend.disabled = false;
        chatbotInput.focus();
    }
}

// Process message based on conversation state
async function processMessage(message, loadingId) {
    removeLoading(loadingId);
    
    if (conversationState.mode === 'onboarding') {
        if (message.toLowerCase().includes('yes') || message.toLowerCase().includes('start') || message.toLowerCase().includes('begin')) {
            conversationState.mode = 'onboarding_q1';
            askQuestion1();
        } else {
            addMessage('Just say "yes" or "start" to begin! 😊', 'bot');
        }
    } 
    else if (conversationState.mode === 'onboarding_q1') {
        conversationState.onboardingData.wake_time = extractTime(message);
        conversationState.mode = 'onboarding_q2';
        askQuestion2();
    }
    else if (conversationState.mode === 'onboarding_q2') {
        conversationState.onboardingData.sleep_time = message;
        conversationState.mode = 'onboarding_q3';
        askQuestion3();
    }
    else if (conversationState.mode === 'onboarding_q3') {
        conversationState.onboardingData.key_goals = message;
        conversationState.mode = 'onboarding_q4';
        askQuestion4();
    }
    else if (conversationState.mode === 'onboarding_q4') {
        conversationState.onboardingData.fixed_routines = message;
        conversationState.mode = 'onboarding_q5';
        askQuestion5();
    }
    else if (conversationState.mode === 'onboarding_q5') {
        const peak = message.toLowerCase();
        let productivityPeak = 'morning';
        if (peak.includes('afternoon')) productivityPeak = 'afternoon';
        else if (peak.includes('night') || peak.includes('evening')) productivityPeak = 'night';
        
        conversationState.onboardingData.productivity_peak = productivityPeak;
        
        const hoursMatch = message.match(/(\d+)\s*hours?/i);
        conversationState.onboardingData.available_hours = hoursMatch ? parseInt(hoursMatch[1]) : 5;
        
        await completeOnboarding();
    }
    else if (conversationState.mode === 'ready') {
        await handleReturningUserRequest(message);
    }
}

// Onboarding Questions
function askQuestion1() {
    addMessage('<strong>(Q1)</strong> What time do you usually wake up?<br><br>For example: "7 AM" or "06:30"', 'bot');
}

function askQuestion2() {
    addMessage('<strong>(Q2)</strong> What time do you go to bed?<br><br>For example: "11 PM" or "23:00"', 'bot');
}

function askQuestion3() {
    addMessage('<strong>(Q3)</strong> What are the 3 most important things you want to achieve each day?<br><br>For example: "study, exercise, meditation"', 'bot');
}

function askQuestion4() {
    addMessage('<strong>(Q4)</strong> Do you have any fixed routines or time-bound tasks?<br><br>For example: "class at 9am, gym at 6pm" or "no fixed routines"', 'bot');
}

function askQuestion5() {
    addMessage('<strong>(Q5)</strong> When do you feel most productive and how many hours per day can you dedicate to your goals?<br><br>For example: "morning, 5 hours"', 'bot');
}

// Complete onboarding
async function completeOnboarding() {
    const loadingId = showLoading();
    
    try {
        const schedulerModule = await import('./ai-scheduler.js');
        
        // Ensure scheduler is initialized
        if (window.firebaseDb && window.firebaseAuth) {
            schedulerModule.initScheduler(window.firebaseDb, window.firebaseAuth);
        } else {
            throw new Error('Firebase not initialized. Please refresh the page.');
        }
        
        const profile = {
            wake_time: conversationState.onboardingData.wake_time,
            sleep_time: conversationState.onboardingData.sleep_time,
            key_goals: conversationState.onboardingData.key_goals,
            fixed_routines: conversationState.onboardingData.fixed_routines,
            productivity_peak: conversationState.onboardingData.productivity_peak,
            available_hours: conversationState.onboardingData.available_hours,
            createdAt: new Date().toISOString()
        };
        
        await schedulerModule.saveUserProfile(profile);
        
        removeLoading(loadingId);
        
        addMessage(`<strong>✅ Got it! I've saved your habit profile:</strong><br><br>
        🌅 Wake time: ${profile.wake_time}<br>
        🌙 Sleep time: ${profile.sleep_time}<br>
        🎯 Key goals: ${profile.key_goals}<br>
        ⏰ Fixed routines: ${profile.fixed_routines}<br>
        ⚡ Productivity peak: ${profile.productivity_peak}<br>
        📚 Available hours: ${profile.available_hours} hours<br><br>
        <strong>Creating your personalized schedule...</strong>`, 'bot');
        
        const scheduleLoadingId = showLoading();
        const schedule = await generateDailySchedule(schedulerModule, profile);
        removeLoading(scheduleLoadingId);
        
        if (schedule && schedule.length > 0) {
            displaySchedule(schedule, schedulerModule);
            await schedulerModule.saveSchedule(schedule);
        }
        
        conversationState.mode = 'ready';
        conversationState.userProfile = profile;
        
        addMessage('<br><strong>🎉 Your schedule is ready! I\'ll update your plan based on your progress each day.</strong>', 'bot');
        
    } catch (error) {
        removeLoading(loadingId);
        console.error('Error completing onboarding:', error);
        addMessage(`I had trouble saving your profile: ${error.message}. Please try again or check your API key.`, 'bot');
    }
}

// Handle returning user requests
async function handleReturningUserRequest(message) {
    const lowerMessage = message.toLowerCase();
    const schedulerModule = await import('./ai-scheduler.js');
    
    if (lowerMessage.includes('update') || lowerMessage.includes('today') || lowerMessage.includes('schedule')) {
        addMessage('Great! Tell me what tasks you need to do today, and I\'ll create an updated schedule for you.', 'bot');
        conversationState.mode = 'updating';
    } 
    else if (lowerMessage.includes('review') || lowerMessage.includes('yesterday') || lowerMessage.includes('performance')) {
        addMessage('I\'d love to review your progress! Tell me what you completed yesterday and how you felt about it.', 'bot');
    }
    else if (lowerMessage.includes('new schedule') || lowerMessage.includes('create')) {
        const loadingId = showLoading();
        const schedule = await generateDailySchedule(schedulerModule, conversationState.userProfile);
        removeLoading(loadingId);
        
        if (schedule && schedule.length > 0) {
            displaySchedule(schedule, schedulerModule);
            await schedulerModule.saveSchedule(schedule);
        }
    }
    else {
        const loadingId = showLoading();
        try {
            const tasks = await schedulerModule.parseTasksWithAI(message, apiKey);
            if (tasks && tasks.length > 0) {
                removeLoading(loadingId);
                const schedule = await generateScheduleFromTasks(schedulerModule, tasks);
                if (schedule && schedule.length > 0) {
                    displaySchedule(schedule, schedulerModule);
                    await schedulerModule.saveSchedule(schedule);
                }
            } else {
                removeLoading(loadingId);
                addMessage('I understand! How can I help you with your schedule today?', 'bot');
            }
        } catch (error) {
            removeLoading(loadingId);
            addMessage('Tell me what you\'d like to do today, and I\'ll help you plan it!', 'bot');
        }
    }
}

// Generate daily schedule
async function generateDailySchedule(schedulerModule, profile) {
    try {
        const schedule = await schedulerModule.generatePersonalizedSchedule(profile, apiKey);
        return schedule;
    } catch (error) {
        console.error('Error generating schedule:', error);
        addMessage(`Error generating schedule: ${error.message}`, 'bot');
        return null;
    }
}

// Generate schedule from tasks
async function generateScheduleFromTasks(schedulerModule, tasks) {
    try {
        const profile = conversationState.userProfile || conversationState.onboardingData;
        const schedule = await schedulerModule.generateScheduleWithAI(
            tasks,
            parseFixedRoutines(profile.fixed_routines),
            null,
            apiKey
        );
        return schedule;
    } catch (error) {
        console.error('Error generating schedule from tasks:', error);
        return null;
    }
}

// Helper: Extract time from message
function extractTime(message) {
    const timePatterns = [
        /(\d{1,2})\s*:?\s*(\d{2})?\s*(am|pm)/gi,
        /(\d{1,2})\s*(am|pm)/gi,
    ];
    
    for (const pattern of timePatterns) {
        const match = message.match(pattern);
        if (match) {
            return match[0];
        }
    }
    
    return message;
}

// Helper: Parse fixed routines
function parseFixedRoutines(routinesText) {
    if (!routinesText || routinesText.toLowerCase().includes('no')) {
        return [];
    }
    
    const routines = [];
    const timePattern = /(\w+)\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/gi;
    let match;
    
    while ((match = timePattern.exec(routinesText)) !== null) {
        routines.push({
            name: match[1],
            time: match[2] + ':' + (match[3] || '00')
        });
    }
    
    return routines;
}

// Display schedule
function displaySchedule(schedule, schedulerModule) {
    if (!schedule || schedule.length === 0) {
        addMessage("I couldn't generate a schedule. Please try again.", 'bot');
        return;
    }
    
    let scheduleText = `📅 <strong>Your Personalized Daily Schedule</strong><br><br>`;
    
    schedule.forEach((item) => {
        const startTime = item.start || item.startTime || '';
        const endTime = item.end || item.endTime || '';
        const task = item.task || '';
        const comment = item.comment || '';
        
        scheduleText += `⏰ <strong>${startTime} - ${endTime}</strong><br>`;
        scheduleText += `${task}`;
        if (comment) {
            scheduleText += `<br><em>${comment}</em>`;
        }
        scheduleText += `<br><br>`;
    });
    
    addMessage(scheduleText, 'bot');
    
    if (window.displayScheduleInDashboard) {
        window.displayScheduleInDashboard(schedule);
    }
}

// Add message to chat
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = text;
    
    messageDiv.appendChild(contentDiv);
    chatbotMessages.appendChild(messageDiv);
    
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

// Show loading indicator
function showLoading() {
    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'message bot-message';
    
    const loadingContent = document.createElement('div');
    loadingContent.className = 'loading-message';
    loadingContent.innerHTML = `
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
    `;
    
    loadingDiv.appendChild(loadingContent);
    chatbotMessages.appendChild(loadingDiv);
    
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    
    return loadingId;
}

// Remove loading indicator
function removeLoading(loadingId) {
    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) {
        loadingElement.remove();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
} else {
    initChatbot();
}