import { $, esc, UI, showModal, closeModal, toast } from './core.js';
import { listSharedSaves, loadSharedSave, getActiveSharedSave } from './saves-client.js';

export function promptSaveName() {
  return new Promise((resolve) => {
    showModal('给这局起个名字', `<p>这个名字会出现在所有连接同一局域网服务的设备上。</p>
      <label class="save-label" for="sharedSaveName">存档名（1到32字）</label>
      <input id="sharedSaveName" class="save-name-input" maxlength="32" autocomplete="off" placeholder="例如：轩哥的第一百天">
      <p id="sharedSaveError" class="save-error" role="alert"></p>
      <div class="modalbuttons"><button class="primary" id="sharedSaveConfirm">开始</button><button id="sharedSaveCancel">取消</button></div>`, { lock: true, focus: '#sharedSaveName' });
    const input = $('sharedSaveName');
    const done = (value) => { closeModal(true); resolve(value); };
    $('sharedSaveConfirm').onclick = () => {
      const value = input.value.trim();
      if (!value || [...value].length > 32 || /[\x00-\x1f\x7f-\x9f]/u.test(value)) { $('sharedSaveError').textContent = '请输入1到32字，不含控制字符。'; input.focus(); return; }
      done(value);
    };
    $('sharedSaveCancel').onclick = () => done(null);
    input.onkeydown = (event) => { if (event.key === 'Enter') $('sharedSaveConfirm').click(); };
  });
}

export async function showSaveTable({ onLoad, onImport } = {}) {
  const returnFocus = document.activeElement;
  showModal('局域网存档', '<p>正在读取存档列表…</p>', { wide: true });
  let saves;
  try { saves = await listSharedSaves(); }
  catch (error) {
    showModal('局域网存档', `<p class="save-error">${esc(error.message)}。请检查服务连接后重试。</p><div class="modalbuttons"><button id="saveRetry">重试</button></div>`, { wide: true });
    UI.lastFocus = returnFocus;
    $('saveRetry').onclick = () => showSaveTable({ onLoad, onImport });
    return;
  }
  const active = getActiveSharedSave();
  const rows = saves.map((save) => `<tr data-name="${esc(save.name.toLowerCase())}"><td><strong>${esc(save.name)}</strong>${save.id === active?.id ? '<small>当前存档</small>' : ''}</td><td>第${save.day}天</td><td>${esc(new Date(save.updatedAt).toLocaleString('zh-CN'))}</td><td><button data-load="${esc(save.id)}">继续</button></td></tr>`).join('');
  showModal('局域网存档', `<p>按名字找回进度。继续后，当前设备会接着保存到这份存档。</p>
    <label class="save-label" for="saveSearch">查找存档</label><input id="saveSearch" class="save-name-input" placeholder="输入存档名筛选" autocomplete="off">
    <div class="save-table-scroll"><table class="save-table"><thead><tr><th>名称</th><th>进度</th><th>最后保存</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4">还没有共享存档。新开局时可以创建。</td></tr>'}</tbody></table></div>
    ${onImport ? '<div class="modalbuttons"><button id="saveImportLocal">导入当前本机进度为新档</button></div>' : ''}`, { wide: true, focus: '#saveSearch' });
  UI.lastFocus = returnFocus;
  $('saveSearch').oninput = (event) => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('.save-table tbody tr[data-name]').forEach((row) => { row.hidden = !row.dataset.name.includes(query); });
  };
  document.querySelectorAll('[data-load]').forEach((button) => {
    button.onclick = async () => {
      button.disabled = true; button.textContent = '读取中…';
      try { const record = await loadSharedSave(button.dataset.load); closeModal(true); await onLoad?.(record); }
      catch (error) { toast(error.message); button.disabled = false; button.textContent = '继续'; }
    };
  });
  if (onImport) $('saveImportLocal').onclick = async () => { closeModal(true); await onImport(); };
}
