// ✅ firebase.js (FULLY FIXED - Habits now work!)

// Import Firebase SDKs (from CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp, 
  query, 
  orderBy,
  limit,
  increment,
  setDoc,
  getDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// 🔹 Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCXjWbVKGuLbdxlYAs83zq6A2vj2ExHkvo",
  authDomain: "hackurai.firebaseapp.com",
  projectId: "hackurai",
  storageBucket: "hackurai.firebasestorage.app",
  messagingSenderId: "649176729729",
  appId: "1:649176729729:web:183dc359374ea6b3e6a580"
};

// 🔹 Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Export to window for use by other modules
window.firebaseDb = db;
window.firebaseAuth = auth;

// ✅ Get current logged-in user dynamically
function getActiveUserInfo() {
  const user = auth.currentUser;
  if (user && user.email) {
    return {
      username: user.displayName || user.email.split("@")[0],
      userId: user.uid,
    };
  } else {
    // fallback to localStorage (guest mode)
    return {
      username: localStorage.getItem("habitlens_username") || "Guest",
      userId: localStorage.getItem("habitlens_user_id") || "guest_" + Date.now(),
    };
  }
}

// 🧩 Initialize local user data
let { username: CURRENT_USER, userId: USER_ID } = getActiveUserInfo();

if (!localStorage.getItem("habitlens_username")) {
  localStorage.setItem("habitlens_username", CURRENT_USER);
  localStorage.setItem("habitlens_user_id", USER_ID);
}

// 🔹 Detect which page we are on
const currentPage = window.location.pathname.split("/").pop();

