// ─────────────────────────────────────────────
// JobUnify — signup.js
// ─────────────────────────────────────────────

let selectedStatus = null;

// ── Select work status card ──
function selectStatus(status) {
  selectedStatus = status;

  document.querySelectorAll('.status-card').forEach(card => {
    card.classList.remove('selected');
  });

  document.getElementById('card-' + status).classList.add('selected');
  document.getElementById('statusError').textContent = '';
}

// ── Toggle password visibility ──
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

// ── Show error ──
function showError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + 'Error');
  if (input) input.classList.add('error');
  if (error) error.textContent = message;
}

// ── Clear error ──
function clearError(fieldId) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + 'Error');
  if (input) input.classList.remove('error');
  if (error) error.textContent = '';
}

// ── Clear errors on input ──
document.querySelectorAll('input').forEach(input => {
  input.addEventListener('input', () => {
    input.classList.remove('error');
    const errorEl = document.getElementById(input.id + 'Error');
    if (errorEl) errorEl.textContent = '';
  });
});

// ── Signup validation ──
function handleSignup() {
  const name     = document.getElementById('name').value.trim();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const mobile   = document.getElementById('mobile').value.trim();

  let valid = true;

  // Name
  if (!name || name.length < 2) {
    showError('name', 'Please enter your full name.');
    valid = false;
  } else {
    clearError('name');
  }

  // Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showError('email', 'Please enter a valid email address.');
    valid = false;
  } else {
    clearError('email');
  }

  // Password
  if (!password || password.length < 6) {
    showError('password', 'Password must be at least 6 characters.');
    valid = false;
  } else {
    clearError('password');
  }

  // Mobile
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobile || !mobileRegex.test(mobile)) {
    showError('mobile', 'Please enter a valid 10-digit Indian mobile number.');
    valid = false;
  } else {
    clearError('mobile');
  }

  // Work status
  if (!selectedStatus) {
    document.getElementById('statusError').textContent = 'Please select your work status.';
    valid = false;
  }

  if (!valid) return;

  // Loading state
  const btn = document.querySelector('.register-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Registering...';
  btn.disabled = true;

  // Clear previous API error
  let apiErrorEl = document.getElementById('apiError');
  if (apiErrorEl) apiErrorEl.textContent = '';

  fetch('http://localhost:5000/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      email,
      password,
      mobile,
      workStatus: selectedStatus
    })
  })
  .then(async response => {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
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

    // Show error message from API under the form
    if (!apiErrorEl) {
      apiErrorEl = document.createElement('div');
      apiErrorEl.id = 'apiError';
      apiErrorEl.className = 'error-msg';
      apiErrorEl.style.textAlign = 'center';
      apiErrorEl.style.marginTop = '10px';
      apiErrorEl.style.display = 'block';
      btn.parentNode.insertBefore(apiErrorEl, btn.nextSibling);
    }
    apiErrorEl.textContent = error.message;
  });
}

// ── Google auth ──
function handleGoogle() {
  window.location.href = 'http://localhost:5000/api/auth/google';
}

// ── Submit on Enter ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSignup();
});
