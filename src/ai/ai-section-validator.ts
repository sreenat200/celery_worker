import { AiSectionBlueprintSchema } from './ai-blueprint.schema';
import { mergeEditableBlueprint } from './ai-section-editable';
import {
  ALLOWED_PROPS,
  ALLOWED_STYLE_PROPERTIES,
  AI_SETTING_TYPES,
  BINDING_PATTERN,
  LEAF_COMPONENT_TYPES,
  MAX_BLUEPRINT_CHARS,
  MAX_CHILDREN,
  MAX_LAYOUT_DEPTH,
  MAX_LAYOUT_NODES,
  MAX_SETTINGS,
  MAX_SETTING_STRING,
  UNSAFE_CONTENT_PATTERN,
  normalizeComponentType,
  type AiComponentType,
  type AiSettingType,
} from './ai-section-component-registry';

export class AiSectionValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'AiSectionValidationError';
  }
}

export interface ValidatedBlueprint {
  name: string;
  schema: Record<string, any>;
  defaultSettings: Record<string, any>;
  layout: any;
}

function extractJsonObject(raw: string): unknown {
  if (!raw || typeof raw !== 'string') {
    throw new AiSectionValidationError('Empty AI response', 'INVALID_JSON');
  }

  let cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  cleaned = cleaned.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  cleaned = stripTrailingCommas(cleaned);

  const parsed = tryParseJson(cleaned) ?? tryParseJson(sliceFirstObject(cleaned)) ?? parseSequentialObjects(cleaned);
  if (parsed == null) {
    throw new AiSectionValidationError('AI output is not valid JSON', 'INVALID_JSON');
  }
  return parsed;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sliceFirstObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  const a0 = text.indexOf('[');
  const a1 = text.lastIndexOf(']');
  if (a0 >= 0 && a1 > a0) return text.slice(a0, a1 + 1);
  return text;
}

function mergeBlueprints(items: any[]): unknown {
  const blueprints = items.filter((item) => item && typeof item === 'object' && item.layout);
  if (blueprints.length === 1) return blueprints[0];
  if (blueprints.length > 1) {
    const schema = Object.assign({}, ...blueprints.map((b) => b.schema || {}));
    const defaultSettings = Object.assign({}, ...blueprints.map((b) => b.defaultSettings || {}));
    return {
      name: blueprints[0].name || 'Collections',
      schema,
      defaultSettings,
      layout: {
        type: 'container',
        children: blueprints.map((b) => b.layout).filter(Boolean),
      },
    };
  }
  const nodes = items.filter((item) => item && typeof item === 'object' && item.type);
  if (nodes.length) {
    return {
      name: 'Collections',
      schema: {},
      defaultSettings: {},
      layout: { type: 'container', children: nodes },
    };
  }
  return items[0] || null;
}

function parseSequentialObjects(text: string): unknown | null {
  const trimmed = text.trim();
  const asArray = tryParseJson(trimmed.startsWith('[') ? trimmed : `[${trimmed}]`);
  if (Array.isArray(asArray)) {
    const merged = mergeBlueprints(asArray);
    if (merged) return merged;
  }

  const objects: any[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const piece = tryParseJson(stripTrailingCommas(text.slice(start, i + 1)));
        if (piece) objects.push(piece);
        start = -1;
      }
    }
  }
  if (!objects.length) return null;
  return mergeBlueprints(objects);
}

function stripTrailingCommas(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j += 1;
      if (input[j] === '}' || input[j] === ']') continue;
    }
    out += ch;
  }
  return out;
}

function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, acc));
    return acc;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, acc));
  }
  return acc;
}

function assertNoUnsafeContent(value: unknown) {
  const strings = collectStrings(value);
  const hits = strings.filter((s) => UNSAFE_CONTENT_PATTERN.test(s));
  if (hits.length > 0) {
    throw new AiSectionValidationError(
      'AI output contains unsafe or executable content',
      'UNSAFE_CONTENT',
      hits.slice(0, 5).map((s) => s.slice(0, 120)),
    );
  }
}

function collectBindings(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    const re = new RegExp(BINDING_PATTERN.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      acc.add(match[1]);
    }
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectBindings(item, acc));
    return acc;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectBindings(item, acc));
  }
  return acc;
}

function inferSettingType(key: string): AiSettingType {
  const k = key.toLowerCase();
  if (k.includes('color') || k.endsWith('_bg') || k.includes('background')) return 'color';
  if (k.includes('video')) return 'video';
  if (k.includes('image') || k.includes('photo') || k.includes('poster')) return 'image';
  if (k.includes('font')) return 'font';
  if (k.includes('link') || k.includes('url') || k.includes('href')) return 'link';
  if (k.includes('show_') || k.startsWith('is_') || k.startsWith('enable_')) return 'toggle';
  if (k.includes('end_date')) return 'datetime';
  if (k.includes('model')) return 'text';
  if (k.includes('count') || k.includes('column') || k.includes('gap')) return 'number';
  if (k.includes('product') || k.includes('collection')) return 'resourcePicker';
  if (k.includes('description') || k.includes('rich')) return 'richtext';
  return 'text';
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sanitizeUrlLike(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text')) {
    return '';
  }
  return trimmed;
}

