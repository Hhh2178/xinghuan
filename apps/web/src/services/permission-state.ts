export function filterNodeCatalogByPermissions<T extends { type: string }>(
  nodes: T[],
  deniedNodeTypes: string[],
) {
  return nodes.filter((node) => isNodeTypeAllowed(node.type, deniedNodeTypes));
}

export function isNodeTypeAllowed(
  nodeType: string,
  deniedNodeTypes: string[],
) {
  const denied = new Set(deniedNodeTypes);
  return !denied.has("*") && !denied.has(nodeType);
}

export function deniedWorkflowNodeTypes(
  nodeTypes: string[],
  deniedNodeTypes: string[],
) {
  return [...new Set(
    nodeTypes.filter((nodeType) => !isNodeTypeAllowed(nodeType, deniedNodeTypes)),
  )];
}
