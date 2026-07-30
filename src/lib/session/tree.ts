import type { FlattenedTreeItem, SavedSession, SessionTreeGroupNode, SessionTreeNode } from '../../types/session'
import { sessionEndpoint } from '../../types/session'

/** 搜索时 buildTree 不注入占位分组，避免无匹配会话下出现空分组树 */
export const NO_GROUP_PLACEHOLDERS: string[] = []

/**
 * 将扁平的 savedSessions 列表构建为侧边栏用的分组树结构。
 *
 * 分组路径支持多级嵌套（如 "prod/web"），通过 getOrCreate 递归创建父分组节点。
 * 最终排序规则：同一层级内分组在前、会话在后，各自按 name 字典序排列。
 * @param groupPlaceholders 空分组占位路径；搜索模式下传 NO_GROUP_PLACEHOLDERS 以避免无会话的空分组
 */
export function buildTree(
  savedSessions: SavedSession[],
  groupPlaceholders: string[],
): SessionTreeNode[] {
  // path → 分组节点；所有层级分组均注册于此，便于按 group 路径挂载会话
  const groupMap: Record<string, SessionTreeGroupNode> = {}

  /**
   * 按路径获取或创建分组节点，并自动递归创建缺失的父级分组。
   * 例：创建 "a/b/c" 时会依次确保 "a"、"a/b" 存在，再将 c 挂到 "a/b" 下
   */
  const getOrCreate = (path: string): SessionTreeGroupNode => {
    if (groupMap[path]) return groupMap[path]
    const name = path.split('/').pop() ?? path
    const node: SessionTreeGroupNode = { id: path, type: 'group', name, path, children: [] }
    groupMap[path] = node
    const parentPath = path.includes('/') ? path.split('/').slice(0, -1).join('/') : null
    if (parentPath) getOrCreate(parentPath).children.push(node)
    return node
  }

  // 先注入占位分组（用户新建但尚无会话的分组），再扫描会话确保其分组节点存在
  groupPlaceholders.forEach((g) => getOrCreate(g))
  savedSessions.forEach((s) => {
    if (s.group) getOrCreate(s.group)
  })

  // 无分组或分组路径未在 groupMap 中的会话，直接挂到根级 ungrouped 列表
  const ungrouped: SessionTreeNode[] = []
  savedSessions.forEach((s) => {
    const sessNode: SessionTreeNode = {
      id: s.savedId,
      type: 'session',
      name: s.label || sessionEndpoint(s) || s.savedId,
      session: s,
    }
    if (s.group && groupMap[s.group]) groupMap[s.group].children.push(sessNode)
    else ungrouped.push(sessNode)
  })

  // 根级分组：path 不含 "/" 的节点（嵌套子分组通过 children 链接，不在此列）
  const rootGroups = Object.values(groupMap).filter((n) => !n.path.includes('/'))

  /** 递归排序：分组优先于会话，同类型按 name 字典序；分组子节点同样递归排序 */
  const sortNodes = (nodes: SessionTreeNode[]): SessionTreeNode[] => {
    const groups = nodes
      .filter((n): n is SessionTreeGroupNode => n.type === 'group')
      .sort((a, b) => a.name.localeCompare(b.name))
    const sessions = nodes
      .filter((n) => n.type === 'session')
      .sort((a, b) => a.name.localeCompare(b.name))
    groups.forEach((g) => {
      g.children = sortNodes(g.children)
    })
    return [...groups, ...sessions]
  }

  return sortNodes([...rootGroups, ...ungrouped])
}

/**
 * 将树形结构按展开状态深度优先扁平化，供侧边栏虚拟列表渲染。
 *
 * 每个节点都会输出一条 FlattenedTreeItem（含原始 node 引用）；
 * 仅当分组处于展开状态时，才继续遍历其 children
 * @param isExp 判断分组 path 是否展开的回调（通常来自 Sidebar 的 expandedGroups 状态）
 */
export function flattenVisibleTree(
  nodes: SessionTreeNode[],
  isExp: (path: string) => boolean,
): FlattenedTreeItem[] {
  const out: FlattenedTreeItem[] = []

  /** 深度优先遍历：先输出当前节点，展开的分组再递归子节点 */
  const walk = (list: SessionTreeNode[]) => {
    for (const node of list) {
      out.push({ id: node.id, type: node.type, node })
      // 折叠的分组不遍历 children，其子节点不会出现在扁平列表中
      if (node.type === 'group' && isExp(node.path)) walk(node.children)
    }
  }

  walk(nodes)
  return out
}
