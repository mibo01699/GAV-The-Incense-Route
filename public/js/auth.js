document.getElementById('login-btn').addEventListener('click', async function() {
  const btn = this;
  const errorDiv = document.getElementById('login-error');
  btn.disabled = true;
  btn.textContent = 'جارٍ الاتصال...';
  errorDiv.style.display = 'none';

  try {
    const auth = await Pi.authenticate(['username', 'payments']);
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: auth.accessToken })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Auth failed');
    document.getElementById('user-name').textContent = data.user.username;
    document.getElementById('user-id').textContent = data.user.uid;
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
  } catch (err) {
    errorDiv.textContent = 'فشل تسجيل الدخول: ' + err.message;
    errorDiv.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 تسجيل الدخول بحساب Pi';
  }
});