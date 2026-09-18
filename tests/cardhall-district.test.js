import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dataPath = new URL('../03_开发数据_商店物品愿望事件100日.json', import.meta.url);

async function designData() {
  return JSON.parse(await readFile(dataPath, 'utf8'));
}

test('cardhall has reciprocal station and cinema routes', async () => {
  const data = await designData();
  const districts = Object.fromEntries(data.districts.map((district) => [district.id, district]));

  assert.equal(data.districts.length, 10);
  assert.equal(data.districts.at(-1).id, 'furniture');
  assert.equal(districts.cardhall.name, '棋牌馆');
  assert.deepEqual(districts.cardhall.neighbors, ['station', 'cinema']);
  assert.ok(districts.station.neighbors.includes('cardhall'));
  assert.ok(districts.cinema.neighbors.includes('cardhall'));
  assert.ok(districts.station.hotspots.includes('西侧空地随机牌局'));
  assert.equal(data.shops.length, 10);
});
