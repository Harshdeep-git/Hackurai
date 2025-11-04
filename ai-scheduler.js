// AI Scheduler - Core logic for HabitLens.AI
// This file handles task parsing, schedule generation, and habit analysis
// Now using OpenAI (ChatGPT) API instead of Gemini

import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where,
    orderBy,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Initialize Firebase (reuse existing config)
const firebaseConfig = {
    apiKey: "AIzaSyCXjWbVKGuLbdxlYAs83zq6A2vj2ExHkvo",
    authDomain: "hackurai.firebaseapp.com",
    projectId: "hackurai",
    storageBucket: "hackurai.firebasestorage.app",
    messagingSenderId: "649176729729",
    appId: "1:649176729729:web:183dc359374ea6b3e6a580"
};

// Get db reference (will be initialized by firebase.js)
let db = null;
let auth = null;

// Initialize when Firebase is ready
export function initScheduler(firestoreDb, firebaseAuth) {
    db = firestoreDb;
    auth = firebaseAuth;
    console.log('✅ AI Scheduler initialized with Firebase');
}

// Get current user info
function getCurrentUserId() {
    if (auth && auth.currentUser) {
        return auth.currentUser.uid;
    }
    return localStorage.getItem("habitlens_user_id") || "guest_" + Date.now();
}

// ============================================
// HABIT ANALYSIS
// ============================================

/**
 * Analyze user's habits to find patterns and preferences
 */
export async function analyzeUserHabits() {
    if (!db) {
        console.error("Database not initialized");
        return null;
    }

    try {
        const userId = getCurrentUserId();
        const habitsSnapshot = await getDocs(
            query(collection(db, "habits"), where("userId", "==", userId))
        );

        const habits = [];
        const analysis = {
            totalHabits: 0,
            activeStreaks: [],
            averageConsistency: 0,
            mostProductiveHabits: [],
            habitPatterns: []
        };

        habitsSnapshot.forEach((doc) => {
            const habit = doc.data();
            habits.push({
                name: habit.name,
                icon: habit.icon,
                streak: habit.streak || 0,
                completedDays: habit.completedDays || 0,
                totalDays: habit.totalDays || 0,
                consistency: habit.totalDays > 0 
                    ? (habit.completedDays / habit.totalDays) * 100 
                    : 0,
                lastCompleted: habit.lastCompleted?.toDate() || null
            });
        });

        analysis.totalHabits = habits.length;
        
        if (habits.length > 0) {
            // Calculate average consistency
            const totalConsistency = habits.reduce((sum, h) => sum + h.consistency, 0);
            analysis.averageConsistency = Math.round(totalConsistency / habits.length);

            // Find active streaks
            analysis.activeStreaks = habits
                .filter(h => h.streak > 0)
                .sort((a, b) => b.streak - a.streak)
                .slice(0, 5);

            // Most productive habits (by consistency)
            analysis.mostProductiveHabits = habits
                .sort((a, b) => b.consistency - a.consistency)
                .slice(0, 5);

            // Pattern analysis
            analysis.habitPatterns = habits.map(h => ({
                name: h.name,
                icon: h.icon,
                consistency: h.consistency,
                isActive: h.streak > 0
            }));
        }

        return analysis;
    } catch (error) {
        console.error("Error analyzing habits:", error);
        return null;
    }
}

// ============================================
// TASK PARSING WITH AI
// ============================================

/**
 * Parse user's natural language input into structured tasks using OpenAI
 */
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
                temperature: 0.3,
                response_format: { type: 'json_object' }
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to parse tasks');
        }

        const text = data.choices[0]?.message?.content || '';
        console.log('✅ OpenAI API success!');
        
        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const tasks = JSON.parse(jsonMatch[0]);
            return tasks;
        } else {
            // Try to parse as JSON object first, then extract array
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) return parsed;
                if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed.tasks;
            } catch (e) {
                // If all fails, try to extract array from text
                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) return JSON.parse(arrayMatch[0]);
            }
            throw new Error('Could not parse tasks from response');
        }
        
    } catch (error) {
        console.error('Error parsing tasks with OpenAI:', error);
        throw new Error(`Failed to parse tasks: ${error.message}`);
    }
}

export async function generateScheduleWithAI(tasks, fixedRoutines, habitAnalysis, apiKey) {
    // Build context from habit analysis
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

Return ONLY a valid JSON array of scheduled items, no other text. Each item should have:
- task: task name
- startTime: start time in HH:MM format (24-hour)
- endTime: end time in HH:MM format (24-hour)
- duration: duration in minutes
- priority: task priority
- category: task category

Example format:
[
  {"task": "Morning Exercise", "startTime": "07:00", "endTime": "08:00", "duration": 60, "priority": "high", "category": "exercise"},
  {"task": "Break", "startTime": "08:00", "endTime": "08:15", "duration": 15, "priority": "low", "category": "break"},
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
                        content: 'You are a helpful schedule assistant that returns only valid JSON arrays. Never include any text outside the JSON array.'
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
            throw new Error(data.error?.message || 'Failed to generate schedule');
        }

        const text = data.choices[0]?.message?.content || '';
        console.log('✅ OpenAI API success!');
        

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const schedule = JSON.parse(jsonMatch[0]);
            return schedule;
        } else {

            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) return parsed;
                if (parsed.schedule && Array.isArray(parsed.schedule)) return parsed.schedule;
            } catch (e) {

                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) return JSON.parse(arrayMatch[0]);
            }
            throw new Error('Could not parse schedule from response');
        }
        
    } catch (error) {
        console.error('Error generating schedule with OpenAI:', error);
        throw new Error(`Failed to generate schedule: ${error.message}`);
    }
}


