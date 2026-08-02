-- 配信・オーサリング基盤のスキーマ (SU-0004, docs/architecture.md §4)。
--
-- document_versions.body は不変 — 更新は常に新しい行。releases がチャネル
-- (internal/canary/production) ごとの「今どのバージョンが公開されているか」を
-- 指すポインタで、ロールバックはこのポインタの差し替えだけで済む
-- (ADR-0007「イミュータブルなドキュメントと可変のポインタ」)。

CREATE TABLE documents (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id              text NOT NULL UNIQUE,
  name                   text NOT NULL,
  current_draft_version  integer NOT NULL DEFAULT 0,
  created_by             text NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES documents (id),
  seq          integer NOT NULL,
  body         jsonb NOT NULL,
  checksum     text NOT NULL,
  author       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, seq)
);

CREATE TYPE release_channel AS ENUM ('internal', 'canary', 'production');

CREATE TABLE releases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES documents (id),
  version_id       uuid NOT NULL REFERENCES document_versions (id),
  channel          release_channel NOT NULL,
  rollout_percent  integer NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
  targeting        jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at     timestamptz NOT NULL DEFAULT now(),
  published_by     text NOT NULL,
  approved_by      text,
  -- DEFERRABLE: 呼び出し側は新しい行の id を先に決め、まだ挿入していないその id を
  -- 古い行の superseded_by に立ててから新しい行を挿入する (releases_active_idx への
  -- 自己違反を避けるため)。外部キーは COMMIT 時まで検査を遅らせないと、この順序で
  -- 「参照先がまだ存在しない」エラーになる。
  superseded_by    uuid REFERENCES releases (id) DEFERRABLE INITIALLY DEFERRED,
  superseded_at    timestamptz
);

-- チャネルごとに「現在有効な」リリースは高々1件。部分ユニークインデックスとして
-- DB に強制させることで、公開とロールバックの競合が二重に有効な行を作れないようにする。
-- 呼び出し側は、古い行の superseded_by を立ててから新しい行を挿入する順序を守る
-- 必要がある — 部分インデックスは DEFERRABLE にできないため、逆順だと同一
-- トランザクション内で一時的に2行が「有効」になり、この制約に自分自身で違反する。
CREATE UNIQUE INDEX releases_active_idx ON releases (document_id, channel) WHERE superseded_by IS NULL;

CREATE TABLE audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor        text NOT NULL,
  action       text NOT NULL,
  document_id  uuid REFERENCES documents (id),
  version_id   uuid REFERENCES document_versions (id),
  diff         jsonb NOT NULL DEFAULT '{}'::jsonb,
  at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_document_idx ON audit_log (document_id, at DESC);

-- 検討した代替案には出てこないが、Detailed design 項目5 (テレメトリ収集と
-- 対応率の集計) に上の4表だけでは持ち場がないため追加する。
-- docs/architecture.md §8 のイベント名をそのまま event に入れる。
CREATE TABLE telemetry_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id    text NOT NULL,
  version_id   uuid REFERENCES document_versions (id),
  event        text NOT NULL,
  properties   jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX telemetry_events_screen_idx ON telemetry_events (screen_id, event, received_at DESC);
