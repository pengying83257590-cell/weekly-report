#!/usr/bin/env node
/**
 * 周报数据更新工具
 * 用法: node update.js <section> <week> <data...>
 * 
 * 示例:
 *   更新开户: node update.js newAccounts "03/30~04/05" 15 4 3 5 3
 *   更新AUM:  node update.js newAUM "03/30~04/05" "$3.0M" "$1.0M" "$2.0M" "$0.5M" "$1.0M" "$1.5M" "$0" "$0" "$0"
 *   更新KPI:  node update.js kpi 0 "134 / 175" 77
 *   更新日期: node update.js meta updateDate "2026年4月5日"
 *   更新时间进度: node update.js meta timeProgress "92%"
 *   更新小标题: node update.js subtitle newAccounts "上周新增15户，OTC部贡献3户"
 *   更新累计行: node update.js cumulative newAccounts "134" "29" "27" "32" "46"
 * 
 * Section IDs: newAccounts, newAUM, stockAUM, otcPrivate, otcJpHk, ipo, profitBiz, profitDept, revenueDept
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function load() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log('✅ data.json 已更新');
}

function findSection(data, id) {
  const s = data.sections.find(s => s.id === id);
  if (!s) {
    console.error(`❌ 未找到 section: ${id}`);
    console.log('可用:', data.sections.map(s => s.id).join(', '));
    process.exit(1);
  }
  return s;
}

const [,, cmd, ...args] = process.argv;

if (!cmd) {
  console.log(`
📊 周报数据更新工具

命令:
  meta <key> <value>              更新元信息 (updateDate, timeProgress)
  kpi <index> <value> <percent>   更新KPI卡片 (index从0开始)
  subtitle <sectionId> <text>     更新模块小标题
  cumulative <sectionId> <vals>   更新累计完成行 (total行)
  rate <sectionId> <vals>         更新完成率行
  add <sectionId> <week> <vals>   添加新一周数据 (插入到第一条normal行之前)
  target <sectionId> <vals>       更新目标行
  show <sectionId>                查看模块当前数据
  list                            列出所有模块

Section IDs: newAccounts, newAUM, stockAUM, otcPrivate, otcJpHk, ipo, profitBiz, profitDept, revenueDept
  `);
  process.exit(0);
}

const data = load();

switch (cmd) {
  case 'meta': {
    const [key, ...rest] = args;
    data.meta[key] = rest.join(' ');
    console.log(`meta.${key} = "${data.meta[key]}"`);
    save(data);
    break;
  }

  case 'kpi': {
    const [idx, value, percent] = args;
    const i = parseInt(idx);
    data.kpi[i].value = value;
    if (percent) data.kpi[i].percent = parseInt(percent);
    console.log(`KPI[${i}]: ${data.kpi[i].label} = ${value} (${data.kpi[i].percent}%)`);
    save(data);
    break;
  }

  case 'subtitle': {
    const [sectionId, ...rest] = args;
    const section = findSection(data, sectionId);
    section.subtitle = rest.join(' ');
    console.log(`${section.title} 小标题 = "${section.subtitle}"`);
    save(data);
    break;
  }

  case 'cumulative': {
    const [sectionId, ...vals] = args;
    const section = findSection(data, sectionId);
    const row = section.rows.find(r => r.type === 'total');
    if (!row) { console.error('❌ 未找到 total 行'); process.exit(1); }
    // 保留前两列(分类/指标)，替换后面的数据
    for (let i = 0; i < vals.length && i + 2 < row.data.length; i++) {
      row.data[i + 2] = vals[i];
    }
    console.log(`${section.title} 累计:`, row.data.join(' | '));
    save(data);
    break;
  }

  case 'rate': {
    const [sectionId, ...vals] = args;
    const section = findSection(data, sectionId);
    const row = section.rows.find(r => r.type === 'rate');
    if (!row) { console.error('❌ 未找到 rate 行'); process.exit(1); }
    for (let i = 0; i < vals.length && i + 2 < row.data.length; i++) {
      row.data[i + 2] = vals[i];
    }
    console.log(`${section.title} 完成率:`, row.data.join(' | '));
    save(data);
    break;
  }

  case 'target': {
    const [sectionId, ...vals] = args;
    const section = findSection(data, sectionId);
    const row = section.rows.find(r => r.type === 'target');
    if (!row) { console.error('❌ 未找到 target 行'); process.exit(1); }
    for (let i = 0; i < vals.length && i + 2 < row.data.length; i++) {
      row.data[i + 2] = vals[i];
    }
    console.log(`${section.title} 目标:`, row.data.join(' | '));
    save(data);
    break;
  }

  case 'add': {
    const [sectionId, week, ...vals] = args;
    const section = findSection(data, sectionId);
    // 找到第一条 normal 行的位置
    const firstNormal = section.rows.findIndex(r => r.type === 'normal');
    if (firstNormal === -1) { console.error('❌ 未找到插入位置'); process.exit(1); }
    const newRow = { type: 'normal', data: ['新增', week, ...vals] };
    // 如果第一条normal行的分类是"新增"，改为空
    if (section.rows[firstNormal].data[0] === '新增') {
      section.rows[firstNormal].data[0] = '';
    }
    section.rows.splice(firstNormal, 0, newRow);
    console.log(`${section.title} 添加: ${week}`, vals.join(' | '));
    save(data);
    break;
  }

  case 'show': {
    const [sectionId] = args;
    const section = findSection(data, sectionId);
    console.log(`\n📊 ${section.title}`);
    if (section.subtitle) console.log(`   ${section.subtitle}`);
    console.log('   ' + section.headers.join(' | '));
    console.log('   ' + '-'.repeat(60));
    section.rows.forEach(r => {
      const tag = r.type === 'target' ? '🎯' : r.type === 'total' ? '📌' : r.type === 'rate' ? '📈' : '  ';
      console.log(`${tag} ${r.data.join(' | ')}`);
    });
    break;
  }

  case 'list': {
    console.log('\n📋 所有模块:');
    data.sections.forEach(s => {
      const rows = s.rows.filter(r => r.type === 'normal').length;
      console.log(`  ${s.id.padEnd(15)} ${s.title} (${rows}周数据)`);
    });
    break;
  }

  default:
    console.error(`❌ 未知命令: ${cmd}`);
    console.log('运行 node update.js 查看帮助');
    process.exit(1);
}
