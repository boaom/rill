// scripts/gen-mock.mjs —— 生成 src/data/mock.json
// 用法：pnpm gen:mock（或 node scripts/gen-mock.mjs）
// 确定性：固定种子，同输入永远同字节输出。不要改 SEED，除非同时更新 mock.json 并重跑验收。

import { writeFileSync } from 'node:fs';
import { buildMock } from './mock-data.mjs';

const target = new URL('../src/data/mock.json', import.meta.url);
const data = buildMock();
writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(
  `[gen:mock] users=${data.users.length} statuses=${data.statuses.length} comments=${data.comments.length} -> src/data/mock.json`,
);