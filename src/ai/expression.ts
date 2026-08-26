/**
 * Universal Commerce Context Expression Engine.
 *
 * A single, dependency-free interpreter shared across the React Admin
 * renderer, the Theme Editor preview, and (via the identical module) the
 * worker-side validation path. It evaluates:
 *
 *   - Scoped interpolation   {{product.title}}
 *   - Fallback chains        {{settings.subheading || 'Default'}}
 *   - Formatters             {{product.price | currency}}, {{title | uppercase | truncate:24}}
 *   - Conditional rendering  node.condition  (e.g. "cart.item_count > 0")
 *
 * Scopes: settings, product, collection, store, cart.
 */

export type ExpressionScope = 'settings' | 'product' | 'collection' | 'store' | 'cart';

export type ExpressionContext = Record<string, any>;

export const EXPRESSION_SCOPES: readonly ExpressionScope[] = [
  'settings',
  'product',
  'collection',
  'store',
  'cart',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export const formatters: Record<string, (value: any, arg?: string) => any> = {
  currency(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? '');
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    } catch {
      return `$${n.toFixed(2)}`;
    }
  },
  uppercase(value) {
    return String(value ?? '').toUpperCase();
  },
  lowercase(value) {
    return String(value ?? '').toLowerCase();
  },
  date(value) {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value ?? '');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },
  truncate(value, arg) {
    const max = Number(arg) > 0 ? Math.floor(Number(arg)) : 80;
    const s = String(value ?? '');
    return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
  },
  default(value, arg) {
    return value == null || value === '' ? (arg ?? '') : value;
  },
};

/**
 * Resolve a dotted path against a context. First segment may be a scope
 * name; if not, the value is looked up in every scope (settings first).
 */
export function resolvePath(path: string, context: ExpressionContext): any {
  const trimmed = (path || '').trim();
  if (!trimmed) return undefined;

  const segments = trimmed.split('.');
  if (EXPRESSION_SCOPES.includes(segments[0] as ExpressionScope)) {
    const scopeValue = context?.[segments[0]];
    return readSegments(scopeValue, segments.slice(1));
  }

  for (const scope of EXPRESSION_SCOPES) {
    const scopeValue = context?.[scope];
    if (scopeValue === undefined || scopeValue === null) continue;
    const found = readSegments(scopeValue, segments);
    if (found !== undefined && found !== null) return found;
  }
  return undefined;
}

function readSegments(root: any, segments: string[]): any {
  let current: any = root;
  for (const seg of segments) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(seg);
      if (!Number.isFinite(idx)) return undefined;
      current = current[idx];
      continue;
    }
    if (isPlainObject(current)) {
      current = current[seg];
      continue;
    }
    return undefined;
  }
  return current;
}

function parseQuotedLiteral(expr: string): { value: any; consumed: boolean } {
  const trimmed = expr.trim();
  const first = trimmed[0];
  if (first === '"' || first === "'") {
    const end = trimmed.indexOf(first, 1);
    if (end >= 0) {
      return { value: trimmed.slice(1, end), consumed: true };
    }
  }
  return { value: undefined, consumed: false };
}

function applyFormatterChain(value: any, chain: string[]): any {
  let result = value;
  for (const segment of chain) {
    const [name, arg] = segment.trim().split(':');
    const fn = formatters[name];
    if (typeof fn === 'function') {
      result = fn(result, arg);
    }
  }
  return result;
}

/**
 * Interpolate a template string containing `{{ ... }}` expressions.
 * Supports scoped paths, `||` fallback chains, and `| formatter(:arg)` pipes.
 */
export function evaluateTemplate(
  template: unknown,
  context: ExpressionContext,
): any {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawExpr: string) => {
    const alternatives = rawExpr.split('||');
    for (const alt of alternatives) {
      const parts = alt.split('|');
      const valueExpr = parts[0];
      const chain = parts.slice(1);
      let value: any;
      const literal = parseQuotedLiteral(valueExpr);
      value = literal.consumed ? literal.value : resolvePath(valueExpr, context);
      value = applyFormatterChain(value, chain);
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return '';
  });
}

// ── Conditional evaluation (safe, no eval) ──────────────────────────────

type CondToken =
  | { kind: 'lit'; value: any }
  | { kind: 'path'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'paren'; value: '(' | ')' };

