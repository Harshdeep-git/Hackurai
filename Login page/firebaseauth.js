// Load Firebase (no imports required)
const firebaseConfig = {
  apiKey: "AIzaSyCXjWbVKGuLbdxlYAs83zq6A2vj2ExHkvo",
  authDomain: "hackurai.firebaseapp.com",
  projectId: "hackurai",
  storageBucket: "hackurai.appspot.com",
  messagingSenderId: "649176729729",
  appId: "1:649176729729:web:183dc359374ea6b3e6a580"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Run after DOM is ready
document.addEventListener("DOMContentLoaded", () => {

  // Auto redirect if user is already logged in
  auth.onAuthStateChanged((user) => {
    if (user) {
      window.location.href = "../index.html";
    }
  });

  // ============= SIGN UP =============
  const signUpBtn = document.getElementById("submitSignUp");
  if (signUpBtn) {
    signUpBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const firstName = document.getElementById("fName").value.trim();
      const lastName = document.getElementById("lName").value.trim();
      const email = document.getElementById("rEmail").value.trim();
      const password = document.getElementById("rPassword").value;

      if (!firstName || !lastName) {
        alert("Please enter your full name!");
        return;
      }
      if (password.length < 6) {
        alert("Password must be at least 6 characters long!");
        return;
      }

      signUpBtn.classList.add("loading");
      signUpBtn.disabled = true;

      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await db.collection("users").doc(user.uid).set({
          firstName,
          lastName,
          username: `${firstName} ${lastName}`,
          email,
          level: 1,
          xp: 0,
          totalStreak: 0,
          comboMultiplier: 1,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection("leaderboard").doc(user.uid).set({
          userId: user.uid,
          username: `${firstName} ${lastName}`,
          email,
          xp: 0,
          level: 1,
          streak: 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Account created successfully! Welcome to HabitLens! 🎉");
        window.location.href = "../index.html";
      } catch (error) {
        console.error("Sign up error:", error);
        let errorMessage = "Failed to create account. ";
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = "This email is already registered. Please sign in instead.";
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "Please enter a valid email address.";
        } else if (error.code === 'auth/weak-password') {
          errorMessage = "Password is too weak. Please use at least 6 characters.";
        } else {
          errorMessage += error.message;
        }
        alert(errorMessage);
      } finally {
        signUpBtn.classList.remove("loading");
        signUpBtn.disabled = false;
      }
    });
  }

  // ============= SIGN IN =============
  const signInBtn = document.getElementById("submitSignIn");
  if (signInBtn) {
    signInBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      if (!email || !password) {
        alert("Please enter both email and password!");
        return;
      }

      signInBtn.classList.add("loading");
      signInBtn.disabled = true;

      try {
        await auth.signInWithEmailAndPassword(email, password);
        // Redirect happens automatically
      } catch (error) {
        console.error("Sign in error:", error);
        let errorMessage = "Failed to sign in. ";
        if (error.code === 'auth/user-not-found') {
          errorMessage = "No account found with this email. Please sign up first.";
        } else if (error.code === 'auth/wrong-password') {
          errorMessage = "Incorrect password. Please try again.";
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "Please enter a valid email address.";
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = "Too many failed attempts. Please try again later.";
        } else {
          errorMessage += error.message;
        }
        alert(errorMessage);
      } finally {
        signInBtn.classList.remove("loading");
        signInBtn.disabled = false;
      }
    });
  }
});