// --------------------------------------
// 🟢 INDEX (Dashboard) PAGE LOGIC
// --------------------------------------
if (currentPage === "index.html" || currentPage === "") {
  console.log("Dashboard page loaded ✅");
  
  const habitsContainer = document.getElementById("habits-container");
  const addHabitBtn = document.getElementById("add-habit-btn");
  const modal = document.getElementById("add-habit-modal");
  const cancelBtn = document.getElementById("cancel-habit-btn");
  const saveHabitBtn = document.getElementById("save-habit-btn");
  const habitNameInput = document.getElementById("habit-name");
  const iconPicker = document.querySelectorAll(".icon-option");
  const selectedIconInput = document.getElementById("selected-icon");
  
  // User stats
  let userLevel = parseInt(localStorage.getItem("user_level")) || 1;
  let userXP = parseInt(localStorage.getItem("user_xp")) || 0;
  let totalStreak = parseInt(localStorage.getItem("total_streak")) || 0;
  let comboMultiplier = parseInt(localStorage.getItem("combo_multiplier")) || 1;
  
  // Update stats display
  function updateStatsDisplay() {
    document.getElementById("user-level").textContent = userLevel;
    document.getElementById("user-xp").textContent = userXP;
    document.getElementById("total-streak").textContent = totalStreak;
    document.getElementById("combo-multiplier").textContent = `x${comboMultiplier}`;
    
    const xpNeeded = userLevel * 100;
    const xpProgress = (userXP / xpNeeded) * 100;
    document.getElementById("xp-bar").style.width = `${xpProgress}%`;
    document.getElementById("xp-text").textContent = `${userXP} / ${xpNeeded} XP to Level ${userLevel + 1}`;
    
    localStorage.setItem("user_level", userLevel);
    localStorage.setItem("user_xp", userXP);
    localStorage.setItem("total_streak", totalStreak);
    localStorage.setItem("combo_multiplier", comboMultiplier);
    
    updateLeaderboard();
  }
  
  // Icon picker
  iconPicker.forEach(icon => {
    icon.addEventListener("click", () => {
      iconPicker.forEach(i => i.classList.remove("selected"));
      icon.classList.add("selected");
      selectedIconInput.value = icon.dataset.icon;
    });
  });
  
  // Modal controls
  addHabitBtn?.addEventListener("click", () => modal.classList.remove("hidden"));
  cancelBtn?.addEventListener("click", () => {
    modal.classList.add("hidden");
    habitNameInput.value = "";
  });
  modal?.querySelector(".modal-overlay")?.addEventListener("click", () => {
    modal.classList.add("hidden");
    habitNameInput.value = "";
  });
  
  // ✅ FIXED: Save new habit - waits for auth
  saveHabitBtn?.addEventListener("click", async () => {
    const habitName = habitNameInput.value.trim();
    const habitIcon = selectedIconInput.value;
    
    if (!habitName) {
      alert("Please enter a habit name!");
      return;
    }
    
    try {
      // Ensure user is authenticated
      const user = auth.currentUser;
      if (!user) {
        alert("Please log in first!");
        return;
      }
      
      const { userId } = getActiveUserInfo();
      
      console.log("Creating habit for userId:", userId);
      
      await addDoc(collection(db, "habits"), {
        userId,
        name: habitName,
        icon: habitIcon,
        streak: 0,
        completedDays: 0,
        totalDays: 0,
        lastCompleted: null,
        createdAt: serverTimestamp()
      });
      
      console.log("✅ Habit created successfully!");
      
      modal.classList.add("hidden");
      habitNameInput.value = "";
      
      // Reload habits
      loadHabits();
    } catch (error) {
      console.error("Error adding habit:", error);
      alert(`Failed to add habit: ${error.message}`);
    }
  });
  
  // ✅ FIXED: Load habits - queries by userId directly
  async function loadHabits() {
    if (!habitsContainer) return;
    
    habitsContainer.innerHTML = "<p>Loading habits...</p>";
    
    try {
      // Ensure user is authenticated
      const user = auth.currentUser;
      if (!user) {
        habitsContainer.innerHTML = "<p class='subtitle text-center'>Please log in to view your habits.</p>";
        return;
      }
      
      const { userId } = getActiveUserInfo();
      
      console.log("Loading habits for userId:", userId);
      
      // ✅ Query by userId first - this is the fix!
      const q = query(
        collection(db, "habits"), 
        where("userId", "==", userId)
      );
      
      const snapshot = await getDocs(q);
      
      console.log(`✅ Found ${snapshot.size} habit(s)`);
      
      habitsContainer.innerHTML = "";
      
      if (snapshot.empty) {
        habitsContainer.innerHTML = "<p class='subtitle text-center'>No habits yet. Create your first habit to get started! 🚀</p>";
        return;
      }
      
      // Convert to array and sort
      const habitsArray = [];
      snapshot.forEach((docSnap) => {
        habitsArray.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      
      // Sort by createdAt (newest first)
      habitsArray.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });
      
      // Display habits
      habitsArray.forEach((habit) => {
        const habitId = habit.id;
        const lastCompleted = habit.lastCompleted?.toDate();
        const today = new Date().toDateString();
        const isCompletedToday = lastCompleted && lastCompleted.toDateString() === today;
        
        const growthPercentage = habit.totalDays > 0 
          ? Math.round((habit.completedDays / habit.totalDays) * 100) 
          : 0;
        
        const habitCard = document.createElement("div");
        habitCard.classList.add("habit-card");
        if (isCompletedToday) habitCard.classList.add("completed");
        
        habitCard.innerHTML = `
          <div class="habit-header">
            <span class="habit-icon">${habit.icon}</span>
            <h3 class="habit-name">${habit.name}</h3>
            <button class="delete-habit-btn" data-id="${habitId}">×</button>
          </div>
          <div class="habit-stats">
            <div class="stat streak">
              <span class="stat-number">${habit.streak}</span>
              <span class="stat-label">Streak</span>
            </div>
            <div class="stat">
              <span class="stat-number">${habit.completedDays}</span>
              <span class="stat-label">Completed</span>
            </div>
          </div>
          <div class="growth-container">
            <span class="growth-label">Consistency: ${growthPercentage}%</span>
            <div class="growth-bar"><div class="growth-fill" style="width: ${growthPercentage}%"></div></div>
          </div>
          <button class="complete-btn ${isCompletedToday ? 'completed' : ''}" data-id="${habitId}">
            ${isCompletedToday ? '✓ Completed Today' : 'Mark Complete'}
          </button>
        `;
        habitsContainer.appendChild(habitCard);
      });

      document.querySelectorAll(".complete-btn").forEach(btn => btn.addEventListener("click", () => completeHabit(btn.dataset.id)));
      document.querySelectorAll(".delete-habit-btn").forEach(btn => btn.addEventListener("click", e => {
        e.stopPropagation();
        deleteHabit(btn.dataset.id);
      }));

    } catch (error) {
      console.error("Error loading habits:", error);
      habitsContainer.innerHTML = `<p class='subtitle text-center'>Error: ${error.message}</p>`;
    }
  }
  
  async function completeHabit(habitId) {
    try {
      const habitRef = doc(db, "habits", habitId);
      const habitSnap = await getDoc(habitRef);
      if (!habitSnap.exists()) return;

      const habit = habitSnap.data();
      const lastCompleted = habit.lastCompleted?.toDate();
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastCompleted && lastCompleted.toDateString() === today.toDateString()) {
        alert("You've already completed this habit today! 🎉");
        return;
      }

      let newStreak = habit.streak;
      if (lastCompleted && lastCompleted.toDateString() === yesterday.toDateString()) newStreak += 1;
      else newStreak = 1;

      await updateDoc(habitRef, {
        streak: newStreak,
        completedDays: increment(1),
        totalDays: increment(1),
        lastCompleted: serverTimestamp()
      });

      const xpGained = 10 * comboMultiplier;
      userXP += xpGained;
      totalStreak = Math.max(totalStreak, newStreak);

      const xpNeeded = userLevel * 100;
      if (userXP >= xpNeeded) {
        userLevel++;
        userXP -= xpNeeded;
        comboMultiplier++;
        alert(`🎉 Level Up! You're now Level ${userLevel}!`);
      }

      updateStatsDisplay();
      loadHabits();

    } catch (error) {
      console.error("Error completing habit:", error);
      alert("Failed to complete habit. Please try again.");
    }
  }

  async function deleteHabit(habitId) {
    if (!confirm("Are you sure you want to delete this habit?")) return;
    try {
      await deleteDoc(doc(db, "habits", habitId));
      loadHabits();
    } catch (error) {
      console.error("Error deleting habit:", error);
      alert("Failed to delete habit. Please try again.");
    }
  }

  async function updateLeaderboard() {
    try {
      const { username, userId } = getActiveUserInfo();
      const userRef = doc(db, "leaderboard", userId);
      await setDoc(userRef, {
        username,
        xp: userXP,
        level: userLevel,
        streak: totalStreak,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Error updating leaderboard:", error);
    }
  }

  updateStatsDisplay();
  
  // ✅ CRITICAL: Wait for auth before loading habits
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("✅ User authenticated:", user.uid);
      loadHabits();
    } else {
      console.warn("❌ No user authenticated");
      habitsContainer.innerHTML = "<p class='subtitle text-center'>Please log in to view your habits.</p>";
    }
  });
  
  // Load today's schedule if exists
  loadTodaysSchedule();
}

