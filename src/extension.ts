import * as vscode from 'vscode';

const OPEN_COMMAND = 'promptScratchpad.openScratchpad';
const OPEN_IN_SIDEBAR_COMMAND = 'promptScratchpad.openScratchpadInSidebar';
const OPEN_IN_PANEL_COMMAND = 'promptScratchpad.openScratchpadInPanel';
const OPEN_IN_EDITOR_COMMAND = 'promptScratchpad.openScratchpadInEditor';

const SIDEBAR_CONTAINER_ID = 'promptScratchpadSidebar';
const PANEL_CONTAINER_ID = 'promptScratchpadPanel';
const SIDEBAR_VIEW_ID = 'promptScratchpad.sidebarView';
const PANEL_VIEW_ID = 'promptScratchpad.panelView';
const EDITOR_PANEL_ID = 'promptScratchpad.editorPanel';
const DRAFT_KEY = 'promptScratchpad.draft';
const OPEN_LOCATION_KEY = 'openLocation';

type OpenLocation = 'sidebar' | 'panel' | 'editor';

type IncomingMessage =
  | { type: 'draftChanged'; value: string }
  | { type: 'copy'; value: string }
  | { type: 'clear' }
  | { type: 'cut'; value: string }
  | { type: 'pasteToTerminal'; value: string }
  | { type: 'moveToTerminal'; value: string }
  | { type: 'appendClipboard'; value: string };

export function activate(context: vscode.ExtensionContext): void {
  const scratchpad = new ScratchpadController(context);
  const sidebarProvider = new ScratchpadViewProvider(scratchpad, 'sidebar');
  const panelProvider = new ScratchpadViewProvider(scratchpad, 'panel');

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SIDEBAR_VIEW_ID, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.window.registerWebviewViewProvider(PANEL_VIEW_ID, panelProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.name = 'Prompt Scratchpad';
  statusBar.text = '$(note) PS';
  statusBar.command = OPEN_COMMAND;
  updateStatusBarTooltip(statusBar);
  statusBar.show();

  context.subscriptions.push(
    statusBar,
    vscode.commands.registerCommand(OPEN_COMMAND, async () => {
      await openConfiguredLocation(scratchpad, sidebarProvider, panelProvider);
    }),
    vscode.commands.registerCommand(OPEN_IN_SIDEBAR_COMMAND, async () => {
      await revealSidebar(sidebarProvider);
    }),
    vscode.commands.registerCommand(OPEN_IN_PANEL_COMMAND, async () => {
      await revealPanel(panelProvider);
    }),
    vscode.commands.registerCommand(OPEN_IN_EDITOR_COMMAND, async () => {
      await scratchpad.openEditorPanel();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('promptScratchpad.openLocation')) {
        updateStatusBarTooltip(statusBar);
      }
    })
  );
}

export function deactivate(): void {}

async function openConfiguredLocation(
  scratchpad: ScratchpadController,
  sidebarProvider: ScratchpadViewProvider,
  panelProvider: ScratchpadViewProvider
): Promise<void> {
  const location = getOpenLocation();
  switch (location) {
    case 'sidebar':
      await revealSidebar(sidebarProvider);
      break;
    case 'panel':
      await revealPanel(panelProvider);
      break;
    case 'editor':
      await scratchpad.openEditorPanel();
      break;
    default:
      await revealSidebar(sidebarProvider);
      break;
  }
}

async function revealSidebar(provider: ScratchpadViewProvider): Promise<void> {
  await vscode.commands.executeCommand(`workbench.view.extension.${SIDEBAR_CONTAINER_ID}`);
  provider.show();
}

async function revealPanel(provider: ScratchpadViewProvider): Promise<void> {
  await vscode.commands.executeCommand(`workbench.view.extension.${PANEL_CONTAINER_ID}`);
  provider.show();
}

function getOpenLocation(): OpenLocation {
  return vscode.workspace
    .getConfiguration('promptScratchpad')
    .get<OpenLocation>(OPEN_LOCATION_KEY, 'sidebar');
}

function updateStatusBarTooltip(statusBar: vscode.StatusBarItem): void {
  const location = getOpenLocation();
  statusBar.tooltip = `Open Prompt Scratchpad (${location})`;
}

class ScratchpadViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  public constructor(
    private readonly scratchpad: ScratchpadController,
    private readonly location: 'sidebar' | 'panel'
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    this.scratchpad.attachWebview(`view:${this.location}`, webviewView.webview);

    webviewView.onDidDispose(() => {
      this.view = undefined;
      this.scratchpad.detachWebview(`view:${this.location}`);
    });
  }

  public show(): void {
    this.view?.show?.(true);
  }
}

