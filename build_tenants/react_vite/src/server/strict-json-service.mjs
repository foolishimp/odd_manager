function syntaxError(message, offset) {
  const error = new SyntaxError(`${message} at byte ${offset}`);
  error.code = 'strict_json_invalid';
  return error;
}

function duplicateKeyError(key, offset) {
  const error = new SyntaxError(`duplicate JSON object key ${JSON.stringify(key)} at byte ${offset}`);
  error.code = 'duplicate_json_key';
  error.key = key;
  return error;
}

function scanJsonStructure(source) {
  let cursor = 0;

  function whitespace() {
    while (cursor < source.length && /[\u0009\u000a\u000d\u0020]/u.test(source[cursor])) cursor += 1;
  }

  function stringToken() {
    const start = cursor;
    if (source[cursor] !== '"') throw syntaxError('expected JSON string', cursor);
    cursor += 1;
    while (cursor < source.length) {
      const character = source[cursor];
      if (character === '"') {
        cursor += 1;
        try {
          return JSON.parse(source.slice(start, cursor));
        } catch {
          throw syntaxError('invalid JSON string', start);
        }
      }
      if (character === '\\') {
        cursor += 1;
        if (cursor >= source.length) throw syntaxError('unterminated JSON escape', cursor);
        if (source[cursor] === 'u') {
          const hex = source.slice(cursor + 1, cursor + 5);
          if (!/^[0-9a-fA-F]{4}$/u.test(hex)) throw syntaxError('invalid JSON unicode escape', cursor);
          cursor += 5;
        } else {
          if (!/["\\/bfnrt]/u.test(source[cursor])) throw syntaxError('invalid JSON escape', cursor);
          cursor += 1;
        }
        continue;
      }
      if (source.charCodeAt(cursor) < 0x20) throw syntaxError('unescaped JSON control character', cursor);
      cursor += 1;
    }
    throw syntaxError('unterminated JSON string', start);
  }

  function primitiveToken() {
    const start = cursor;
    while (cursor < source.length && !/[\s,\]}]/u.test(source[cursor])) cursor += 1;
    if (cursor === start) throw syntaxError('expected JSON value', cursor);
  }

  function value() {
    whitespace();
    if (source[cursor] === '{') return object();
    if (source[cursor] === '[') return array();
    if (source[cursor] === '"') {
      stringToken();
      return;
    }
    primitiveToken();
  }

  function object() {
    cursor += 1;
    whitespace();
    const keys = new Set();
    if (source[cursor] === '}') {
      cursor += 1;
      return;
    }
    while (cursor < source.length) {
      whitespace();
      const keyOffset = cursor;
      const key = stringToken();
      if (keys.has(key)) throw duplicateKeyError(key, keyOffset);
      keys.add(key);
      whitespace();
      if (source[cursor] !== ':') throw syntaxError('expected colon after JSON object key', cursor);
      cursor += 1;
      value();
      whitespace();
      if (source[cursor] === '}') {
        cursor += 1;
        return;
      }
      if (source[cursor] !== ',') throw syntaxError('expected comma in JSON object', cursor);
      cursor += 1;
    }
    throw syntaxError('unterminated JSON object', cursor);
  }

  function array() {
    cursor += 1;
    whitespace();
    if (source[cursor] === ']') {
      cursor += 1;
      return;
    }
    while (cursor < source.length) {
      value();
      whitespace();
      if (source[cursor] === ']') {
        cursor += 1;
        return;
      }
      if (source[cursor] !== ',') throw syntaxError('expected comma in JSON array', cursor);
      cursor += 1;
    }
    throw syntaxError('unterminated JSON array', cursor);
  }

  value();
  whitespace();
  if (cursor !== source.length) throw syntaxError('unexpected content after JSON value', cursor);
}

export function parseStrictJson(source) {
  if (typeof source !== 'string') throw new TypeError('strict JSON source must be a string');
  scanJsonStructure(source);
  return JSON.parse(source);
}

export function readStrictJson(source) {
  try {
    return { ok: true, value: parseStrictJson(source) };
  } catch (error) {
    return {
      ok: false,
      code: error?.code === 'duplicate_json_key' ? 'duplicate_json_key' : 'invalid_json',
      message: error instanceof Error ? error.message : 'invalid JSON',
    };
  }
}
