# litlink-analytics-plus

lit.link の分析ページで、任意の期間を指定して閲覧数・クリック数を集計する Tampermonkey ユーザースクリプトです。

## 機能

- **任意期間の集計**：開始日・終了日を指定して、期間内の閲覧数・クリック数を合計
- **日別データ表示**：指定した期間の1日ごとの閲覧数・クリック数をテーブル表示
- **APIキャッシュ**：1時間以内の同じリクエストはキャッシュを使用（サーバー負荷軽減）
- **自動認証**：lit.link の既存セッションを再利用して認証

## インストール

1. **Tampermonkey をインストール**（Chrome/Edge/Firefox の拡張機能ストアから）
2. **スクリプトをインストール**：
   - [litlink-analytics-plus.user.js](https://github.com/tomoya-mitani/litlink-analytics-plus/raw/main/litlink-analytics-plus.user.js) をクリック
   - Tampermonkey が「インストールしますか？」と表示されたら「OK」

## 使い方

1. `https://lit.link/admin/analytics` を開く
2. 画面右上に「📊 lit.link 期間集計」パネルが表示される
3. 開始日・終了日を選んで「集計する」を押す

## 注意点

- **APIは直近1ヶ月分の日次データを返します**（lit.linkの仕様）
- 指定した期間が1ヶ月を超える場合は、直近1ヶ月の範囲内でフィルタリングされます
- 管理画面で「1週間」表示の状態でも、1ヶ月以上前の期間を指定すれば自動的にAPIからデータを取得します

## ライセンス

MIT
