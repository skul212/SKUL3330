#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const providers = JSON.parse(readFileSync(join(ROOT, 'data/providers.json'), 'utf8'));
const models = JSON.parse(readFileSync(join(ROOT, 'data/models.json'), 'utf8'));

const ESC = '\x1b[';
const C={reset:'\x1b[0m',bold:'\x1b[1m',dim:'\x1b[2m',cyan:'\x1b[36m',blue:'\x1b[34m',green:'\x1b[32m',yellow:'\x1b[33m',magenta:'\x1b[35m',white:'\x1b[37m',gray:'\x1b[90m'};
const clear = () => process.stdout.write(ESC + '2J' + ESC + 'H');
const hideCursor = () => process.stdout.write(ESC + '?25l');
const showCursor = () => process.stdout.write(ESC + '?25h');

let state = { screen: 'menu', idx: 0, filter: '', page: 0, pageSize: 18, selectedProvider: null, selectedModel: null, chatMessages: [], chatInput: '' };
let filtered = [];

function box(title, lines) {
  const width = Math.min(process.stdout.columns || 80, 100);
  const top = '┌' + '─'.repeat(width - 2) + '┐';
  const bot = '└' + '─'.repeat(width - 2) + '┘';
  const out = [top];
  if (title) {
    out.push('│ ' + C.bold + C.cyan + title + C.reset + ' '.repeat(Math.max(0,width-3-title.length)) + '│');
    out.push('├' + '─'.repeat(width - 2) + '┤');
  }
  for (const l of lines) out.push('│ ' + (l || '').padEnd(width - 3) + '│');
  out.push(bot);
  return out.join('\n');
}

function render() {
  clear();
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  if (state.screen === 'menu') {
    const items = ['Browse Providers (' + providers.length + ')', 'Browse Models (' + models.length + ')', 'Search Models', 'Chat', 'Stats', 'Exit'];
    const lines = items.map((it, i) => (i === state.idx ? '▶ ' + it : '  ' + it));
    lines.push('');
    lines.push('Use ↑↓ to navigate, Enter to select, q to quit');
    process.stdout.write(box('AI-X CLI  •  Terminal UI', lines));
  } else if (state.screen === 'providers') {
    const q = state.filter.toLowerCase();
    const list = q ? providers.filter(p => p.toLowerCase().includes(q)) : providers;
    const start = state.page * state.pageSize;
    const pageItems = list.slice(start, start + state.pageSize);
    const lines = ['Filter: ' + (state.filter || '(none)') + '   (type to filter, Backspace delete, Esc back)', ''];
    pageItems.forEach((p, i) => {
      const global = start + i;
      const marker = global === state.idx ? '▶ ' : '  ';
      lines.push(marker + p);
    });
    lines.push('');
    lines.push(`Page ${state.page + 1}/${Math.max(1, Math.ceil(list.length / state.pageSize))}  •  ${list.length} providers`);
    process.stdout.write(box('Providers', lines));
  } else if (state.screen === 'models') {
    const q = state.filter.toLowerCase();
    const list = (state.selectedProvider ? models.filter(m => m.provider === state.selectedProvider) : models)
      .filter(m => !q || m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q));
    const start = state.page * state.pageSize;
    const pageItems = list.slice(start, start + state.pageSize);
    const lines = ['Filter: ' + (state.filter || '(none)') + (state.selectedProvider ? '   Provider: ' + state.selectedProvider : '')];
    lines.push('');
    pageItems.forEach((m, i) => {
      const global = start + i;
      const marker = global === state.idx ? '▶ ' : '  ';
      lines.push(marker + m.name.padEnd(24) + ' ' + m.provider.slice(0, 22).padEnd(22) + ' ctx:' + m.context);
    });
    lines.push('');
    lines.push(`Page ${state.page + 1}/${Math.max(1, Math.ceil(list.length / state.pageSize))}  •  ${list.length} models`);
    process.stdout.write(box('Models', lines));
  } else if (state.screen === 'modeldetail') {
    const m = state.selectedModel;
    const lines = [
      'Name:     ' + m.name,
      'Provider: ' + m.provider,
      'Context:  ' + m.context,
      'Input $/1M:  ' + m.input,
      'Output $/1M: ' + m.output,
      'Modalities: ' + m.modalities.join(', '),
      '',
      'Press Esc to go back',
    ];
    process.stdout.write(box('Model Details', lines));
  } else if (state.screen === 'chat') {
    const lines = state.chatMessages.slice(-12).map(m => (m.role==='user'?'You: ':'AI:  ') + m.text);
    if (!lines.length) lines.push('Type a message and press Enter. Esc to go back.');
    lines.push('');
    lines.push('Input: ' + state.chatInput);
    process.stdout.write(box('Chat', lines));
  } else if (state.screen === 'stats') {
    const lines = [
      'Providers: ' + providers.length,
      'Models:    ' + models.length,
      'Unique providers with models: ' + new Set(models.map(m => m.provider)).size,
      '',
      'Press Esc to go back',
    ];
    process.stdout.write(box('Stats', lines));
  }
}

