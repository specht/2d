# ruby test/client_errors_test.rb – the server side of the Fehlerberichte
# (src/ruby/client_errors.rb); the rest of the tests run with node --test.
require "minitest/autorun"
require "tmpdir"
require_relative "../src/ruby/client_errors"

class ClientErrorsTest < Minitest::Test
    def test_entry_keeps_known_keys_and_cuts_strings
        time = Time.utc(2026, 10, 12, 8, 30)
        entry = ClientErrors.entry({
            "message" => "x" * 5000, "line" => 12, "stack" => "s" * 9000, "evil" => "dropped",
            "breadcrumbs" => (1..60).map { |i| "click #{i}" } + [{ "kind" => "key" }],
            "context" => { "pane" => "level", "password" => "nope", "url" => "/#level" },
        }, time)
        assert_equal "2026-10-12T08:30:00Z", entry["time"]
        assert_equal 2000, entry["message"].size
        assert_equal 6000, entry["stack"].size
        assert_equal 12, entry["line"]
        refute entry.include?("evil")
        assert_equal 40, entry["breadcrumbs"].size
        assert_equal '{"kind":"key"}', entry["breadcrumbs"].last
        assert_equal({ "pane" => "level", "url" => "/#level" }, entry["context"])
        assert_equal({ "time" => "2026-10-12T08:30:00Z" }, ClientErrors.entry("not a hash", time))
    end

    def test_append_writes_one_line_per_report_per_day
        Dir.mktmpdir do |dir|
            time = Time.utc(2026, 10, 12, 8, 30)
            ClientErrors.append(File.join(dir, "client-errors"), { "message" => "a" }, time)
            ClientErrors.append(File.join(dir, "client-errors"), { "message" => "b" }, time)
            lines = File.readlines(File.join(dir, "client-errors", "2026-10-12.jsonl"))
            assert_equal %w(a b), lines.map { |line| JSON.parse(line)["message"] }
        end
    end

    def test_limiter_allows_a_few_reports_per_minute_and_client
        limiter = ClientErrors::Limiter.new(3)
        assert_equal [true, true, true, false], (1..4).map { limiter.allow?("a", 1000) }
        assert limiter.allow?("b", 1000)
        assert limiter.allow?("a", 1060)
    end

    def test_groups_put_the_same_bug_together_and_resolved_ones_away
        a = { "time" => "2026-10-12T08:00:00Z", "message" => "boom", "source" => "https://x.de/canvas.js?abc", "line" => 3 }
        b = a.merge("time" => "2026-10-12T09:00:00Z", "source" => "https://x.de/canvas.js?def")
        c = { "time" => "2026-10-12T08:30:00Z", "message" => "other", "source" => "/level_editor.js", "line" => 9 }
        groups = ClientErrors.groups([a, c, b])
        assert_equal [2, 1], groups.map { |g| g["reports"].size }
        id = groups.first["id"]
        assert_equal 6, id.size
        assert_equal "2026-10-12T09:00:00Z", groups.first["last"]
        # fixed after the last report: hidden; fixed before it: back, marked
        assert_equal 1, ClientErrors.groups([a, c, b], { id => "2026-10-12T10:00:00Z" }).size
        again = ClientErrors.groups([a, c, b], { id => "2026-10-12T08:30:00Z" })
        assert again.find { |g| g["id"] == id }["again"]
    end

    # The reports of October 5th 2026: one bug in Object.get (the Beute picker)
    # came as an uncaught error and as a rejected promise, in three versions
    # with two line numbers, and made three groups.
    DROP_ERROR = <<~STACK
        TypeError: Cannot read properties of undefined (reading 'drop')
            at Object.get (https://2d.hackschule.de/game.js?v9dz9cy1m13u:1243:40)
            at SpriteSelectWidget.refresh (https://2d.hackschule.de/widgets.js?v9dz9cy1m13u:1090:34)
            at Game.refresh_sprite_reference_pickers (https://2d.hackschule.de/game.js?v9dz9cy1m13u:943:34)
            at Object.onclick [as old_onclick] (https://2d.hackschule.de/game.js?v9dz9cy1m13u:410:22)
            at HTMLDivElement.dispatch (https://2d.hackschule.de/jquery-3.6.0.min.js:2:43064)
    STACK
    DROP_PROMISE = <<~STACK
        TypeError: Cannot read properties of undefined (reading 'drop')
            at Object.get (https://2d.hackschule.de/game.js?2dhh7m8y04pc:1244:40)
            at SpriteSelectWidget.refresh (https://2d.hackschule.de/widgets.js?2dhh7m8y04pc:1168:34)
            at Game.refresh_frames_on_screen (https://2d.hackschule.de/game.js?2dhh7m8y04pc:777:34)
            at https://2d.hackschule.de/canvas.js?2dhh7m8y04pc:1088:27
    STACK

    def drop_reports
        browser = { "user_agent" => "Chrome", "screen" => "1536×695" }
        [
            { "time" => "2026-10-05T04:18:55Z", "kind" => "error", "studio_version" => "v9dz9cy1m13u",
              "message" => "Uncaught TypeError: Cannot read properties of undefined (reading 'drop')",
              "source" => "https://2d.hackschule.de/game.js?v9dz9cy1m13u", "line" => 1243, "stack" => DROP_ERROR,
              "context" => browser.merge("user_agent" => "Linux") },
            { "time" => "2026-10-05T15:23:03Z", "kind" => "error", "studio_version" => "2dhh7m8y04pc",
              "message" => "Uncaught TypeError: Cannot read properties of undefined (reading 'drop')",
              "source" => "https://2d.hackschule.de/game.js?2dhh7m8y04pc", "line" => 1244,
              "stack" => DROP_ERROR.gsub("v9dz9cy1m13u", "2dhh7m8y04pc").sub(":1243:", ":1244:"), "context" => browser },
            { "time" => "2026-10-05T15:23:03Z", "kind" => "promise", "studio_version" => "2dhh7m8y04pc",
              "message" => "Cannot read properties of undefined (reading 'drop')", "stack" => DROP_PROMISE, "context" => browser },
        ]
    end

    def test_stack_frames_of_the_studio_only
        frames = ClientErrors.app_frames(DROP_ERROR)
        assert_equal %w(Object.get SpriteSelectWidget.refresh Game.refresh_sprite_reference_pickers Object.onclick),
            frames.map { |f| f[:function] }
        assert_equal ["game.js", 1243], [frames[0][:file], frames[0][:line]]
        assert_equal "(anonym)", ClientErrors.app_frames(DROP_PROMISE).last[:function]
        firefox = "get@https://2d.hackschule.de/game.js?x:1243:40\n@https://2d.hackschule.de/canvas.js?x:9:1\n"
        assert_equal [["get", "game.js"], ["(anonym)", "canvas.js"]], ClientErrors.app_frames(firefox).map { |f| [f[:function], f[:file]] }
        assert_equal [], ClientErrors.app_frames("at chrome-extension://abc/x.js:1:2")
        assert_equal [], ClientErrors.app_frames(nil)
    end

    def test_one_bug_is_one_group_across_versions_and_kinds
        groups = ClientErrors.groups(drop_reports)
        assert_equal 1, groups.size
        assert_equal 3, groups.first["reports"].size
        assert_equal "Cannot read properties of undefined (reading 'drop')",
            ClientErrors.normalized_message("Uncaught TypeError: Cannot read properties of undefined (reading 'drop')")
        # another way into the same message is another group
        other = drop_reports.first.merge("stack" => DROP_ERROR.sub("Object.get", "LevelEditor.render"))
        assert_equal 2, ClientErrors.groups(drop_reports + [other]).size
    end

    def test_codes_resolved_before_still_count
        legacy_id = ClientErrors.group_id(ClientErrors.legacy_group_key(drop_reports[1]))
        groups = ClientErrors.groups(drop_reports, { legacy_id => "2026-10-05T20:00:00Z" })
        assert_equal [], groups
        again = ClientErrors.groups(drop_reports, { legacy_id => "2026-10-05T10:00:00Z" })
        assert again.first["again"]
        assert_includes again.first["legacy_ids"], legacy_id
    end

    def test_reports_of_one_moment_on_one_page_are_related
        page = { "page" => "p1", "user_agent" => "Chrome", "screen" => "1836×922" }
        resize = { "time" => "2026-10-05T16:02:22Z", "message" => "Uncaught TypeError: x (reading 'layers')", "context" => page,
                   "stack" => "TypeError: x\n    at LevelEditor.ui_to_world (https://h.de/level_editor.js?a:4434:61)\n" }
        leave = resize.merge("stack" => "TypeError: x\n    at LevelEditor.render (https://h.de/level_editor.js?a:4488:61)\n")
        later = resize.merge("time" => "2026-10-05T16:30:00Z", "message" => "later")
        elsewhere = leave.merge("context" => page.merge("page" => "p2"), "message" => "elsewhere")
        id = ->(report) { ClientErrors.group_id(ClientErrors.group_key(report)) }
        related = ClientErrors.groups([resize, leave, later, elsewhere]).to_h { |g| [g["id"], g["related"]] }
        assert_equal 4, related.size
        assert_equal [id[leave]], related[id[resize]]
        assert_equal [id[resize]], related[id[leave]]
        assert_equal [], related[id[later]]       # half an hour later
        assert_equal [], related[id[elsewhere]]   # another page at the same moment
        # older reports have no page: the same browser and window count
        old = [resize, leave].map { |r| r.merge("context" => page.reject { |k, _| k == "page" }) }
        assert ClientErrors.groups(old).all? { |g| g["related"].size == 1 }
    end

    def test_clear_deletes_every_report_but_remembers_what_was_fixed
        Dir.mktmpdir do |dir|
            %w(2026-10-01 2026-10-12).each { |day| File.write(File.join(dir, "#{day}.jsonl"), "{}\n") }
            File.write(File.join(dir, "resolved.json"), '{"abc123":"2026-10-01T00:00:00Z"}')
            assert_equal 2, ClientErrors.clear(dir)
            assert_equal [], ClientErrors.files(dir)
            assert_equal({ "abc123" => "2026-10-01T00:00:00Z" }, ClientErrors.read_resolved(dir))
        end
    end

    def test_a_reports_game_as_a_file_the_studio_loads
        Dir.mktmpdir do |gen|
            FileUtils.mkpath([File.join(gen, "games"), File.join(gen, "png")])
            File.binwrite(File.join(gen, "png", "f1.png"), "\x89PNG".b)
            game = { "sprites" => [{ "states" => [{ "frames" => [{ "tag" => "f1" }, { "tag" => "gone" }] }] }], "levels" => [] }
            File.write(File.join(gen, "games", "abc1234.json"), game.to_json)
            full = JSON.parse(ClientErrors.game_json("abc1234", gen))
            frames = full["sprites"][0]["states"][0]["frames"]
            assert_equal "data:image/png;base64,iVBORw==", frames[0]["src"]
            refute frames[1].include?("src")
            assert_equal "abc1234", full["parent"]
            refute JSON.parse(ClientErrors.game_json("abc1234", gen, pictures: false))["sprites"][0]["states"][0]["frames"][0].include?("src")
            assert_raises(ArgumentError) { ClientErrors.game_json("../etc", gen) }
        end
    end

    def test_a_reports_game_is_kept_with_the_reports
        Dir.mktmpdir do |root|
            gen, dir = File.join(root, "gen"), File.join(root, "client-errors")
            FileUtils.mkpath([File.join(gen, "games"), ClientErrors.games_dir(dir)])
            game = { "sprites" => [], "levels" => [], "properties" => { "title" => "Kopie" } }
            File.write(File.join(ClientErrors.games_dir(dir), "new1234.json"), game.to_json)
            # a report from before: its game among the game files
            File.write(File.join(gen, "games", "old1234.json"), game.merge("properties" => { "title" => "Alt" }).to_json)
            assert_equal "Kopie", JSON.parse(ClientErrors.game_json("new1234", gen, dir: dir))["properties"]["title"]
            assert_equal "Alt", JSON.parse(ClientErrors.game_json("old1234", gen, dir: dir))["properties"]["title"]
            assert_nil ClientErrors.game_path("gone123", gen, dir: dir)
            assert_raises(ArgumentError) { ClientErrors.game_json("gone123", gen, dir: dir) }

            File.write(File.join(dir, "2026-10-12.jsonl"), "{}\n")
            now = File.mtime(File.join(ClientErrors.games_dir(dir), "new1234.json"))
            assert_equal [], ClientErrors.old_games(dir, 30, now)
            assert_equal ["new1234.json"], ClientErrors.old_games(dir, 30, now + 31 * 24 * 3600).map { |p| File.basename(p) }
            assert_equal 1, ClientErrors.clear(dir)
            assert_equal [], ClientErrors.game_files(dir)
            assert File.exist?(File.join(gen, "games", "old1234.json")), "a saved game is never a report's to delete"
        end
    end

    def test_the_dashboard_lists_open_groups_with_the_text_of_show
        Dir.mktmpdir do |dir|
            stack = "TypeError: x\n    at Canvas.attachSprite (https://2d.hackschule.de/canvas.js?v1:1809:33)"
            first = { "message" => "Uncaught TypeError: x", "stack" => stack, "context" => { "pane" => "sprites", "page" => "a" },
                      "breadcrumbs" => ["1.0s sprites click canvas"], "game_tag" => "abcdefg" }
            later = { "message" => "Uncaught TypeError: y", "stack" => "TypeError: y\n    at Character.try_move_y (https://2d.hackschule.de/app.js?v1:791:5)",
                      "context" => { "pane" => "play", "page" => "b" }, "details" => { "im_spiel" => true } }
            t1 = Time.now.utc - 60
            t2 = Time.now.utc - 30
            ClientErrors.append(dir, ClientErrors.entry(first, t1), t1)
            ClientErrors.append(dir, ClientErrors.entry(later, t2), t2)
            ClientErrors.append(dir, ClientErrors.entry(first, t2), t2)
            list = ClientErrors.dashboard(dir)
            # the one that happened last first, each once with its count
            assert_equal [2, 1], list.map { |g| g["count"] }
            assert_equal "Uncaught TypeError: x", list.first["message"]
            assert_equal true, list.last["in_game"]
            group = ClientErrors.groups(ClientErrors.read(ClientErrors.files(dir))).find { |g| g["id"] == list.first["id"] }
            assert_equal ClientErrors.show_lines(group).join("\n"), list.first["text"]
            assert_includes list.first["text"], "Spiele zum Nachstellen: /?abcdefg"
            assert_includes list.first["text"], "  · 1.0s sprites click canvas"
            refute_includes list.first["text"], "\e["
            # resolved ones stay away
            ClientErrors.write_resolved(dir, { list.last["id"] => Time.now.utc.strftime("%Y-%m-%dT%H:%M:%SZ") })
            assert_equal [list.first["id"]], ClientErrors.dashboard(dir).map { |g| g["id"] }
        end
    end

    def test_day_files_for_listing_and_pruning
        Dir.mktmpdir do |dir|
            %w(2026-10-01 2026-10-10 2026-10-12).each { |day| File.write(File.join(dir, "#{day}.jsonl"), "") }
            File.write(File.join(dir, "resolved.json"), "{}")
            today = Date.new(2026, 10, 12)
            assert_equal ["2026-10-12"], ClientErrors.files(dir, 1, today).map { |p| File.basename(p, ".jsonl") }
            assert_equal %w(2026-10-10 2026-10-12), ClientErrors.files(dir, 3, today).map { |p| File.basename(p, ".jsonl") }
            assert_equal 3, ClientErrors.files(dir).size
            assert_equal ["2026-10-01"], ClientErrors.old_files(dir, 5, today).map { |p| File.basename(p, ".jsonl") }
        end
    end
end