class ScratchpadController {
  private readonly webviews = new Map<string, vscode.Webview>();
  private editorPanel: vscode.WebviewPanel | undefined;

  public constructor(private readonly context: vscode.ExtensionContext) {}

  public attachWebview(key: string, webview: vscode.Webview): void {
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    webview.html = this.getHtml(webview);
    void webview.postMessage({ type: 'setDraft', value: this.getDraft() });

    this.webviews.set(key, webview);
    webview.onDidReceiveMessage(async (message: IncomingMessage) => {
      await this.handleMessage(message, key);
    });
  }

  public detachWebview(key: string): void {
    this.webviews.delete(key);
  }

  public async openEditorPanel(): Promise<void> {
    if (this.editorPanel) {
      this.editorPanel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      EDITOR_PANEL_ID,
      'Prompt Scratchpad',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );

    this.editorPanel = panel;
    this.attachWebview('editor', panel.webview);

    panel.onDidDispose(() => {
      this.detachWebview('editor');
      this.editorPanel = undefined;
    });
  }

  private async handleMessage(message: IncomingMessage, sourceKey: string): Promise<void> {
    switch (message.type) {
      case 'draftChanged':
        await this.setDraft(message.value);
        this.broadcastDraft(sourceKey);
        break;
      case 'copy':
        await vscode.env.clipboard.writeText(message.value);
        void vscode.window.showInformationMessage('Prompt Scratchpad copied to clipboard.');
        break;
      case 'clear':
        await this.setDraft('');
        this.broadcastDraft();
        break;
      case 'cut':
        await vscode.env.clipboard.writeText(message.value);
        await this.setDraft('');
        this.broadcastDraft();
        void vscode.window.showInformationMessage('Prompt Scratchpad cut to clipboard.');
        break;
      case 'pasteToTerminal':
        await this.pasteToTerminal(message.value);
        break;
      case 'moveToTerminal':
        if (await this.pasteToTerminal(message.value)) {
          await this.setDraft('');
          this.broadcastDraft();
        }
        break;
      case 'appendClipboard': {
        const clipboard = await vscode.env.clipboard.readText();
        if (!clipboard) {
          void vscode.window.showWarningMessage('Clipboard is empty.');
          return;
        }

        const nextDraft =
          message.value.trim().length === 0 ? clipboard : `${message.value}\n${clipboard}`;
        await this.setDraft(nextDraft);
        this.broadcastDraft();
        break;
      }
      default:
        break;
    }
  }

  private async pasteToTerminal(text: string): Promise<boolean> {
    const terminal = vscode.window.activeTerminal;
    if (!terminal) {
      void vscode.window.showWarningMessage(
        'No active terminal found. Please focus or create a terminal first.'
      );
      return false;
    }

    terminal.sendText(text, false);
    void vscode.window.showInformationMessage('Prompt Scratchpad sent to the active terminal.');
    return true;
  }

  private storage(): vscode.Memento {
    return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? this.context.workspaceState
      : this.context.globalState;
  }

  private getDraft(): string {
    return this.storage().get<string>(DRAFT_KEY, '');
  }

  private async setDraft(value: string): Promise<void> {
    await this.storage().update(DRAFT_KEY, value);
  }

  private broadcastDraft(exceptKey?: string): void {
    const draft = this.getDraft();
    for (const [key, webview] of this.webviews.entries()) {
      if (key === exceptKey) {
        continue;
      }

      void webview.postMessage({
        type: 'setDraft',
        value: draft
      });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Prompt Scratchpad</title>
  </head>
  <body>
    <div class="layout">
      <div class="toolbar">
        <div class="group group-four">
          <button id="copy" class="primary" title="Copy draft to clipboard">Copy</button>
          <button id="clear" class="secondary" title="Clear the draft">Clear</button>
          <button id="cut" class="secondary" title="Copy and clear the draft">Cut</button>
          <button id="appendClipboard" class="secondary" title="Paste clipboard text into the draft">Paste</button>
        </div>
        <div class="group group-two">
          <button id="paste" class="secondary" title="Paste draft into the active terminal without clearing">Paste to Terminal</button>
          <button id="move" class="primary" title="Send draft to the active terminal and clear it">Move to Terminal</button>
        </div>
      </div>
      <textarea id="draft" placeholder="Draft prompts here while you keep scrolling the terminal..."></textarea>
      <div class="hint">Default open location: ${getOpenLocation()}. Text actions work on the draft. Terminal actions send to the active terminal.</div>
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function getNonce(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
