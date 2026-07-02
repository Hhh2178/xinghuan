#!/usr/bin/env node

/**
 * verify-package-exports.mjs
 *
 * 验证 monorepo 中所有共享包的 package.json 配置正确性
 *
 * 检查项：
 * 1. types 字段必须指向 ./dist/index.d.ts（而非源码）
 * 2. main 字段必须指向 ./dist/index.js
 * 3. 必须有 exports 字段配置
 * 4. exports 字段中的 types 和 import 路径正确
 *
 * 这个验证脚本防止 AI 或开发者错误配置包的类型导出，
 * 避免 TypeScript 无法解析共享包的问题。
 */

import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// ANSI 颜色代码
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function error(msg) {
  log(`❌ ${msg}`, "red");
}

function success(msg) {
  log(`✅ ${msg}`, "green");
}

function warning(msg) {
  log(`⚠️  ${msg}`, "yellow");
}

function info(msg) {
  log(`ℹ️  ${msg}`, "cyan");
}

// 查找所有包
const packagesDir = resolve(projectRoot, "packages");
const packagePaths = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name, "package.json"));

let hasErrors = false;
let totalWarnings = 0;

log("\n🔍 验证包配置...\n", "blue");

for (const pkgPath of packagePaths) {
  const pkgName = dirname(pkgPath).split(/[/\\]/).pop();
  info(`检查 packages/${pkgName}/package.json`);

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch (err) {
    error(`  无法解析 package.json: ${err.message}`);
    hasErrors = true;
    continue;
  }

  let pkgHasError = false;

  // 检查 1: types 字段
  if (!pkg.types) {
    error(`  缺少 "types" 字段`);
    pkgHasError = true;
  } else if (pkg.types === "./src/index.ts") {
    error(`  "types" 字段指向源码 (${pkg.types})`);
    error(`  应该指向: "./dist/index.d.ts"`);
    pkgHasError = true;
  } else if (pkg.types !== "./dist/index.d.ts") {
    warning(`  "types" 字段值非标准: ${pkg.types}`);
    warning(`  建议使用: "./dist/index.d.ts"`);
    totalWarnings++;
  } else {
    success(`  types 字段正确: ${pkg.types}`);
  }

  // 检查 2: main 字段
  if (!pkg.main) {
    warning(`  缺少 "main" 字段`);
    totalWarnings++;
  } else if (pkg.main === "./src/index.ts") {
    error(`  "main" 字段指向源码 (${pkg.main})`);
    error(`  应该指向: "./dist/index.js"`);
    pkgHasError = true;
  } else if (pkg.main !== "./dist/index.js") {
    warning(`  "main" 字段值非标准: ${pkg.main}`);
    warning(`  建议使用: "./dist/index.js"`);
    totalWarnings++;
  } else {
    success(`  main 字段正确: ${pkg.main}`);
  }

  // 检查 3: exports 字段
  if (!pkg.exports) {
    error(`  缺少 "exports" 字段`);
    error(`  现代包应该提供 exports 字段以支持双模式导出`);
    pkgHasError = true;
  } else {
    // 检查 exports 结构
    const rootExport = pkg.exports["."];
    if (!rootExport) {
      error(`  exports 字段缺少 "." 入口`);
      pkgHasError = true;
    } else {
      // 检查 types
      if (!rootExport.types) {
        error(`  exports["."] 缺少 "types" 字段`);
        pkgHasError = true;
      } else if (rootExport.types === "./src/index.ts") {
        error(`  exports["."].types 指向源码`);
        error(`  应该指向: "./dist/index.d.ts"`);
        pkgHasError = true;
      } else if (rootExport.types !== "./dist/index.d.ts") {
        warning(`  exports["."].types 值非标准: ${rootExport.types}`);
        totalWarnings++;
      } else {
        success(`  exports["."].types 正确: ${rootExport.types}`);
      }

      // 检查 import
      if (!rootExport.import) {
        warning(`  exports["."] 缺少 "import" 字段（ESM 入口）`);
        totalWarnings++;
      } else if (rootExport.import === "./src/index.ts") {
        error(`  exports["."].import 指向源码`);
        error(`  应该指向: "./dist/index.js"`);
        pkgHasError = true;
      } else if (rootExport.import !== "./dist/index.js") {
        warning(`  exports["."].import 值非标准: ${rootExport.import}`);
        totalWarnings++;
      } else {
        success(`  exports["."].import 正确: ${rootExport.import}`);
      }
    }
  }

  if (pkgHasError) {
    hasErrors = true;
  }

  console.log();
}

// 总结
log("=".repeat(60), "blue");
if (hasErrors) {
  error("\n❌ 发现配置错误！\n");
  log("修复建议：", "yellow");
  log("1. 确保 types 字段指向 ./dist/index.d.ts", "yellow");
  log("2. 确保 main 字段指向 ./dist/index.js", "yellow");
  log("3. 添加 exports 字段配置", "yellow");
  log("4. 运行 npm run build 确保构建产物存在\n", "yellow");
  process.exit(1);
} else {
  success("✅ 所有包配置验证通过！\n");
  if (totalWarnings > 0) {
    info("建议处理上述警告以提升项目质量。\n");
  }
}
