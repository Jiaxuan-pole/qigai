const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const button = (label, action, attrs = '') => `<button type="button" data-work-action="${action}" ${attrs}>${esc(label)}</button>`;
const art = kind => `<span class="wg-object wg-${esc(kind)}" aria-hidden="true"></span>`;

export function renderFamilyA(challenge, progress, selectedPiece) {
  switch (challenge.family) {
    case 'sorting': {
      const placed = new Set(progress.placed.map(entry => entry.pieceId));
      const pieces = challenge.pieces.filter(piece => !placed.has(piece.id));
      return `<div class="wg-workbench"><div class="wg-tray" aria-label="待分拣物件"><h3>待分拣 · ${pieces.length} 件</h3><div class="wg-pieces">${pieces.map(piece =>
        button(`${piece.label}${selectedPiece === piece.id ? ' · 已拿起' : ''}`, 'piece', `data-id="${esc(piece.id)}" draggable="true" aria-pressed="${selectedPiece === piece.id}" data-focus="piece-${esc(piece.id)}"`)).join('')}</div></div>
        <div class="wg-bins" aria-label="分类筐">${challenge.bins.map(bin => `<div class="wg-bin" data-bin="${esc(bin.id)}">${art('bin')}${button(bin.label, 'bin', `data-id="${esc(bin.id)}" data-focus="bin-${esc(bin.id)}"`)}</div>`).join('')}</div></div><p class="wg-help">点选或拖动物件，再点选对应筐。键盘按 Enter 选物、Tab 切筐。</p>`;
    }
    case 'memory': {
      if (progress.phase === 'preview') return `<div class="wg-order"><h3>出餐单 · 记住从左到右的顺序</h3><ol>${challenge.order.map(id => `<li>${art(id)}<b>${esc(challenge.dishes.find(d => d.id === id)?.label)}</b></li>`).join('')}</ol></div><div class="wg-actions">${button('记住了，开始出餐', 'ready', 'class="primary" data-focus="ready"')}</div>`;
      return `<div class="wg-order wg-order-hidden"><h3>出餐单已收起</h3><div class="wg-slots">${challenge.order.map((_, i) => `<span class="wg-slot">${i < progress.picks.length ? esc(challenge.dishes.find(d => d.id === progress.picks[i])?.label) : `${i + 1} 号餐`}</span>`).join('')}</div></div><h3>从下一道开始出餐</h3><div class="wg-dishes">${challenge.dishes.map(dish => button(dish.label, 'pick', `data-id="${esc(dish.id)}" data-focus="dish-${esc(dish.id)}"`)).join('')}</div>`;
    }
    case 'circuit': {
      const wires = challenge.tiles.map((tile, i) => {
        let mask = tile.mask;
        for (let n = 0; n < progress.rotations[i]; n++) mask = ((mask << 1) & 15) | (mask >>> 3);
        return `<button type="button" class="wg-tile" data-work-action="rotate" data-index="${i}" data-focus="tile-${i}" aria-label="旋转第 ${Math.floor(i / challenge.width) + 1} 行第 ${i % challenge.width + 1} 列线路"><span class="wg-wire">${[['up', 1], ['right', 2], ['down', 4], ['left', 8]].filter(([, bit]) => mask & bit).map(([direction]) => `<i class="${direction}"></i>`).join('')}</span>${i === challenge.start ? '<span class="wg-terminal">电源</span>' : ''}${i === challenge.end ? '<span class="wg-terminal">设备</span>' : ''}</button>`;
      }).join('');
      return `<div class="wg-circuit"><span class="wg-power">电源 →</span><div class="wg-board" role="group" aria-label="三乘三线路板">${wires}</div><span class="wg-device">→ 设备</span></div><p class="wg-help">点线路块旋转四分之一圈，接通左侧电源与右侧设备。已旋转 ${progress.moves}/${challenge.maxMoves} 次。</p><div class="wg-actions">${button('通电检查', 'submit', 'class="primary" data-focus="submit"')}</div>`;
    }
    case 'audit': {
      const sale = challenge.variant !== 'table';
      return `<div class="wg-ledger"><table><caption>${sale ? '店内价签核对' : '今日进货账目'}</caption><thead><tr><th scope="col">物件</th>${sale ? '<th scope="col">店内基价</th><th scope="col">标价</th>' : '<th scope="col">数量</th><th scope="col">单价</th><th scope="col">记账金额</th>'}<th scope="col">操作</th></tr></thead><tbody>${challenge.rows.map(row => `<tr><th scope="row">${esc(row.item)}</th>${sale ? `<td>${esc(row.basePrice)} 元</td><td>${esc(row.tagPrice)} 元</td>` : `<td>${esc(row.quantity)}</td><td>${esc(row.unitPrice)} 元</td><td>${esc(row.total)} 元</td>`}<td>${button('标出此行', 'flag', `data-id="${esc(row.id)}" data-focus="row-${esc(row.id)}"`)}</td></tr>`).join('')}</tbody></table></div><p class="wg-help">${sale ? '对照店内基价，找出错误价签。' : '逐行核算数量乘单价，找出记错的一行。'}</p>`;
    }
    default: return '<p class="wg-error">未知的工作内容</p>';
  }
}
