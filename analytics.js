/*
 * Google アナリティクス 4（GA4）の読み込み。
 * 測定 ID は Firebase プロジェクトの Web アプリ（データストリーム）に発行されたもの。
 * 下の MEASUREMENT_ID が G-XXXXXXXXXX 形式でない間は、何も読み込まず何も送らない。
 * 計測の範囲（このサイトのどのページで送るか、何を送るか）は privacy.html の
 * 「ウェブサイトのアクセス解析」と一致させること。変えるときは両方を直す。
 */
(function () {
  "use strict";

  var MEASUREMENT_ID = "REPLACE_WITH_GA4_MEASUREMENT_ID";

  if (!/^G-[A-Z0-9]{6,12}$/.test(MEASUREMENT_ID)) return;

  // Do Not Track / Global Privacy Control を尊重し、計測しない。
  var nav = window.navigator || {};
  if (nav.doNotTrack === "1" || window.doNotTrack === "1" || nav.globalPrivacyControl === true) return;

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, {
    // 広告向けの機能は使わない（アクセス解析だけに限る）
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  // App Store への遷移と、お問い合わせの Issues への遷移を、名前付きのイベントにする。
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var name = null;
    if (href.indexOf("https://apps.apple.com/") === 0) name = "app_store_click";
    else if (href.indexOf("https://github.com/andy0911/andy0911.github.io/issues") === 0) name = "contact_click";
    if (!name) return;
    gtag("event", name, {
      link_url: href,
      placement: a.getAttribute("data-placement") || "unknown",
      page_path: location.pathname,
      transport_type: "beacon"
    });
  }, true);
})();
