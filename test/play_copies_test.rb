# ruby test/play_copies_test.rb – the copies Spielen and Level testen play
# (src/ruby/play_copies.rb); the endpoints themselves are in main.rb.
require "minitest/autorun"
require "tmpdir"
require "json"
require_relative "../src/ruby/play_copies"

class PlayCopiesTest < Minitest::Test
    def write_copy(dir, tag, time)
        FileUtils.mkpath([PlayCopies.games_dir(dir), PlayCopies.sheets_dir(dir)])
        [PlayCopies.game_path(dir, tag), PlayCopies.sheets_path(dir, tag)].each do |path|
            File.write(path, { "tag" => tag }.to_json)
            File.utime(time, time, path)
        end
    end

    def test_a_copy_is_handed_out_only_by_a_valid_tag
        Dir.mktmpdir do |dir|
            write_copy(dir, "abc1234", Time.now)
            assert_equal({ "tag" => "abc1234" }, JSON.parse(PlayCopies.read(dir, "abc1234")))
            assert_equal({ "tag" => "abc1234" }, JSON.parse(PlayCopies.read(dir, "abc1234", :sheets)))
            assert_nil PlayCopies.read(dir, "zzz9999")
            assert_nil PlayCopies.read(dir, "../../gen/games/abc1234")
            assert_nil PlayCopies.read(dir, "abc1234.json")
            assert_nil PlayCopies.game_path(dir, "ABC1234")
        end
    end

    def test_copies_not_played_for_a_week_are_deleted
        Dir.mktmpdir do |dir|
            now = Time.utc(2026, 10, 12, 8, 0)
            write_copy(dir, "old0001", now - 8 * 24 * 3600)
            write_copy(dir, "new0001", now - 6 * 24 * 3600)
            # played again yesterday: kept although it was made long ago
            write_copy(dir, "again01", now - 30 * 24 * 3600)
            PlayCopies.touch(dir, "again01", now - 24 * 3600)
            assert_equal ["old0001"], PlayCopies.prune(dir, now)
            assert_nil PlayCopies.read(dir, "old0001")
            refute File.exist?(PlayCopies.sheets_path(dir, "old0001"))
            assert PlayCopies.read(dir, "new0001")
            assert PlayCopies.read(dir, "again01", :sheets)
            assert_equal [], PlayCopies.prune(dir, now)
        end
    end

    def test_nothing_to_prune_without_a_directory
        Dir.mktmpdir do |dir|
            assert_equal [], PlayCopies.prune(File.join(dir, "play"))
            PlayCopies.touch(File.join(dir, "play"), "abc1234")
        end
    end
end
