# litlink-analytics-plus

lit.link の分析ページで、任意の期間を指定して閲覧数・クリック数を集計するユーザースクリプトです。

## 機能

- **任意期間の集計**：開始日・終了日を指定して、期間内の閲覧数・クリック数を合計
- **日別データ表示**：指定した期間の1日ごとの閲覧数・クリック数をテーブル表示
- **APIキャッシュ**：1時間以内の同じリクエストはキャッシュを使用（サーバー負荷軽減）
- **自動認証**：lit.link の既存セッションを再利用して認証

## 導入手順

### ① Tampermonkey をインストール

Tampermonkeyは、ブラウザの拡張機能です。Webサイトに便利な機能を追加する「スクリプト」を実行するために必要です。

お使いのブラウザに対応した Tampermonkey を拡張機能ストアからインストールしてください。

- [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox Add-ons](https://addons.mozilla.org/ja/firefox/addon/tampermonkey/)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### ② スクリプトをインストール

Tampermonkey のインストールが完了したら、以下のリンクをクリックしてください。

- [litlink-analytics-plus.user.js](https://raw.githubusercontent.com/tomoya-mitani/litlink-analytics-plus/main/litlink-analytics-plus.user.js)

インストール画面が表示されたら、**「インストール」** を押してください。

### ③ 使い方

1. `https://lit.link/admin/analytics` を開く
2. 画面右上に「📊 lit.link 期間集計」パネルが自動表示される
3. 開始日・終了日を選んで「集計する」を押す

## 注意点

- **APIは直近1ヶ月分の日次データを返します**（lit.linkの仕様）
- 指定した期間が1ヶ月を超える場合は、直近1ヶ月の範囲内でフィルタリングされます
- APIは**現在日付から1ヶ月前まで**の日次データを返します。そのため、1ヶ月以上前の期間を指定しても、その範囲のデータは取得できません

## ライセンス

このスクリプトは **MIT License** で提供されています。

- 個人利用は自由です
- **無断での改変・再配布はご遠慮ください**（ご要望があれば作者までお問い合わせください）
- 使用に際して発生した問題について、作者は一切の責任を負いません
