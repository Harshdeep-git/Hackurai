// AI Scheduler Module - Complete implementation

import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Module-level variables to store Firebase references
let db = null;
let auth = null;

// Initialize scheduler with Firebase references
export function initScheduler(firebaseDb, firebaseAuth) {
    db = firebaseDb;
    auth = firebaseAuth;
    console.log('✅ Scheduler initialized with Firebase');
}

// Get current user ID
function getUserId() {
    if (auth && auth.currentUser) {
        return auth.currentUser.uid;
    }
    // Fallback to localStorage
    return localStorage.getItem("habitlens_user_id") || "guest_" + Date.now();
}

// Save user profile to Firestore
export async function saveUserProfile(profile) {
    if (!db) {
        throw new Error('Scheduler not initialized. Please call initScheduler first.');
    }
    
    try {
        const userId = getUserId();
        const profileRef = doc(db, "user_profiles", userId);
        
        await setDoc(profileRef, {
            ...profile,
            userId,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        console.log('✅ User profile saved');
        return true;
    } catch (error) {
        console.error('Error saving user profile:', error);
        throw error;
    }
}

// Load user profile from Firestore
export async function loadUserProfile() {
    if (!db) {
        throw new Error('Scheduler not initialized. Please call initScheduler first.');
    }
    
    try {
        const userId = getUserId();
        const profileRef = doc(db, "user_profiles", userId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const profile = profileSnap.data();
            console.log('✅ User profile loaded');
            return profile;
        }
        
        return null;
    } catch (error) {
        console.error('Error loading user profile:', error);
        return null;
    }
}

// Save schedule to Firestore
export async function saveSchedule(schedule) {
    if (!db) {
        throw new Error('Scheduler not initialized. Please call initScheduler first.');
    }
    
    try {
        const userId = getUserId();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const scheduleRef = doc(db, "schedules", `${userId}_${today}`);
        
        await setDoc(scheduleRef, {
            userId,
            date: today,
            schedule,
            createdAt: serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Schedule saved');
        return true;
    } catch (error) {
        console.error('Error saving schedule:', error);
        throw error;
    }
}

// Load schedule from Firestore
export async function loadSchedule() {
    if (!db) {
        throw new Error('Scheduler not initialized. Please call initScheduler first.');
    }
    
    try {
        const userId = getUserId();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const scheduleRef = doc(db, "schedules", `${userId}_${today}`);
        const scheduleSnap = await getDoc(scheduleRef);
        
        if (scheduleSnap.exists()) {
            const data = scheduleSnap.data();
            console.log('✅ Schedule loaded');
            return data.schedule || [];
        }
        
        return null;
    } catch (error) {
        console.error('Error loading schedule:', error);
        return null;
    }
}

// Generate personalized schedule from user profile
export async function generatePersonalizedSchedule(profile, apiKey) {
    try {
        // Extract key goals as tasks
        const goals = profile.key_goals ? profile.key_goals.split(',').map(g => g.trim()) : [];
        
        // Create tasks from goals
        const tasks = goals.map(goal => ({
            name: goal,
            duration: Math.floor(profile.available_hours * 60 / goals.length) || 60,
            priority: "high",
            category: goal.toLowerCase()
        }));
        
        // Parse fixed routines
        const fixedRoutines = parseFixedRoutines(profile.fixed_routines);
        
        // Generate schedule using AI
        const schedule = await generateScheduleWithAI(tasks, fixedRoutines, null, apiKey);
        
        return schedule;
    } catch (error) {
        console.error('Error generating personalized schedule:', error);
        throw error;
    }
}

// Helper: Parse fixed routines from text
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

// Format time for display
export function formatTime(timeString) {
    if (!timeString) return '';
    
    // If already in HH:MM format, convert to 12-hour
    if (timeString.match(/^\d{2}:\d{2}$/)) {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }
    
    return timeString;
}

// Calculate schedule statistics
export function calculateScheduleStats(schedule) {
    if (!schedule || !Array.isArray(schedule)) {
        return {
            totalTasks: 0,
            totalDuration: 0,
            highPriorityTasks: 0
        };
    }
    
    const stats = {
        totalTasks: schedule.length,
        totalDuration: schedule.reduce((sum, item) => sum + (item.duration || 0), 0),
        highPriorityTasks: schedule.filter(item => item.priority === 'high').length
    };
    
    return stats;
}

// Parse tasks with AI
export async function parseTasksWithAI(userInput, apiKey) {
    const prompt = `You are a task parsing assistant. Parse the following user input into structured tasks.
Return ONLY a valid JSON array of tasks, no other text. Each task should have:
- name: task name
- duration: estimated duration in minutes (number)
- priority: "high", "medium", or "low"
- category: category like "study", "exercise", "work", "personal", etc.

User input: "${userInput}"

Example format:
[
  {"name": "Study for exam", "duration": 120, "priority": "high", "category": "study"},
  {"name": "Gym workout", "duration": 60, "priority": "medium", "category": "exercise"}
]`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that returns only valid JSON arrays. Never include any text outside the JSON array.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3
                // REMOVED: response_format - this was causing issues
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || `API Error: ${response.statusText}`);
        }

        const text = data.choices[0]?.message?.content || '';
        console.log('✅ OpenAI API Response:', text);
        
        // Try to extract JSON array from response
        // First, try to find array brackets
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            const tasks = JSON.parse(arrayMatch[0]);
            return Array.isArray(tasks) ? tasks : [];
        }
        
        // If no brackets found, try parsing the whole thing
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed;
            if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed.tasks;
        } catch (e) {
            console.error('Failed to parse JSON:', e);
        }
        
        throw new Error('Could not parse tasks from AI response');
        
    } catch (error) {
        console.error('Error parsing tasks with OpenAI:', error);
        throw new Error(`Failed to parse tasks: ${error.message}`);
    }
}

