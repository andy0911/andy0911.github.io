// 共有ページ：# 以降のデータを読み、レシピの数値を表示する。データはどこにも送らない。
// 取り込んだ文字は textContent でだけ表示する（innerHTML は使わない）。
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var MESSAGES = {
    notALink: 'このページのリンクではありません。', linkTooLong: 'リンクが大きすぎます。', tooLarge: 'リンクが大きすぎます。',
    unsupportedVersion: '新しい形式のレシピです。アプリを更新してください。',
    badEncoding: 'リンクが壊れているようです。', badCompression: 'リンクが壊れているようです。', badJSON: 'リンクが壊れているようです。',
    schema: 'リンクが壊れているようです。', duplicateKey: 'リンクが壊れているようです。', unknownKey: 'リンクが壊れているようです。',
    badKind: '器具の種類を読めません。', notInteger: '数値の形が正しくありません。', badName: '名前に使えない文字が含まれています。',
    badBean: '豆の情報が正しくありません。', badSteps: '手順の形が正しくありません。', outOfRange: '数値が使える範囲の外です。'
  };
  var KIND = { drip: 'ハンドドリップ', aeropress: 'エアロプレス', press: 'フレンチプレス', espresso: 'エスプレッソ', other: 'その他' };
  var STEP = { bloom: '蒸らし', pour: '注湯', stir: '撹拌', wait: '待つ', press: 'プレス' };
  function clock(sec) { return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }

  function show(r) {
    $('name').textContent = r.name || '基本のレシピ';
    $('summary').textContent = KIND[r.kind] + ' ・ ' + r.water + ' g ・ ' + clock(r.time);
    $('dose').textContent = r.dose + ' g';
    $('water').textContent = r.water + ' g';
    $('waterLabel').textContent = r.kind === 'espresso' ? '抽出量' : '湯の合計';
    $('temp').textContent = r.temp + ' ℃';
    $('grind').textContent = ['極細', '細', '中細', '中', '中粗', '粗'][r.grind];
    var ol = $('steps');
    r.steps.forEach(function (s) {
      var li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('span');
      a.textContent = STEP[s.kind]; b.textContent = (s.amount === null ? '' : s.amount + ' g ・ ') + clock(s.until);
      li.appendChild(a); li.appendChild(b); ol.appendChild(li);
    });
    $('values').hidden = false; ol.hidden = false;
    if (r.bean) { $('bean').textContent = '作った人の豆：' + r.bean.name + '（焙煎度 ' + r.bean.roast + '）'; $('bean').hidden = false; }
  }

  // アプリが入っている人が Safari で直接開いたとき、Smart App Banner が今の URL をアプリに渡す
  var banner = document.querySelector('meta[name="apple-itunes-app"]');
  if (banner) banner.setAttribute('content', banner.getAttribute('content') + ', app-argument=' + location.href);

  window.RecipeShare.decodeHash(location.hash).then(show).catch(function (e) {
    $('name').textContent = 'レシピを表示できません';
    var p = $('error'); p.textContent = MESSAGES[e && e.code] || 'リンクが壊れているようです。'; p.hidden = false;
  });
})();