function sanitizeStyleMap(style: unknown): Record<string, string | number> | undefined {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return undefined;
  const next: Record<string, string | number> = {};
  for (const [rawKey, rawVal] of Object.entries(style as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!ALLOWED_STYLE_PROPERTIES.has(key)) continue;
    if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
      next[key] = rawVal;
      continue;
    }
    if (typeof rawVal === 'string') {
      const cleaned = sanitizeUrlLike(rawVal);
      if (typeof cleaned === 'string' && cleaned.length > 0 && cleaned.length < 500) {
        next[key] = cleaned;
      }
    }
  }
  return Object.keys(next).length ? next : undefined;
}

function sanitizeNode(raw: unknown, depth: number, counter: { nodes: number }): any {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AiSectionValidationError('Layout node is invalid', 'INVALID_LAYOUT');
  }
  if (depth > MAX_LAYOUT_DEPTH) {
    throw new AiSectionValidationError('Layout nesting exceeds the allowed depth', 'LAYOUT_TOO_DEEP');
  }
  counter.nodes += 1;
  if (counter.nodes > MAX_LAYOUT_NODES) {
    throw new AiSectionValidationError('Layout contains too many nodes', 'LAYOUT_TOO_LARGE');
  }

  const node = raw as Record<string, unknown>;
  const type = normalizeComponentType(node.type);
  if (!type) {
    throw new AiSectionValidationError(
      `Unsupported component type: ${String(node.type || '')}`,
      'UNSUPPORTED_COMPONENT',
      [String(node.type || '')],
    );
  }

  const allowed = new Set(ALLOWED_PROPS[type]);
  const props: Record<string, unknown> = {};
  if (node.props && typeof node.props === 'object' && !Array.isArray(node.props)) {
    for (const [key, value] of Object.entries(node.props as Record<string, unknown>)) {
      if (!allowed.has(key)) continue;
      if (typeof value === 'string') {
        props[key] = sanitizeUrlLike(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        props[key] = value;
      }
    }
  }

  const styleIn = node.style && typeof node.style === 'object' ? (node.style as Record<string, unknown>) : {};
  const style: Record<string, Record<string, string | number>> = {};
  const desktop = sanitizeStyleMap(styleIn.desktop);
  const tablet = sanitizeStyleMap(styleIn.tablet);
  const mobile = sanitizeStyleMap(styleIn.mobile);
  if (desktop) style.desktop = desktop;
  if (tablet) style.tablet = tablet;
  if (mobile) style.mobile = mobile;

  let children: any[] | undefined;
  if (LEAF_COMPONENT_TYPES.has(type)) {
    children = undefined;
  } else if (Array.isArray(node.children)) {
    if (node.children.length > MAX_CHILDREN) {
      throw new AiSectionValidationError(`Component ${type} has too many children`, 'TOO_MANY_CHILDREN');
    }
    children = node.children.map((child) => sanitizeNode(child, depth + 1, counter));
  }

  const clean: Record<string, unknown> = { type };
  if (Object.keys(style).length) clean.style = style;
  if (Object.keys(props).length) clean.props = props;
  if (children && children.length) clean.children = children;
  return clean;
}

function expandFaqArraySettings(schema: Record<string, any>, defaults: Record<string, any>) {
  for (const key of Object.keys(schema)) {
    const field = schema[key];
    const type = String(field?.type || '').toLowerCase();
    if (type !== 'array' && type !== 'list' && type !== 'repeater') continue;
    const raw = defaults[key] ?? field?.default;
    const items = Array.isArray(raw) ? raw : [];
    const isFaq = /faq|question|accordion/i.test(key);
    if (isFaq) {
      items.slice(0, 8).forEach((item: any, i: number) => {
        const n = i + 1;
        const q = typeof item === 'string' ? item : item?.question || item?.q || item?.title || '';
        const a = typeof item === 'string' ? '' : item?.answer || item?.a || item?.content || item?.text || '';
        schema[`faq_${n}_q`] = { type: 'text', label: `Question ${n}`, default: String(q) };
        schema[`faq_${n}_a`] = { type: 'richtext', label: `Answer ${n}`, default: String(a) };
        if (defaults[`faq_${n}_q`] == null) defaults[`faq_${n}_q`] = String(q);
        if (defaults[`faq_${n}_a`] == null) defaults[`faq_${n}_a`] = String(a);
      });
    }
    delete schema[key];
    delete defaults[key];
  }
}

