document.addEventListener("DOMContentLoaded", () => {
  const signUpButton = document.getElementById('signUpButton');
  const signInButton = document.getElementById('signInButton');
  const signInForm = document.getElementById('signIn');
  const signUpForm = document.getElementById('signup');

  signUpButton.addEventListener('click', () => {
    signInForm.style.display = "none";
    signUpForm.style.display = "block";
  });
  signInButton.addEventListener('click', () => {
    signInForm.style.display = "block";
    signUpForm.style.display = "none";
  });
});
