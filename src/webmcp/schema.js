export class ToolContractError extends TypeError {
  constructor(toolName, issues) {
    const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    super(`Invalid arguments for ${toolName}: ${detail}`);
    this.name = "ToolContractError";
    this.code = "INVALID_TOOL_ARGUMENTS";
    this.toolName = toolName;
    this.issues = issues;
  }
}

export function validateArgs(toolName, schema, args) {
  const issues = [];
  validateValue(schema ?? {}, args, "$", issues);
  if (issues.length > 0) throw new ToolContractError(toolName, issues);
  return args;
}

function validateValue(schema, value, path, issues) {
  if (!schema || typeof schema !== "object") return;

  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    issues.push({ path, message: `must be one of ${schema.enum.map(formatValue).join(", ")}` });
    return;
  }
  if (Object.hasOwn(schema, "const") && !Object.is(schema.const, value)) {
    issues.push({ path, message: `must equal ${formatValue(schema.const)}` });
    return;
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((candidate) => {
      const candidateIssues = [];
      validateValue(candidate, value, path, candidateIssues);
      return candidateIssues.length === 0;
    });
    if (matches.length !== 1) issues.push({ path, message: "must match exactly one allowed shape" });
    return;
  }
  if (schema.type && !matchesType(schema.type, value)) {
    issues.push({ path, message: `must be ${schema.type}` });
    return;
  }

  if (schema.type === "object") validateObject(schema, value, path, issues);
  if (schema.type === "array") validateArray(schema, value, path, issues);
  if (schema.type === "string") validateString(schema, value, path, issues);
  if (schema.type === "number" || schema.type === "integer") validateNumber(schema, value, path, issues);
}

function validateObject(schema, value, path, issues) {
  const properties = schema.properties ?? {};
  for (const required of schema.required ?? []) {
    if (!Object.hasOwn(value, required)) issues.push({ path: `${path}.${required}`, message: "is required" });
  }
  for (const [key, entry] of Object.entries(value)) {
    if (Object.hasOwn(properties, key)) validateValue(properties[key], entry, `${path}.${key}`, issues);
    else if (schema.additionalProperties === false) issues.push({ path: `${path}.${key}`, message: "is not allowed" });
    else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      validateValue(schema.additionalProperties, entry, `${path}.${key}`, issues);
    }
  }
}

function validateArray(schema, value, path, issues) {
  if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
    issues.push({ path, message: `must contain at least ${schema.minItems} item(s)` });
  }
  if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
    issues.push({ path, message: `must contain at most ${schema.maxItems} item(s)` });
  }
  if (schema.uniqueItems) {
    const unique = new Set(value.map((entry) => JSON.stringify(entry)));
    if (unique.size !== value.length) issues.push({ path, message: "must contain unique items" });
  }
  if (schema.items) value.forEach((entry, index) => validateValue(schema.items, entry, `${path}[${index}]`, issues));
}

function validateString(schema, value, path, issues) {
  if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
    issues.push({ path, message: `must be at least ${schema.minLength} character(s)` });
  }
  if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) {
    issues.push({ path, message: `must be at most ${schema.maxLength} character(s)` });
  }
  if (schema.pattern && !(new RegExp(schema.pattern).test(value))) {
    issues.push({ path, message: `must match ${schema.pattern}` });
  }
}

function validateNumber(schema, value, path, issues) {
  if (typeof schema.minimum === "number" && value < schema.minimum) issues.push({ path, message: `must be at least ${schema.minimum}` });
  if (typeof schema.maximum === "number" && value > schema.maximum) issues.push({ path, message: `must be at most ${schema.maximum}` });
  if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) issues.push({ path, message: `must be greater than ${schema.exclusiveMinimum}` });
  if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) issues.push({ path, message: `must be less than ${schema.exclusiveMaximum}` });
}

function matchesType(type, value) {
  if (Array.isArray(type)) return type.some((candidate) => matchesType(candidate, value));
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "null") return value === null;
  return typeof value === type;
}

function formatValue(value) {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}
