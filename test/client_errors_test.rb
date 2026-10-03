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

