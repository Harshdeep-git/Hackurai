// This file is now mostly handled by firebase.js
// You can add any additional client-side only functionality here

// Example: Username setup on first visit
window.addEventListener('DOMContentLoaded', () => {
  const username = localStorage.getItem("habitlens_username");
  
  if (!username || username === "Guest") {
    const name = prompt("Welcome to HabitLens! 🎯\n\nWhat should we call you?", "");
    if (name && name.trim()) {
      localStorage.setItem("habitlens_username", name.trim());
      location.reload();
    }
  }
});

// Add smooth transitions for page navigation
document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('a[href]');
  
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('http')) {
        e.preventDefault();
        document.body.style.opacity = '0';
        setTimeout(() => {
          window.location.href = href;
        }, 200);
      }
    });
  });
});

// Fade in page on load
window.addEventListener('load', () => {
  document.body.style.transition = 'opacity 0.3s ease';
  document.body.style.opacity = '1';
});