export async function saveUserProfile(profile) {
    if (!db) {
        console.error("Database not initialized");
        return false;
    }

    try {
        const userId = getCurrentUserId();
        const profileRef = doc(db, "user_profiles", userId);
        
        await setDoc(profileRef, {
            userId,
            ...profile,
            updatedAt: serverTimestamp()
        }, { merge: true });

        return true;
    } catch (error) {
        console.error("Error saving profile:", error);
        return false;
    }
}


export async function loadUserProfile() {
    if (!db) {
        console.error("Database not initialized");
        return null;
    }

    try {
        const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
        const userId = getCurrentUserId();
        const profileRef = doc(db, "user_profiles", userId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const data = profileSnap.data();
            return {
                username: data.username || 'User',
                wake_time: data.wake_time,
                sleep_time: data.sleep_time,
                key_goals: data.key_goals,
                fixed_routines: data.fixed_routines,
                productivity_peak: data.productivity_peak,
                available_hours: data.available_hours
            };
        }
        
        return null;
    } catch (error) {
        console.error("Error loading profile:", error);
        return null;
    }
}

// ============================================
// SCHEDULE STORAGE
// ============================================

/**
 * Save schedule to Firebase
 */
export async function saveSchedule(schedule, date) {
    if (!db) {
        console.error("Database not initialized");
        return false;
    }

    try {
        const userId = getCurrentUserId();
        const scheduleDate = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        const scheduleRef = doc(db, "schedules", `${userId}_${scheduleDate}`);
        
        await setDoc(scheduleRef, {
            userId,
            date: scheduleDate,
            schedule: schedule,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        return true;
    } catch (error) {
        console.error("Error saving schedule:", error);
        return false;
    }
}

/**
 * Load schedule from Firebase
 */
export async function loadSchedule(date) {
    if (!db) {
        console.error("Database not initialized");
        return null;
    }

    try {
        const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
        const userId = getCurrentUserId();
        const scheduleDate = date || new Date().toISOString().split('T')[0];
        
        const scheduleRef = doc(db, "schedules", `${userId}_${scheduleDate}`);
        const scheduleSnap = await getDoc(scheduleRef);
        
        if (scheduleSnap.exists()) {
            return scheduleSnap.data().schedule;
        }
        
        return null;
    } catch (error) {
        console.error("Error loading schedule:", error);
        return null;
    }
}

// ============================================
// PERSONALIZED SCHEDULE GENERATION
// ============================================

/**
 * Generate personalized schedule based on user profile using OpenAI
 */
export async function generatePersonalizedSchedule(profile, apiKey) {
    const prompt = `You are HabitLens.AI, a friendly AI assistant that creates personalized daily schedules.

User Profile:
- Wake time: ${profile.wake_time}
- Sleep time: ${profile.sleep_time}
- Key goals: ${profile.key_goals}
- Fixed routines: ${profile.fixed_routines}
- Productivity peak: ${profile.productivity_peak}
- Available hours: ${profile.available_hours} hours

Create a personalized daily schedule that:
1. Respects wake time and sleep time
2. Includes their key goals
3. Incorporates fixed routines at specified times
4. Schedules high-priority tasks during productivity peak
5. Balances work with rest and breaks
6. Uses the available hours effectively

Return ONLY a valid JSON array, no other text. Each item should have:
- task: task name
- start: start time in HH:MM format (24-hour)
- end: end time in HH:MM format (24-hour)
- comment: optional motivational comment

Example format:
[
  {"task": "Morning Exercise", "start": "07:00", "end": "08:00", "comment": "Start your day strong!"},
  {"task": "Breakfast & Preparation", "start": "08:00", "end": "08:30", "comment": ""},
  {"task": "Study Session", "start": "09:00", "end": "11:00", "comment": "Focus time - you've got this!"}
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
                        content: 'You are HabitLens.AI, a friendly AI assistant. Return only valid JSON arrays. Never include any text outside the JSON array.'
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
            throw new Error(data.error?.message || 'Failed to generate schedule');
        }

        const text = data.choices[0]?.message?.content || '';
        console.log('✅ OpenAI API success!');
        
        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const schedule = JSON.parse(jsonMatch[0]);
            return schedule;
        } else {
            // Try to parse as JSON object first
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) return parsed;
                if (parsed.schedule && Array.isArray(parsed.schedule)) return parsed.schedule;
            } catch (e) {
                // If all fails, try to extract array from text
                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) return JSON.parse(arrayMatch[0]);
            }
            throw new Error('Could not parse schedule from response');
        }
        
    } catch (error) {
        console.error('Error generating personalized schedule with OpenAI:', error);
        throw new Error(`Failed to generate personalized schedule: ${error.message}`);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format time for display
 */
export function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Calculate schedule statistics
 */
export function calculateScheduleStats(schedule) {
    if (!schedule || schedule.length === 0) {
        return {
            totalTasks: 0,
            totalDuration: 0,
            highPriorityTasks: 0,
            categories: []
        };
    }

    const stats = {
        totalTasks: schedule.filter(item => item.category !== 'break').length,
        totalDuration: schedule.reduce((sum, item) => sum + (item.duration || 0), 0),
        highPriorityTasks: schedule.filter(item => item.priority === 'high').length,
        categories: [...new Set(schedule.map(item => item.category).filter(c => c))]
    };

    return stats;
}