function modelsList() {
  const q = state.filter.toLowerCase();
  const base = state.selectedProvider ? models.filter(m => m.provider === state.selectedProvider) : models;
  return q ? base.filter(m => m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q)) : base;
}
function providersList() {
  const q = state.filter.toLowerCase();
  return q ? providers.filter(p => p.toLowerCase().includes(q)) : providers;
}

process.stdin.setRawMode(true);
process.stdin.resume();
hideCursor();

process.stdin.on('data', (buf) => {
  const key = buf.toString();
  if (key === '\u0003' || key === 'q') { showCursor(); clear(); process.exit(0); }
  if (state.screen === 'menu') {
    if (key === '\u001b[A') state.idx = Math.max(0, state.idx - 1);
    else if (key === '\u001b[B') state.idx = Math.min(5, state.idx + 1);
    else if (key === '\r') {
      if (state.idx === 0) { state.screen = 'providers'; state.idx = 0; state.page = 0; state.filter = ''; }
      else if (state.idx === 1) { state.screen = 'models'; state.idx = 0; state.page = 0; state.filter = ''; state.selectedProvider = null; }
      else if (state.idx === 2) { state.screen = 'models'; state.idx = 0; state.page = 0; state.filter = ''; state.selectedProvider = null; }
      else if (state.idx === 3) { state.screen = 'chat'; state.chatInput=''; }
      else if (state.idx === 4) { state.screen = 'stats'; }
      else if (state.idx === 5) { showCursor(); clear(); process.exit(0); }
    }
  } else if (state.screen === 'providers') {
    if (key === '\u001b') { state.screen = 'menu'; state.idx = 0; }
    else if (key === '\u001b[A') { state.idx = Math.max(0, state.idx - 1); if (state.idx < state.page * state.pageSize) state.page--; }
    else if (key === '\u001b[B') { const l = providersList(); state.idx = Math.min(l.length - 1, state.idx + 1); if (state.idx >= (state.page + 1) * state.pageSize) state.page++; }
    else if (key === '\u001b[5~') { state.page = Math.max(0, state.page - 1); state.idx = state.page * state.pageSize; }
    else if (key === '\u001b[6~') { const l = providersList(); const maxPage = Math.ceil(l.length / state.pageSize) - 1; state.page = Math.min(maxPage, state.page + 1); state.idx = state.page * state.pageSize; }
    else if (key === '\r') {
      const l = providersList(); const p = l[state.idx]; if (p) { state.selectedProvider = p; state.screen = 'models'; state.idx = 0; state.page = 0; state.filter = ''; }
    } else if (key === '\x7f') { state.filter = state.filter.slice(0, -1); state.idx = 0; state.page = 0; }
    else if (key.length === 1 && key >= ' ' && key <= '~') { state.filter += key; state.idx = 0; state.page = 0; }
  } else if (state.screen === 'models') {
    const l = modelsList();
    if (key === '\u001b') { if (state.selectedProvider) { state.selectedProvider = null; } else { state.screen = 'menu'; state.idx = 1; } state.filter = ''; state.page = 0; state.idx = 0; }
    else if (key === '\u001b[A') { state.idx = Math.max(0, state.idx - 1); if (state.idx < state.page * state.pageSize) state.page--; }
    else if (key === '\u001b[B') { state.idx = Math.min(l.length - 1, state.idx + 1); if (state.idx >= (state.page + 1) * state.pageSize) state.page++; }
    else if (key === '\u001b[5~') { state.page = Math.max(0, state.page - 1); state.idx = state.page * state.pageSize; }
    else if (key === '\u001b[6~') { const maxPage = Math.ceil(l.length / state.pageSize) - 1; state.page = Math.min(maxPage, state.page + 1); state.idx = state.page * state.pageSize; }
    else if (key === '\r') { const m = l[state.idx]; if (m) { state.selectedModel = m; state.screen = 'modeldetail'; } }
    else if (key === '\x7f') { state.filter = state.filter.slice(0, -1); state.idx = 0; state.page = 0; }
    else if (key.length === 1 && key >= ' ' && key <= '~') { state.filter += key; state.idx = 0; state.page = 0; }
  } else if (state.screen === 'chat') {
    if (key === '\u001b') { state.screen='menu'; }
    else if (key === '\r') { if (state.chatInput.trim()){ state.chatMessages.push({role:'user',text:state.chatInput}); state.chatMessages.push({role:'assistant',text:'Echo: '+state.chatInput}); state.chatInput=''; } }
    else if (key === '\x7f') { state.chatInput=state.chatInput.slice(0,-1); }
    else if (key.length===1 && key>=' ' && key<='~') { state.chatInput += key; }
  } else if (state.screen === 'modeldetail' || state.screen === 'stats') {
    if (key === '\u001b' || key === '\r') { state.screen = state.screen === 'modeldetail' ? 'models' : 'menu'; }
  }
  render();
});

process.on('exit', showCursor);
render();
