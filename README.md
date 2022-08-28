# Recording tasks from TickTick to Notion

[![clasp](https://img.shields.io/badge/built%20with-clasp-4285f4.svg)](https://github.com/google/clasp)

タスク管理アプリ TickTick で完了したタスクを Notion に記録する GAS プロジェクトのプログラムです。
This is a program of the GAS project that records tasks completed by the task management application TickTick in Notion.

TickTick のタスク完了をトリガーとして IFTTT に設定し、Webhook を使用してこの GAS プロジェクトに通知します。
Set IFTTT to trigger TickTick task completion and use Webhooks to notify this GAS project.

## Notion

1. Notion API のインテグレーションを作成する。
2. タスクを記録するためのデータベースを作成する。
3. 作成したデータベースにインテグレーションを追加する。

データベースのプロパティには以下を設定する。

| Name         | Type           |
| ------------ | -------------- |
| TaskName     | ページタイトル |
| TaskContent  | テキスト       |
| CompleteDate | 日付           |
| StartDate    | 日付           |
| EndDate      | 日付           |
| List         | セレクト       |
| Priority     | セレクト       |
| Tag          | マルチセレクト |
| LinkToTask   | URL            |
| CreatedAt    | 日付           |

## GAS

GAS プロジェクトのスクリプトプロパティに、以下を設定する。

| Property     | Value                                   |
| ------------ | --------------------------------------- |
| NOTION_TOKEN | Notion インテグレーションのトークン     |
| DATABASE_ID  | Notion データベースのデータベース ID    |
| MAIL_ADDRESS | エラー通知をするための Gmail のアドレス |
| AUTH_TOKEN   | 認証用のトークン                        |

## IFTTT

### トリガーの設定

TickTick の「New completed task」をトリガーに設定する。
アカウントを連携して、以下を設定する。

| Item     | Value         |
| -------- | ------------- |
| List     | All Lists     |
| Tag      | Please Select |
| Priority | Please Select |

### アクションの設定

Webhooks の「Make a web request」をアクションに設定する。
GAS プロジェクトを Web API としてデプロイして、以下を設定する。
authToken には GAS と同じ値を設定する。

| Item         | Value                   |
| ------------ | ----------------------- |
| URL          | デプロイした API の URL |
| Method       | POST                    |
| Content Type | application/json        |
| Body         | 以下の JSON             |

```
{
  "authToken": "",
  "TaskName": "{{TaskName}}",
  "TaskContent": "{{TaskContent}}",
  "CompleteDate": "{{CompleteDate}}",
  "StartDate": "{{StartDate}}",
  "EndDate": "{{EndDate}}",
  "List": "{{List}}",
  "Priority": "{{Priority}}",
  "Tag": "{{Tag}}",
  "LinkToTask": "{{LinkToTask}}",
  "CreatedAt": "{{CreatedAt}}"
}
```
