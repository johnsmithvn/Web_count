import { message } from 'antd';

export const copyToClipboard = (text, customMessage = 'Copied to clipboard!') => {
  // Check if clipboard API is available
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => {
      message.success(customMessage);
    }).catch(() => {
      message.error('Failed to copy');
    });
  } else {
    // Fallback for older browsers or non-HTTPS
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success(customMessage);
      return Promise.resolve();
    } catch (err) {
      message.error('Failed to copy');
      return Promise.reject(err);
    }
  }
};
