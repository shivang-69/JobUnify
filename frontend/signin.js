// ─────────────────────────────────────────────
// JobUnify — signin.js
// ─────────────────────────────────────────────

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

function showError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + 'Error');
  if (input) input.classList.add('error');
  if (error) error.textContent = message;
}

function clearError(fieldId) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + 'Error');
  if (input) input.classList.remove('error');
  if (error) error.textContent = '';
}

document.querySelectorAll('input').forEach(input => {
  input.addEventListener('input', () => {
    input.classList.remove('error');
    const errorEl = document.getElementById(input.id + 'Error');
    if (errorEl) errorEl.textContent = '';
  });
});

function handleSignin() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  let valid = true;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showError('email', 'Please enter a valid email address.');
    valid = false;
  } else {
    clearError('email');
  }

  if (!password || password.length < 1) {
    showError('password', 'Please enter your password.');
    valid = false;
  } else {
    clearError('password');
  }

  if (!valid) return;

  const btn = document.querySelector('.register-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Signing in...';
  btn.disabled = true;

  // Clear previous API error
  let apiErrorEl = document.getElementById('apiError');
  if (apiErrorEl) apiErrorEl.textContent = '';

  fetch('http://localhost:5000/api/auth/signin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password
    })
  })
  .then(async response => {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Invalid email or password');
    }
    return data;
  })
  .then(data => {
    localStorage.setItem('jobunify_token', data.token);
    localStorage.setItem('jobunify_user', JSON.stringify(data.user));
    window.location.href = 'index.html';
  })
  .catch(error => {
    btn.textContent = originalText;
    btn.disabled = false;

    // Show "Invalid email or password" message under the form
    if (!apiErrorEl) {
      apiErrorEl = document.createElement('div');
      apiErrorEl.id = 'apiError';
      apiErrorEl.className = 'error-msg';
      apiErrorEl.style.textAlign = 'center';
      apiErrorEl.style.marginTop = '10px';
      apiErrorEl.style.display = 'block';
      btn.parentNode.insertBefore(apiErrorEl, btn.nextSibling);
    }
    apiErrorEl.textContent = "Invalid email or password";
  });
}

function handleGoogle() {
  window.location.href = 'http://localhost:5000/api/auth/google';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSignin();
});