// ============================================
// SCHEDULE DISPLAY FUNCTIONALITY
// ============================================

async function loadTodaysSchedule() {
  try {
    const schedulerModule = await import('./ai-scheduler.js');
    schedulerModule.initScheduler(db, auth);
    
    const schedule = await schedulerModule.loadSchedule();
    if (schedule && schedule.length > 0) {
      displayScheduleInDashboard(schedule);
    }
  } catch (error) {
    if (error.code !== 'permission-denied') {
      console.error("Error loading schedule:", error);
    }
  }
}

// Display schedule in dashboard
window.displayScheduleInDashboard = function(schedule) {
  const scheduleSection = document.getElementById('schedule-section');
  const scheduleContainer = document.getElementById('schedule-container');
  
  if (!scheduleSection || !scheduleContainer) return;
  
  scheduleSection.style.display = 'block';
  scheduleContainer.innerHTML = '';
  
  import('./ai-scheduler.js').then(schedulerModule => {
    const stats = schedulerModule.calculateScheduleStats(schedule);
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'schedule-stats';
    headerDiv.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Total Tasks</span>
        <span class="stat-value">${stats.totalTasks}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total Time</span>
        <span class="stat-value">${Math.round(stats.totalDuration / 60)}h</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">High Priority</span>
        <span class="stat-value">${stats.highPriorityTasks}</span>
      </div>
    `;
    scheduleContainer.appendChild(headerDiv);
    
    schedule.forEach((item) => {
      const scheduleItem = document.createElement('div');
      scheduleItem.className = `schedule-item ${item.category === 'break' ? 'break' : ''} priority-${item.priority}`;
      
      const startTime = schedulerModule.formatTime(item.startTime);
      const endTime = schedulerModule.formatTime(item.endTime);
      
      const emoji = item.category === 'break' ? '☕' : 
                   item.priority === 'high' ? '🔥' : 
                   item.priority === 'medium' ? '⭐' : '📌';
      
      scheduleItem.innerHTML = `
        <div class="schedule-time">
          <span class="time-start">${startTime}</span>
          <span class="time-end">${endTime}</span>
        </div>
        <div class="schedule-content">
          <div class="schedule-task">
            ${emoji} <strong>${item.task}</strong>
          </div>
          ${item.category !== 'break' ? `
            <div class="schedule-meta">
              <span class="schedule-duration">${item.duration} min</span>
              <span class="schedule-priority priority-${item.priority}">${item.priority}</span>
              <span class="schedule-category">${item.category}</span>
            </div>
          ` : ''}
        </div>
      `;
      
      scheduleContainer.appendChild(scheduleItem);
    });
    
    const hideBtn = document.getElementById('hide-schedule-btn');
    if (hideBtn) {
      hideBtn.addEventListener('click', () => {
        scheduleSection.style.display = 'none';
      });
    }
  });
}

// 🟡 LEADERBOARD PAGE
if (currentPage === "leaderboard.html") {
  console.log("Leaderboard page loaded ✅");
  const leaderboardList = document.getElementById("leaderboard-list");

  async function loadLeaderboard() {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = "<p>Loading leaderboard...</p>";
    try {
      const q = query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(10));
      const snapshot = await getDocs(q);
      leaderboardList.innerHTML = "";
      if (snapshot.empty) {
        leaderboardList.innerHTML = "<p class='subtitle text-center'>No data yet. Start tracking habits to appear here! 🏆</p>";
        return;
      }
      let rank = 1;
      snapshot.forEach((docSnap) => {
        const user = docSnap.data();
        const li = document.createElement("li");
        li.classList.add("leaderboard-item");
        if (rank === 1) li.classList.add("top-1");
        if (rank === 2) li.classList.add("top-2");
        if (rank === 3) li.classList.add("top-3");
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
        li.innerHTML = `
          <span class="rank ${medal ? 'rank-medal' : ''}">${medal || rank}</span>
          <div class="user-info">
            <div class="user-name">${user.username}</div>
            <div class="user-level">Level ${user.level} • ${user.streak} day streak</div>
          </div>
          <div class="user-xp">${user.xp} XP</div>`;
        leaderboardList.appendChild(li);
        rank++;
      });
    } catch (error) {
      console.error("Error loading leaderboard:", error);
      leaderboardList.innerHTML = "<p class='subtitle text-center'>Failed to load leaderboard. Please refresh the page.</p>";
    }
  }
  loadLeaderboard();
}

// 🟢 COMMUNITY PAGE
if (currentPage === "community.html") {
  console.log("Community page loaded ✅");
  const postInput = document.getElementById("post-input");
  const postBtn = document.getElementById("post-btn");
  const feed = document.getElementById("community-feed");
  const postsRef = collection(db, "community_posts");

  async function loadPosts() {
    if (!feed) return;
    feed.innerHTML = "<p>Loading posts...</p>";
    try {
      const q = query(postsRef, orderBy("timestamp", "desc"), limit(20));
      const snapshot = await getDocs(q);
      feed.innerHTML = "";
      if (snapshot.empty) {
        feed.innerHTML = "<p class='subtitle text-center'>No posts yet. Be the first to share! 🚀</p>";
        return;
      }
      snapshot.forEach((docSnap) => {
        const post = docSnap.data();
        const div = document.createElement("div");
        div.classList.add("post-card");
        const timeString = post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString() : "Just now";
        div.innerHTML = `
          <div class="post-header">
            <span class="post-avatar">👤</span>
            <div>
              <div class="post-author">${post.username}</div>
              <div class="post-time">${timeString}</div>
            </div>
          </div>
          <div class="post-content">${post.content}</div>`;
        feed.appendChild(div);
      });
    } catch (error) {
      console.error("Error loading posts:", error);
      feed.innerHTML = `<p class='subtitle text-center'>Failed to load posts: ${error.message}</p>`;
    }
  }

  postBtn?.addEventListener("click", async () => {
    const content = postInput.value.trim();
    if (!content) {
      alert("Please write something first!");
      return;
    }
    try {
      const { username } = getActiveUserInfo();
      await addDoc(postsRef, {
        username,
        content,
        timestamp: serverTimestamp()
      });
      postInput.value = "";
      loadPosts();
    } catch (error) {
      console.error("Error posting:", error);
      alert(`Failed to post: ${error.message}`);
    }
  });

  loadPosts();
}

// 🟣 Logout functionality
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        alert("You've been logged out!");
        window.location.href = "./Login page/login.html";
      } catch (error) {
        console.error("Logout error:", error);
        alert("Failed to logout. Try again.");
      }
    });
  }
});

// 🟢 Keep local data synced with Firebase user
onAuthStateChanged(auth, (user) => {
  if (user) {
    localStorage.setItem("habitlens_username", user.displayName || user.email.split("@")[0]);
    localStorage.setItem("habitlens_user_id", user.uid);
  }
});