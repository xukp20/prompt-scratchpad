(function () {
  const vscode = acquireVsCodeApi();
  const draftEl = document.getElementById('draft');
  const copyBtn = document.getElementById('copy');
  const clearBtn = document.getElementById('clear');
  const cutBtn = document.getElementById('cut');
  const pasteBtn = document.getElementById('paste');
  const moveBtn = document.getElementById('move');
  const appendClipboardBtn = document.getElementById('appendClipboard');

  const postDraftChanged = debounce(() => {
    vscode.postMessage({ type: 'draftChanged', value: draftEl.value });
  }, 150);

  draftEl.addEventListener('input', () => {
    postDraftChanged();
  });

  copyBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'copy', value: draftEl.value });
  });

  clearBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'clear' });
  });

  cutBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'cut', value: draftEl.value });
  });

  pasteBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'pasteToTerminal', value: draftEl.value });
  });

  moveBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'moveToTerminal', value: draftEl.value });
  });

  appendClipboardBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'appendClipboard', value: draftEl.value });
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || typeof message.type !== 'string') {
      return;
    }

    switch (message.type) {
      case 'setDraft':
        draftEl.value = typeof message.value === 'string' ? message.value : '';
        postDraftChanged.cancel();
        vscode.setState({ draft: draftEl.value });
        break;
      default:
        break;
    }
  });

  const initialState = vscode.getState();
  if (initialState && typeof initialState.draft === 'string') {
    draftEl.value = initialState.draft;
  }

  function debounce(fn, wait) {
    let timeout = undefined;
    const wrapped = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        timeout = undefined;
        fn();
      }, wait);
    };
    wrapped.cancel = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
    };
    return wrapped;
  }
})();
