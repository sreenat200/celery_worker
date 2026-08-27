/**
 * AST walker — canonical tree traversal for universal section/page
 * blueprints. Mirrors `shared/ast-walker.ts` (kept in-package to respect
 * per-package tsconfig rootDir boundaries).
 *
 * Path convention: the root node is `"root"`; each child appends its index as
 * a dot-separated segment (e.g. `"root.0.1"` = root → child[0] → child[1]).
 */

export interface AstNode {
  type?: string;
  id?: string;
  [key: string]: any;
}

export type AstWalkCallback = (node: AstNode, path: string, parent: AstNode | null) => void;

export function walkAst(
  node: AstNode | null | undefined,
  callback: AstWalkCallback,
  parentPath = 'root',
  parent: AstNode | null = null,
): void {
  if (!node || typeof node !== 'object') return;
  const path = parentPath;
  callback(node, path, parent);

  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child, index) => {
    if (child && typeof child === 'object') {
      walkAst(child, callback, `${path}.${index}`, node);
    }
  });
}

export function findNodeById(
  root: AstNode | null | undefined,
  id: string,
): { node: AstNode; path: string } | null {
  let result: { node: AstNode; path: string } | null = null;
  walkAst(root, (node, path) => {
    if (result) return;
    if (node && node.id === id) {
      result = { node, path };
    }
  });
  return result;
}

export function getNodeByPath(
  root: AstNode | null | undefined,
  path: string,
): AstNode | null {
  if (!root || typeof root !== 'object' || !path) return null;

  const normalized = String(path).trim();
  if (!normalized) return null;

  if (normalized.startsWith('root')) {
    const segments = normalized.split('.').slice(1).map(Number);
    return resolveByIndices(root, segments);
  }

  const dashSegments = normalized.split('-').map(Number);
  if (dashSegments.every((n) => Number.isFinite(n))) {
    let node: AstNode | null = root;
    for (let i = 1; i < dashSegments.length; i += 1) {
      const idx = dashSegments[i];
      if (!node || !Array.isArray(node.children) || !node.children[idx]) return null;
      node = node.children[idx];
    }
    return node;
  }

  return null;
}

function resolveByIndices(root: AstNode, indices: number[]): AstNode | null {
  let node: AstNode | null = root;
  for (const idx of indices) {
    if (!Number.isFinite(idx)) return null;
    if (!node || !Array.isArray(node.children) || !node.children[idx]) return null;
    node = node.children[idx];
  }
  return node;
}

export function mapAst(
  node: AstNode | null | undefined,
  mapper: (node: AstNode) => AstNode,
): AstNode | null {
  if (!node || typeof node !== 'object') return node as AstNode | null;
  const mapped = mapper(node);
  if (Array.isArray(mapped.children)) {
    const children = mapped.children
      .map((child: AstNode) => mapAst(child, mapper))
      .filter((c: AstNode | null): c is AstNode => !!c);
    return { ...mapped, children };
  }
  return mapped;
}
