const contactForm = document.getElementById('contact-form');
const contactSubject = document.getElementById('contact-subject');
const contactReply = document.getElementById('contact-reply');
const contactMessage = document.getElementById('contact-message');
const contactVersion = document.getElementById('contact-version');
const contactFeedback = document.getElementById('contact-feedback');
const contactSubmit = document.getElementById('contact-submit');

function setContactFeedback(message, type = '') {
  contactFeedback.textContent = message;
  contactFeedback.className = type
    ? `contact-form__feedback contact-form__feedback--${type}`
    : 'contact-form__feedback';
}

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  void (async () => {
    contactSubmit.disabled = true;
    setContactFeedback('');

    try {
      const result = await window.amongUsBot.submitContact({
        subject: contactSubject.value.trim(),
        message: contactMessage.value.trim(),
        contact: contactReply.value.trim(),
      });

      if (result?.success) {
        setContactFeedback(result.message || '送信しました', 'success');
        contactMessage.value = '';
      } else {
        setContactFeedback(result?.message || '送信に失敗しました', 'error');
      }
    } catch (error) {
      setContactFeedback(getErrorMessage(error, '送信に失敗しました'), 'error');
    } finally {
      contactSubmit.disabled = false;
    }
  })();
});

async function init() {
  if (!window.amongUsBot || !contactVersion) {
    return;
  }

  try {
    const info = await window.amongUsBot.getAppInfo();
    contactVersion.textContent = `${info.name} v${info.version}`;
  } catch {
    contactVersion.textContent = '';
  }
}

void init();
