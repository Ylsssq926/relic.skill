"""回归测试：国际平台导入解析器的输出契约。

背景：项目长期只有 wechat / qq / telegram 三个解析器，其中两个是国内平台，
海外用户实际可用的导入工具只有一个。v1.7.0 补齐了 Discord / Slack / WhatsApp /
Instagram / Email 五个解析器，这组测试把它们的输出契约钉死：

  - 统一的 payload 结构（schema_version / source.platform / messages[]）
  - 各平台特有的导出格式都能被正确识别
  - 时间戳三种精度（ISO8601 / 毫秒 epoch / 秒级）都能换算成 Unix 秒
  - 附件、表情、多行消息不会丢
  - --self-name 能正确判定消息方向
  - 产物可以直接喂给 relic_writer.py

每个样本都按该平台官方导出的真实结构构造。
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
WRITER = SCRIPTS / "relic_writer.py"


class ParserTestCase(unittest.TestCase):
    """Shared helpers for parser CLI tests."""

    def run_parser(self, script, input_path, extra=None, out_name="data.json"):
        out = Path(self.tmp.name) / out_name
        cmd = [sys.executable, str(SCRIPTS / script),
               "--input", str(input_path), "--output", str(out)]
        if extra:
            cmd.extend(extra)
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        payload = None
        if out.exists():
            payload = json.loads(out.read_text(encoding="utf-8"))
        return proc, payload

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def tmpdir(self):
        return Path(self.tmp.name)


class DiscordParserTest(ParserTestCase):
    def test_chatexporter_json(self):
        path = self.tmpdir() / "general.json"
        path.write_text(json.dumps({
            "guild": {"id": "1", "name": "Studio"},
            "channel": {"id": "2", "name": "general"},
            "messages": [
                {"type": "Default", "timestamp": "2023-03-01T10:00:00.000+00:00",
                 "content": "Morning", "author": {"id": "u1", "name": "alice"}},
                {"type": "Default", "timestamp": "2023-03-01T10:01:00.000+00:00",
                 "content": "", "attachments": [{"fileName": "mockup.png"}],
                 "author": {"id": "u2", "name": "bob"}},
            ],
        }, ensure_ascii=False), encoding="utf-8")

        proc, payload = self.run_parser(
            "discord_parser.py", path, ["--self-name", "alice", "--pretty"])
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(payload["source"]["platform"], "discord")
        # attachment-only messages still carry signal
        self.assertEqual(len(payload["messages"]), 2)
        self.assertIn("mockup.png", payload["messages"][1]["content"])
        self.assertEqual(payload["messages"][0]["direction"], "outgoing")
        self.assertEqual(payload["messages"][1]["direction"], "incoming")
        # ISO8601 with offset -> Unix seconds
        self.assertEqual(payload["messages"][0]["timestamp"], 1677664800)
        self.assertIn("Studio", payload["messages"][0]["chat_name"])

    def test_official_data_package_folder(self):
        nested = self.tmpdir() / "messages" / "111" / "222"
        nested.mkdir(parents=True)
        (nested / "222.json").write_text(json.dumps({
            "messages": [
                {"type": "Default", "timestamp": "2023-03-01T10:00:00.000+00:00",
                 "content": "hello", "author": {"id": "u1", "username": "alice"}},
            ],
        }, ensure_ascii=False), encoding="utf-8")

        proc, payload = self.run_parser("discord_parser.py", self.tmpdir())
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(payload["messages"][0]["sender_name"], "alice")


class SlackParserTest(ParserTestCase):
    def test_resolves_user_ids_via_users_json(self):
        root = self.tmpdir()
        (root / "users.json").write_text(json.dumps([
            {"id": "U1", "real_name": "Alice Chen"},
            {"id": "U2", "real_name": "Bob Ray"},
        ], ensure_ascii=False), encoding="utf-8")
        (root / "general.json").write_text(json.dumps([
            {"user": "U1", "text": "Deploy finished", "ts": "1677664800.000100"},
            {"user": "U2", "text": "Nice", "ts": "1677664860.000200",
             "files": [{"name": "changelog.md"}]},
            {"bot_id": "B1", "username": "buildbot", "text": "Build passed",
             "ts": "1677664920.000300"},
        ], ensure_ascii=False), encoding="utf-8")

        proc, payload = self.run_parser(
            "slack_parser.py", root, ["--self-name", "Alice Chen"])
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(payload["source"]["platform"], "slack")
        # Uxxxx must become real names, otherwise the persona profile is all IDs
        self.assertEqual(payload["messages"][0]["sender_name"], "Alice Chen")
        self.assertEqual(payload["messages"][1]["sender_name"], "Bob Ray")
        self.assertIn("changelog.md", payload["messages"][1]["content"])
        self.assertEqual(payload["messages"][2]["sender_name"], "buildbot")
        # slack ts is seconds.microseconds -> integer seconds
        self.assertEqual(payload["messages"][0]["timestamp"], 1677664800)


class WhatsAppParserTest(ParserTestCase):
    def test_ios_and_android_formats_and_seconds(self):
        root = self.tmpdir()
        (root / "Chat with Mom.txt").write_text(
            "[2023/3/1, 10:00:00] Me: Hey mom\n"
            "[2023/3/1, 10:00:05] Mom: Hi sweetheart\n"
            "[2023/3/1, 10:00:09] Mom: Did you eat\n"
            "<Media omitted>\n"
            "[2023/3/1, 10:01:00] Me: Yes mom\n",
            encoding="utf-8",
        )
        (root / "Work.txt").write_text(
            "1/5/23, 9:15 - Alice: Standup moved to 10\n"
            "1/5/23, 9:16 - Bob: works\n",
            encoding="utf-8",
        )

        proc, payload = self.run_parser(
            "whatsapp_parser.py", root, ["--self-name", "Me"])
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(payload["source"]["platform"], "whatsapp")
        self.assertEqual(len(payload["messages"]), 6)

        mom = [m for m in payload["messages"] if "Mom" in m["chat_name"]]
        self.assertEqual(len(mom), 4)
        # multi-line: a bare "<Media omitted>" folds into the previous message
        self.assertEqual(mom[2]["content"], "Did you eat\n<Media omitted>")
        self.assertEqual(mom[0]["direction"], "outgoing")
        # seconds must survive: 10:00:00 vs 10:00:05
        self.assertEqual(mom[1]["timestamp"] - mom[0]["timestamp"], 5)

    def test_bracket_free_android_no_seconds(self):
        root = self.tmpdir()
        (root / "G.txt").write_text("1/5/23, 9:15 - A: one\n1/5/23, 9:16 - A: two\n",
                                    encoding="utf-8")
        proc, payload = self.run_parser("whatsapp_parser.py", root)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(len(payload["messages"]), 2)
        self.assertEqual(payload["messages"][1]["timestamp"] - payload["messages"][0]["timestamp"], 60)


class InstagramParserTest(ParserTestCase):
    def test_dms_and_comments(self):
        root = self.tmpdir()
        thread = root / "messages" / "inbox" / "bob_1"
        thread.mkdir(parents=True)
        (thread / "message_1.json").write_text(json.dumps({
            "participants": [{"name": "Me"}, {"name": "bob"}],
            "title": "bob",
            "messages": [
                {"sender_name": "bob", "timestamp_ms": 1677664800000, "text": "are we on for saturday"},
                {"sender_name": "Me", "timestamp_ms": 1677664860000, "text": "yes noon works"},
            ],
        }, ensure_ascii=False), encoding="utf-8")
        comments = root / "comments"
        comments.mkdir()
        (comments / "post1.json").write_text(json.dumps([
            {"owner": {"username": "carl"}, "text": "great work",
             "timestamp": "2023-03-02T08:00:00Z"},
        ], ensure_ascii=False), encoding="utf-8")

        proc, payload = self.run_parser(
            "instagram_parser.py", root, ["--self-name", "Me"])
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(payload["source"]["platform"], "instagram")
        self.assertEqual(len(payload["messages"]), 3)
        # epoch milliseconds -> seconds
        self.assertEqual(payload["messages"][0]["timestamp"], 1677664800)
        self.assertTrue(any("comment" in m["chat_name"] for m in payload["messages"]))


class EmailParserTest(ParserTestCase):
    # mbox requires "From " (space) as the per-message separator line
    SAMPLE = (
        "From alice@example.com Mon Jan  1 00:00:00 2023\n"
        "From: Alice <alice@example.com>\nSubject: Dinner plan\n"
        "Date: Mon, 01 Jan 2023 10:00:00 +0000\n\n"
        "Are you free Friday?\n\nOn Sun, 1 Jan 2023, someone wrote:\n> old thread content\n\n\n"
        "From me@example.com Tue Jan  2 00:00:00 2023\n"
        "From: Me <me@example.com>\nSubject: Re: Dinner plan\n"
        "Date: Tue, 02 Jan 2023 11:00:00 +0000\n\nYes, 7pm works.\n"
    )

    def test_mbox_parses_all_messages_and_trims_quotes(self):
        mbox = self.tmpdir() / "Archive.mbox"
        mbox.write_text(self.SAMPLE, encoding="utf-8")

        proc, payload = self.run_parser(
            "email_parser.py", mbox, ["--self-name", "me@example.com"])
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(payload["source"]["platform"], "email")
        self.assertEqual(len(payload["messages"]), 2)
        # quoted history must be trimmed, otherwise the whole chain floods the profile
        self.assertNotIn("old thread content", payload["messages"][0]["content"])
        self.assertEqual(payload["messages"][0]["content"], "Are you free Friday?")
        self.assertEqual(payload["messages"][1]["direction"], "outgoing")
        self.assertIn("Dinner plan", payload["messages"][0]["chat_name"])


class IMessageParserTest(ParserTestCase):
    """chat.db 是 macOS 上现成的数据库，不需要导出对话框——但要处理
    Apple epoch（纳秒/秒两种精度）、attributedBody 兜底、tapback 过滤。"""

    def _build_db(self):
        import sqlite3
        db = self.tmpdir() / "chat.db"
        conn = sqlite3.connect(str(db))
        conn.executescript(
            """
            CREATE TABLE handle (ROWID INTEGER PRIMARY KEY, id TEXT);
            CREATE TABLE chat (ROWID INTEGER PRIMARY KEY, chat_identifier TEXT, display_name TEXT);
            CREATE TABLE message (
                ROWID INTEGER PRIMARY KEY, text TEXT, attributedBody BLOB,
                handle_id INTEGER, date INTEGER, is_from_me INTEGER,
                associated_message_type INTEGER
            );
            CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER);
            CREATE TABLE attachment (ROWID INTEGER PRIMARY KEY, filename TEXT);
            CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER);
            """
        )
        conn.execute("INSERT INTO handle (ROWID, id) VALUES (1, '+15551234567')")
        conn.execute("INSERT INTO chat (ROWID, chat_identifier, display_name) "
                     "VALUES (1, '+15551234567', 'Mom')")
        # Apple epoch: 2023-03-01T10:00:00Z = 699_357_600 s after 2001-01-01
        base_ns = 699357600 * 1_000_000_000
        conn.execute("INSERT INTO message (ROWID, text, handle_id, date, is_from_me, "
                     "associated_message_type) VALUES (1, 'did you eat', 1, ?, 0, 0)",
                     (base_ns,))
        # outgoing, no handle, second precision (older macOS)
        conn.execute("INSERT INTO message (ROWID, text, handle_id, date, is_from_me, "
                     "associated_message_type) VALUES (2, 'yes mom', NULL, ?, 1, 0)",
                     (699357660,))
        # attributedBody only (modern macOS sometimes NULLs text)
        conn.execute("INSERT INTO message (ROWID, text, attributedBody, handle_id, date, "
                     "is_from_me, associated_message_type) VALUES (3, NULL, ?, 1, ?, 0, 0)",
                     (b"\x04\x0bstreamtyped\x81\xe8\x03NSString\x01raw content here\x86", base_ns + 120_000_000_000))
        # tapback reaction — must be filtered out
        conn.execute("INSERT INTO message (ROWID, text, handle_id, date, is_from_me, "
                     "associated_message_type) VALUES (4, 'Loved \"did you eat\"', 1, ?, 0, 2000)",
                     (base_ns + 180_000_000_000,))
        # attachment-only message
        conn.execute("INSERT INTO message (ROWID, text, handle_id, date, is_from_me, "
                     "associated_message_type) VALUES (5, ?, 1, ?, 0, 0)",
                     ("\ufffc", base_ns + 240_000_000_000))
        conn.execute("INSERT INTO attachment (ROWID, filename) "
                     "VALUES (1, '/Users/x/Library/Messages/Attachments/photo.jpg')")
        conn.execute("INSERT INTO message_attachment_join (message_id, attachment_id) VALUES (5, 1)")
        for mid in (1, 2, 3, 4, 5):
            conn.execute("INSERT INTO chat_message_join (chat_id, message_id) VALUES (1, ?)", (mid,))
        conn.commit()
        conn.close()
        return db

    def test_parses_chat_db(self):
        db = self._build_db()
        proc, payload = self.run_parser(
            "imessage_parser.py", db, ["--self-name", "me@icloud.com"])
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(payload["source"]["platform"], "imessage")
        contents = [m["content"] for m in payload["messages"]]
        self.assertIn("did you eat", contents)
        self.assertIn("yes mom", contents)
        # attributedBody fallback recovered the body
        self.assertTrue(any("raw content here" in c for c in contents),
                        f"attributedBody not recovered: {contents}")
        # tapback filtered
        self.assertFalse(any(c.startswith("Loved") for c in contents))
        # attachment placeholder survived (\ufffc -> attachment)
        self.assertTrue(any("photo.jpg" in c for c in contents))

    def test_apple_epoch_and_direction(self):
        db = self._build_db()
        proc, payload = self.run_parser(
            "imessage_parser.py", db, ["--self-name", "me@icloud.com"])
        self.assertEqual(proc.returncode, 0, proc.stderr)
        first = payload["messages"][0]
        # 2023-03-01T10:00:00Z
        self.assertEqual(first["timestamp"], 1677664800)
        self.assertEqual(first["direction"], "incoming")
        self.assertEqual(first["chat_name"], "Mom")
        outgoing = [m for m in payload["messages"] if m["content"] == "yes mom"]
        self.assertEqual(outgoing[0]["direction"], "outgoing")
        self.assertEqual(outgoing[0]["sender_name"], "me@icloud.com")


class ParserToWriterContractTest(ParserTestCase):
    """The whole point of the unified contract: parser output feeds the writer."""

    def test_discord_output_generates_a_relic(self):
        sample = self.tmpdir() / "general.json"
        sample.write_text(json.dumps({
            "guild": {"id": "1", "name": "Studio"},
            "channel": {"id": "2", "name": "general"},
            "messages": [
                {"type": "Default", "timestamp": "2023-03-01T10:00:00.000+00:00",
                 "content": "Morning, standup in five", "author": {"id": "u2", "name": "bob"}},
                {"type": "Default", "timestamp": "2023-03-01T10:01:00.000+00:00",
                 "content": "on my way", "author": {"id": "u1", "name": "alice"}},
            ],
        }, ensure_ascii=False), encoding="utf-8")
        data = self.tmpdir() / "d.json"
        subprocess.run([sys.executable, str(SCRIPTS / "discord_parser.py"),
                        "--input", str(sample), "--output", str(data)],
                       check=True, capture_output=True)

        out_dir = self.tmpdir() / "out"
        proc = subprocess.run(
            [sys.executable, str(WRITER), "--data", str(data), "--template", "human",
             "--slug", "contract-test", "--name", "Bob", "--output-dir", str(out_dir)],
            capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        relic = out_dir / "contract-test"
        for name in ("SKILL.md", "personality.md", "interaction.md", "memory.md", "manifest.json"):
            self.assertTrue((relic / name).exists(), f"{name} missing from generated Relic")


if __name__ == "__main__":
    unittest.main()