function ensureSettings(blueprint: {
  schema: Record<string, any>;
  defaultSettings: Record<string, any>;
  layout: any;
}) {
  const referenced = collectBindings(blueprint.layout);
  const schema = { ...blueprint.schema };
  const defaults = { ...blueprint.defaultSettings };

  expandFaqArraySettings(schema, defaults);

  for (const [key, field] of Object.entries(schema)) {
    if (!field || typeof field !== 'object') {
      delete schema[key];
      continue;
    }
    const type = String(field.type || '');
    if (!(AI_SETTING_TYPES as readonly string[]).includes(type)) {
      delete schema[key];
      delete defaults[key];
      continue;
    }
    if (!field.label || typeof field.label !== 'string') {
      field.label = humanize(key);
    }
    if (Array.isArray(field.options)) {
      field.options = field.options
        .map((opt: any) => {
          if (opt && typeof opt === 'object' && typeof opt.value === 'string') {
            return { label: String(opt.label || opt.value), value: opt.value };
          }
          if (typeof opt === 'string' || typeof opt === 'number') {
            return { label: humanize(String(opt)), value: String(opt) };
          }
          return null;
        })
        .filter(Boolean);
    }
    if (defaults[key] === undefined) {
      defaults[key] = field.default !== undefined ? field.default : type === 'toggle' ? false : '';
    }
    if (type === 'image' || type === 'video' || type === 'link') {
      defaults[key] = sanitizeUrlLike(defaults[key]);
      if (field.default !== undefined) field.default = sanitizeUrlLike(field.default);
    }
  }

  for (const key of referenced) {
    if (!schema[key]) {
      const type = inferSettingType(key);
      schema[key] = {
        type,
        label: humanize(key),
        default: defaults[key] !== undefined ? defaults[key] : '',
      };
    }
    if (defaults[key] === undefined) {
      defaults[key] = schema[key].default !== undefined ? schema[key].default : '';
    }
  }

  for (const key of Object.keys(defaults)) {
    if (!schema[key]) {
      delete defaults[key];
    } else if (typeof defaults[key] === 'string' && defaults[key].length > MAX_SETTING_STRING) {
      defaults[key] = defaults[key].slice(0, MAX_SETTING_STRING);
    }
  }

  if (Object.keys(schema).length > MAX_SETTINGS) {
    throw new AiSectionValidationError('Too many settings on this section', 'TOO_MANY_SETTINGS');
  }

  return { schema, defaultSettings: defaults };
}

export function validateAiSectionBlueprint(rawText: string): ValidatedBlueprint {
  if (rawText && rawText.length > MAX_BLUEPRINT_CHARS) {
    throw new AiSectionValidationError('AI response exceeds size limit', 'BLUEPRINT_TOO_LARGE');
  }
  const parsed = extractJsonObject(rawText);
  assertNoUnsafeContent(parsed);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AiSectionValidationError('Blueprint must be a JSON object', 'INVALID_STRUCTURE');
  }

  const source = parsed as Record<string, unknown>;
  if (!source.layout || typeof source.layout !== 'object') {
    throw new AiSectionValidationError('Blueprint is missing a layout tree', 'MISSING_LAYOUT');
  }

  const layout = sanitizeNode(source.layout, 1, { nodes: 0 });
  const name =
    typeof source.name === 'string' && source.name.trim().length > 0
      ? source.name.trim().slice(0, 80)
      : 'Custom Section';

  const rawSchema =
    source.schema && typeof source.schema === 'object' && !Array.isArray(source.schema)
      ? (source.schema as Record<string, any>)
      : {};
  const rawDefaults =
    source.defaultSettings && typeof source.defaultSettings === 'object' && !Array.isArray(source.defaultSettings)
      ? (source.defaultSettings as Record<string, any>)
      : {};

  const synced = ensureSettings({
    schema: rawSchema,
    defaultSettings: rawDefaults,
    layout,
  });
  const { schema, defaultSettings } = mergeEditableBlueprint({
    name,
    schema: synced.schema,
    defaultSettings: synced.defaultSettings,
    layout,
  });

  const candidate = { name, schema, defaultSettings, layout };
  assertNoUnsafeContent(candidate);

  const result = AiSectionBlueprintSchema.safeParse(candidate);
  if (!result.success) {
    const issues = Array.isArray((result.error as any)?.issues) ? (result.error as any).issues : [];
    const details = issues.slice(0, 8).map((issue: any) => `${(issue.path || []).join('.')}: ${issue.message}`);
    throw new AiSectionValidationError('Blueprint failed schema validation', 'ZOD_VALIDATION', details);
  }

  return result.data as ValidatedBlueprint;
}

export function isRenderableBlueprint(value: unknown): value is ValidatedBlueprint {
  if (!value || typeof value !== 'object') return false;
  const parsed = AiSectionBlueprintSchema.safeParse(value);
  return parsed.success;
}
