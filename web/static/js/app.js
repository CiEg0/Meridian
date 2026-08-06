(function() {
  'use strict';

  const loginEl = document.getElementById('page-login');
  const shellEl = document.getElementById('app-shell');
  const loginFormEl = document.getElementById('loginForm');
  const loginFooterEl = document.getElementById('login-footer');
  const loginButtonEl = document.getElementById('btn-login');
  const usernameInputEl = document.getElementById('inp-username');
  const usernameHelpEl = document.getElementById('admin-username-help');
  const passwordInputEl = document.getElementById('inp-password');
  const passwordHelpEl = document.getElementById('admin-password-help');
  const confirmPasswordGroupEl = document.getElementById('confirm-password-group');
  const confirmPasswordInputEl = document.getElementById('inp-confirm-password');
  const setupTokenGroupEl = document.getElementById('setup-token-group');
  const setupTokenInputEl = document.getElementById('inp-setup-token');
  const setupTokenToggleEl = document.getElementById('btn-toggle-setup-token');
  const authCheckStatusEl = document.getElementById('auth-check-status');
  const authCheckMessageEl = document.getElementById('auth-check-message');
  const authRetryButtonEl = document.getElementById('btn-auth-retry');
  let dashboardRefreshTimer = null;
  let appBootstrapped = false;
  let modalBackdropClosable = false;
  let modalPreviousFocus = null;
  let authMode = 'checking';
  let authSubmissionInFlight = false;
  let authStatus = {
    needs_setup: false,
    mode: 'single_admin',
    jwt_secret_ephemeral: false,
  };

  window.openModal = function(options) {
    modalBackdropClosable = !!(options && options.closeOnBackdrop);
    modalPreviousFocus = document.activeElement;
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-body').scrollTop = 0;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  };

  window.closeModal = function() {
    modalBackdropClosable = false;
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (modalPreviousFocus && modalPreviousFocus.isConnected) modalPreviousFocus.focus();
    modalPreviousFocus = null;
  };

  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this && modalBackdropClosable) closeModal();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('modal-overlay').classList.contains('active')) closeModal();
  });

  function setSetupTokenVisible(visible) {
    setupTokenInputEl.type = visible ? 'text' : 'password';
    setupTokenToggleEl.textContent = visible ? '隐藏' : '显示';
    setupTokenToggleEl.setAttribute('aria-pressed', visible ? 'true' : 'false');
    setupTokenToggleEl.setAttribute('aria-label', visible ? '隐藏初始化令牌' : '显示初始化令牌');
  }

  function setAuthChecking() {
    authMode = 'checking';
    loginFormEl.setAttribute('aria-busy', 'true');
    loginButtonEl.disabled = true;
    loginButtonEl.textContent = '正在检查...';
    authCheckStatusEl.hidden = false;
    authCheckStatusEl.classList.remove('error');
    authCheckStatusEl.setAttribute('role', 'status');
    authCheckMessageEl.textContent = '正在检查初始化状态...';
    authRetryButtonEl.hidden = true;
    authRetryButtonEl.disabled = true;
    loginFooterEl.hidden = true;
  }

  function showAuthCheckError() {
    authMode = 'error';
    loginFormEl.setAttribute('aria-busy', 'false');
    loginButtonEl.disabled = true;
    loginButtonEl.textContent = '状态检查失败';
    authCheckStatusEl.hidden = false;
    authCheckStatusEl.classList.add('error');
    authCheckStatusEl.setAttribute('role', 'alert');
    authCheckMessageEl.textContent = '初始化状态检查失败，无法确定应登录还是创建管理员。请确认服务可用后重试。';
    authRetryButtonEl.hidden = false;
    authRetryButtonEl.disabled = false;
    loginFooterEl.hidden = true;
  }

  async function checkAuth() {
    setAuthChecking();
    try {
      const res = await API.checkSetup();
      if (!res || typeof res.needs_setup !== 'boolean') {
        throw new Error('invalid auth check response');
      }
      authStatus = {
        needs_setup: res.needs_setup,
        mode: typeof res.mode === 'string' ? res.mode : 'single_admin',
        jwt_secret_ephemeral: !!res.jwt_secret_ephemeral,
      };
      if (res.needs_setup) {
        showSetupMode();
        return;
      }
      if (res.authenticated) {
        API.setSession(res);
        enterApp();
        return;
      }
      showLoginMode();
    } catch (e) {
      showAuthCheckError();
    }
  }

  function renderLoginFooter(isSetup) {
    const lines = [isSetup
      ? '当前为单管理员模式，请创建唯一的管理员账号。'
      : '当前为单管理员模式。'];

    if (authStatus.jwt_secret_ephemeral) {
      lines.push('<span class="login-note warn">当前未固定 JWT_SECRET，服务重启后需要重新登录。</span>');
    }

    return lines.join('');
  }

  function showSetupMode() {
    authMode = 'setup';
    loginFormEl.setAttribute('aria-busy', 'false');
    authCheckStatusEl.hidden = true;
    loginButtonEl.textContent = '创建管理员';
    loginButtonEl.disabled = false;
    loginFooterEl.innerHTML = renderLoginFooter(true);
    loginFooterEl.hidden = false;
    usernameHelpEl.hidden = false;
    usernameInputEl.setAttribute('aria-describedby', 'admin-username-help');
    passwordHelpEl.hidden = false;
    passwordInputEl.autocomplete = 'new-password';
    passwordInputEl.setAttribute('aria-describedby', 'admin-password-help');
    confirmPasswordGroupEl.hidden = false;
    confirmPasswordInputEl.required = true;
    setupTokenGroupEl.hidden = false;
    setupTokenInputEl.required = true;
    setSetupTokenVisible(false);
  }

  function showLoginMode() {
    authMode = 'login';
    loginFormEl.setAttribute('aria-busy', 'false');
    authCheckStatusEl.hidden = true;
    loginButtonEl.textContent = '登录';
    loginButtonEl.disabled = false;
    loginFooterEl.innerHTML = renderLoginFooter(false);
    loginFooterEl.hidden = false;
    usernameHelpEl.hidden = true;
    usernameInputEl.removeAttribute('aria-describedby');
    passwordHelpEl.hidden = true;
    passwordInputEl.autocomplete = 'current-password';
    passwordInputEl.removeAttribute('aria-describedby');
    confirmPasswordGroupEl.hidden = true;
    confirmPasswordInputEl.required = false;
    confirmPasswordInputEl.value = '';
    setupTokenGroupEl.hidden = true;
    setupTokenInputEl.required = false;
    setupTokenInputEl.value = '';
    setSetupTokenVisible(false);
  }

  function setupUsernameValidationError(username) {
    const length = utf8ByteLength(username);
    return length < 1 || length > 64 ? '管理员用户名必须为 1-64 个 UTF-8 字节' : '';
  }

  authRetryButtonEl.addEventListener('click', checkAuth);
  setupTokenToggleEl.addEventListener('click', function() {
    setSetupTokenVisible(setupTokenInputEl.type === 'password');
  });

  function startDashboardRefresh() {
    if (dashboardRefreshTimer) clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = setInterval(() => {
      if (Router.current === 'dashboard') loadDashboardData();
    }, 15000);
  }

  function stopDashboardRefresh() {
    if (!dashboardRefreshTimer) return;
    clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = null;
  }

  function teardownAppRuntime() {
    stopDashboardRefresh();
    if (typeof stopDashSSE === 'function') stopDashSSE();
    if (typeof stopTrafficRefresh === 'function') stopTrafficRefresh();
  }

  loginFormEl.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (authSubmissionInFlight) return;
    if (authMode !== 'setup' && authMode !== 'login') {
      Toast.error('初始化状态尚未确认，请先重试');
      return;
    }
    const submittingSetup = authMode === 'setup';

    const username = usernameInputEl.value.trim();
    const password = passwordInputEl.value;
    const confirmPassword = confirmPasswordInputEl.value;
    const setupToken = setupTokenInputEl.value.trim();

    if (!submittingSetup) {
      if (!username || !password) {
        Toast.error('请填写用户名和密码');
        return;
      }
    } else {
      const usernameError = setupUsernameValidationError(username);
      if (usernameError) {
        Toast.error(usernameError);
        return;
      }
      const passwordError = adminPasswordValidationError(password);
      if (passwordError) {
        Toast.error(passwordError);
        return;
      }
      if (password !== confirmPassword) {
        Toast.error('两次输入的密码不一致');
        return;
      }
      if (!setupToken) {
        Toast.error('请填写初始化令牌');
        return;
      }
    }

    authSubmissionInFlight = true;
    loginButtonEl.disabled = true;
    loginButtonEl.textContent = '处理中...';

    try {
      let res;
      if (submittingSetup) {
        res = await API.setup(username, password, setupToken);
        Toast.success('管理员创建成功');
      } else {
        res = await API.login(username, password);
        Toast.success('欢迎回来, ' + res.username + '!');
      }
      API.setSession(res);
      passwordInputEl.value = '';
      confirmPasswordInputEl.value = '';
      setupTokenInputEl.value = '';
      setSetupTokenVisible(false);
      enterApp();
    } catch (err) {
      Toast.error(err.message);
      if (submittingSetup) {
        await checkAuth();
      } else {
        loginButtonEl.disabled = false;
        loginButtonEl.textContent = '登录';
      }
    } finally {
      authSubmissionInFlight = false;
    }
  });


  function enterApp() {
    loginEl.classList.add('hidden');
    shellEl.classList.add('active');

    const avatar = document.getElementById('avatar-btn');
    avatar.textContent = (API.username || 'A')[0].toUpperCase();

    if (!appBootstrapped) {
      Router.register('dashboard', renderDashboard);
      Router.register('sites', renderSites);
      Router.register('traffic', renderTraffic);
      if (typeof renderDiag === 'function') {
        Router.register('diagnostics', renderDiag);
      } else {
        console.error('renderDiag is not defined; diagnostics page script failed to load');
        Router.register('diagnostics', function() {
          var page = document.getElementById('page-diagnostics');
          if (page) {
            page.innerHTML = '<div class="diag-card diag-card-wide"><div class="diag-empty">诊断页面脚本加载失败，请强制刷新浏览器缓存后重试。</div></div>';
          }
        });
      }
      Router.init();
      appBootstrapped = true;
    }

    Router.resolve();
    startDashboardRefresh();
  }

  document.getElementById('avatar-btn').addEventListener('click', async function() {
    if (!confirm('确认退出登录？')) return;

    teardownAppRuntime();
    await API.logout();
    loginEl.classList.remove('hidden');
    shellEl.classList.remove('active');
    showLoginMode();
    document.getElementById('inp-password').value = '';
    Toast.info('已退出登录');
  });

  checkAuth();
})();
