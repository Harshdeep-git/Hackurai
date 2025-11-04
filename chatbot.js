// HabitLens.AI - Personalized AI Assistant for Daily Routines and Habits


const API_KEY_STORAGE = 'openai_api_key';
const DEFAULT_API_KEY = process.env.DEFAULT_API_KEY;

let apiKey = null;

// Conversation state
let conversationState = {
    mode: 'idle', // 'idle', 'onboarding', 'onboarding_q1', 'onboarding_q2', 'onboarding_q3', 'onboarding_q4', 'onboarding_q5', 'ready', 'updating'
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
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSend = document.getElementById('chatbot-send');
const chatbotMessages = document.getElementById('chatbot-messages');
const chatbotToggle = document.getElementById('chatbot-toggle');
const chatbotBody = document.getElementById('chatbot-body');

// Initialize chatbot
function initChatbot() {
    // Get or set OpenAI API key
    apiKey = localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
    
    if (!localStorage.getItem(API_KEY_STORAGE)) {
        localStorage.setItem(API_KEY_STORAGE, DEFAULT_API_KEY);
    }
    
    // Ensure apiKey is set
    apiKey = localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;

    initializeScheduler();
    setupEventListeners();
    
    // Check if user has profile
    checkUserProfile();
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
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkFirebase, 500);
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
        const schedulerModule = await import('./ai-scheduler.js');
        if (window.firebaseDb && window.firebaseAuth) {
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
        } else {
            setTimeout(checkUserProfile, 1000);
        }
    } catch (error) {
        console.error("Error checking profile:", error);
        showNewUserGreeting();
    }
}

// Show greeting for new users
function showNewUserGreeting() {
    const messagesContainer = document.getElementById('chatbot-messages');
    messagesContainer.innerHTML = `
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
    const messagesContainer = document.getElementById('chatbot-messages');
    
    messagesContainer.innerHTML = `
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
        addMessage('Sorry, I encountered an error. Please try again.', 'bot');
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
        // Start onboarding
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
        conversationState.onboardingData.sleep_time = extractTime(message);
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
        
        // Extract hours from message
        const hoursMatch = message.match(/\d+/);
        conversationState.onboardingData.available_hours = hoursMatch ? parseInt(hoursMatch[0]) : 5;
        
        // Save profile and generate schedule
        await completeOnboarding();
    }
    else if (conversationState.mode === 'ready') {
        // Handle returning user requests
        await handleReturningUserRequest(message);
    }
}

// Onboarding Questions
function askQuestion1() {
    addMessage('<strong>(Q1)</strong> What time do you usually wake up and go to bed?<br><br>For example: "I wake up at 7 AM and go to bed at 11 PM"', 'bot');
}

function askQuestion2() {
    addMessage('<strong>(Q2)</strong> What are the 3 most important things you want to achieve each day?<br><br>For example: "study, exercise, meditation"', 'bot');
}

function askQuestion3() {
    addMessage('<strong>(Q3)</strong> Do you have any fixed routines or time-bound tasks?<br><br>For example: "class at 9am, gym at 6pm" or "no fixed routines"', 'bot');
}

function askQuestion4() {
    addMessage('<strong>(Q4)</strong> When do you feel most productive — morning, afternoon, or night?', 'bot');
}

function askQuestion5() {
    addMessage('<strong>(Q5)</strong> How many hours per day can you dedicate to your personal goals or self-improvement?<br><br>Just tell me the number, like "5 hours"', 'bot');
}

// Complete onboarding
async function completeOnboarding() {
    const loadingId = showLoading();
    
    try {
        const schedulerModule = await import('./ai-scheduler.js');
        
        // Create profile JSON
        const profile = {
            wake_time: conversationState.onboardingData.wake_time,
            sleep_time: conversationState.onboardingData.sleep_time,
            key_goals: conversationState.onboardingData.key_goals,
            fixed_routines: conversationState.onboardingData.fixed_routines,
            productivity_peak: conversationState.onboardingData.productivity_peak,
            available_hours: conversationState.onboardingData.available_hours,
            createdAt: new Date().toISOString()
        };
        
        // Save profile to Firebase
        await schedulerModule.saveUserProfile(profile);
        
        removeLoading(loadingId);
        
        // Show summary
        addMessage(`<strong>Got it! I've saved your habit profile:</strong><br><br>
        🌅 Wake time: ${profile.wake_time}<br>
        🌙 Sleep time: ${profile.sleep_time}<br>
        🎯 Key goals: ${profile.key_goals}<br>
        ⏰ Fixed routines: ${profile.fixed_routines}<br>
        ⚡ Productivity peak: ${profile.productivity_peak}<br>
        📚 Available hours: ${profile.available_hours} hours<br><br>
        <strong>Got it! I've saved your habit profile. Let's start building your smart daily plan!</strong>`, 'bot');
        
        // Generate schedule
        const scheduleLoadingId = showLoading();
        const schedule = await generateDailySchedule(schedulerModule, profile);
        removeLoading(scheduleLoadingId);
        
        if (schedule && schedule.length > 0) {
            displaySchedule(schedule, schedulerModule);
            await schedulerModule.saveSchedule(schedule);
        }
        
        conversationState.mode = 'ready';
        
        addMessage('<br><strong>See you tomorrow! Ill update your plan based on todays progress.</strong>', 'bot');
        
    } catch (error) {
        removeLoading(loadingId);
        console.error('Error completing onboarding:', error);
        addMessage('I had trouble saving your profile. Please try again.', 'bot');
    }
}

// Handle returning user requests
async function handleReturningUserRequest(message) {
    const lowerMessage = message.toLowerCase();
    const schedulerModule = await import('./ai-scheduler.js');
    
    if (lowerMessage.includes('update') || lowerMessage.includes('today') || lowerMessage.includes('schedule')) {
        // Update schedule based on today's tasks
        addMessage('Great! Tell me what tasks you need to do today, and Ill create an updated schedule for you.', 'bot');
        conversationState.mode = 'updating';
    } 
    else if (lowerMessage.includes('review') || lowerMessage.includes('yesterday') || lowerMessage.includes('performance')) {
        // Review performance
        addMessage('I\'d love to review your progress! Tell me what you completed yesterday and how you felt about it.', 'bot');
    }
    else if (lowerMessage.includes('new schedule') || lowerMessage.includes('create')) {
        // Generate new schedule
        const loadingId = showLoading();
        const schedule = await generateDailySchedule(schedulerModule, conversationState.userProfile);
        removeLoading(loadingId);
        
        if (schedule && schedule.length > 0) {
            displaySchedule(schedule, schedulerModule);
            await schedulerModule.saveSchedule(schedule);
        }
    }
    else {
        // Try to parse as tasks
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
    // Try to extract time patterns
    const timePatterns = [
        /(\d{1,2})\s*(am|pm|AM|PM)/gi,
        /(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/gi,
        /wake.*?(\d{1,2})/gi,
        /bed.*?(\d{1,2})/gi
    ];
    
    for (const pattern of timePatterns) {
        const match = message.match(pattern);
        if (match) {
            return match[0];
        }
    }
    
    return message; // Return as-is if no pattern found
}

// Helper: Parse fixed routines
function parseFixedRoutines(routinesText) {
    if (!routinesText || routinesText.toLowerCase().includes('no')) {
        return [];
    }
    
    // Simple parsing - can be enhanced
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
    
    // Also display in dashboard
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
