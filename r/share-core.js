// 共有リンクの復号と検証（アプリの CoffeeCore/Share と同じ規則。05 §6.1・UX-62）。DOM に触れない純粋な関数だけ。
// 範囲の表は App/Resources/Rules/recipe.json の写し（test.mjs が一致を確かめる）。
(function (root) {
  'use strict';
  var RULES = {
    nameMaxLength: 40, doseMin: 1, doseMax: 100, tempMin: 70, tempMax: 100, grindMin: 0, grindMax: 5,
    stepsMin: 1, stepsMax: 24, pourMin: 1, pourMax: 10, amountMin: 1, timeMax: 600,
    water: { drip: [150, 600], aeropress: [150, 250], press: [225, 1000], espresso: [14, 50], other: [100, 1000] }
  };
  var MAX_LINK = 2048, MAX_JSON = 4096;
  var KINDS = ['bloom', 'pour', 'stir', 'wait', 'press'];

  function fail(code) { var e = new Error(code); e.code = code; e.share = true; throw e; }

  // 厳格な JSON：重複キー・整数でない数・先頭の 0・-0・深すぎる入れ子を拒否する
  function parseStrict(text) {
    var i = 0;
    function ws() { while (i < text.length && ' \t\n\r'.indexOf(text[i]) >= 0) i++; }
    function value(depth) {
      if (depth > 8) fail('badJSON');
      ws();
      var c = text[i];
      if (c === '{') return object(depth);
      if (c === '[') return array(depth);
      if (c === '"') return string();
      if (text.substr(i, 4) === 'null') { i += 4; return null; }
      if (c === '-' || (c >= '0' && c <= '9')) return integer();
      return fail('badJSON');
    }
    function integer() {
      var m = /^-?[0-9]+/.exec(text.slice(i));
      if (!m) fail('badJSON');
      var s = m[0], digits = s.replace('-', '');
      if (digits.length > 1 && digits[0] === '0') fail('badJSON');
      i += s.length;
      if ('.eE'.indexOf(text[i]) >= 0 && i < text.length) fail('notInteger');
      if (digits.length > 9 || s === '-0') fail('notInteger');
      return parseInt(s, 10);
    }
    function string() {
      var out = ''; i++;
      for (;;) {
        if (i >= text.length) fail('badJSON');
        var c = text[i++];
        if (c === '"') return out;
        if (c.charCodeAt(0) < 0x20) fail('badJSON');
        if (c !== '\\') { out += c; continue; }
        var e = text[i++];
        if (e === 'u') {
          var h = text.substr(i, 4);
          if (!/^[0-9a-fA-F]{4}$/.test(h)) fail('badJSON');
          i += 4;
          var code = parseInt(h, 16);
          if (code >= 0xD800 && code <= 0xDBFF) {
            var l = text.substr(i, 6);
            if (!/^\\u[dD][c-fC-F][0-9a-fA-F]{2}$/.test(l)) fail('badJSON');
            i += 6;
            out += String.fromCharCode(code, parseInt(l.slice(2), 16));
          } else if (code >= 0xDC00 && code <= 0xDFFF) { fail('badJSON'); } else { out += String.fromCharCode(code); }
        } else {
          var map = { '"': '"', '\\': '\\', '/': '/', n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
          if (!(e in map)) fail('badJSON');
          out += map[e];
        }
      }
    }
    function array(depth) {
      i++; var a = []; ws();
      if (text[i] === ']') { i++; return a; }
      for (;;) { a.push(value(depth + 1)); ws(); if (text[i] === ',') { i++; continue; } if (text[i] === ']') { i++; return a; } fail('badJSON'); }
    }
    function object(depth) {
      i++; var o = Object.create(null); ws();
      if (text[i] === '}') { i++; return o; }
      for (;;) {
        ws(); if (text[i] !== '"') fail('badJSON');
        var k = string();
        if (k in o) fail('duplicateKey');
        ws(); if (text[i] !== ':') fail('badJSON'); i++;
        o[k] = value(depth + 1); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return o; }
        fail('badJSON');
      }
    }
    var v = value(0); ws();
    if (i !== text.length) fail('badJSON');
    return v;
  }

  function cleanName(s) {
    var t = s.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      var n = 0; var it = new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(t)[Symbol.iterator]();
      while (!it.next().done) n++;
      if (n > RULES.nameMaxLength) fail('badName');
    } else if (Array.from(t).length > RULES.nameMaxLength) { fail('badName'); }
    // Unicode の一般カテゴリ Cc（制御文字）と Cf（書式文字。U+202E・U+200B など）を含まない。
    // 例外は絵文字の列の中の ZWJ（U+200D）だけ：前が絵文字か U+FE0F、後ろが絵文字（アプリの nameIsClean と同じ。D-1004）
    var cps = Array.from(t);
    var emoji = function (c) { return c !== undefined && c.codePointAt(0) >= 0x80 && /\p{Emoji}/u.test(c); };
    for (var i = 0; i < cps.length; i++) {
      if (/\p{Cc}/u.test(cps[i])) fail('badName');
      if (/\p{Cf}/u.test(cps[i]) &&
          !(cps[i] === '‍' && (emoji(cps[i - 1]) || cps[i - 1] === '️') && emoji(cps[i + 1]))) fail('badName');
    }
    return t;
  }

  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }

  function validate(obj) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) fail('schema');
    var allowed = ['schema', 'kind', 'name', 'dose', 'temp', 'grind', 'steps', 'bean'];
    Object.keys(obj).forEach(function (k) { if (allowed.indexOf(k) < 0) fail('unknownKey'); });
    if (obj.schema !== 1) fail('schema');
    if (typeof obj.kind !== 'string' || !(obj.kind in RULES.water)) fail('badKind');
    if (typeof obj.name !== 'string') fail('badName');
    var name = cleanName(obj.name);
    ['dose', 'temp', 'grind'].forEach(function (k) { if (!isInt(obj[k])) fail('notInteger'); });
    if (!Array.isArray(obj.steps)) fail('badSteps');
    if (obj.steps.length < RULES.stepsMin || obj.steps.length > RULES.stepsMax) fail('outOfRange');
    var water = 0, pours = 0, prev = 0;
    var steps = obj.steps.map(function (s) {
      if (!Array.isArray(s) || s.length !== 3 || typeof s[0] !== 'string' || KINDS.indexOf(s[0]) < 0 || !isInt(s[2])) fail('badSteps');
      var pour = s[0] === 'bloom' || s[0] === 'pour';
      if (pour) { if (!isInt(s[1])) fail('badSteps'); if (s[1] < RULES.amountMin) fail('outOfRange'); water += s[1]; pours++; }
      else if (s[1] !== null) fail('badSteps');
      if (s[2] <= prev) fail('outOfRange');
      prev = s[2];
      return { kind: s[0], amount: s[1], until: s[2] };
    });
    if (prev > RULES.timeMax) fail('outOfRange');
    if (pours < RULES.pourMin || pours > RULES.pourMax) fail('outOfRange');
    var range = RULES.water[obj.kind];
    if (water < range[0] || water > range[1]) fail('outOfRange');
    if (obj.dose < RULES.doseMin || obj.dose > RULES.doseMax) fail('outOfRange');
    if (obj.temp < RULES.tempMin || obj.temp > RULES.tempMax) fail('outOfRange');
    if (obj.grind < RULES.grindMin || obj.grind > RULES.grindMax) fail('outOfRange');
    var bean = null;
    if (obj.bean !== undefined) {
      var b = obj.bean;
      if (b === null || typeof b !== 'object' || Array.isArray(b)) fail('badBean');
      var keys = Object.keys(b).sort();
      if (keys.length !== 2 || keys[0] !== 'name' || keys[1] !== 'roast') fail('badBean');
      if (typeof b.name !== 'string' || !isInt(b.roast) || b.roast < 1 || b.roast > 8) fail('badBean');
      bean = { name: cleanName(b.name), roast: b.roast };
    }
    return { kind: obj.kind, name: name, dose: obj.dose, temp: obj.temp, grind: obj.grind, steps: steps, water: water, time: prev, bean: bean };
  }

  function fromBase64Url(s) {
    if (!s || !/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 === 1) fail('badEncoding');
    var b = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    var bin = atob(b), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // raw DEFLATE を展開しながら MAX_JSON バイトで打ち切る（圧縮爆弾の対策）
  async function inflate(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    var reader = stream.getReader(), chunks = [], total = 0;
    try {
      for (;;) {
        var r = await reader.read();
        if (r.done) break;
        total += r.value.length;
        if (total > MAX_JSON) { await reader.cancel(); fail('tooLarge'); }
        chunks.push(r.value);
      }
    } catch (e) { if (e && e.share) throw e; fail('badCompression'); }
    var out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }

  // location.hash（"#v1.…"）を受け取り、検証済みのレシピを返す。失敗は Error（code 付き）
  async function decodeHash(hash) {
    if (typeof hash !== 'string' || hash.length > MAX_LINK) fail('linkTooLong');
    if (hash.charAt(0) !== '#') fail('notALink');
    var body = hash.slice(1);
    if (!/^v1\./.test(body)) fail(/^v[0-9]+\./.test(body) ? 'unsupportedVersion' : 'notALink');
    var text = new TextDecoder('utf-8', { fatal: true }).decode(await inflate(fromBase64Url(body.slice(3))));
    return validate(parseStrict(text));
  }

  var api = { RULES: RULES, parseStrict: parseStrict, validate: validate, decodeHash: decodeHash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RecipeShare = api;
})(typeof self !== 'undefined' ? self : this);
