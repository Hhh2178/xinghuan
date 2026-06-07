# 生产用户账号创建记录 - 2026-06-06

## 目标

- 按用户要求创建 3 个普通成员账号。
- 账号以 `zezhen` 开头。
- 密码使用随机码。

## 已创建账号

- `zezhen01@xinghuan.local`
- `zezhen02@xinghuan.local`
- `zezhen03@xinghuan.local`

角色均为：

```text
member
```

## 凭据交付

真实密码未写入仓库、文档或聊天输出。

服务器侧临时凭据文件：

```text
/opt/apps/xinghuan-canvas/shared/credentials/accounts-2026-06-06T08-24-45-419Z.txt
```

文件权限：

```text
0600
```

该文件包含当前管理员邮箱、管理员密码和 3 个新成员账号的随机密码。交付后应尽快移入密码管理器，或由管理员完成密码轮换后删除临时凭据文件。

## 验证

- 管理员登录生产后台 API 成功。
- 3 个新成员账号均已通过 `/api/auth/login` 登录验证。
- 未在聊天、文档或 Git 中记录真实密码。