// Same fix for generateScheduleWithAI
export async function generateScheduleWithAI(tasks, fixedRoutines, habitAnalysis, apiKey) {
    const habitContext = habitAnalysis ? `
User's Habit Patterns:
- Total habits: ${habitAnalysis.totalHabits}
- Average consistency: ${habitAnalysis.averageConsistency}%
- Active streaks: ${habitAnalysis.activeStreaks.map(h => h.name).join(', ')}
- Most productive habits: ${habitAnalysis.mostProductiveHabits.map(h => h.name).join(', ')}
` : '';

    const fixedRoutinesText = fixedRoutines && fixedRoutines.length > 0
        ? `Fixed Routines (must be scheduled at these times):\n${fixedRoutines.map(r => `- ${r.name} at ${r.time}`).join('\n')}`
        : 'No fixed routines specified.';

    const prompt = `You are an intelligent schedule assistant. Create an optimal daily schedule.

Tasks to schedule:
${JSON.stringify(tasks, null, 2)}

${fixedRoutinesText}

${habitContext}

Create a schedule that:
1. Respects fixed routines (if any)
2. Considers task priorities
3. Suggests optimal times based on productivity patterns
4. Includes breaks between tasks
5. Groups similar tasks together when possible

Return ONLY a valid JSON array of scheduled items. Each item should have:
- task: task name
- startTime: start time in HH:MM format (24-hour)
- endTime: end time in HH:MM format (24-hour)
- duration: duration in minutes
- priority: task priority
- category: task category

Example:
[
  {"task": "Morning Exercise", "startTime": "07:00", "endTime": "08:00", "duration": 60, "priority": "high", "category": "exercise"},
  {"task": "Study for exam", "startTime": "09:00", "endTime": "11:00", "duration": 120, "priority": "high", "category": "study"}
]`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful schedule assistant that returns only valid JSON arrays.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || `API Error: ${response.statusText}`);
        }

        const text = data.choices[0]?.message?.content || '';
        console.log('✅ Schedule generated');
        
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            const schedule = JSON.parse(arrayMatch[0]);
            return Array.isArray(schedule) ? schedule : [];
        }
        
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed;
            if (parsed.schedule && Array.isArray(parsed.schedule)) return parsed.schedule;
        } catch (e) {
            console.error('Failed to parse schedule:', e);
        }
        
        throw new Error('Could not parse schedule from AI response');
        
    } catch (error) {
        console.error('Error generating schedule with OpenAI:', error);
        throw new Error(`Failed to generate schedule: ${error.message}`);
    }
}