(function () {
  'use strict';

  const apps = { flow: 'Flow', odo: 'Odo', pastetrail: 'PasteTrail' };
  const strings = {
    en: {
      saving: 'Saving…',
      submit: 'Notify me',
      unsupported: 'Please use a newer browser to sign up for launch notifications.',
      title: function (name) { return 'Get notified when ' + name + ' launches'; },
      copy: function (name) { return 'One email when ' + name + ' launches.'; },
      invalid: 'Please enter a valid email address.',
      rejected: 'Please check your email address and try again.',
      tooMany: 'Too many requests. Please try again in a little while.',
      unavailable: 'Sign-ups are temporarily unavailable. Please try again later.',
      failed: 'We couldn’t save your email. Please try again.',
      timeout: 'That took too long. Please try again.',
      offline: 'We couldn’t save your email. Check your connection and try again.',
      successTitle: "You're on the list.",
      successCopy: function (name) { return "We'll email you when " + name + ' launches.'; }
    },
    zh: {
      saving: '正在保存…',
      submit: '通知我',
      unsupported: '请使用较新版本的浏览器登记发布通知。',
      title: function (name) { return name + ' 发布时通知我'; },
      copy: function (name) { return name + ' 发布时，我们只会给你发一封邮件。'; },
      invalid: '请输入有效的邮箱地址。',
      rejected: '请检查邮箱地址后重试。',
      tooMany: '请求过于频繁，请稍后再试。',
      unavailable: '暂时无法登记，请稍后再试。',
      failed: '未能保存你的邮箱，请重试。',
      timeout: '请求超时，请重试。',
      offline: '未能保存你的邮箱，请检查网络连接后重试。',
      successTitle: '已加入通知名单。',
      successCopy: function (name) { return name + ' 发布时我们会发邮件通知你。'; }
    }
  };
  const t = /^zh\b/i.test(document.documentElement.lang) ? strings.zh : strings.en;
  const dialog = document.getElementById('waitlist-dialog');
  const form = document.getElementById('waitlist-form');
  const email = document.getElementById('waitlist-email');
  const website = document.getElementById('waitlist-website');
  const title = document.getElementById('waitlist-title');
  const copy = document.getElementById('waitlist-copy');
  const feedback = document.getElementById('waitlist-feedback');
  const success = document.getElementById('waitlist-success');
  const submit = form.querySelector('button[type="submit"]');
  const done = success.querySelector('button');

  let app = null;
  let opener = null;
  let request = null;
  let busy = false;
  let generation = 0;

  function setBusy(value) {
    busy = value;
    submit.disabled = value;
    submit.textContent = value ? t.saving : t.submit;
    form.setAttribute('aria-busy', String(value));
  }

  function showError(message, invalidEmail) {
    feedback.textContent = message;
    feedback.hidden = false;
    if (invalidEmail) {
      email.setAttribute('aria-invalid', 'true');
      email.focus();
    }
  }

  document.querySelectorAll('[data-notify-app]').forEach(function (button) {
    button.addEventListener('click', function () {
      const selectedApp = button.dataset.notifyApp;
      if (!apps[selectedApp]) return;
      if (typeof dialog.showModal !== 'function') {
        window.alert(t.unsupported);
        return;
      }

      generation += 1;
      app = selectedApp;
      opener = button;
      form.reset();
      form.hidden = false;
      success.hidden = true;
      feedback.hidden = true;
      feedback.textContent = '';
      email.removeAttribute('aria-invalid');
      title.textContent = t.title(apps[app]);
      copy.textContent = t.copy(apps[app]);
      setBusy(false);
      dialog.showModal();
      document.body.classList.add('waitlist-open');
      email.focus({ preventScroll: true });
    });
  });

  dialog.querySelector('.waitlist-close').addEventListener('click', function () {
    dialog.close();
  });
  done.addEventListener('click', function () { dialog.close(); });

  dialog.addEventListener('click', function (event) {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) {
      dialog.close();
    }
  });

  dialog.addEventListener('close', function () {
    generation += 1;
    if (request) request.abort();
    request = null;
    app = null;
    form.reset();
    setBusy(false);
    document.body.classList.remove('waitlist-open');
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });

  email.addEventListener('input', function () {
    email.removeAttribute('aria-invalid');
    feedback.hidden = true;
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy || !apps[app]) return;
    email.value = email.value.trim();
    if (!email.checkValidity()) {
      showError(t.invalid, true);
      return;
    }

    const selectedApp = app;
    const currentGeneration = generation;
    const controller = new AbortController();
    request = controller;
    feedback.hidden = true;
    setBusy(true);
    const timeout = window.setTimeout(function () { controller.abort(); }, 15000);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        body: JSON.stringify({ app: selectedApp, email: email.value, website: website.value }),
        signal: controller.signal
      });
      if (currentGeneration !== generation || !dialog.open) return;

      if (!response.ok) {
        if (response.status === 400 || response.status === 422) {
          showError(t.rejected, true);
        } else if (response.status === 429) {
          showError(t.tooMany);
        } else if (response.status === 503 || response.status === 404 || response.status === 405 || response.status === 501) {
          showError(t.unavailable);
        } else {
          showError(t.failed);
        }
        return;
      }

      const result = await response.json();
      if (currentGeneration !== generation || !dialog.open) return;
      if (result.ok !== true) {
        showError(t.failed);
        return;
      }

      title.textContent = t.successTitle;
      copy.textContent = t.successCopy(apps[selectedApp]);
      form.reset();
      form.hidden = true;
      success.hidden = false;
      title.focus({ preventScroll: true });
    } catch (error) {
      if (currentGeneration !== generation || !dialog.open) return;
      showError(error.name === 'AbortError' ? t.timeout : t.offline);
    } finally {
      window.clearTimeout(timeout);
      if (currentGeneration === generation) {
        request = null;
        setBusy(false);
      }
    }
  });
})();
