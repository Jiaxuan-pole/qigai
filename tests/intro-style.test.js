// 开场文案的舞台提示行 class 是 stage；HUD 的地图容器也叫 stage，样式必须限定到 .map-wrap，否则第一幕会被撑成全屏盖住画布。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 注释里提到 .stage 不算规则，先剥掉。
const css = (readFileSync(new URL('../public/style.css', import.meta.url), 'utf8') + readFileSync(new URL('../public/ui/life.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');

test('HUD 的 .stage 规则只作用于地图容器，不会碰到开场的舞台提示行', () => {
  const bare = css.match(/(^|[\s,}])\.stage(?![\w-])[^{]*\{[^}]*(position|inset|padding)/gm) || [];
  assert.deepEqual(bare, [], '发现裸 .stage 布局规则：' + bare.join(' | '));
  assert.match(css, /\.map-wrap\.stage\{position:absolute/);
});