function tokenizeCondition(expr: string): CondToken[] {
  const tokens: CondToken[] = [];
  let i = 0;
  const n = expr.length;
  while (i < n) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ kind: 'paren', value: ch as '(' | ')' });
      i += 1;
      continue;
    }
    const two = expr.slice(i, i + 2);
    if (two === '&&' || two === '||' || two === '==' || two === '!=' || two === '>=' || two === '<=') {
      tokens.push({ kind: 'op', value: two });
      i += 2;
      continue;
    }
    if (ch === '!' || ch === '>' || ch === '<') {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = expr.indexOf(ch, i + 1);
      const raw = end >= 0 ? expr.slice(i + 1, end) : expr.slice(i + 1);
      tokens.push({ kind: 'lit', value: raw });
      i = end >= 0 ? end + 1 : n;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9.]/.test(expr[j])) j += 1;
      tokens.push({ kind: 'lit', value: Number(expr.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_.]/.test(expr[j])) j += 1;
      const word = expr.slice(i, j);
      if (word === 'true') tokens.push({ kind: 'lit', value: true });
      else if (word === 'false') tokens.push({ kind: 'lit', value: false });
      else if (word === 'null') tokens.push({ kind: 'lit', value: null });
      else tokens.push({ kind: 'path', value: word });
      i = j;
      continue;
    }
    i += 1;
  }
  return tokens;
}

const PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '>': 4,
  '<': 4,
  '>=': 4,
  '<=': 4,
};

function toBoolean(value: any): boolean {
  if (value === true) return true;
  if (value === false) return false;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  return Boolean(value);
}

export function evaluateCondition(
  condition: string | undefined | null,
  context: ExpressionContext,
): boolean {
  if (condition == null || condition === '') return true;
  const tokens = tokenizeCondition(String(condition));
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parsePrimary(): any {
    const tok = next();
    if (!tok) return undefined;
    if (tok.kind === 'lit') return tok.value;
    if (tok.kind === 'path') return resolvePath(tok.value, context);
    if (tok.kind === 'op' && tok.value === '!') return !toBoolean(parsePrimary());
    if (tok.kind === 'paren' && tok.value === '(') {
      const v = parseExpression(0);
      next(); // consume ')'
      return v;
    }
    return undefined;
  }

  function parseExpression(minPrec: number): any {
    let left = parsePrimary();
    for (;;) {
      const tok = peek();
      if (!tok || tok.kind !== 'op') break;
      const op = tok.value;
      const prec = PRECEDENCE[op];
      if (prec === undefined || prec < minPrec) break;
      next();
      const right = parseExpression(prec + 1);
      switch (op) {
        case '||':
          left = toBoolean(left) || toBoolean(right);
          break;
        case '&&':
          left = toBoolean(left) && toBoolean(right);
          break;
        case '==':
          left = String(left) === String(right);
          break;
        case '!=':
          left = String(left) !== String(right);
          break;
        case '>':
          left = Number(left) > Number(right);
          break;
        case '<':
          left = Number(left) < Number(right);
          break;
        case '>=':
          left = Number(left) >= Number(right);
          break;
        case '<=':
          left = Number(left) <= Number(right);
          break;
        default:
          left = undefined;
      }
    }
    return left;
  }

  return toBoolean(parseExpression(0));
}

/**
 * Resolve a repeater's `itemsSource` into an iterable array of scoped
 * item contexts. Returns an empty array when the source resolves to
 * nothing (rather than throwing).
 */
export function resolveRepeaterItems(
  itemsSource: string | undefined | null,
  context: ExpressionContext,
): ExpressionContext[] {
  if (!itemsSource) return [];
  const value = resolvePath(itemsSource.trim(), context);
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({ ...context, item }));
}

/**
 * Build a scoped context for a single repeater item, adding the aliased
 * item and (optionally) index key.
 */
export function repeaterItemContext(
  base: ExpressionContext,
  item: any,
  itemAlias: string,
  indexAlias?: string,
  index?: number,
): ExpressionContext {
  const ctx: ExpressionContext = { ...base, item };
  if (itemAlias) ctx[itemAlias] = item;
  if (indexAlias && index != null) ctx[indexAlias] = index;
  return ctx;
}
