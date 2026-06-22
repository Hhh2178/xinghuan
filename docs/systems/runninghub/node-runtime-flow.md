# RunningHub 节点运行态链路

## 后台到画布的链路

1. 后台条目维护 `fields / inputSlots / outputSchema / executionRules`
2. API public catalog 透出可消费结构
3. 画布 RH 节点读取 catalog 条目
4. 节点按字段定义渲染参数区
5. 运行时将条目元信息与参数一起提交

## 参数区的来源

- 优先使用后台条目定义
- `displayLabel` 存在时，节点名称优先显示标注
- 没有标注时，回退显示参数名

## 分析链路的作用

后台分析面板负责从：

- `requestExample`
- `responseExample`

推断出：

- 字段草案
- 参数 schema 草案
- 输出定义草案
- 执行规则草案

## 当前边界

- 如果运行目标本身不返回 `nodeInfoList`，仍可能需要后台人工补录字段
- 如果条目是历史混合态，必须先回后台重存，不能指望前端修正
